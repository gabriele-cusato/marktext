import equal from 'deep-equal'
import bus from '../bus'
import { hasKeys, getUniqueId, deepClone, isMarkdownPath, adjustTrailingNewlines } from '../util'
import { clearUnified } from './unifiedHistory'
import listToTree from '../util/listToTree'
import {
  createDocumentState,
  getOptionsFromState,
  getSingleFileState,
  getBlankFileState
} from './help'
import notice from '../services/notification'
import {
  FileEncodingCommand,
  LineEndingCommand,
  QuickOpenCommand,
  TrailingNewlineCommand
} from '../commands'
import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import { usePreferencesStore } from './preferences'
import { useProjectStore } from './project'
import { useLayoutStore } from './layout'
import { useMainStore } from '.'
import { i18n } from '../i18n'

const autoSaveTimers = new Map()
// H2 — stato sessione (module-scope, non reattivo): owner = solo questa finestra fa backup/close silenzioso;
// timer del backup periodico; ultima contentVersion salvata (gate: niente scrittura se nulla è cambiato).
let isSessionOwner = false
let sessionBackupTimer = null
let lastBackupVersion = -1
// Tracks the exact markdown payload we asked the main process to write.
// Used to update `originalMarkdown` after save so Light Touch doesn't drift.
//
// Race condition handling:
// - When save completes, we check if tab.markdown === pendingSavedMarkdown.get(id)
// - If they match: save was successful with no concurrent edits → mark as saved
// - If they differ: user edited during save → keep unsaved, but update baseline
// - If no entry exists: user canceled save dialog → keep unsaved
const pendingSavedMarkdown = new Map()

