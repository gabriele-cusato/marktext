import bus from '../bus'
import { delay } from '@/util'
import getCommandDescriptionById from './descriptions'
import { t } from '../i18n'

const SPECIAL_CHARS = /[\[\]\\^$.\|\?\*\+\(\)\/]{1}/g // eslint-disable-line no-useless-escape

// The quick open command
class QuickOpenCommand {
  constructor(rootState) {
    this.id = 'file.quick-open'
    this.description = getCommandDescriptionById('file.quick-open')
    this.placeholder = t('commandPalette.placeholders.searchFileToOpen')
    this.shortcut = null

    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Reference to folder and editor and project state.
    this._editorState = rootState.editor
    this._folderState = rootState.project

    this._cancelFn = null
  }

  search = async (query) => {
    // Show opened files when no query given.
    if (!query) {
      return this.subcommands
    }

    const { _cancelFn } = this
    if (_cancelFn) {
      _cancelFn()
      this._cancelFn = null
    }

    const timeout = delay(300)
    this._cancelFn = () => {
      timeout.cancel()
      this._cancelFn = null
    }

    await timeout
    return this._doSearch(query)
  }

  run = async () => {
    // Recent Files: la sorgente non sono più i tab aperti ma la lista persistita dei file
    // aperti di recente (main/menu/index.js), già filtrata dai percorsi non più esistenti
    // su disco (vedi getRecentlyUsedDocuments, che scarta le voci non isFile2/isDirectory2).
    const recentDocuments = await window.electron.ipcRenderer.invoke(
      'mt::get-recently-used-documents'
    )
    if (recentDocuments.length === 0) {
      throw new Error(null)
    }

    this.subcommands = recentDocuments.map((pathname) => {
      const item = { id: pathname }
      Object.assign(item, this._getPath(pathname))
      return item
    })
  }

  execute = async () => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async (id) => {
    const { windowId } = window.marktext.env
    window.electron.ipcRenderer.send('mt::open-file-by-window-id', windowId, id)
  }

  unload = () => {
    this.subcommands = []
  }

  // --- private ------------------------------------------

  _doSearch = (query) => {
    this._cancelFn = null
    const { _editorState, _folderState } = this
    const isRootDirOpened = !!_folderState.projectTree
    const tabsAvailable = _editorState.tabs.length > 0

    // Only show opened files if no directory is opened.
    if (!isRootDirOpened && !tabsAvailable) {
      return []
    }

    const searchResult = []
    const rootPath = isRootDirOpened ? _folderState.projectTree.pathname : null

    // Add files that are not in the current root directory but opened.
    if (tabsAvailable) {
      const re = new RegExp(
        query.replace(SPECIAL_CHARS, (p) => {
          if (p === '*') return '.*'
          return p === '\\' ? '\\\\' : `\\${p}`
        }),
        'i'
      )

      for (const tab of _editorState.tabs) {
        const { pathname } = tab
        if (
          pathname &&
          re.test(pathname) &&
          (!rootPath || !window.fileUtils.isChildOfDirectory(rootPath, pathname))
        ) {
          searchResult.push(pathname)
        }
      }
    }

    if (!isRootDirOpened) {
      return searchResult.map((pathname) => {
        return {
          id: pathname,
          description: pathname,
          title: pathname
        }
      })
    }

    // Search root directory on disk.
    return window.electron.ipcRenderer
      .invoke('mt::search-files', {
        directories: [rootPath],
        inclusions: this._getInclusions(query),
        options: {}
      })
      .then((paths) => {
        this._cancelFn = null
        for (const p of paths) searchResult.push(p)
        return searchResult.map((pathname) => {
          const item = { id: pathname }
          Object.assign(item, this._getPath(pathname))
          return item
        })
      })
      .catch((error) => {
        this._cancelFn = null
        throw error
      })
  }

  _getInclusions = (query) => {
    // NOTE: This will fail on `foo.m` because we search for `foo.m.md`.
    if (window.fileUtils.hasMarkdownExtension(query)) {
      return [`*${query}`]
    }

    const inclusions = []
    for (let i = 0; i < window.fileUtils.MARKDOWN_INCLUSIONS.length; ++i) {
      inclusions[i] = `*${query}` + window.fileUtils.MARKDOWN_INCLUSIONS[i]
    }
    return inclusions
  }

  _getPath = (pathname) => {
    const { projectTree } = this._folderState
    // Nessuna cartella aperta (il filetree è deprecato: projectTree resta null): mostrare solo il
    // path assoluto del tab, evitando l'accesso a projectTree.pathname che altrimenti crasherebbe.
    if (!projectTree) {
      return { title: pathname, description: pathname }
    }

    const rootPath = projectTree.pathname
    if (!window.fileUtils.isChildOfDirectory(rootPath, pathname)) {
      return { title: pathname, description: pathname }
    }

    const p = window.path.relative(rootPath, pathname)
    const item = { description: p }
    if (p.length > 50) {
      item.title = p
    }
    return item
  }
}

export default QuickOpenCommand
