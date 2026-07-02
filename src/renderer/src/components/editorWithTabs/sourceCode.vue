<template>
  <div
    ref="sourceCodeContainer"
    class="source-code"
  />
</template>

<script>
// Livello modulo: sopravvive ai remount del componente (ogni cambio tab smonta/rimonta).
// Se fosse dentro <script setup>, verrebbe ricreato ad ogni mount → history persa ad ogni cambio tab.
const cmStatePerTab = new Map()
// Traccia l'undoSize CM dell'ultimo push unificato: risincronizzato ad ogni change (anche replay)
// così il replay non genera un push fantasma (il gate uguaglianza è il secondo livello di difesa).
let lastUndoSize = 0
// H1: traccia se Ctrl è tenuto premuto per la modalità multi-selezione additiva.
// Module-level: un solo editor source attivo per volta, nessuna race.
let ctrlHeld = false
const onCtrlKeyDown = (e) => { if (e.key === 'Control') ctrlHeld = true }
const onCtrlKeyUp = (e) => { if (e.key === 'Control') ctrlHeld = false }
const onCtrlBlur = () => { ctrlHeld = false }
// P-REV2: tracking della changeGeneration CM per evitare getValue() ad ogni cursorActivity.
// Se la generazione non è cambiata rispetto all'ultimo cursorActivity, il contenuto non è
// cambiato → skip del percorso costoso (getValue, adjustTrailingNewlines×2, getWordCount).
let lastChangeGen = -1
</script>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import codeMirror, { setModeForFile, setCursorAtFirstLine, setTextDirection } from '../../codeMirror'
import { debounce, wordCount as getWordCount } from 'muya/lib/utils'
import { adjustCursor, adjustTrailingNewlines, isMarkdownPath } from '../../util'
import bus from '../../bus'
import { oneDarkThemes, railscastsThemes } from '@/config'
import {
  seedUnified,
  pushUnified,
  unifiedUndo,
  unifiedRedo,
  clearUnified,
  isUnifiedTarget
} from '@/store/unifiedHistory'

const props = defineProps({
  markdown: {
    type: String,
    default: ''
  },
  muyaIndexCursor: {
    type: Object,
    default: null
  },
  textDirection: {
    type: String,
    required: true
  }
})

const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

const sourceCodeContainer = ref(null)

const editor = ref(null)
const commitTimer = ref(null)
const viewDestroyed = ref(false)
const tabId = ref(null)
const isFirstLoad = ref(true) // P6: evita LISTEN_FOR_CONTENT_CHANGE al primo handleFileChange
let containerResizeObs = null  // P-DF8-6: ResizeObserver per refresh CodeMirror su resize container

// Stato ricerca CodeMirror (Ctrl+F in source). Transitorio per-mount del componente.
let searchMarks = []        // TextMarker delle occorrenze (evidenza tenue)
let currentMark = null      // mark del match corrente (evidenza forte, niente setSelection)
let searchPositions = []    // posizioni {from,to} di tutti i match
let searchIndex = -1        // indice del match corrente
let lastSearchValue = ''    // ultimo termine cercato (per replace + navigazione)
let lastSearchOpt = {}      // ultime opzioni (case/word/regex)
// cmStatePerTab è a livello modulo (vedi <script> sopra) → non ridichiarare qui

const { theme, sourceCode, zoom } = storeToRefs(preferencesStore)
const { currentFile: currentTab } = storeToRefs(editorStore)

watch(
  () => props.textDirection,
  (value, oldValue) => {
    if (value !== oldValue && editor.value) {
      setTextDirection(editor.value, value)
    }
  }
)

// Font-size base CodeMirror (px) — allineato al valore in one-dark.css/sourceCode.vue style
const CM_BASE_FONT_SIZE = 18

watch(zoom, (newZoom) => {
  if (!editor.value) return
  const factor = newZoom || 1
  editor.value.getWrapperElement().style.fontSize = `${Math.round(CM_BASE_FONT_SIZE * factor)}px`
  editor.value.refresh()
})

const getMarkdownAndCursor = (cm) => {
  let focus = cm.getCursor('head')
  let anchor = cm.getCursor('anchor')

  const markdown = cm.getValue()
  const convertToMuyaCursor = (cursor) => {
    const line = cm.getLine(cursor.line)
    const preLine = cm.getLine(cursor.line - 1)
    const nextLine = cm.getLine(cursor.line + 1)
    return adjustCursor(cursor, preLine, line, nextLine)
  }

  anchor = convertToMuyaCursor(anchor) // Selection start as Muya cursor
  focus = convertToMuyaCursor(focus) // Selection end as Muya cursor

  // Normalize cursor that `anchor` is always before `focus` because
  // this is the expected behavior in Muya.
  if (anchor && focus && anchor.line > focus.line) {
    const tmpCursor = focus
    focus = anchor
    anchor = tmpCursor
  }
  return { cursor: { focus, anchor }, markdown }
}

const prepareTabSwitch = () => {
  if (commitTimer.value) clearTimeout(commitTimer.value)
  if (tabId.value) {
    if (!isFirstLoad.value) {
      // P6: il primo handleFileChange è il caricamento iniziale — nessuna modifica da salvare.
      // Saltare evita che justLoaded venga consumato qui, prima che il debounce post-setValue
      // possa usarlo per sincronizzare originalMarkdown senza alzare il bollino.
      const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
      editorStore.LISTEN_FOR_CONTENT_CHANGE({
        id: tabId.value,
        markdown: newMarkdown,
        muyaIndexCursor: cursor
      })
    }
    // Salva snapshot {content, history} prima di invalidare tabId.
    // getHistory() ritorna deep copy → non corrotta da setValue successivi.
    // Usare il content CM (non lo store) garantisce consistenza con le posizioni in history.
    if (editor.value) {
      const hist = editor.value.getHistory()
      // R2 (rivisto): NESSUN cap LRU. Tutte le tab della sessione mantengono la propria
      // history undo (decisione utente). Lo snapshot viene rimosso solo alla chiusura della
      // tab (onBeforeUnmount). Per il rischio RAM con molte tab → avviso "troppe tab" gestito
      // altrove (notifica perf), non si butta più la history.
      cmStatePerTab.set(tabId.value, {
        content: editor.value.getValue(),
        history: hist
      })
    }
    isFirstLoad.value = false
    tabId.value = null // invalidate tab id
  }
}

const scrollToCords = (y) => {
  requestAnimationFrame(() => {
    // Ensures there we have scrolled to that position before the browser paints the next frame
    // prevents "flickers"
    // B7: guard, componente può smontarsi prima del frame → null deref
    // Bug 6: scroll surface ora è .CodeMirror-scroll (interno CM) → API CM scrollTo
    if (editor.value) {
      editor.value.scrollTo(null, y)
    }
  })
}

/**
 * Carica il content in `cm` dallo snapshot (se allineato allo store) o da `storeMarkdown`.
 * Restituisce { history, savedCursor } da applicare DOPO il posizionamento del cursore.
 * history=null → il caller deve chiamare clearHistory(); savedCursor=null → usare il fallback del caller.
 * Regola chiave: setHistory va SEMPRE chiamato DOPO setCursor per non lasciare un selection event
 * in cima allo stack (che CM5 skeppa al Ctrl+Z rimuovendo 2 entry invece di 1).
 */
const restoreCmStateForTab = (cm, id, storeMarkdown) => {
  if (cmStatePerTab.has(id)) {
    const { content, history, cursor: savedCursor } = cmStatePerTab.get(id)
    if (typeof storeMarkdown === 'string' && storeMarkdown !== content) {
      // Snapshot stale rispetto allo store (modifiche in Muya nel frattempo) → usa store, history azzerata.
      cm.setValue(storeMarkdown)
      return { history: null, savedCursor: null }
    }
    // Snapshot allineato: ripristina contenuto + history (preserva undo cross-tab).
    cm.setValue(content)
    return { history, savedCursor }
  }
  // Prima visita: carica dallo store.
  if (typeof storeMarkdown === 'string') {
    cm.setValue(storeMarkdown)
  }
  return { history: null, savedCursor: null }
}