export const useEditorStore = defineStore('editor', {
  state: () => ({
    currentFile: {},
    tabs: [],
    // P-REV3: bump O(1) ad ogni content-change; il content-watcher della sidebar osserva questo
    // invece di concatenare tutti i tab.markdown ad ogni keystroke.
    contentVersion: 0,
    listToc: [], // Used for equal check and for searching for the correct github-slug to jump to
    toc: [],
    isSaving: false, // Tracks when a manual save is in progress
    // Testo attualmente selezionato nell'editor attivo (Muya o CodeMirror). Aggiornato dai
    // due editor; usato dai trigger Ctrl+F / Ctrl+Shift+F per cercare sulla selezione.
    currentSelection: ''
  }),

  actions: {
    /**
     * Copies the specified heading's github-slug to the clipboard.
     * @param {string} id The heading-id to copy.
     */
    copyGithubSlug(key) {
      const item = this.listToc.find((i) => i.slug === key)

      if (item) {
        window.electron.clipboard.writeText(`#${item.githubSlug}`)
        notice.notify({
          title: i18n.global.t('store.editor.anchorLinkCopied'),
          type: 'primary',
          time: 2000,
          showConfirm: false
        })
      } else {
        console.warn(i18n.global.t('store.editor.tocItemNotFound', { key }))
      }
    },

    /**
     * Update scroll position for the currentFile
     */
    updateScrollPosition(scrollTop) {
      this.currentFile.scrollTop = scrollTop
    },

    /**
     * Push a tab specific notification on stack that never disappears.
     */
    pushTabNotification(data) {
      const defaultAction = () => {}
      const { tabId, msg } = data
      const action = data.action || defaultAction
      const showConfirm = data.showConfirm || false
      const style = data.style || 'info'
      // Whether only one notification should exist.
      const exclusiveType = data.exclusiveType || ''

      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) {
        console.error(i18n.global.t('store.editor.tabNotFound'))
        return
      }

      const { notifications } = tab

      // Remove the old notification if only one should exist.
      if (exclusiveType) {
        const index = notifications.findIndex((n) => n.exclusiveType === exclusiveType)
        if (index >= 0) {
          // Reorder current notification
          notifications.splice(index, 1)
        }
      }

      // Push new notification on stack.
      notifications.push({
        msg,
        showConfirm,
        style,
        exclusiveType,
        action
      })
    },

    loadChange(change) {
      const { tabs, currentFile } = this
      const { data, pathname } = change
      const {
        isMixedLineEndings,
        lineEnding,
        adjustLineEndingOnSave,
        trimTrailingNewline,
        encoding,
        markdown,
        filename
      } = data
      const options = { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline }
      // Create a new document and update few entires later.
      const newFileState = getSingleFileState({ markdown, filename, pathname, options })

      const tab = tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
      if (!tab) {
        // The tab may be closed in the meanwhile.
        console.error('loadChange: Cannot find tab in tab list.')
        notice.notify({
          title: i18n.global.t('store.editor.errorLoadingTabTitle'),
          message: i18n.global.t('store.editor.errorLoadingTabMessage'),
          type: 'error',
          time: 20000,
          showConfirm: false
        })
        return
      }

      // Backup few entries that we need to restore later.
      const oldId = tab.id
      const oldNotifications = tab.notifications
      let oldHistory = null
      if (tab.history.index >= 0 && tab.history.stack.length >= 1) {
        // Allow to restore the old document.
        oldHistory = {
          stack: [tab.history.stack[tab.history.index]],
          index: 0
        }

        // Free reference from array
        tab.history.index--
        tab.history.stack.pop()
      }

      // Update file content and restore some entries.
      Object.assign(tab, newFileState)
      tab.id = oldId
      tab.notifications = oldNotifications
      if (oldHistory) {
        tab.history = oldHistory
      }

      // Reload da disco = baseline pulita: il contenuto è quello del file.
      tab.isSaved = true
      // justLoaded: finestra di assestamento (come apertura file, B1/B8). Muya/CM
      // normalizzano il contenuto ricaricato → senza questa finestra il content-change
      // risultante marcherebbe il tab dirty (bollino verde) subito dopo il reload.
      tab.justLoaded = Date.now()

      if (isMixedLineEndings) {
        this.pushTabNotification({
          tabId: tab.id,
          msg: i18n.global.t('store.editor.mixedLineEndingsNormalized', {
            name: filename,
            lineEnding: lineEnding.toUpperCase()
          }),
          showConfirm: false,
          style: 'info',
          exclusiveType: ''
        })
      }

      // Reload the editor if the tab is currently opened.
      if (pathname === currentFile.pathname) {
        // save current state first
        this.currentFile = tab
        const { id, cursor, history, scrollTop } = tab // Should not use blocks history as this is loaded from disk
        // H8 — azzera la pila unificata al reload da disco (Q2); source mode reseed avviene in
        // sourceCode.vue forceReload branch (serve anche per lastUndoSize reset); Muya seedUnified
        // avviene in editor.vue handleFileChange dopo setMarkdown.
        clearUnified(id)
        bus.emit('file-changed', {
          id,
          markdown,
          cursor,
          renderCursor: true,
          history,
          scrollTop,
          // forceReload: in source mode handleFileChange salta il setValue quando id===tabId
          // (caso re-emit commitTimer). Per il reload esterno serve forzare il caricamento in CM.
          forceReload: true
        })
      }
    },

    // Opzione A: l'utente ha rifiutato il reload (Annulla). Il file su disco è cambiato ma
    // teniamo la versione in editor. Spostiamo la baseline al contenuto NUOVO del disco:
    // così editor (vecchio) ≠ originalMarkdown (disco) → il bollino "non salvato" compare
    // e PERSISTE ai movimenti cursore/Ctrl+Z (il confronto contenuto-vs-baseline resta diverso),
    // finché l'utente non riallinea o salva (sovrascrivendo il disco). NON tocca editor né history.
    markDivergedFromDisk(change) {
      const { data, pathname } = change
      const tab = this.tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
      if (!tab) return
      tab.originalMarkdown = data.markdown
      tab.isSaved = false
    },

    FORMAT_LINK_CLICK({ data, dirname }) {
      // Check if the link starts with a #, that is a local anchor link.

      if (data.href.length > 0 && data.href[0] === '#') {
        const anchorSlug = data.href.substring(1)
        if (!anchorSlug) return

        // Find the block with the anchor slug from the TOC
        for (const item of this.listToc) {
          if (item.githubSlug === anchorSlug) {
            // Scroll to the corresponding element that matches this github-slug
            bus.emit('scroll-to-header', item.slug)
            return
          }
        }

        return
      }

      window.electron.ipcRenderer.send('mt::format-link-click', { data, dirname })
    },

    LISTEN_SCREEN_SHOT() {
      window.electron.ipcRenderer.on('mt::screenshot-captured', () => {
        bus.emit('screenshot-captured')
      })
    },

    // image path auto complement
    ASK_FOR_IMAGE_AUTO_PATH(src) {
      const { pathname } = this.currentFile
      if (pathname) {
        let rs
        const promise = new Promise((resolve) => {
          rs = resolve
        })
        const id = getUniqueId()
        window.electron.ipcRenderer.once(`mt::response-of-image-path-${id}`, (_, files) => {
          rs(files)
        })
        window.electron.ipcRenderer.send('mt::ask-for-image-auto-path', {
          pathname,
          src,
          id,
          currentFile: deepClone(this.currentFile)
        })
        return promise
      } else {
        return Promise.resolve([])
      }
    },

    SEARCH(value) {
      this.currentFile.searchMatches = JSON.parse(JSON.stringify(value)) // deep clone to trigger state changes
    },

    SHOW_IMAGE_DELETION_URL(deletionUrl) {
      notice
        .notify({
          title: i18n.global.t('store.editor.imageDeletionUrlTitle'),
          message: i18n.global.t('store.editor.imageDeletionUrlMessage', { url: deletionUrl }),
          showConfirm: true,
          time: 20000
        })
        .then(() => {
          window.electron.clipboard.writeText(deletionUrl)
        })
    },

    // We need to update line endings menu when changing tabs.
    UPDATE_LINE_ENDING_MENU() {
      const { lineEnding } = this.currentFile
      if (lineEnding) {
        const { windowId } = global.marktext.env
        window.electron.ipcRenderer.send('mt::update-line-ending-menu', windowId, lineEnding)
      }
    },

    // Helper to clear the saving spinner with minimum display time
    _clearSavingSpinner() {
      const MIN_SPINNER_TIME = 1000 // Minimum time to show spinner (1 second)
      const elapsed = Date.now() - (this._saveStartTime || 0)
      const remaining = Math.max(0, MIN_SPINNER_TIME - elapsed)

      setTimeout(() => {
        this.isSaving = false
      }, remaining)
    },

    FILE_SAVE() {
      // Flush CM content to store before reading: in source mode il commitTimer ha debounce 1s.
      // Se Ctrl+S arriva prima che scada, tab.markdown è stale → si salverebbe contenuto vecchio.
      // mitt è sincrono → il listener in sourceCode.vue chiama LISTEN_FOR_CONTENT_CHANGE prima
      // che la riga successiva legga this.currentFile.markdown.
      bus.emit('pre-save')
      const projectStore = useProjectStore()
      const preferencesStore = usePreferencesStore()
      const { id, filename, pathname, markdown, originalMarkdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)
      const { lightTouch } = preferencesStore
      if (id) {
        // Apply Light Touch mode: use original markdown if no semantic changes
        const markdownToSave = getMarkdownForSave(markdown, originalMarkdown, lightTouch)
        // Remember what we asked main to save so we can update baseline on success.
        // Only track saves that won't show a file dialog (i.e. already have a pathname).
        if (pathname) {
          pendingSavedMarkdown.set(id, markdownToSave)
        }

        // Show save spinner for manual saves
        // Record start time to ensure minimum display duration
        this._saveStartTime = Date.now()
        this.isSaving = true
        window.electron.ipcRenderer.send(
          'mt::response-file-save',
          id,
          filename,
          pathname,
          markdownToSave,
          deepClone(options),
          defaultPath
        )
      }
    },

    // need pass some data to main process when `save` menu item clicked
    LISTEN_FOR_SAVE() {
      window.electron.ipcRenderer.on('mt::editor-ask-file-save', () => {
        this.FILE_SAVE()
      })
      bus.on('mt::editor-ask-file-save', () => {
        this.FILE_SAVE()
      })
    },

    FILE_SAVE_AS() {
      bus.emit('pre-save')
      const projectStore = useProjectStore()
      const { id, filename, pathname, markdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)

      if (id) {
        // Registra cosa stiamo per scrivere: così il race-check in mt::set-pathname
        // aggiorna la baseline col contenuto realmente salvato, non con quello corrente
        // (che potrebbe includere modifiche fatte mentre il dialog Save As era aperto).
        pendingSavedMarkdown.set(id, markdown)
        // Show save spinner for manual saves
        this._saveStartTime = Date.now()
        this.isSaving = true
        window.electron.ipcRenderer.send(
          'mt::response-file-save-as',
          id,
          filename,
          pathname,
          markdown,
          deepClone(options),
          defaultPath
        )
      }
    },

    // need pass some data to main process when `save as` menu item clicked
    LISTEN_FOR_SAVE_AS() {
      window.electron.ipcRenderer.on('mt::editor-ask-file-save-as', () => {
        this.FILE_SAVE_AS()
      })
      bus.on('mt::editor-ask-file-save-as', () => {
        this.FILE_SAVE_AS()
      })
    },

    LISTEN_FOR_SET_PATHNAME() {
      window.electron.ipcRenderer.on('mt::set-pathname', (_, fileInfo) => {
        const { tabs } = this
        const { pathname, id } = fileInfo
        const tab = tabs.find((f) => f.id === id)
        if (!tab) {
          console.error('[ERROR] Cannot change file path from unknown tab.')
          return
        }

        // If a tab with the same file path already exists we need to close the tab.
        // The existing tab is overwritten by this tab.
        const existingTab = tabs.find(
          (t) => t.id !== id && window.fileUtils.isSamePathSync(t.pathname, pathname)
        )
        if (existingTab) {
          this.CLOSE_TAB(existingTab)
        }

        // SET_PATHNAME
        const { filename } = fileInfo
        if (id === this.currentFile.id && pathname) {
          window.DIRNAME = window.path.dirname(pathname)
        }
        if (tab) {
          const savedMarkdown = pendingSavedMarkdown.get(id)

          // Apply pathname and filename regardless
          Object.assign(tab, { filename, pathname })

          // Race condition check: Only mark as saved if current content
          // matches what was saved (no concurrent edits during save operation)
          if (savedMarkdown) {
            if (tab.markdown === savedMarkdown) {
              tab.isSaved = true
              tab.originalMarkdown = savedMarkdown
            } else if (normalizeBlock(tab.markdown) === normalizeBlock(savedMarkdown)) {
              // lightTouch: formattazione diversa, contenuto semantico identico
              tab.isSaved = true
              tab.originalMarkdown = tab.markdown
            } else {
              // Modifica concorrente durante il salvataggio
              tab.isSaved = false
              tab.originalMarkdown = savedMarkdown
            }
          } else {
            // Fallback: no pending record (shouldn't happen for set-pathname)
            // Mark as saved with current content as baseline
            tab.isSaved = true
            tab.originalMarkdown = tab.markdown
          }

          pendingSavedMarkdown.delete(id)

          // B13: dopo Save As, riapplica sourceCode mode in base alla nuova estensione
          if (tab.id === this.currentFile.id) {
            this._applySourceCodeForFile(tab)
          }
        }
        // Clear the saving spinner with minimum display time
        this._clearSavingSpinner()
      })

      window.electron.ipcRenderer.on('mt::tab-saved', (_, tabId, canceled) => {
        // Save As / save annullato dall'utente: nessuna scrittura su disco.
        // Scarta il record pending e lascia la tab nello stato in cui era (no falso "salvato").
        if (canceled) {
          pendingSavedMarkdown.delete(tabId)
          this._clearSavingSpinner()
          return
        }
        const tab = this.tabs.find((f) => f.id === tabId)
        if (tab) {
          const savedMarkdown = pendingSavedMarkdown.get(tabId)

          // Race condition check: Only mark as saved if:
          // 1. We have a record of what was saved (not a cancellation)
          // 2. Current content matches what we saved (no concurrent edits)
          if (savedMarkdown) {
            if (tab.markdown === savedMarkdown) {
              // Success: content in store matches what was saved
              tab.isSaved = true
              tab.originalMarkdown = savedMarkdown
            } else if (normalizeBlock(tab.markdown) === normalizeBlock(savedMarkdown)) {
              // lightTouch ha prodotto savedMarkdown con formattazione diversa da tab.markdown
              // (blank lines preservati, spazi, ecc.) ma il contenuto semantico è identico.
              // Usare tab.markdown come baseline evita false-dirty in N12 e LISTEN_FOR_CONTENT_CHANGE
              // (entrambi confrontano contro originalMarkdown usando il contenuto CM grezzo/normalizzato).
              tab.isSaved = true
              tab.originalMarkdown = tab.markdown
            } else {
              // Modifica concorrente durante il salvataggio — contenuto effettivamente cambiato
              tab.isSaved = false
              tab.originalMarkdown = savedMarkdown
            }
          } else {
            // No pending save record means user canceled save dialog
            // Keep current unsaved state
            tab.isSaved = false
          }

          pendingSavedMarkdown.delete(tabId)
        }
        // Clear the saving spinner with minimum display time
        this._clearSavingSpinner()
      })

      window.electron.ipcRenderer.on('mt::tab-save-failure', (_, tabId, msg) => {
        // Clear the saving spinner on failure
        this._clearSavingSpinner()

        const tab = this.tabs.find((t) => t.id === tabId)
        if (!tab) {
          notice.notify({
            title: i18n.global.t('dialog.saveFailure'),
            message: msg,
            type: 'error',
            time: 20000,
            showConfirm: false
          })
          return
        }

        tab.isSaved = false
        this.pushTabNotification({
          tabId,
          msg: i18n.global.t('store.editor.errorWhileSaving', { msg }),
          style: 'crit'
        })
      })
    },

    LISTEN_FOR_CLOSE() {
      const projectStore = useProjectStore()
      const preferencesStore = usePreferencesStore()
      window.electron.ipcRenderer.on('mt::ask-for-close', () => {
        // B-REV3: flush sincrono del contenuto source (commit debounced ~1s) prima di leggere
        // tab.markdown, altrimenti chiudendo entro 1s dall'ultima battuta si salva una versione vecchia.
        bus.emit('pre-save')

        // H2: chiusura silenziosa stile Notepad++ — solo la finestra owner con la feature attiva.
        // Scrive la sessione (incl. untitled e dirty) e chiude SENZA popup "salvare?".
        if (preferencesStore.sessionSnapshotEnabled && isSessionOwner) {
          // deepClone OBBLIGATORIO: COLLECT_SESSION contiene proxy reattivi Pinia (cursor/encoding) →
          // structured-clone IPC fallisce ("An object could not be cloned"). JSON-clone li appiattisce.
          window.electron.ipcRenderer.send('mt::session-save-and-close', deepClone(this.COLLECT_SESSION()))
          return
        }

        const { lightTouch } = preferencesStore
        const unsavedFiles = this.tabs
          .filter((file) => !file.isSaved)
          .map((file) => {
            const { id, filename, pathname, markdown, originalMarkdown } = file
            const options = getOptionsFromState(file)
            // Apply Light Touch mode: use original markdown if no semantic changes
            const markdownToSave = getMarkdownForSave(markdown, originalMarkdown, lightTouch)
            // Only track baseline updates for files that already exist on disk.
            if (id && pathname) {
              pendingSavedMarkdown.set(id, markdownToSave)
            }
            return {
              id,
              filename,
              pathname,
              markdown: markdownToSave,
              options,
              defaultPath: getRootFolderFromState(projectStore)
            }
          })

        if (unsavedFiles.length) {
          window.electron.ipcRenderer.send('mt::close-window-confirm', deepClone(unsavedFiles))
        } else {
          window.electron.ipcRenderer.send('mt::close-window')
        }
      })
    },

    LISTEN_FOR_SAVE_CLOSE() {
      window.electron.ipcRenderer.on('mt::force-close-tabs-by-id', (_, tabIdList) => {
        if (Array.isArray(tabIdList) && tabIdList.length) {
          this.CLOSE_TABS(tabIdList)
        }
      })
    },

    ASK_FOR_SAVE_ALL(closeTabs) {
      // B-REV3: flush sincrono (source debounced) prima di raccogliere tab.markdown.
      bus.emit('pre-save')
      const { tabs } = this
      const projectStore = useProjectStore()
      const preferencesStore = usePreferencesStore()
      const { lightTouch } = preferencesStore
      const unsavedFiles = tabs
        .filter((file) => !file.isSaved)
        .map((file) => {
          const { id, filename, pathname, markdown, originalMarkdown } = file
          const options = getOptionsFromState(file)
          // Apply Light Touch mode: use original markdown if no semantic changes
          const markdownToSave = getMarkdownForSave(markdown, originalMarkdown, lightTouch)
          // Only track baseline updates for files that already exist on disk.
          if (id && pathname) {
            pendingSavedMarkdown.set(id, markdownToSave)
          }
          return {
            id,
            filename,
            pathname,
            markdown: markdownToSave,
            options,
            defaultPath: getRootFolderFromState(projectStore)
          }
        })

      if (closeTabs) {
        if (unsavedFiles.length) {
          this.CLOSE_TABS(tabs.filter((f) => f.isSaved).map((f) => f.id))
          window.electron.ipcRenderer.send('mt::save-and-close-tabs', deepClone(unsavedFiles))
        } else {
          this.CLOSE_TABS(tabs.map((f) => f.id))
        }
      } else {
        window.electron.ipcRenderer.send('mt::save-tabs', deepClone(unsavedFiles))
      }
    },

    MOVE_FILE_TO() {
      const projectStore = useProjectStore()
      const { id, filename, pathname, markdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)
      if (!id) return
      if (!pathname) {
        // if current file is a newly created file, just save it!
        window.electron.ipcRenderer.send(
          'mt::response-file-save',
          id,
          filename,
          pathname,
          markdown,
          deepClone(options),
          defaultPath
        )
      } else {
        // if not, move to a new(maybe) folder
        window.electron.ipcRenderer.send('mt::response-file-move-to', { id, pathname })
      }
    },

    LISTEN_FOR_MOVE_TO() {
      window.electron.ipcRenderer.on('mt::editor-move-file', () => {
        this.MOVE_FILE_TO()
      })
      bus.on('mt::editor-move-file', () => {
        this.MOVE_FILE_TO()
      })
    },

    LISTEN_FOR_RENAME() {
      window.electron.ipcRenderer.on('mt::editor-rename-file', () => {
        this.RESPONSE_FOR_RENAME()
      })
      bus.on('mt::editor-rename-file', () => {
        this.RESPONSE_FOR_RENAME()
      })
    },

    RESPONSE_FOR_RENAME() {
      const projectStore = useProjectStore()
      const { id, filename, pathname, markdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)
      if (!id) return
      if (!pathname) {
        // if current file is a newly created file, just save it!
        window.electron.ipcRenderer.send(
          'mt::response-file-save',
          id,
          filename,
          pathname,
          markdown,
          deepClone(options),
          defaultPath
        )
      } else {
        bus.emit('rename')
      }
    },

    // ask for main process to rename this file to a new name `newFilename`
    RENAME(newFilename) {
      const { id, pathname, filename } = this.currentFile
      if (typeof filename === 'string' && filename !== newFilename) {
        const newPathname = window.path.join(window.path.dirname(pathname), newFilename)
        window.electron.ipcRenderer.send('mt::rename', {
          id,
          pathname,
          newPathname,
          currentFile: deepClone(this.currentFile)
        })
      }
    },

    UPDATE_CURRENT_FILE(currentFile) {
      const oldCurrentFile = this.currentFile
      if (!oldCurrentFile.id || oldCurrentFile.id !== currentFile.id) {
        // B6: imposta sourceCode mode PRIMA di emettere file-changed.
        // Altrimenti Muya riceve l'evento mentre sourceCode è ancora false e
        // tenta di renderizzare contenuto non-markdown → eccezione → crash UI.
        this._applySourceCodeForFile(currentFile)

        const { id, markdown, cursor, history, pathname, scrollTop, blocks } = currentFile
        window.DIRNAME = pathname ? window.path.dirname(pathname) : ''
        this.currentFile = currentFile
        // N8: nextTick garantisce che sourceCode.vue sia montato prima di file-changed.
        // Senza nextTick, l'evento arriva mentre il componente non è ancora nel DOM.
        nextTick(() => {
          bus.emit('file-changed', {
            id,
            markdown,
            cursor,
            renderCursor: true,
            history,
            scrollTop,
            blocks
          })

          // Se la tab appena attivata ha una modifica esterna rimandata (avvenuta mentre era
          // in background), mostra ora il dialog di reload. Ora è la currentFile → loadChange
          // ricarica davvero l'editor. Emesso dopo file-changed così l'editor è già montato.
          if (currentFile.pendingExternalChange) {
            const pending = currentFile.pendingExternalChange
            currentFile.pendingExternalChange = null
            bus.emit('file-changed-externally', {
              change: pending,
              filename: currentFile.filename,
              hasUnsavedChanges: !currentFile.isSaved
            })
          }
        })
      }

      if (!this.tabs.some((file) => file.id === currentFile.id)) {
        this.tabs.push(currentFile)
      }
      this.UPDATE_LINE_ENDING_MENU()
    },

    // B13: helper - imposta sourceCode mode in base all'estensione del file.
    // File .md/.markdown/.mdown/.mkd o senza estensione → WYSIWYG (Muya).
    // Tutti gli altri (.js, .txt, ecc.) → CodeMirror con line numbers.
    _applySourceCodeForFile(file) {
      if (!file) return
      const preferencesStore = usePreferencesStore()
      // isMarkdownPath gestisce sia untitled (no pathname → Muya) sia le estensioni markdown.
      const wantSource = !isMarkdownPath(file.pathname)
      if (preferencesStore.sourceCode !== wantSource) {
        preferencesStore.SET_MODE({ type: 'sourceCode', checked: wantSource })
      }
    },

    // This events are only used during window creation.
    LISTEN_FOR_BOOTSTRAP_WINDOW() {
      const preferencesStore = usePreferencesStore()
      const layoutStore = useLayoutStore()
      const projectStore = useProjectStore()
      const mainStore = useMainStore()

      // Delay load runtime commands and initialize commands.
      setTimeout(() => {
        bus.emit('cmd::register-command', new FileEncodingCommand(this))
        bus.emit(
          'cmd::register-command',
          new QuickOpenCommand({
            editor: this,
            preferences: preferencesStore,
            project: projectStore
          })
        )
        bus.emit('cmd::register-command', new LineEndingCommand(this))
        bus.emit('cmd::register-command', new TrailingNewlineCommand(this))

        setTimeout(() => {
          window.electron.ipcRenderer.send('mt::request-keybindings')
          bus.emit('cmd::sort-commands')
        }, 100)
      }, 400)

      window.electron.ipcRenderer.on('mt::bootstrap-editor', (_, config) => {
        const {
          addBlankTab,
          markdownList,
          lineEnding,
          sideBarVisibility,
          tabBarVisibility,
          sourceCodeModeEnabled,
          isRestore = false,
          isSessionOwner: owner = false
        } = config

        // H2: memorizza se questa finestra è l'owner della sessione (backup periodico + close silenzioso).
        isSessionOwner = !!owner

        window.electron.ipcRenderer.send('mt::window-initialized')
        mainStore.SET_INITIALIZED()
        preferencesStore.SET_USER_PREFERENCE({ endOfLine: lineEnding })
        layoutStore.SET_LAYOUT({
          rightColumn: 'files',
          showSideBar: !!sideBarVisibility,
          showTabBar: !!tabBarVisibility
        })
        layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
        preferencesStore.SET_MODE({
          type: 'sourceCode',
          checked: !!sourceCodeModeEnabled
        })

        if (isRestore) {
          // H2: finestra di ripristino → chiedi al main le tab della scorsa sessione (mt::restore-session).
          window.electron.ipcRenderer.send('mt::request-session-restore')
        } else if (addBlankTab) {
          this.NEW_UNTITLED_TAB({ selected: true })
        } else if (markdownList.length) {
          let isFirst = true
          for (const markdown of markdownList) {
            this.NEW_UNTITLED_TAB({ markdown, selected: isFirst })
            isFirst = false
          }
        }
      })
    },

    // Open a new tab, optionally with content.
    LISTEN_FOR_NEW_TAB() {
      window.electron.ipcRenderer.on(
        'mt::open-new-tab',
        (_, markdownDocument, options = {}, selected = true) => {
          if (markdownDocument) {
            // Create tab with content.
            this.NEW_TAB_WITH_CONTENT({ markdownDocument, options, selected })
          } else {
            // Fallback: create a blank tab and always select it
            this.NEW_UNTITLED_TAB({})
          }
        }
      )

      window.electron.ipcRenderer.on(
        'mt::new-untitled-tab',
        (_, selected = true, markdown = '') => {
          // Create a blank tab
          this.NEW_UNTITLED_TAB({ markdown, selected })
        }
      )
      bus.on('mt::new-untitled-tab', ({ selected = true, markdown = '' }) => {
        this.NEW_UNTITLED_TAB({ markdown, selected })
      })
    },

    // H2: raccoglie lo stato di TUTTE le tab per il backup di sessione
    // (ordine + quale attiva + pinnate + contenuto + opzioni encoding/eol).
    COLLECT_SESSION() {
      const activeId = this.currentFile && this.currentFile.id
      return {
        tabs: this.tabs.map((f) => ({
          id: f.id,
          pathname: f.pathname || '',
          filename: f.filename,
          markdown: f.markdown,
          isSaved: f.isSaved,
          isActive: f.id === activeId,
          pinned: !!f.pinned,
          cursor: f.cursor || null,
          encoding: f.encoding,
          lineEnding: f.lineEnding,
          adjustLineEndingOnSave: f.adjustLineEndingOnSave,
          trimTrailingNewline: f.trimTrailingNewline
        }))
      }
    },

    // H2: ricostruisce le tab dalla sessione GIÀ risolta dal main (mt::restore-session).
    RESTORE_SESSION(result) {
      if (!result || !Array.isArray(result.tabs) || !result.tabs.length) {
        this.NEW_UNTITLED_TAB({ selected: true })
        return
      }

      // Pulizia difensiva (la finestra di restore non ha blank tab, ma evitiamo residui).
      this.tabs.splice(0, this.tabs.length)
      this.currentFile = {}

      let activeState = null
      for (const t of result.tabs) {
        const docState = createDocumentState({
          markdown: t.markdown,
          filename: t.filename,
          pathname: t.pathname || '',
          encoding: t.encoding,
          lineEnding: t.lineEnding,
          adjustLineEndingOnSave: t.adjustLineEndingOnSave,
          trimTrailingNewline: t.trimTrailingNewline,
          cursor: t.cursor || null
        })
        docState.pinned = !!t.pinned
        docState.isSaved = !!t.isSaved
        // Baseline: per i file da disco è il contenuto su disco (bollino corretto); untitled resta null.
        if (t.originalMarkdown !== undefined) {
          docState.originalMarkdown = t.originalMarkdown
        }
        // justLoaded (finestra settle 400ms) SOLO per i file da disco puliti → assorbe la normalizzazione
        // iniziale di Muya senza falso-dirty. Tab dirty/untitled: 0 → restano dirty correttamente (B8/NB12).
        docState.justLoaded = docState.pathname && docState.isSaved ? Date.now() : 0
        this.tabs.push(docState)
        if (t.isActive && !activeState) activeState = docState
      }

      // Riordina pinnate-prima (invariante H4), preservando l'ordine relativo.
      const pinned = this.tabs.filter((t) => t.pinned)
      const unpinned = this.tabs.filter((t) => !t.pinned)
      this.tabs.splice(0, this.tabs.length, ...pinned, ...unpinned)

      const active = activeState || this.tabs[0]
      this.SHOW_TAB_VIEW(true)
      this.UPDATE_CURRENT_FILE(active)
      bus.emit('file-loaded', { id: active.id, markdown: active.markdown, cursor: active.cursor })
    },

    // H2: registra il restore + arma il backup periodico (solo finestra owner). Da app.vue onMounted.
    LISTEN_FOR_SESSION() {
      const preferencesStore = usePreferencesStore()

      window.electron.ipcRenderer.on('mt::restore-session', (_, result) => {
        this.RESTORE_SESSION(result)
      })

      // Backup periodico stile Notepad++: scrive solo se il contenuto è cambiato dall'ultimo flush
      // (gate su contentVersion → niente I/O inutile). L'intervallo (secondi) è una preferenza.
      const tick = () => {
        const seconds = Math.max(1, Number(preferencesStore.sessionBackupInterval) || 7)
        if (
          preferencesStore.sessionSnapshotEnabled &&
          isSessionOwner &&
          this.tabs.length &&
          this.contentVersion !== lastBackupVersion
        ) {
          lastBackupVersion = this.contentVersion
          bus.emit('pre-save') // flush sincrono del source debounced prima di leggere tab.markdown
          // deepClone: vedi nota in LISTEN_FOR_CLOSE (proxy reattivi non clonabili via IPC).
          window.electron.ipcRenderer.send('mt::session-save', deepClone(this.COLLECT_SESSION()))
        }
        sessionBackupTimer = setTimeout(tick, seconds * 1000)
      }
      if (sessionBackupTimer) clearTimeout(sessionBackupTimer)
      sessionBackupTimer = setTimeout(tick, 1000)
    },

    CLOSE_TAB(file = null) {
      if (!file) {
        file = this.currentFile
      }
      if (!hasKeys(file)) return

      if (file.isSaved) {
        this.FORCE_CLOSE_TAB(file)
      } else {
        this.CLOSE_UNSAVED_TAB(file)
      }
    },

    LISTEN_FOR_CLOSE_TAB() {
      window.electron.ipcRenderer.on('mt::editor-close-tab', () => {
        this.CLOSE_TAB()
      })
      bus.on('mt::editor-close-tab', () => {
        this.CLOSE_TAB()
      })
    },

    LISTEN_FOR_TAB_CYCLE() {
      window.electron.ipcRenderer.on('mt::tabs-cycle-left', () => {
        this.CYCLE_TABS(false)
      })
      window.electron.ipcRenderer.on('mt::tabs-cycle-right', () => {
        this.CYCLE_TABS(true)
      })
      bus.on('mt::tabs-cycle-left', () => {
        this.CYCLE_TABS(false)
      })
      bus.on('mt::tabs-cycle-right', () => {
        this.CYCLE_TABS(true)
      })
    },

    LISTEN_FOR_SWITCH_TABS() {
      window.electron.ipcRenderer.on('mt::switch-tab-by-index', (_, index) => {
        this.SWITCH_TAB_BY_INDEX(index)
      })
    },

    FORCE_CLOSE_TAB(file) {
      const { tabs, currentFile } = this
      const index = tabs.findIndex((t) => t.id === file.id)
      if (index > -1) {
        tabs.splice(index, 1)
      }

      if (file.id && autoSaveTimers.has(file.id)) {
        const timer = autoSaveTimers.get(file.id)
        clearTimeout(timer)
        autoSaveTimers.delete(file.id)
      }
      // H8 — cleanup simmetrico: rimuovi la pila undo unificata alla chiusura della tab
      clearUnified(file.id)

      if (file.id === currentFile.id) {
        const fileState = this.tabs[index] || this.tabs[index - 1] || this.tabs[0] || {}
        this.currentFile = fileState
        // Aggiorna sourceCode mode in base al nuovo tab (come fa UPDATE_CURRENT_FILE)
        this._applySourceCodeForFile(fileState)
        if (typeof fileState.markdown === 'string') {
          const { id, markdown, cursor, history, pathname, scrollTop, blocks } = fileState
          window.DIRNAME = pathname ? window.path.dirname(pathname) : ''
          bus.emit('file-changed', {
            id,
            markdown,
            cursor,
            renderCursor: true,
            history,
            scrollTop,
            blocks
          })
        } else {
          window.DIRNAME = ''
        }
      }

      if (this.tabs.length === 0) {
        this.listToc = []
        this.toc = []
      }

      const { pathname } = file
      if (pathname) {
        // mt::window-tab-closed fa già scattare removeFromOpenedFiles nel main che rimuove il watcher
        window.electron.ipcRenderer.send('mt::window-tab-closed', pathname)
      }
    },

    CLOSE_UNSAVED_TAB(file) {
      // B-REV3: flush sincrono (source debounced) prima di leggere file.markdown.
      bus.emit('pre-save')
      const { id, pathname, filename, markdown } = file
      const options = getOptionsFromState(file)
      window.electron.ipcRenderer.send('mt::save-and-close-tabs', [
        { id, pathname, filename, markdown, options: deepClone(options) }
      ])
    },

    // H4: flippa il flag pinned e riordina: pinnate prima (ordine relativo preservato).
    TOGGLE_PIN_TAB(id) {
      const tab = this.tabs.find(t => t.id === id)
      if (!tab) return
      tab.pinned = !tab.pinned
      const pinned = this.tabs.filter(t => t.pinned)
      const unpinned = this.tabs.filter(t => !t.pinned)
      this.tabs.splice(0, this.tabs.length, ...pinned, ...unpinned)
    },

    CLOSE_OTHER_TABS(file) {
      this.tabs
        .filter((f) => f.id !== file.id && !f.pinned)  // H4: le tab pinnate sono protette
        .forEach((tab) => {
          this.CLOSE_TAB(tab)
        })
    },

    CLOSE_SAVED_TABS() {
      this.tabs
        .filter((f) => f.isSaved)
        .forEach((tab) => {
          this.CLOSE_TAB(tab)
        })
    },

    CLOSE_ALL_TABS() {
      this.tabs.slice().filter(t => !t.pinned).forEach((tab) => {  // H4: skip pinnate
        this.CLOSE_TAB(tab)
      })
    },

    CLOSE_TABS(tabIdList) {
      if (!tabIdList || tabIdList.length === 0) return

      let tabIndex = 0
      tabIdList.forEach((id) => {
        const index = this.tabs.findIndex((f) => f.id === id)
        if (index === -1) return

        const { pathname } = this.tabs[index]

        if (pathname) {
          // mt::window-tab-closed fa già scattare removeFromOpenedFiles nel main che rimuove il watcher
          window.electron.ipcRenderer.send('mt::window-tab-closed', pathname)
        }

        this.tabs.splice(index, 1)
        if (this.currentFile.id === id) {
          this.currentFile = {}
          window.DIRNAME = ''
          if (tabIdList.length === 1) {
            tabIndex = index
          }
        }
      })

      if (!this.currentFile.id && this.tabs.length > 0) {
        this.currentFile = this.tabs[tabIndex] || this.tabs[tabIndex - 1] || this.tabs[0] || {}
        if (typeof this.currentFile.markdown === 'string') {
          const { id, markdown, cursor, history, pathname, scrollTop, blocks } = this.currentFile
          window.DIRNAME = pathname ? window.path.dirname(pathname) : ''
          // Imposta sourceCode mode PRIMA di emettere file-changed (come FORCE_CLOSE_TAB
          // e UPDATE_CURRENT_FILE). Senza questo, sourceCode resta true anche se il tab
          // successivo è markdown → Untitled resta in source mode + history cross-tab.
          this._applySourceCodeForFile(this.currentFile)
          bus.emit('file-changed', {
            id,
            markdown,
            cursor,
            renderCursor: true,
            history,
            scrollTop,
            blocks
          })
        }
      }

      if (this.tabs.length === 0) {
        this.listToc = []
        this.toc = []
      }
    },

    EXCHANGE_TABS_BY_ID(tabIDs) {
      const { fromId, toId } = tabIDs
      const { tabs } = this
      const moveItem = (arr, from, to) => {
        if (from === to) return true
        const len = arr.length
        const item = arr.splice(from, 1)
        if (item.length === 0) return false

        arr.splice(to, 0, item[0])
        return arr.length === len
      }

      const fromIndex = tabs.findIndex((t) => t.id === fromId)
      if (fromIndex === -1) return

      const fromPinned = tabs[fromIndex].pinned

      if (!toId) {
        if (fromPinned) {
          // Pinnata → va solo alla fine della zona pinnata
          const lastPinned = tabs.reduce((acc, t, i) => t.pinned ? i : acc, fromIndex)
          moveItem(tabs, fromIndex, lastPinned)
        } else {
          moveItem(tabs, fromIndex, tabs.length - 1)
        }
      } else {
        const toIndex = tabs.findIndex((t) => t.id === toId)
        if (toIndex === -1) return
        let realToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex

        // H4: zone clamping — pinnata resta nella zona pinnata, non-pinnata in quella non-pinnata
        if (fromPinned) {
          const lastPinned = tabs.reduce((acc, t, i) => t.pinned ? i : acc, fromIndex)
          realToIndex = Math.min(realToIndex, lastPinned)
        } else {
          const firstUnpinned = tabs.findIndex(t => !t.pinned)
          if (firstUnpinned >= 0) realToIndex = Math.max(realToIndex, firstUnpinned)
        }

        moveItem(tabs, fromIndex, realToIndex)
      }
    },

    RENAME_FILE(file) {
      this.UPDATE_CURRENT_FILE(file)
      bus.emit('rename')
    },

    // Direction is a boolean where false is left and true right.
    CYCLE_TABS(direction) {
      const { tabs, currentFile } = this
      if (tabs.length <= 1) {
        return
      }

      const currentIndex = tabs.findIndex((t) => t.id === currentFile.id)
      if (currentIndex === -1) {
        console.error('CYCLE_TABS: Cannot find current tab index.')
        return
      }

      let nextTabIndex = 0
      if (!direction) {
        // Switch tab to the left.
        nextTabIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
      } else {
        // Switch tab to the right.
        nextTabIndex = (currentIndex + 1) % tabs.length
      }

      const nextTab = tabs[nextTabIndex]
      if (!nextTab || !nextTab.id) {
        console.error(`CYCLE_TABS: Cannot find next tab (index="${nextTabIndex}").`)
        return
      }

      this.UPDATE_CURRENT_FILE(nextTab)
    },

    SWITCH_TAB_BY_INDEX(nextTabIndex) {
      const { tabs, currentFile } = this
      if (nextTabIndex < 0 || nextTabIndex >= tabs.length) {
        console.warn('Invalid tab index:', nextTabIndex)
        return
      }

      const currentIndex = tabs.findIndex((t) => t.id === currentFile.id)
      if (currentIndex === -1) {
        console.error('Cannot find current tab index.')
        return
      }

      const nextTab = tabs[nextTabIndex]
      if (!nextTab || !nextTab.id) {
        console.error(`Cannot find tab by index="${nextTabIndex}".`)
        return
      }
      this.UPDATE_CURRENT_FILE(nextTab)
    },

    /**
     * Create a new untitled tab optional from a markdown string.
     *
     * @param {*} _ The store context - not used.
     * @param {{markdown?: string, selected?: boolean}} obj Optional markdown string
     * and whether the tab should become the selected tab (true if not set).
     */
    NEW_UNTITLED_TAB({ markdown: markdownString, selected }) {
      if (selected == null) {
        selected = true
      }

      this.SHOW_TAB_VIEW(false)

      const preferencesStore = usePreferencesStore()
      const { defaultEncoding, endOfLine } = preferencesStore
      const fileState = getBlankFileState(this.tabs, defaultEncoding, endOfLine, markdownString)

      if (selected) {
        const { id, markdown } = fileState
        this.UPDATE_CURRENT_FILE(fileState)
        bus.emit('file-loaded', { id, markdown })
      } else {
        this.tabs.push(fileState)
      }
    },

    /**
     * Create a new tab from the given markdown document.
     *
     * @param {*} _ The store context - not used.
     * @param {{markdownDocument: IMarkdownDocumentRaw, selected?: boolean}} obj The markdown document
     * and optional whether the tab should become the selected tab (true if not set).
     */
    NEW_TAB_WITH_CONTENT({ markdownDocument, options = {}, selected }) {
      if (!markdownDocument) {
        console.warn('Cannot create a file tab without a markdown document!')
        this.NEW_UNTITLED_TAB({})
        return
      }

      if (typeof selected === 'undefined') {
        selected = true
      }

      const { currentFile, tabs } = this
      const { pathname } = markdownDocument
      const existingTab = tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
      if (existingTab) {
        this.UPDATE_CURRENT_FILE(existingTab)
        return
      }

      let keepTabBarState = false
      if (currentFile) {
        const { isSaved, pathname } = currentFile
        if (isSaved && !pathname) {
          keepTabBarState = true
          this.FORCE_CLOSE_TAB(currentFile)
        }
      }

      if (!keepTabBarState) {
        this.SHOW_TAB_VIEW(false)
      }

      const { markdown, isMixedLineEndings } = markdownDocument
      const docState = createDocumentState(Object.assign(markdownDocument, options))
      // B8: flag "appena caricato da disco". Serve a LISTEN_FOR_CONTENT_CHANGE per
      // distinguere la prima normalizzazione di Muya (che modifica il markdown)
      // dalle modifiche reali dell'utente. true solo per file con pathname.
      // Timestamp di caricamento: usato da LISTEN_FOR_CONTENT_CHANGE per
      // ignorare le normalizzazioni Muya nei primi 400ms dopo apertura.
      docState.justLoaded = docState.pathname ? Date.now() : 0
      const { id, cursor } = docState

      if (selected) {
        this.UPDATE_CURRENT_FILE(docState)
        bus.emit('file-loaded', { id, markdown, cursor })
      } else {
        this.tabs.push(docState)
      }
      // Il watcher viene avviato dal main process in EditorWindow._doOpenTab
      // via ipcMain.emit('watcher-watch-file', browserWindow, pathname)

      if (isMixedLineEndings) {
        const { filename, lineEnding } = markdownDocument
        this.pushTabNotification({
          tabId: id,
          msg: i18n.global.t('store.editor.mixedLineEndingsNormalized', {
            name: filename,
            lineEnding: lineEnding.toUpperCase()
          })
        })
      }
    },

    SHOW_TAB_VIEW(always) {
      const { tabs } = this
      const layoutStore = useLayoutStore()
      if (always || tabs.length === 1) {
        layoutStore.SET_LAYOUT({ showTabBar: true })
        layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
      }
    },

    SET_SAVE_STATUS_WHEN_REMOVE({ pathname }) {
      this.tabs.forEach((f) => {
        if (f.pathname === pathname) {
          f.isSaved = false
        }
      })
    },

    // Content change from realtime preview editor and source code editor
    LISTEN_FOR_CONTENT_CHANGE({
      id,
      markdown,
      wordCount,
      cursor,
      muyaIndexCursor,
      history,
      toc,
      blocks
    }) {
      // P-REV3: incrementa la versione contenuto (O(1)) → il content-watcher della sidebar reagisce
      // a questo invece di ricostruire la concatenazione di tutti i tab.markdown ad ogni change.
      this.contentVersion++
      const preferencesStore = usePreferencesStore()
      const { autoSave } = preferencesStore
      const LOAD_SETTLE_MS = 400
      const {
        id: currentId,
        filename,
        pathname,
        markdown: oldMarkdown,
        trimTrailingNewline
      } = this.currentFile

      if (!id) {
        throw new Error('Listen for document change but id was not set!')
      } else if (!currentId || this.tabs.length === 0) {
        return
      } else if (id !== 'muya' && currentId !== id) {
        for (const tab of this.tabs) {
          if (tab.id && tab.id === id) {
            const adjMarkdown = adjustTrailingNewlines(markdown, tab.trimTrailingNewline)
            tab.markdown = adjMarkdown
            // Applica justLoaded anche per tab in background: se Muya normalizza il contenuto
            // mentre l'utente ha già switchato ad altra tab, aggiorna la baseline senza
            // marcare come dirty — altrimenti al ritorno originalMarkdown ≠ markdown → bollino.
            if (tab.justLoaded && (Date.now() - tab.justLoaded) < LOAD_SETTLE_MS) {
              tab.originalMarkdown = adjMarkdown
            }
            if (cursor) tab.cursor = cursor
            if (history) tab.history = history
            break
          }
        }
        return
      }

      markdown = adjustTrailingNewlines(markdown, trimTrailingNewline)
      this.currentFile.markdown = markdown

      if (oldMarkdown.length === 0 && markdown.length === 1 && markdown[0] === '\n') {
        // P1: Muya normalizza file vuoto a '\n'. Per Untitled (no pathname)
        // sync originalMarkdown da '' a '\n' — altrimenti dopo Ctrl+Z totale
        // Muya manda '' → adjustTrailingNewlines → '\n' ≠ originalMarkdown=''
        // → bollino non scompare mai.
        if (!pathname && this.currentFile.originalMarkdown === '') {
          this.currentFile.originalMarkdown = '\n'
        }
        return
      }

      if (wordCount) this.currentFile.wordCount = wordCount
      if (cursor) this.currentFile.cursor = cursor
      if (muyaIndexCursor) this.currentFile.muyaIndexCursor = muyaIndexCursor
      if (history) this.currentFile.history = history
      if (blocks) this.currentFile.blocks = blocks
      if (toc && !equal(toc, this.listToc)) {
        this.listToc = toc
        this.toc = listToTree(toc)
      }

      if (markdown !== oldMarkdown) {
        // B8: finestra di assestamento post-caricamento (400ms). Muya può fare
        // più pass di normalizzazione all'init (newline, spazi, encoding). Durante
        // la finestra si aggiorna la baseline senza marcare come non salvato.
        const isSettling = this.currentFile.justLoaded &&
          (Date.now() - this.currentFile.justLoaded) < LOAD_SETTLE_MS
        if (isSettling) {
          this.currentFile.originalMarkdown = markdown
          // isSaved resta true; NON azzero justLoaded — la finestra scade da sola
        } else {
          if (this.currentFile.justLoaded) this.currentFile.justLoaded = 0
          // NB12: guardia contro false-dirty all'apertura file.
          // Se il contenuto corrente è identico a quello caricato da disco,
          // non marcare come "non salvato" (originalMarkdown è null per file nuovi).
          const isUnchangedFromDisk =
            this.currentFile.originalMarkdown !== null &&
            markdown === this.currentFile.originalMarkdown
          if (!isUnchangedFromDisk) {
            this.currentFile.isSaved = false
            if (pathname && autoSave) {
              const options = getOptionsFromState(this.currentFile)
              this.HANDLE_AUTO_SAVE({
                id: currentId,
                filename,
                pathname,
                markdown,
                options
              })
            }
          } else {
            // B9: contenuto torna identico al disco (es. Ctrl+Z) → ripristina salvato.
            this.currentFile.isSaved = true
          }
        }
      }
    },

    HANDLE_AUTO_SAVE({ id, filename, pathname, markdown, options }) {
      if (!id || !pathname) {
        throw new Error('HANDLE_AUTO_SAVE: Invalid tab.')
      }

      const preferencesStore = usePreferencesStore()
      const projectStore = useProjectStore()
      const { autoSaveDelay, lightTouch } = preferencesStore

      if (autoSaveTimers.has(id)) {
        const timer = autoSaveTimers.get(id)
        clearTimeout(timer)
        autoSaveTimers.delete(id)
      }

      const timer = setTimeout(() => {
        autoSaveTimers.delete(id)

        const tab = this.tabs.find((t) => t.id === id)
        if (tab && !tab.isSaved) {
          const defaultPath = getRootFolderFromState(projectStore)
          // Apply Light Touch mode: use original markdown if no semantic changes
          const markdownToSave = getMarkdownForSave(markdown, tab.originalMarkdown, lightTouch)
          // Remember what we asked main to save so we can update baseline on success.
          pendingSavedMarkdown.set(id, markdownToSave)
          window.electron.ipcRenderer.send(
            'mt::response-file-save',
            id,
            filename,
            pathname,
            markdownToSave,
            deepClone(options),
            defaultPath
          )
        }
      }, autoSaveDelay)
      autoSaveTimers.set(id, timer)
    },

    // Aggiorna il testo selezionato corrente (chiamata da Muya e CodeMirror).
    SET_SELECTION(text) {
      this.currentSelection = typeof text === 'string' ? text : ''
    },

    SELECTION_CHANGE(changes) {
      const { start, end } = changes
      if (start.key === end.key && start.block.text) {
        const value = start.block.text.substring(start.offset, end.offset)
        this.currentFile.searchMatches = {
          matches: [],
          index: -1,
          value
        }
        // Traccia selezione Muya (singolo blocco) per i trigger di ricerca.
        this.currentSelection = value
      } else {
        // Selezione cross-block o nessuna selezione → niente testo utilizzabile.
        this.currentSelection = ''
      }

      const { windowId } = global.marktext.env
      window.electron.ipcRenderer.send(
        'mt::editor-selection-changed',
        windowId,
        createApplicationMenuState(changes)
      )
    },

    SELECTION_FORMATS(formats) {
      const { windowId } = global.marktext.env
      window.electron.ipcRenderer.send(
        'mt::update-format-menu',
        windowId,
        createSelectionFormatState(formats)
      )
    },

    EXPORT({ type, content, pageOptions }) {
      if (!hasKeys(this.currentFile)) return

      let title = ''
      const { listToc } = this
      if (listToc && listToc.length > 0) {
        let headerRef = listToc[0]
        const len = Math.min(listToc.length, 6)
        for (let i = 1; i < len; ++i) {
          if (headerRef.lvl === 1) break
          const header = listToc[i]
          if (headerRef.lvl > header.lvl) {
            headerRef = header
          }
        }
        title = headerRef.content
      }

      const { filename, pathname } = this.currentFile
      window.electron.ipcRenderer.send('mt::response-export', {
        type,
        title,
        content,
        filename,
        pathname,
        pageOptions
      })
    },

    LISTEN_FOR_EXPORT_SUCCESS() {
      window.electron.ipcRenderer.on('mt::export-success', (_, { filePath }) => {
        notice
          .notify({
            title: i18n.global.t('store.editor.exportSuccessTitle'),
            message: i18n.global.t('store.editor.exportSuccessMessage', {
              name: window.path.basename(filePath)
            }),
            showConfirm: true
          })
          .then(() => {
            window.electron.shell.showItemInFolder(filePath)
          })
      })
    },

    PRINT_RESPONSE() {
      window.electron.ipcRenderer.send('mt::response-print')
    },

    LISTEN_FOR_PRINT_SERVICE_CLEARUP() {
      window.electron.ipcRenderer.on('mt::print-service-clearup', () => {
        bus.emit('print-service-clearup')
      })
    },

    SET_LINE_ENDING(lineEnding) {
      const { lineEnding: oldLineEnding } = this.currentFile
      if (lineEnding !== oldLineEnding) {
        this.currentFile.lineEnding = lineEnding
        this.currentFile.adjustLineEndingOnSave = lineEnding !== 'lf'
        this.currentFile.isSaved = false  // N14: cambio EOL = modifica non salvata
        this.UPDATE_LINE_ENDING_MENU()
      }
    },

    LISTEN_FOR_SET_LINE_ENDING() {
      window.electron.ipcRenderer.on('mt::set-line-ending', (_, lineEnding) => {
        this.SET_LINE_ENDING(lineEnding)
      })
      bus.on('mt::set-line-ending', (lineEnding) => {
        this.SET_LINE_ENDING(lineEnding)
      })
    },

    LISTEN_FOR_SET_ENCODING() {
      // Accetta sia stringa (legacy) sia oggetto {encoding, isBom} per supporto BOM
      bus.on('mt::set-file-encoding', (payload) => {
        const encodingName = typeof payload === 'string' ? payload : payload.encoding
        const bomFlag = typeof payload === 'string' ? false : !!payload.isBom
        const cur = this.currentFile.encoding
        if (cur.encoding !== encodingName || cur.isBom !== bomFlag) {
          this.currentFile.encoding.encoding = encodingName
          this.currentFile.encoding.isBom = bomFlag
          this.currentFile.isSaved = false  // N14: cambio encoding = modifica non salvata
        }
      })
    },

    LISTEN_FOR_SET_FINAL_NEWLINE() {
      bus.on('mt::set-final-newline', (value) => {
        const { trimTrailingNewline } = this.currentFile
        if (trimTrailingNewline !== value) {
          this.currentFile.trimTrailingNewline = value
          // Coerente con SET_LINE_ENDING e set-encoding (N14): cambiare l'opzione
          // non equivale a salvare → la tab resta dirty.
          this.currentFile.isSaved = false
        }
      })
    },

    LISTEN_FOR_FILE_CHANGE() {
      const preferencesStore = usePreferencesStore()
      window.electron.ipcRenderer.on('mt::update-file', (_, { type, change }) => {
        const { tabs } = this
        const { pathname } = change
        const tab = tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
        if (tab) {
          const { id, isSaved, filename } = tab
          switch (type) {
            case 'unlink': {
              tab.isSaved = false
              this.pushTabNotification({
                tabId: id,
                msg: i18n.global.t('store.editor.fileRemovedOnDisk', { name: filename }),
                style: 'warn',
                showConfirm: false,
                exclusiveType: 'file_changed'
              })
              break
            }
            case 'add':
            case 'change': {
              const { autoSave } = preferencesStore
              if (autoSave) {
                if (autoSaveTimers.has(id)) {
                  const timer = autoSaveTimers.get(id)
                  clearTimeout(timer)
                  autoSaveTimers.delete(id)
                }

                if (isSaved) {
                  this.loadChange(change)
                  return
                }
              }

              // Mostra il dialog SOLO se la modifica riguarda la tab attiva: ricaricare ha
              // senso solo sul file aperto a video (loadChange ricarica l'editor solo per la
              // currentFile). Se la tab è in background, memorizziamo la modifica e mostriamo
              // il dialog quando l'utente apre quella tab (vedi UPDATE_CURRENT_FILE).
              const isActiveTab = this.currentFile && this.currentFile.id === id
              if (isActiveTab) {
                // Floating box centrale. NON marcare dirty qui: il tab resta nel suo stato
                // finché l'utente non sceglie. hasUnsavedChanges → avviso perdita modifiche.
                bus.emit('file-changed-externally', {
                  change,
                  filename,
                  hasUnsavedChanges: !isSaved
                })
              } else {
                // Tab in background: rimanda. L'ultima modifica vince (sovrascrive la pendente).
                tab.pendingExternalChange = change
              }
              break
            }
            default:
              console.error(`LISTEN_FOR_FILE_CHANGE: Invalid type "${type}"`)
          }
        } else {
          console.error(`LISTEN_FOR_FILE_CHANGE: Cannot find tab for path "${pathname}".`)
        }
      })
    },

    ASK_FOR_IMAGE_PATH() {
      return window.electron.ipcRenderer.sendSync('mt::ask-for-image-path')
    },

    EDIT_ZOOM(zoomFactor) {
      const preferencesStore = usePreferencesStore()
      zoomFactor = Number.parseFloat(zoomFactor.toFixed(3))
      const { zoom } = preferencesStore
      if (zoom !== zoomFactor) {
        preferencesStore.SET_SINGLE_PREFERENCE({ type: 'zoom', value: zoomFactor })
      }
      // Non chiama più webFrame.setZoomFactor: lo zoom agisce solo sul testo dell'editor
    },

    LISTEN_WINDOW_ZOOM() {
      const ZOOM_STEP = 0.125
      window.electron.ipcRenderer.on('mt::window-zoom', (_, zoomFactor) => {
        this.EDIT_ZOOM(zoomFactor)
      })
      // Gestisce zoom per step da menu e da Ctrl+rotella (via main process)
      window.electron.ipcRenderer.on('mt::window-zoom-direction', (_, direction) => {
        const preferencesStore = usePreferencesStore()
        const current = preferencesStore.zoom || 1.0
        const next = direction === 'in'
          ? Math.min(2.0, current + ZOOM_STEP)
          : Math.max(0.5, current - ZOOM_STEP)
        this.EDIT_ZOOM(next)
      })
      bus.on('mt::window-zoom', (zoomFactor) => {
        this.EDIT_ZOOM(zoomFactor)
      })
      // Gestisce zoom per step da Ctrl+rotella intercettato nel renderer (index.vue)
      bus.on('mt::window-zoom-direction', (direction) => {
        const preferencesStore = usePreferencesStore()
        const current = preferencesStore.zoom || 1.0
        const next = direction === 'in'
          ? Math.min(2.0, current + ZOOM_STEP)
          : Math.max(0.5, current - ZOOM_STEP)
        this.EDIT_ZOOM(next)
      })
    },

    LISTEN_FOR_RELOAD_IMAGES() {
      window.electron.ipcRenderer.on('mt::invalidate-image-cache', () => {
        bus.emit('invalidate-image-cache')
      })
    },

    LISTEN_FOR_CONTEXT_MENU() {
      // General context menu
      window.electron.ipcRenderer.on('mt::cm-copy-as-markdown', () => {
        bus.emit('copyAsMarkdown', 'copyAsMarkdown')
      })
      window.electron.ipcRenderer.on('mt::cm-copy-as-html', () => {
        bus.emit('copyAsHtml', 'copyAsHtml')
      })
      window.electron.ipcRenderer.on('mt::cm-paste-as-plain-text', () => {
        bus.emit('pasteAsPlainText', 'pasteAsPlainText')
      })
      window.electron.ipcRenderer.on('mt::cm-insert-paragraph', (_, location) => {
        bus.emit('insertParagraph', location)
      })

      // Spelling
      window.electron.ipcRenderer.on('mt::spelling-replace-misspelling', (_, info) => {
        bus.emit('replace-misspelling', info)
      })
      window.electron.ipcRenderer.on('mt::spelling-show-switch-language', () => {
        bus.emit('open-command-spellchecker-switch-language')
      })
    }
  }
})