const handleFileChange = ({ id, markdown: newMarkdown, cursor, scrollTop, forceReload, renderCursor, pathname, filename }) => {
  // sourceCode=false significa che il componente sta per smontarsi (tab close o switch).
  // Non processare eventi: evita di caricare contenuto/history di tab estranee in CM
  // e di cambiare tabId (che poi causerebbe emit spurio in onBeforeUnmount).
  if (!sourceCode.value) return

  const eventTab = pathname ? null : editorStore.tabs.find((tab) => tab.id === id)
  const modeFilename = pathname || eventTab?.pathname || eventTab?.filename || filename || currentTab.value?.pathname || currentTab.value?.filename || ''
  if (editor.value) {
    setModeForFile(editor.value, modeFilename)
  }

  // Stessa tab già attiva: skip save/restore per preservare la history.
  // commitTimer (1s) → LISTEN_FOR_CONTENT_CHANGE → store update → parent watch re-emette
  // file-changed per la tab corrente. Fare setValue+setHistory qui azzerebbe lo stack undo
  // ogni secondo, rendendo Ctrl+Z permanentemente inutile.
  if (id === tabId.value) {
    // Reload esterno (file modificato da altro programma) della tab corrente: forceReload
    // distingue questo caso dal re-emit del commitTimer → qui DOBBIAMO ricaricare il contenuto
    // in CM, altrimenti il file non si aggiorna a video.
    if (forceReload && typeof newMarkdown === 'string' && editor.value) {
      // il debounce pendente porterebbe contenuto stale (pre-reload) → annullalo
      if (commitTimer.value) { clearTimeout(commitTimer.value); commitTimer.value = null }
      editor.value.setValue(newMarkdown)
      editor.value.refresh()
      // setValue NON azzera l'undo di CM5 (vedi BUG-CTRLZ): senza questo Ctrl+Z post-reload
      // tornerebbe al contenuto pre-reload. Reload da disco = undo riparte pulito (intento doc EASY §104).
      editor.value.clearHistory()
      // H8 — azzera + reseed history unificata al reload da disco (Q2)
      if (isUnifiedTarget(currentTab.value?.pathname)) {
        clearUnified(id)
        const s = getMarkdownAndCursor(editor.value)
        seedUnified(id, s.markdown, s.cursor)
        lastUndoSize = editor.value.historySize().undo
      }
      // baseline pulita: il contenuto CM è ora il file su disco (come al caricamento iniziale)
      if (currentTab.value) {
        currentTab.value.isSaved = true
        currentTab.value.justLoaded = false
      }
      return
    }
    // Pulisce justLoaded: CM non normalizza come Muya → il content caricato è già il baseline
    // corretto, nessun bisogno che LISTEN_FOR_CONTENT_CHANGE aggiorni originalMarkdown.
    if (currentTab.value && currentTab.value.justLoaded) {
      currentTab.value.justLoaded = false
    }
    // Jump a riga richiesto dalla sidebar di ricerca (click su match nella tab già attiva).
    // Solo setSelection, nessun setValue → la history undo resta intatta.
    if (renderCursor && cursor && editor.value) {
      const { anchor, focus } = cursor
      try {
        const lineCount = editor.value.lineCount()
        const clampLine = (l) => Math.max(0, Math.min(typeof l === 'number' ? l : 0, lineCount - 1))
        editor.value.setSelection(
          { line: clampLine(anchor?.line), ch: anchor?.ch ?? 0 },
          { line: clampLine(focus?.line), ch: focus?.ch ?? 0 },
          { scroll: true }
        )
      } catch {}
    }
    return
  }

  prepareTabSwitch()

  // historyToRestore viene applicato DOPO il cursor positioning (regola spiegata in restoreCmStateForTab).
  const { history: histSnap } = restoreCmStateForTab(editor.value, id, newMarkdown)
  let historyToRestore = histSnap

  if (typeof newMarkdown === 'string' || cmStatePerTab.has(id)) {
    // P-DF8-1: tiny line + crash "Cannot read properties of undefined (reading 'map')".
    // Single rAF non basta: misura prima del paint completo, lineView restano stale →
    // tiny line + click su line non sincronizzata → mapFromLineView ritorna undefined.
    // Refresh sync: forza ricalcolo views immediato (evita stato stale per click rapidi).
    // Doppio rAF: garantisce layout+paint completo del browser prima della rimisura finale.
    editor.value.refresh()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (editor.value) editor.value.refresh()
      })
    })
    // Bug A: in modalità sourceCode (CodeMirror) il markdown caricato è il baseline corretto.
    // CM non normalizza il contenuto come Muya → spegnere justLoaded evita che il primo
    // LISTEN_FOR_CONTENT_CHANGE post-edit sovrascriva originalMarkdown con il contenuto
    // post-modifica, rompendo il check di Ctrl+Z back-to-saved.
    if (currentTab.value && currentTab.value.justLoaded) {
      currentTab.value.justLoaded = false
    }
  }

  // t('editor.sourceCode.cursorNullComment')

  if (cursor) {
    const { anchor, focus } = cursor
    try {
      // NB11: clamp coordinate cursore prima di setSelection.
      // Causa crash chunkSize: cursore in formato Muya (no campo ch) o
      // cursore da file precedente con più righe di quello appena caricato.
      const lineCount = editor.value.lineCount()
      const clampLine = (l) => Math.max(0, Math.min(typeof l === 'number' ? l : 0, lineCount - 1))
      const safeAnchor = { line: clampLine(anchor?.line), ch: anchor?.ch ?? 0 }
      const safeFocus = { line: clampLine(focus?.line), ch: focus?.ch ?? 0 }
      editor.value.setSelection(safeAnchor, safeFocus, { scroll: true })
    } catch {
      // Fallback: errore residuo (cursore formato incompatibile) → inizio file
      setCursorAtFirstLine(editor.value)
    }
  } else {
    setCursorAtFirstLine(editor.value)
  }

  // setHistory DOPO il cursor positioning: sovrascrive il selection event che setCursorAtFirstLine
  // ha appena aggiunto, garantendo uno stack undo pulito senza eventi fantasma in cima.
  if (historyToRestore) {
    editor.value.setHistory(historyToRestore)
  } else {
    // BUG Ctrl+Z cross-tab: setValue() NON azzera l'undo stack di CM5 (la sostituzione resta
    // annullabile) → senza questo, Ctrl+Z sulla nuova tab annullerebbe il setValue e mostrerebbe
    // il contenuto della tab PRECEDENTE. clearHistory dopo il cursore = stack undo pulito e isolato.
    editor.value.clearHistory()
  }

  if (typeof scrollTop === 'number') {
    scrollToCords(scrollTop)
  }
  tabId.value = id

  // H8 — seed baseline unificata allo switch tab in source mode.
  // seedUnified è idempotente → nessun rischio di azzerare la history di una tab già caricata.
  if (isUnifiedTarget(currentTab.value?.pathname)) {
    const s = getMarkdownAndCursor(editor.value)
    seedUnified(id, s.markdown, s.cursor)
    lastUndoSize = editor.value.historySize().undo
  }

  // R4: degrade expensive CM options on very large files to prevent freeze/lag.
  if (editor.value) {
    const fileSize = (newMarkdown || currentTab.value?.markdown || '').length
    const isHuge = fileSize > 10 * 1024 * 1024 // 10 MB
    editor.value.setOption('highlightSelectionMatches', isHuge ? false : {
      minChars: 2,
      wordsOnly: true,
      showToken: false
    })
    editor.value.setOption('styleActiveLine', !isHuge)
  }

  // Switch source→source (nessun remount del componente): il setValue qui sopra ha cancellato
  // i mark di ricerca. Chiedi alla sidebar di ri-evidenziare se la ricerca è attiva. Il caso col
  // remount (Muya→source) è già coperto dall'emit nel setTimeout di onMounted.
  bus.emit('request-search-highlight')
}

const handleInvalidateImageCache = () => {
  if (editor.value) {
    editor.value.invalidateImageCache()
  }
}

// Bug 2: handler undo/redo per modalità sourceCode (CodeMirror)
const handleUndo = () => {
  if (!editor.value) return
  if (isUnifiedTarget(currentTab.value?.pathname)) {
    // Flush tail: cattura lo stato live se non ancora committato al funnel (debounce 1s)
    const live = getMarkdownAndCursor(editor.value)
    pushUnified(tabId.value, live.markdown, live.cursor, 'source-undo-flush')
    const snap = unifiedUndo(tabId.value)
    if (snap) bus.emit('unified-replay', snap)
    return
  }
  editor.value.execCommand('undo')
}

const handleRedo = () => {
  if (!editor.value) return
  if (isUnifiedTarget(currentTab.value?.pathname)) {
    const live = getMarkdownAndCursor(editor.value)
    pushUnified(tabId.value, live.markdown, live.cursor, 'source-redo-flush')
    const snap = unifiedRedo(tabId.value)
    if (snap) bus.emit('unified-replay', snap)
    return
  }
  editor.value.execCommand('redo')
}

// Applica uno snapshot unified-undo/redo in source mode (guardia: solo se source attivo)
const handleUnifiedReplay = ({ markdown, muyaIndexCursor }) => {
  if (!sourceCode.value || !editor.value) return
  const cm = editor.value
  cm.setValue(markdown)
  if (muyaIndexCursor?.anchor && muyaIndexCursor?.focus) {
    const lineCount = cm.lineCount()
    const clampPos = (p) => ({
      line: Math.max(0, Math.min(p?.line ?? 0, lineCount - 1)),
      ch: Math.max(0, Math.min(p?.ch ?? 0, cm.getLine(Math.max(0, Math.min(p?.line ?? 0, lineCount - 1))).length))
    })
    cm.setSelection(clampPos(muyaIndexCursor.anchor), clampPos(muyaIndexCursor.focus))
  }
}

// Trasforma il case della selezione corrente in CodeMirror
const handleToUpperCase = () => {
  if (!sourceCode.value || !editor.value) return
  const updated = editor.value.getSelections().map(s => s.toUpperCase())
  editor.value.replaceSelections(updated, 'around')
}

const handleToLowerCase = () => {
  if (!sourceCode.value || !editor.value) return
  const updated = editor.value.getSelections().map(s => s.toLowerCase())
  editor.value.replaceSelections(updated, 'around')
}

const sendSourceCodeFocusState = (focused) => {
  const { windowId } = global.marktext.env
  window.electron.ipcRenderer.send('mt::source-code-focus-changed', {
    windowId,
    focused: !!focused
  })
}

const handleSourceCommentActionFromMain = (action) => {
  if (!sourceCode.value || !editor.value) return
  applySourceCommentAction(editor.value, action)
}

const handleSourceCommentFromMain = () => {
  handleSourceCommentActionFromMain('comment')
}

const handleSourceUncommentFromMain = () => {
  handleSourceCommentActionFromMain('uncomment')
}


// Flush sincronizzato CM→store prima del salvataggio (Ctrl+S / Save As).
// FILE_SAVE emette 'pre-save' via bus (mitt = sincrono) PRIMA di leggere tab.markdown.
// Qui cancelliamo il commitTimer e committiamo subito il contenuto CM reale,
// così FILE_SAVE legge il valore aggiornato invece dello stale da 1s di debounce.
const handlePreSave = () => {
  if (commitTimer.value) {
    clearTimeout(commitTimer.value)
    commitTimer.value = null
  }
  // NB: NON filtrare per isFirstLoad. Un Ctrl+S è sempre esplicito → il contenuto in CM
  // DEVE essere flushato nello store prima che FILE_SAVE legga tab.markdown. isFirstLoad
  // resta true per una tab aperta e mai cambiata (azzerato solo in prepareTabSwitch dentro
  // `if (tabId.value)`, saltato al primo load) → con la guardia il flush non avveniva mai
  // e Ctrl+S entro il debounce 1s salvava contenuto stale. Se non ci sono modifiche reali,
  // LISTEN_FOR_CONTENT_CHANGE è comunque no-op (markdown === oldMarkdown).
  if (editor.value && tabId.value) {
    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
    editorStore.LISTEN_FOR_CONTENT_CHANGE({
      id: tabId.value,
      markdown: newMarkdown,
      muyaIndexCursor: cursor
    })
  }
}

// Avvolge la selezione (o inserisce marcatori vuoti al cursore) con `before`/`after`.
const wrapSelection = (cm, before, after = before) => {
  if (cm.somethingSelected()) {
    cm.replaceSelection(before + cm.getSelection() + after)
  } else {
    const cursor = cm.getCursor()
    cm.replaceRange(before + after, cursor)
    cm.setCursor({ line: cursor.line, ch: cursor.ch + before.length })
  }
  cm.focus()
}

const NON_WS_RE = /[^\s\u00a0]/

const getModeAtPosition = (cm, pos) => {
  if (typeof cm.getModeAt === 'function') {
    return cm.getModeAt(pos)
  }
  return cm.getMode()
}

const isBlockCommentOnlyMode = (mode) => {
  return !!(mode?.blockCommentStart && mode?.blockCommentEnd && !mode?.lineComment)
}

const getBlockCommentEndLine = (cm, from, to) => {
  let endLine = Math.min(to.line, cm.lastLine())
  const isSingleSelection = from.line === to.line && from.ch === to.ch
  if (!isSingleSelection && to.ch === 0 && NON_WS_RE.test(cm.getLine(endLine))) {
    endLine -= 1
  }
  return endLine
}

const getCommonIndentForRange = (cm, fromLine, endLine) => {
  let commonIndent = null
  for (let lineNumber = fromLine; lineNumber <= endLine; lineNumber++) {
    const line = cm.getLine(lineNumber)
    if (!NON_WS_RE.test(line)) continue
    const indent = line.match(/^\s*/)?.[0] ?? ''
    if (commonIndent === null || indent.length < commonIndent.length) {
      commonIndent = indent
    }
  }
  return commonIndent ?? ''
}

const insertIndentAwareBlockComment = (cm, from, to, mode) => {
  const endLine = getBlockCommentEndLine(cm, from, to)
  if (from.line > endLine) return

  const commonIndent = getCommonIndentForRange(cm, from.line, endLine)
  const pad = ' '
  const endLineText = cm.getLine(endLine)

  // Inserire prima la chiusura per evitare di spostare la posizione target su selezione singola.
  cm.replaceRange(`${pad}${mode.blockCommentEnd}`, { line: endLine, ch: endLineText.length })
  cm.replaceRange(`${mode.blockCommentStart}${pad}`, { line: from.line, ch: commonIndent.length })
}

const toggleIndentAwareBlockComment = (cm, from, to, mode) => {
  const didUncomment = cm.uncomment(from, to, { indent: true })
  if (!didUncomment) {
    insertIndentAwareBlockComment(cm, from, to, mode)
  }
}

const applyLineCommentToggleForRange = (cm, from, to) => {
  const didUncomment = cm.uncomment(from, to, { indent: true })
  if (!didUncomment) {
    cm.lineComment(from, to, { indent: true })
  }
}