// ----------------------------------------------------------------------------

/**
 * Return the opened root folder or an empty string.
 *
 * @param {object} projectStore The project store instance.
 */
const getRootFolderFromState = (projectStore) => {
  const openedFolder = projectStore.projectTree
  if (openedFolder) {
    return openedFolder.pathname
  }
  return ''
}


/**
 * Normalizes a block of text for semantic comparison.
 * Removes whitespace differences while preserving content.
 *
 * @param {string} text The text to normalize.
 * @returns {string} Normalized text for comparison.
 */
const normalizeBlock = (text) => {
  if (!text) return ''
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // B-REV5: protect markdown hard-breaks (2+ trailing spaces before \n) with a sentinel.
    // Without this, "hello  \n" → "hello\n" → hard-break edit looks identical to original
    // → never written to disk. Sentinel \x02 survives the whitespace-strip and space-collapse
    // steps below because it is neither a space nor a tab.
    .replace(/ {2,}(\n)/g, '\x02$1')
    // Remove trailing spaces from lines (sentinel \x02 at EOL is not matched)
    .replace(/[ \t]+$/gm, '')
    // Normalize all blank line variations to single newline for comparison
    .replace(/\n+/g, '\n')
    // Collapse multiple inline spaces to single space (\x02 is not a space, survives)
    .replace(/[ \t]+/g, ' ')
    // Restore hard-breaks AFTER the inline-space collapse so "  " is not re-collapsed
    .replace(/\x02/g, '  ')
    // Trim
    .trim()
}