// Applicare commento source a tutte le selezioni attive, da fondo a cima, per evitare
// spostamenti di indice sui range successivi.
const applySourceCommentAction = (cm, action) => {
  const ranges = cm.listSelections()

  if (action === 'toggle') {
    const hasBlockCommentOnlySelection = ranges.some((range) => {
      const mode = getModeAtPosition(cm, range.from())
      return isBlockCommentOnlyMode(mode)
    })
    if (!hasBlockCommentOnlySelection) {
      cm.toggleComment({ indent: true })
      cm.focus()
      return
    }
  }

  cm.operation(() => {
    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i]
      const from = range.from()
      const to = range.to()
      const mode = getModeAtPosition(cm, from)
      const blockCommentOnly = isBlockCommentOnlyMode(mode)

      if (!blockCommentOnly) {
        if (action === 'comment') {
          cm.lineComment(from, to, { indent: true })
        } else if (action === 'uncomment') {
          cm.uncomment(from, to, { indent: true })
        } else if (action === 'toggle') {
          applyLineCommentToggleForRange(cm, from, to)
        }
        continue
      }

      if (action === 'comment') {
        insertIndentAwareBlockComment(cm, from, to, mode)
      } else if (action === 'uncomment') {
        cm.uncomment(from, to, { indent: true })
      } else if (action === 'toggle') {
        toggleIndentAwareBlockComment(cm, from, to, mode)
      }
    }
  })

  cm.focus()
}

// Intercetta eventi 'format' in source mode.
// 'del' e 'link' sono selection-aware: selezione → sintassi markdown; cursore nudo → line-op legacy.
const handleFormatInSource = (type) => {
  if (!sourceCode.value || !editor.value) return
  const cm = editor.value
  if (type === 'del') {
    if (cm.somethingSelected()) {
      // Selezione presente → strikethrough ~~testo~~
      wrapSelection(cm, '~~')
    } else {
      // Nessuna selezione (Ctrl+D) → duplica riga corrente (line-op legacy)
      // H1: collassa multi-selezione per evitare duplicazioni incoerenti
      if (cm.listSelections().length > 1) cm.execCommand('singleSelection')
      const from = cm.getCursor('from')
      const to = cm.getCursor('to')
      const hasSel = from.line !== to.line || from.ch !== to.ch
      if (!hasSel) {
        cm.replaceRange(cm.getLine(from.line) + '\n', { line: from.line, ch: 0 })
      } else {
        // edge case: selezione finisce a ch=0 → l'ultima riga non è toccata → escludila
        const endLine = (to.ch === 0 && to.line > from.line) ? to.line - 1 : to.line
        const lines = []
        for (let i = from.line; i <= endLine; i++) lines.push(cm.getLine(i))
        cm.replaceRange(lines.join('\n') + '\n', { line: from.line, ch: 0 })
      }
      cm.focus()
    }
  } else if (type === 'link') {
    if (cm.somethingSelected()) {
      // Selezione presente → inserisci link [testo]()
      const sel = cm.getSelection()
      cm.replaceSelection(`[${sel}]()`)
      const pos = cm.getCursor()
      cm.setCursor({ line: pos.line, ch: pos.ch - 1 }) // cursore dentro ()
      cm.focus()
    } else {
      // Nessuna selezione (Ctrl+L) → elimina riga corrente (line-op legacy)
      cm.execCommand('deleteLine')
      cm.focus()
    }
  } else if (type === 'strong') {
    wrapSelection(cm, '**')
  } else if (type === 'em') {
    wrapSelection(cm, '_')
  } else if (type === 'u') {
    wrapSelection(cm, '<u>', '</u>')
  } else if (type === 'mark') {
    wrapSelection(cm, '==')
  } else if (type === 'sup') {
    wrapSelection(cm, '^')
  } else if (type === 'sub') {
    wrapSelection(cm, '~')
  } else if (type === 'inline_code') {
    wrapSelection(cm, '`')
  } else if (type === 'inline_math') {
    wrapSelection(cm, '$')
  } else if (type === 'image') {
    const sel = cm.somethingSelected() ? cm.getSelection() : ''
    cm.replaceSelection(`![${sel}]()`)
    if (!sel) {
      const pos = cm.getCursor()
      // Posiziona il cursore sull'alt text (![|]()); 3 chars back da ')' = dentro '[]'
      cm.setCursor({ line: pos.line, ch: pos.ch - 3 })
    }
    cm.focus()
  } else if (type === 'clear') {
    if (cm.somethingSelected()) {
      const text = cm.getSelection()
      // Rimuove i wrapper markdown più comuni (solo se simmetrici)
      const stripped = text
        .replace(/^\*\*(.*)\*\*$/, '$1')
        .replace(/^__(.*)__$/, '$1')
        .replace(/^\*(.*)\*$/, '$1')
        .replace(/^_(.*)_$/, '$1')
        .replace(/^~~(.*)~~$/, '$1')
        .replace(/^`(.*)`$/, '$1')
        .replace(/^<u>(.*)<\/u>$/, '$1')
        .replace(/^==(.*)==$/, '$1')
        .replace(/^\^(.*)\^$/, '$1')
      cm.replaceSelection(stripped)
      cm.focus()
    }
  }
}