/**
 * Normalizes a single line for comparison (trims trailing whitespace).
 *
 * @param {string} line The line to normalize.
 * @returns {string} Normalized line.
 */
const normalizeLine = (line) => line.replace(/[ \t]+$/, '')

/**
 * Computes the Longest Common Subsequence (LCS) between two arrays of lines,
 * using normalized lines for comparison. Returns an array of matching index
 * pairs: [{ orig: i, regen: j }, ...]
 *
 * @param {string[]} origLines Original lines.
 * @param {string[]} regenLines Regenerated lines.
 * @returns {Array<{orig: number, regen: number}>} LCS index pairs.
 */
const computeLcs = (origLines, regenLines) => {
  const n = origLines.length
  const m = regenLines.length

  // dp[i][j] = length of LCS of orig[0..i) and regen[0..j)
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (normalizeLine(origLines[i - 1]) === normalizeLine(regenLines[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to get matching indices
  const matches = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (normalizeLine(origLines[i - 1]) === normalizeLine(regenLines[j - 1])) {
      matches.push({ orig: i - 1, regen: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return matches.reverse()
}

/**
 * Merges regenerated markdown with the original file by aligning unchanged
 * lines (via LCS) and preserving their exact formatting. Changed or new lines
 * come from the regenerated content. This keeps unrelated lines untouched
 * even when nearby lines were edited, and avoids inserting new blank lines
 * where the original had none.
 *
 * @param {string} regenerated The regenerated markdown from editor.
 * @param {string} original The original markdown from file.
 * @returns {string} Merged markdown with preserved formatting where possible.
 */
const mergeWithOriginal = (regenerated, original) => {
  // Normalize line endings to simplify processing
  const regenLines = regenerated.replace(/\r\n/g, '\n').split('\n')
  const origLines = original.replace(/\r\n/g, '\n').split('\n')

  const matches = computeLcs(origLines, regenLines)

  const resultLines = []
  let prevOrig = -1
  let prevRegen = -1

  for (const { orig: oi, regen: rj } of matches) {
    // Lines from original in the gap (blank lines we want to preserve)
    const origGapLines = origLines.slice(prevOrig + 1, oi)
    // Lines from regenerated in the gap (may include new content)
    const regenGapLines = regenLines.slice(prevRegen + 1, rj)

    if (origGapLines.length > 0) {
      // Original had lines in this gap
      const newContent = regenGapLines.filter((l) => normalizeLine(l) !== '')

      if (newContent.length > 0) {
        // New content is being inserted - use Muya's spacing since structure changed
        resultLines.push(...regenGapLines)
      } else {
        // No new content - preserve original gap lines exactly (keeps double blanks)
        resultLines.push(...origGapLines)
      }
    } else if (regenGapLines.length > 0) {
      // Original had no gap but regen does - this is purely new content
      // Strip blank-only insertions to avoid adding unwanted spacing
      const onlyBlank = regenGapLines.every((l) => normalizeLine(l) === '')
      if (!onlyBlank) {
        resultLines.push(...regenGapLines.filter((l) => normalizeLine(l) !== ''))
      }
    }

    // Add the matched line from original to preserve formatting
    resultLines.push(origLines[oi])
    prevOrig = oi
    prevRegen = rj
  }

  // Handle tail after the last match
  const origTail = origLines.slice(prevOrig + 1)
  const regenTail = regenLines.slice(prevRegen + 1)

  if (origTail.length > 0) {
    // Original had lines after last match
    const newContent = regenTail.filter((l) => normalizeLine(l) !== '')

    if (newContent.length > 0) {
      // New content at end - use Muya's spacing since structure changed
      resultLines.push(...regenTail)
    } else {
      // No new content - preserve original tail exactly
      resultLines.push(...origTail)
    }
  } else if (regenTail.length > 0) {
    // Only regen has tail lines - add non-blank content only
    const onlyBlank = regenTail.every((l) => normalizeLine(l) === '')
    if (!onlyBlank) {
      resultLines.push(...regenTail.filter((l) => normalizeLine(l) !== ''))
    }
    // If only blank, rely on original trailing newlines preservation below
  }

  // Preserve original trailing newline pattern
  const originalTrailing = original.match(/\n*$/)
  const trailingNewlines = originalTrailing ? originalTrailing[0] : '\n'
  const result = resultLines.join('\n').replace(/\n*$/, trailingNewlines)

  return result
}

/**
 * Determines the markdown to save based on Light Touch mode.
 * When no semantic changes were made, returns the original file exactly.
 * When changes were made, returns the regenerated markdown.
 *
 * @param {string} currentMarkdown The current (regenerated) markdown.
 * @param {string|null} originalMarkdown The original markdown from file load.
 * @param {boolean} lightTouch Whether Light Touch mode is enabled.
 * @returns {string} The markdown to save.
 */
const getMarkdownForSave = (currentMarkdown, originalMarkdown, lightTouch) => {
  // If Light Touch is disabled or no original exists, use current
  if (!lightTouch || !originalMarkdown) {
    return currentMarkdown
  }

  // Normalize both for quick full-document comparison
  const normalizedCurrent = normalizeBlock(currentMarkdown)
  const normalizedOriginal = normalizeBlock(originalMarkdown)

  // If semantically identical, use original entirely (preserves all whitespace)
  if (normalizedCurrent === normalizedOriginal) {
    return originalMarkdown
  }

  // P-REV1: mergeWithOriginal usa LCS O(n×m) con matrice piena → su file grandi (anche ad ogni
  // autosave) freezerebbe il renderer. Sopra soglia degrada con grazia: salva il rigenerato
  // (formattazione non preservata, contenuto sì).
  const totalLines =
    (currentMarkdown.match(/\n/g) || []).length + (originalMarkdown.match(/\n/g) || []).length
  if (totalLines > 3000) {
    return currentMarkdown
  }

  // Changes were made - merge to preserve unchanged lines
  return mergeWithOriginal(currentMarkdown, originalMarkdown)
}

/**
 * Creates a object that contains the application menu state.
 *
 * @param {*} selection The selection.
 * @returns A object that represents the application menu state.
 */
const createApplicationMenuState = ({ start, end, affiliation }) => {
  const state = {
    isDisabled: false,
    // Whether multiple lines are selected.
    isMultiline: start.key !== end.key,
    // List information - a list must be selected.
    isLooseListItem: false,
    isTaskList: false,
    // Whether the selection is code block like (math, html or code block).
    isCodeFences: false,
    // Whether a code block line is selected.
    isCodeContent: false,
    // Whether the selection contains a table.
    isTable: false,
    // Contains keys about the selection type(s) (string, boolean) like "ul: true".
    affiliation: {}
  }
  const { isMultiline } = state

  // Get code block information from selection.
  if (
    (start.block.functionType === 'cellContent' && end.block.functionType === 'cellContent') ||
    (start.type === 'span' && start.block.functionType === 'codeContent') ||
    (end.type === 'span' && end.block.functionType === 'codeContent')
  ) {
    // A code block like block is selected (code, math, ...).
    state.isCodeFences = true

    // A code block line is selected.
    if (start.block.functionType === 'codeContent' || end.block.functionType === 'codeContent') {
      state.isCodeContent = true
    }
  }

  // Query list information.
  if (affiliation.length >= 1 && /ul|ol/.test(affiliation[0].type)) {
    const listBlock = affiliation[0]
    state.affiliation[listBlock.type] = true
    state.isLooseListItem = listBlock.children[0].isLooseListItem
    state.isTaskList = listBlock.listType === 'task'
  } else if (affiliation.length >= 3 && affiliation[1].type === 'li') {
    const listItem = affiliation[1]
    const listType = listItem.listItemType === 'order' ? 'ol' : 'ul'
    state.affiliation[listType] = true
    state.isLooseListItem = listItem.isLooseListItem
    state.isTaskList = listItem.listItemType === 'task'
  }

  // Search with block depth 3 (e.g. "ul -> li -> p" where p is the actually paragraph inside the list (item)).
  for (const b of affiliation.slice(0, 3)) {
    if (b.type === 'pre' && b.functionType) {
      if (/frontmatter|html|multiplemath|code$/.test(b.functionType)) {
        state.isCodeFences = true
        state.affiliation[b.functionType] = true
      }
      break
    } else if (b.type === 'figure' && b.functionType) {
      if (b.functionType === 'table') {
        state.isTable = true
        state.isDisabled = true
      }
      break
    } else if (isMultiline && /^h{1,6}$/.test(b.type)) {
      // Multiple block elements are selected.
      state.affiliation = {}
      break
    } else {
      if (!state.affiliation[b.type]) {
        state.affiliation[b.type] = true
      }
    }
  }

  // Clean up
  if (Object.getOwnPropertyNames(state.affiliation).length >= 2 && state.affiliation.p) {
    delete state.affiliation.p
  }
  if ((state.affiliation.ul || state.affiliation.ol) && state.affiliation.li) {
    delete state.affiliation.li
  }
  return state
}

/**
 * Creates a object that contains the formats selection state.
 *
 * @param {*} formats The selection formats.
 * @returns A object that represents the formats menu state.
 */
const createSelectionFormatState = (formats) => {
  const state = {}
  for (const item of formats) {
    state[item.type] = true
  }
  return state
}