// Intercetta eventi 'paragraph' in source mode: inserisce sintassi markdown reale via CM.
// Solo per file markdown; no-op per altri tipi di file.
const handleParagraphInSource = (type) => {
  if (!sourceCode.value || !editor.value) return
  if (!isMarkdownPath(currentTab.value?.pathname)) return
  const cm = editor.value

  // Applica `prefix` all'inizio di ogni riga coperta dalla selezione.
  // Rimuove prefissi heading/blockquote/list preesistenti prima di applicare il nuovo.
  const setLinePrefix = (prefix) => {
    const from = cm.getCursor('from')
    const to = cm.getCursor('to')
    const endLine = (to.ch === 0 && to.line > from.line) ? to.line - 1 : to.line
    cm.operation(() => {
      for (let i = from.line; i <= endLine; i++) {
        const text = cm.getLine(i)
        const clean = text.replace(/^#{1,6}\s?/, '').replace(/^>\s?/, '')
          .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '').replace(/^[-*+]\s/, '')
          .replace(/^\d+\.\s/, '')
        cm.replaceRange(prefix + clean, { line: i, ch: 0 }, { line: i, ch: text.length })
      }
    })
    cm.focus()
  }

  if (type.startsWith('heading ')) {
    const level = parseInt(type.split(' ')[1])
    setLinePrefix('#'.repeat(level) + ' ')
  } else if (type === 'paragraph' || type === 'reset-to-paragraph') {
    setLinePrefix('')
  } else if (type === 'upgrade heading') {
    const lineText = cm.getLine(cm.getCursor().line)
    const match = lineText.match(/^(#{1,5})\s/)
    if (match) setLinePrefix('#'.repeat(match[1].length + 1) + ' ')
  } else if (type === 'degrade heading') {
    const lineText = cm.getLine(cm.getCursor().line)
    const match = lineText.match(/^(#{2,6})\s/)
    if (match) setLinePrefix('#'.repeat(match[1].length - 1) + ' ')
  } else if (type === 'blockquote') {
    setLinePrefix('> ')
  } else if (type === 'ol-bullet') {
    setLinePrefix('1. ')
  } else if (type === 'ul-bullet') {
    setLinePrefix('- ')
  } else if (type === 'ul-task') {
    setLinePrefix('- [ ] ')
  } else if (type === 'hr') {
    const line = cm.getCursor().line
    cm.replaceRange('\n---\n', { line, ch: cm.getLine(line).length })
    cm.setCursor({ line: line + 2, ch: 0 })
    cm.focus()
  } else if (type === 'pre') {
    const line = cm.getCursor().line
    cm.replaceRange('\n```\n\n```', { line, ch: cm.getLine(line).length })
    cm.setCursor({ line: line + 2, ch: 0 })
    cm.focus()
  } else if (type === 'mathblock') {
    const line = cm.getCursor().line
    cm.replaceRange('\n$$\n\n$$', { line, ch: cm.getLine(line).length })
    cm.setCursor({ line: line + 2, ch: 0 })
    cm.focus()
  } else if (type === 'table') {
    const line = cm.getCursor().line
    cm.replaceRange('\n| Col 1 | Col 2 |\n| --- | --- |\n| Cell | Cell |',
      { line, ch: cm.getLine(line).length })
    cm.setCursor({ line: line + 1, ch: 0 })
    cm.focus()
  } else if (type === 'html') {
    const line = cm.getCursor().line
    cm.replaceRange('\n<div>\n\n</div>', { line, ch: cm.getLine(line).length })
    cm.setCursor({ line: line + 2, ch: 0 })
    cm.focus()
  } else if (type === 'front-matter') {
    if (cm.getLine(0) !== '---') {
      cm.replaceRange('---\n\n---\n\n', { line: 0, ch: 0 })
      cm.setCursor({ line: 1, ch: 0 })
      cm.focus()
    }
  }
  // 'loose-list-item': semantica complessa (blank line dopo list item) → no-op in source
}

// ---- Ricerca CodeMirror (Ctrl+F in source) ----------------------------------
// Costruisce la query per getSearchCursor rispettando le opzioni del riquadro find.
const buildSearchQuery = (value, opt) => {
  if (opt && opt.isRegexp) {
    return new RegExp(value, opt.isCaseSensitive ? 'g' : 'gi') // può lanciare → try/catch nel chiamante
  }
  if (opt && opt.isWholeWord) {
    const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${esc}\\b`, opt.isCaseSensitive ? 'g' : 'gi')
  }
  return value // stringa semplice: getSearchCursor gestisce caseFold
}

// Rimuove tutte le evidenziazioni (match tenui + match corrente) e azzera lo stato.
const clearSearchHighlight = () => {
  searchMarks.forEach((m) => m.clear())
  if (currentMark) {
    currentMark.clear()
    currentMark = null
  }
  searchMarks = []
  searchPositions = []
  searchIndex = -1
}

// Aggiorna il contatore nel riquadro find (stessa shape di Muya: {value,index,matches}).
const pushSearchMatchesToStore = () => {
  editorStore.SEARCH({ value: lastSearchValue, index: searchIndex, matches: searchPositions })
}

// Evidenzia in modo forte il match corrente SENZA usare setSelection: così il
// match-highlighter (basato sulla selezione) NON aggiunge l'evidenza blu. Scrolla per renderlo visibile.
const markCurrentMatch = () => {
  if (currentMark) {
    currentMark.clear()
    currentMark = null
  }
  if (searchIndex < 0 || searchIndex >= searchPositions.length || !editor.value) return
  const pos = searchPositions[searchIndex]
  currentMark = editor.value.markText(pos.from, pos.to, { className: 'cm-search-match-current' })
  editor.value.scrollIntoView({ from: pos.from, to: pos.to }, 60)
}

// Core ricerca: trova ed evidenzia leggermente tutte le occorrenze (.cm-search-match).
// jump=true → evidenzia anche il match corrente e ci scrolla (Ctrl+F flottante).
// jump=false → solo highlight, nessuno spostamento cursore (ricerca sidebar tutte-le-tab).
const highlightSourceMatches = (value, opt, jump) => {
  if (!sourceCode.value || !editor.value) return
  clearSearchHighlight()
  lastSearchValue = value || ''
  lastSearchOpt = opt || {}
  if (!value) {
    pushSearchMatchesToStore()
    return
  }
  let query
  try {
    query = buildSearchQuery(value, opt)
  } catch {
    pushSearchMatchesToStore() // regex non valida → nessun match, nessun crash
    return
  }
  const cm = editor.value
  const caseFold = !(opt && opt.isCaseSensitive)
  const cursor = cm.getSearchCursor(query, { line: 0, ch: 0 }, { caseFold })
  // P-REV5: cap mark a 1000 per evitare freeze su ricerche broad (es. "e" su file grande).
  const MAX_MARKS = 1000
  while (cursor.findNext()) {
    const from = cursor.from()
    const to = cursor.to()
    if (from.line === to.line && from.ch === to.ch) break // match a lunghezza zero → stop
    searchPositions.push({ from, to })
    searchMarks.push(cm.markText(from, to, { className: 'cm-search-match' }))
    if (searchMarks.length >= MAX_MARKS) break
  }
  if (searchPositions.length && jump) {
    // Match corrente = primo a partire dal cursore (in avanti), altrimenti il primo.
    const head = cm.getCursor('from')
    let idx = searchPositions.findIndex(
      (p) => p.from.line > head.line || (p.from.line === head.line && p.from.ch >= head.ch)
    )
    if (idx === -1) idx = 0
    searchIndex = idx
    markCurrentMatch()
  }
  pushSearchMatchesToStore()
}

// Ctrl+F (riquadro flottante): ricerca + salto al match corrente.
const handleSourceSearch = ({ value, opt }) => {
  highlightSourceMatches(value, opt, true)
}

// Ricerca sidebar (tutte le tab): evidenzia i match nell'editor source SENZA spostare il cursore.
const handleSidebarHighlight = ({ value, opt }) => {
  highlightSourceMatches(value, opt, false)
}

// Naviga tra i match (frecce su/giù del riquadro find).
const handleSourceFindAction = (action) => {
  if (!sourceCode.value || !editor.value || !searchPositions.length) return
  if (action === 'next') searchIndex = (searchIndex + 1) % searchPositions.length
  else if (action === 'prev') searchIndex = (searchIndex - 1 + searchPositions.length) % searchPositions.length
  markCurrentMatch()
  pushSearchMatchesToStore()
}

// Sostituisce il match corrente (isSingle) o tutti. Il contenuto cambia → passa per
// cursorActivity/commit (dirty flag gestito normalmente).
const handleSourceReplace = ({ value: replacement, opt }) => {
  if (!sourceCode.value || !editor.value || !searchPositions.length) return
  const cm = editor.value
  const repl = replacement || ''
  if (opt && opt.isSingle) {
    if (searchIndex < 0 || searchIndex >= searchPositions.length) return
    const pos = searchPositions[searchIndex]
    cm.replaceRange(repl, pos.from, pos.to)
  } else {
    // Replace all: dall'ultimo al primo per non invalidare le posizioni precedenti.
    cm.operation(() => {
      for (let i = searchPositions.length - 1; i >= 0; i--) {
        const pos = searchPositions[i]
        cm.replaceRange(repl, pos.from, pos.to)
      }
    })
  }
  // Ri-cerca per aggiornare evidenziazioni e indice sul testo modificato.
  handleSourceSearch({ value: lastSearchValue, opt: lastSearchOpt })
}

const handleSelectAll = () => {
  if (!sourceCode.value) {
    return
  }

  if (editor.value && editor.value.hasFocus()) {
    editor.value.execCommand('selectAll')
  } else {
    const activeElement = document.activeElement
    const nodeName = activeElement.nodeName
    if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
      if (typeof activeElement.select === 'function') {
        activeElement.select()
      }
    }
  }
}

const handleImageAction = ({ id, result, alt }) => {
  const value = editor.value.getValue()
  const focus = editor.value.getCursor('focus')
  const anchor = editor.value.getCursor('anchor')
  const lines = value.split('\n')
  const index = lines.findIndex((line) => line.indexOf(id) > 0)

  if (index > -1) {
    const oldLine = lines[index]
    lines[index] = oldLine.replace(new RegExp(`!\\[${id}\\]\\(.*\\)`), `![${alt}](${result})`)
    const newValue = lines.join('\n')
    editor.value.setValue(newValue)
    const match = /(!\[.*\]\(.*\))/.exec(oldLine)
    if (!match) {
      // t('editor.sourceCode.imageStructureDeletedComment')
      return
    }
    const range = {
      start: match.index,
      end: match.index + match[1].length
    }
    const delta = alt.length + result.length + 5 - match[1].length

    const adjustPointer = (pointer) => {
      if (!pointer) {
        return
      }
      if (pointer.line !== index) {
        return
      }
      if (pointer.ch <= range.start) {
        // do nothing.
      } else if (pointer.ch > range.start && pointer.ch < range.end) {
        pointer.ch = range.start + alt.length + result.length + 5
      } else {
        pointer.ch += delta
      }
    }

    adjustPointer(focus)
    adjustPointer(anchor)
    if (focus && anchor) {
      editor.value.setSelection(anchor, focus, { scroll: true })
    } else {
      setCursorAtFirstLine()
    }
  }
}

const listenChange = () => {
  editor.value.on('cursorActivity', (cm) => {
    // Traccia la selezione CM per i trigger di ricerca (Ctrl+F / Ctrl+Shift+F su selezione).
    editorStore.SET_SELECTION(cm.getSelection())
    // v2: emette posizione cursor per status bar (Ln/Col)
    const cmCursor = cm.getCursor()
    if (cmCursor && typeof cmCursor.line === 'number') {
      bus.emit('statusbar::cursor-change', {
        line: cmCursor.line + 1,
        col: cmCursor.ch + 1
      })
    }

    // P-REV2: confronta la changeGeneration CM: se non è cambiata rispetto all'ultimo evento,
    // il contenuto è invariato (puro spostamento cursore) → skip del percorso costoso
    // (getValue O(n), adjustTrailingNewlines×2, getWordCount O(n), commitTimer reset).
    const currentGen = cm.changeGeneration()
    if (currentGen === lastChangeGen) return
    lastChangeGen = currentGen

    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(cm)

    // N12: check immediato isSaved (no debounce) per feedback bollino istantaneo dopo Ctrl+Z.
    // Normalizza ENTRAMBI i lati con adjustTrailingNewlines: originalMarkdown dopo un
    // load/reload è il contenuto GREZZO del disco (non normalizzato). Se i trailing-newline
    // del file ≠ forma normalizzata, confrontare grezzo vs normalizzato dava false-dirty
    // su ogni click cursore anche senza modifiche. adjustTrailingNewlines è idempotente → sicuro.
    if (currentTab.value && currentTab.value.originalMarkdown !== null) {
      const trim = currentTab.value.trimTrailingNewline
      const normalizedNew = adjustTrailingNewlines(newMarkdown, trim)
      const normalizedOrig = adjustTrailingNewlines(currentTab.value.originalMarkdown, trim)
      if (normalizedNew === normalizedOrig && !currentTab.value.isSaved) {
        currentTab.value.isSaved = true
      } else if (normalizedNew !== normalizedOrig && currentTab.value.isSaved) {
        currentTab.value.isSaved = false
      }
    }

    // Attention: the cursor may be `{focus: null, anchor: null}` when press `backspace`
    const wordCount = getWordCount(newMarkdown)
    if (commitTimer.value) clearTimeout(commitTimer.value)
    commitTimer.value = setTimeout(() => {
      // See "beforeDestroy" note
      if (!viewDestroyed.value) {
        if (tabId.value) {
          editorStore.LISTEN_FOR_CONTENT_CHANGE({
            id: tabId.value,
            markdown: newMarkdown,
            wordCount,
            muyaIndexCursor: cursor
          })
        } else {
          // This may occur during tab switching but should not occur otherwise.
          console.warn(
            'LISTEN_FOR_CONTENT_CHANGE: Cannot commit changes because not tab id was set!'
          )
        }
      }
    }, 1000)
  })
}

onMounted(() => {
  const { id } = currentTab.value
  // reset currentTab scrollTop position because the codeMirror scroll position is completely different from the muya scroll position
  // reset blocks as well because the blocks are only valid in muya
  // reset cursor because this is a direct "key-cursor", not a muyaIndexCursor, which is {focus: number, anchor: number}
  currentTab.value.scrollTop = undefined
  currentTab.value.blocks = undefined
  currentTab.value.cursor = undefined

  const { markdown, muyaIndexCursor, textDirection } = props
  const container = sourceCodeContainer.value
  // Bug 6: scroll listener spostato su CM (editor.on('scroll')) post-init,
  // perché .source-code ha overflow:hidden e non emette più eventi scroll.
  const codeMirrorConfig = {
    value: markdown,
    lineNumbers: true,
    autofocus: true,
    // v2: lineWrapping pilotato da preferences.wordWrap (default true)
    lineWrapping: preferencesStore.wordWrap !== false,
    styleActiveLine: true,
    direction: textDirection,
    undoDepth: 1000, // R2: reduced from 10000; unified history (H8) handles Ctrl+Z for md files
    // Ctrl+Shift+↑/↓ liberi → sposta riga su/giù solo in source mode
    // Alt+↑/↓ in source mode = sposta riga su/giù (come Notepad++).
    // Ctrl+Shift+↑/↓ torna al default CM (estensione selezione).
    extraKeys: codeMirror.normalizeKeyMap({
      'Ctrl-/': (cm) => {
        applySourceCommentAction(cm, 'toggle')
      },
      'Ctrl-K C': (cm) => {
        applySourceCommentAction(cm, 'comment')
      },
      'Ctrl-K Ctrl-C': (cm) => {
        applySourceCommentAction(cm, 'comment')
      },
      'Cmd-K Cmd-C': (cm) => {
        applySourceCommentAction(cm, 'comment')
      },
      'Ctrl-K U': (cm) => {
        applySourceCommentAction(cm, 'uncomment')
      },
      'Ctrl-K Ctrl-U': (cm) => {
        applySourceCommentAction(cm, 'uncomment')
      },
      'Cmd-K Cmd-U': (cm) => {
        applySourceCommentAction(cm, 'uncomment')
      },
      'Alt-Up': 'swapLineUp',
      'Alt-Down': 'swapLineDown',
      // H1: Esc collassa la multi-selezione se attiva; altrimenti passa al handler find-panel.
      'Escape': (cm) => {
        if (cm.listSelections().length > 1) {
          cm.execCommand('singleSelection')
        } else {
          return codeMirror.Pass
        }
      }
    }),
    // Evidenzia le altre occorrenze della parola selezionata (solo source mode).
    // showToken:false → evidenzia solo la selezione esplicita, non la parola sotto cursore.
    // wordsOnly:true → evidenzia solo se la selezione è una parola intera (doppio-click):
    // selezionando lettere interne a una parola l'addon (isWord) non evidenzia nulla.
    highlightSelectionMatches: {
      minChars: 2,
      wordsOnly: true,
      showToken: false,
      annotateScrollbar: false,
      style: 'matchhighlight'
    }
    // Bug 6: rimosso `viewportMargin: Infinity`. Con scroll interno CM (default)
    // è inutile e rendere tutte le righe DOM-side è uno spreco di performance.
  }

  if (railscastsThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'railscasts'
  } else if (oneDarkThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'one-dark'
  }

  bus.on('file-loaded', handleFileChange)
  bus.on('invalidate-image-cache', handleInvalidateImageCache)
  bus.on('file-changed', handleFileChange)
  bus.on('selectAll', handleSelectAll)
  bus.on('image-action', handleImageAction)
  // H8: replay di uno snapshot unified in source mode
  bus.on('unified-replay', handleUnifiedReplay)
  // Bug 2: Ctrl+Z/Y intercettato da menu Electron, bus.emit('undo'/'redo') arriva qui
  // ma editor.vue handleUndo/handleRedo escono in sourceCode mode → instradiamo a CodeMirror
  bus.on('undo', handleUndo)
  bus.on('redo', handleRedo)
  bus.on('toUpperCase', handleToUpperCase)
  bus.on('toLowerCase', handleToLowerCase)
  bus.on('sourceComment', handleSourceCommentFromMain)
  bus.on('sourceUncomment', handleSourceUncommentFromMain)
  bus.on('format', handleFormatInSource)
  bus.on('paragraph', handleParagraphInSource)
  bus.on('pre-save', handlePreSave)
  // Ricerca CodeMirror (Ctrl+F in source): il riquadro find emette questi eventi.
  bus.on('searchValue', handleSourceSearch)
  bus.on('find-action', handleSourceFindAction)
  bus.on('replaceValue', handleSourceReplace)
  // Highlight nell'editor dei match della ricerca sidebar (senza spostare il cursore).
  bus.on('sidebar-highlight', handleSidebarHighlight)
  // v2: toggle word wrap dalla status bar
  bus.on('mt::wordwrap-change', (value) => {
    if (editor.value) {
      editor.value.setOption('lineWrapping', value)
      // NB10: forza CodeMirror a rimisurare dopo cambio wrap
      // (previene crash prepareMeasureForLine al click successivo)
      editor.value.refresh()
    }
  })

  // For some reason, code mirror does not seem to play well with Vue's refs if we reference editor.value directly.
  // See https://github.com/codemirror/codemirror5/issues/6886 - hence, we need to use a local variable first.
  // F12 DESIGN-FIX-8: markRaw evita Vue3 deep-reactive proxy su cm.doc tree.
  // Senza markRaw, accessi al doc tree creano proxy lazily → CodeMirror's internal indexOf
  // (loop manuale `arr[i] == elt`) confronta raw line con proxy line → ritorna -1 →
  // lineNo orphan → click triggera prepareMeasureForLine con lineN=-1 → cursore non si setta.
  const codeMirrorInstance = markRaw(codeMirror(container, codeMirrorConfig))

  const currentFileMode = currentTab.value?.pathname || currentTab.value?.filename || ''
  setModeForFile(codeMirrorInstance, currentFileMode)

  // Bug B: undo word-by-word + Bug 7: include andate-a-capo.
  // CodeMirror default merge changes con origin '+input' se entro historyEventDelay (1250ms).
  // Digitando "parola1 parola2" rapidamente tutto entra in un solo evento undo.
  // Reset lastModTime=0 dopo char di word-boundary forza il prossimo input a creare
  // un nuovo evento history → Ctrl+Z cancella una parola/riga alla volta.
  // Uso evento 'change' (non 'inputRead') perché Enter è gestito dal command
  // newlineAndIndent via replaceSelection — fires 'change' ma NON 'inputRead'.
  // change.text è array split su '\n' → join('\n') restituisce testo originale incluso \n.
  codeMirrorInstance.on('change', (cm, change) => {
    if (change.origin === '+input' && /[\s.,;:!?]/.test(change.text.join('\n'))) {
      cm.doc.history.lastModTime = 0
    }
    // H8 — cattura snapshot unificato a granularità nativa CM (a-parola, grazie al reset lastModTime).
    // Rileva un nuovo passo undo creato da CM confrontando historySize().undo con l'ultimo noto.
    if (isUnifiedTarget(currentTab.value?.pathname)) {
      const size = cm.historySize().undo
      if (size > lastUndoSize) {
        const { cursor, markdown } = getMarkdownAndCursor(cm)
        pushUnified(tabId.value, markdown, cursor, 'source-change')
      }
      // Risincronizza SEMPRE (anche su replay/setValue) per evitare falsi positivi al prossimo change
      lastUndoSize = cm.historySize().undo
    }
  })

  codeMirrorInstance.on('contextmenu', (cm, event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  // H1: traccia Ctrl per multi-selezione additiva da tastiera.
  // keydown/keyup sul wrapper CM (dove va il focus); blur su window per "stuck-modifier"
  // (es. alt-tab con Ctrl premuto → keyup si perde → blocca in modalità additiva).
  const wrapperEl = codeMirrorInstance.getWrapperElement()
  wrapperEl.addEventListener('keydown', onCtrlKeyDown)
  wrapperEl.addEventListener('keyup', onCtrlKeyUp)
  window.addEventListener('blur', onCtrlBlur)
  codeMirrorInstance.on('focus', () => {
    sendSourceCodeFocusState(true)
  })
  codeMirrorInstance.on('blur', () => {
    onCtrlBlur()
    sendSourceCodeFocusState(false)
  })

  // Mount in source mode: allineare subito stato focus nel main.
  sendSourceCodeFocusState(codeMirrorInstance.hasFocus())

  // H1: beforeSelectionChange — mantiene le selezioni non-vuote esistenti quando
  // il movimento da tastiera (Ctrl+frecce) tenterebbe di collassarle a una sola.
  // Scatta SOLO se: ctrlHeld=true, ≥1 selezione non-vuota esistente, origin=*move|+move,
  // e il nuovo set è più piccolo → previene il collasso.
  codeMirrorInstance.on('beforeSelectionChange', (cm, obj) => {
    if (!ctrlHeld) return
    const current = cm.listSelections()
    const nonEmpty = current.filter(r => !r.empty())
    if (nonEmpty.length < 1) return
    const origin = obj.origin || ''
    if (!/\*move|\+move/.test(origin)) return
    if (obj.ranges.length >= current.length) return
    // Mantiene le selezioni non-vuote + aggiunge la nuova posizione primaria
    obj.update([...nonEmpty, obj.ranges[0]])
  })

  // Bug 6: scroll listener su surface CM (.CodeMirror-scroll) — sostituisce ex
  // listener su .source-code (ora overflow:hidden, non emette scroll).
  codeMirrorInstance.on('scroll', () => {
    handleScroll()
  })

  // Ripristino da snapshot salvato in onBeforeUnmount (cambio tab → smonta/rimonta).
  // cmStatePerTab è a livello modulo → sopravvive ai remount.
  const { history: histToRestore, savedCursor } = restoreCmStateForTab(codeMirrorInstance, id, props.markdown)
  // Cursor: preferisce snapshot → muyaIndexCursor → prima riga.
  if (savedCursor) {
    codeMirrorInstance.setCursor(savedCursor)
  } else if (muyaIndexCursor && muyaIndexCursor.anchor && muyaIndexCursor.focus) {
    const { anchor, focus } = muyaIndexCursor
    codeMirrorInstance.setSelection(anchor, focus, { scroll: true })
  } else {
    setCursorAtFirstLine(codeMirrorInstance)
  }
  // setHistory DOPO il cursore (regola spiegata in restoreCmStateForTab).
  if (histToRestore) codeMirrorInstance.setHistory(histToRestore)

  editor.value = codeMirrorInstance
  tabId.value = id
  // P-REV2: risincronizza con la generazione corrente al mount (il CM inizializzato può avere
  // una generazione > -1 dopo setValue/setCursor) → primo cursorActivity calcola correttamente.
  lastChangeGen = codeMirrorInstance.changeGeneration()

  // H8 — seed baseline unificata al mount (prima visita alla tab).
  // seedUnified è idempotente: no-op se la tab ha già una entry (non sovrascrive history esistente).
  if (isUnifiedTarget(currentTab.value?.pathname)) {
    const s = getMarkdownAndCursor(codeMirrorInstance)
    seedUnified(id, s.markdown, s.cursor)
    lastUndoSize = codeMirrorInstance.historySize().undo
  }

  // P-DF8-8: fix tiny line + click-shift via setTimeout(150ms).
  // Doppio rAF non basta: layout + flex computations richiedono più tempo a settle.
  // setTimeout(150) garantisce che container abbia dimensioni reali.
  // Tab switch funziona perché avviene SECONDI dopo mount (layout già completo).
  // NOTA: setValue azzera la history come side effect → salviamo e ripristiniamo;
  // setHistory chiamato DOPO setCursor per non lasciare un selection event in cima allo stack.
  setTimeout(() => {
    if (!editor.value || viewDestroyed.value) return
    const cm = editor.value
    const cur = cm.getCursor()
    // Bug 6: scroll surface ora è interno CM
    const scrollTop = cm.getScrollInfo().top
    const savedHist = cm.getHistory()    // cattura history prima che setValue la azzeri
    cm.setValue(cm.getValue())           // forza re-creation lineView con dimensioni stabili
    cm.setCursor(cur)
    cm.scrollTo(null, scrollTop)
    cm.refresh()
    cm.setHistory(savedHist)             // ripristina dopo setCursor per stack undo pulito
    // Cambio tab: il componente si rimonta e il setValue qui sopra ha cancellato eventuali
    // mark di ricerca → chiedi alla sidebar di ri-evidenziare se la ricerca è attiva.
    bus.emit('request-search-highlight')
  }, 150)
  // Safety net: ResizeObserver per resize successivi (sidebar toggle, window resize)
  if (window.ResizeObserver && container) {
    containerResizeObs = new ResizeObserver(() => {
      if (editor.value) editor.value.refresh()
    })
    containerResizeObs.observe(container)
  }

  listenChange()
})

onBeforeUnmount(() => {
  viewDestroyed.value = true
  if (commitTimer.value) clearTimeout(commitTimer.value)

  // Salva snapshot per ripristino al prossimo mount (cambio tab).
  // Fatto prima di bus.off e del cleanup per avere editor.value ancora valido.
  if (editor.value && tabId.value) {
    const hist = editor.value.getHistory()
    cmStatePerTab.set(tabId.value, {
      content: editor.value.getValue(),
      history: hist,
      cursor: editor.value.getCursor()
    })
  }

  // P-DF8-6: cleanup ResizeObserver
  if (containerResizeObs) {
    containerResizeObs.disconnect()
    containerResizeObs = null
  }

  // H1: rimuove i listener Ctrl (registrati sul wrapper CM e su window).
  if (editor.value) {
    editor.value.getWrapperElement().removeEventListener('keydown', onCtrlKeyDown)
    editor.value.getWrapperElement().removeEventListener('keyup', onCtrlKeyUp)
  }
  window.removeEventListener('blur', onCtrlBlur)
  ctrlHeld = false
  sendSourceCodeFocusState(false)

  bus.off('file-loaded', handleFileChange)
  bus.off('invalidate-image-cache', handleInvalidateImageCache)
  bus.off('file-changed', handleFileChange)
  bus.off('selectAll', handleSelectAll)
  bus.off('image-action', handleImageAction)
  bus.off('unified-replay', handleUnifiedReplay)
  bus.off('undo', handleUndo)
  bus.off('redo', handleRedo)
  bus.off('toUpperCase', handleToUpperCase)
  bus.off('toLowerCase', handleToLowerCase)
  bus.off('sourceComment', handleSourceCommentFromMain)
  bus.off('sourceUncomment', handleSourceUncommentFromMain)
  bus.off('format', handleFormatInSource)
  bus.off('paragraph', handleParagraphInSource)
  bus.off('pre-save', handlePreSave)
  bus.off('searchValue', handleSourceSearch)
  bus.off('find-action', handleSourceFindAction)
  bus.off('replaceValue', handleSourceReplace)
  bus.off('sidebar-highlight', handleSidebarHighlight)
  clearSearchHighlight()

  // Emette file-changed SOLO per view switch (stesso file, source→markdown).
  // Per tab close/switch il contenuto della tab uscente non deve sovrascrivere
  // il currentFile già caricato in Muya — causerebbe contenuto/history cross-tab.
  if (tabId.value && currentTab.value?.id === tabId.value) {
    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
    // H8 #1 — flush del tail di source nello stack unificato PRIMA di passare a Muya. La cattura
    // source pusha solo ai boundary di parola di CM → l'ultima parola digitata senza spazio finale
    // (es. "gamma") può non essere nello stack. Senza questo, il redo si fermerebbe a metà parola.
    // Anti-loop: no-op se identica alla cima.
    if (isUnifiedTarget(currentTab.value?.pathname)) {
      pushUnified(tabId.value, newMarkdown, cursor, 'source-switch-flush')
    }
    bus.emit('file-changed', {
      id: tabId.value,
      markdown: newMarkdown,
      muyaIndexCursor: cursor,
      renderCursor: true
    })
  }

  // Rimuove snapshot CM per tab chiuse (non per tab switch — potrebbero riaprirsi).
  if (tabId.value && !editorStore.tabs.some(t => t.id === tabId.value)) {
    cmStatePerTab.delete(tabId.value)
  }
  // Bug 6: ex `removeEventListener('scroll')` rimosso — listener era su .source-code
  // ma ora scroll è su CM (gestito automaticamente da CM.destroy quando montato unmount).
})

const handleScroll = debounce(() => {
  // Bug 6: legge scrollTop da CM (surface .CodeMirror-scroll) invece di .source-code
  if (editor.value) {
    editorStore.updateScrollPosition(editor.value.getScrollInfo().top)
  }
}, 50)
</script>

<style>
.source-code {
  /* Bug 3: 100% delega sizing a parent flex (.container in editor-with-tabs).
     Prima `calc(100vh - var(--titleBarHeight))` eccedeva di tabBar+statusBar
     causando range scrollTop sballato e prime righe non raggiungibili.
     Bug 6: overflow hidden — scroll delegato a CodeMirror interno (.CodeMirror-scroll).
     Magic margin CM è progettato per CM con altezza fissa + scroll interno; wrapparlo
     in surface scroll esterna (overflow:auto) faceva apparire .CodeMirror 50px più corto
     del contenuto reale → ultime righe non raggiungibili. */
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.source-code .CodeMirror {
  /* Bug 6: height 100% (non auto) → CM riempie .source-code, magic margin funziona come da design */
  height: 100% !important;
  /* NB8: editor allineato a sinistra, no margin/max-width */
  margin: 0;
  background: transparent;
}
.source-code .CodeMirror-gutters {
  /* NB8: gutter visibile (sfondo distinto + bordo destro) */
  border-right: 1px solid var(--v2-border);
  background-color: var(--v2-surface2);
}
/* P-DF8-2: gutter allineato a fine ultima riga.
   Il fix N10 originale targettava .CodeMirror-scroll padding-bottom: 0, MA quel padding
   è il "magic margin" CodeMirror (50px + margin-bottom -50px) per nascondere scrollbar
   nativi (vedi codemirror.css commento "Things will break if this is overridden").
   VERO target: .CodeMirror-lines ha padding: 4px 0 di default → 4px sotto contenuto →
   gutter (position absolute, min-height 100%) copre quei 4px. Override solo padding-bottom
   per mantenere i 4px sopra prima riga (separazione visiva). */
.source-code .CodeMirror-lines {
  padding-bottom: 0 !important;
}
.source-code .CodeMirror-activeline-background,
.source-code .CodeMirror-activeline-gutter {
  background: var(--floatHoverColor);
}
/* Evidenziazione delle occorrenze trovate dalla ricerca (Ctrl+F / sidebar) in source.
   Colore giallo (coerente con il find di Muya, niente blu). Il match corrente è più marcato. */
.source-code .cm-search-match {
  background-color: rgba(255, 213, 0, 0.30);
  border-radius: 2px;
}
.source-code .cm-search-match-current {
  background-color: rgba(255, 160, 0, 0.75);
  border-radius: 2px;
}
</style>
