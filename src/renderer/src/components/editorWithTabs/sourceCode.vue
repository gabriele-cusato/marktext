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
</script>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, markRaw, computed } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import codeMirror, { setMode, setCursorAtFirstLine, setTextDirection } from '../../codeMirror'
import { debounce, wordCount as getWordCount } from 'muya/lib/utils'
import { adjustCursor } from '../../util'
import bus from '../../bus'
import { oneDarkThemes, railscastsThemes } from '@/config'

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

const handleFileChange = ({ id, markdown: newMarkdown, cursor, scrollTop, forceReload, renderCursor }) => {
  // sourceCode=false significa che il componente sta per smontarsi (tab close o switch).
  // Non processare eventi: evita di caricare contenuto/history di tab estranee in CM
  // e di cambiare tabId (che poi causerebbe emit spurio in onBeforeUnmount).
  if (!sourceCode.value) return

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

  // historyToRestore viene impostato se si ripristina uno snapshot.
  // setHistory viene chiamato DOPO il cursor positioning (vedi sotto) perché setCursorAtFirstLine
  // aggiunge un selection event alla history stack: se setHistory fosse prima, quel selection
  // event finisce sopra e al Ctrl+Z CM5 lo salta (cambia solo cursore) + undoes il cambio sotto
  // → 2 entry rimosse in un colpo e cursore salta a riga 1 invece di revertire il testo.
  let historyToRestore = null

  if (cmStatePerTab.has(id)) {
    // Tab già visitata: ripristina content dallo snapshot. History ripristinata dopo il cursore.
    const { content, history } = cmStatePerTab.get(id)
    if (typeof newMarkdown === 'string' && newMarkdown !== content) {
      // FIX: snapshot stale rispetto allo store (modifiche in Muya nel frattempo) →
      // usa il contenuto dello store, history azzerata.
      editor.value.setValue(newMarkdown)
    } else {
      editor.value.setValue(content)
      historyToRestore = history
    }
  } else if (typeof newMarkdown === 'string') {
    // Prima visita: carica dal store, history parte da zero.
    editor.value.setValue(newMarkdown)
  }

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
  }

  if (typeof scrollTop === 'number') {
    scrollToCords(scrollTop)
  }
  tabId.value = id
}

const handleInvalidateImageCache = () => {
  if (editor.value) {
    editor.value.invalidateImageCache()
  }
}

// Bug 2: handler undo/redo per modalità sourceCode (CodeMirror)
const handleUndo = () => {
  if (editor.value) {
    editor.value.execCommand('undo')
  }
}

const handleRedo = () => {
  if (editor.value) editor.value.execCommand('redo')
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

// Replica di adjustTrailingNewlines (editor.js, privata) per normalizzare cm.getValue()
// prima del confronto N12. Senza questo, trailing newline presenti in CM ma strippate
// dallo store causano false-dirty su ogni click cursore dopo il salvataggio.
const normalizeMarkdown = (md, trimOption) => {
  if (!md) return ''
  const trimEnd = (s) => s.replace(/[\r?\n]+$/, '')
  if (trimOption === 0) return trimEnd(md)
  if (trimOption === 1) {
    if (md[md.length - 1] === '\n') {
      if (md.length === 1) return ''
      if (md[md.length - 2] !== '\n') return md
    }
    const trimmed = trimEnd(md)
    return trimmed.length === 0 ? '' : trimmed + '\n'
  }
  return md
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

// Intercetta eventi format in source mode per operazioni riga (Ctrl+D / Ctrl+L)
const handleFormatInSource = (type) => {
  if (!sourceCode.value || !editor.value) return
  if (type === 'del') {
    // Ctrl+D in source = duplica. Con selezione → duplica tutte le righe coperte.
    const cm = editor.value
    const from = cm.getCursor('from')
    const to = cm.getCursor('to')
    const hasSel = from.line !== to.line || from.ch !== to.ch
    if (!hasSel) {
      // nessuna selezione → duplica la riga corrente
      const line = cm.getLine(from.line)
      cm.replaceRange(line + '\n', { line: from.line, ch: 0 })
    } else {
      // selezione attiva → duplica l'intero blocco di righe coperte
      // edge case: selezione finisce a ch=0 → l'ultima riga non è realmente toccata → escludila
      const endLine = (to.ch === 0 && to.line > from.line) ? to.line - 1 : to.line
      const lines = []
      for (let i = from.line; i <= endLine; i++) lines.push(cm.getLine(i))
      cm.replaceRange(lines.join('\n') + '\n', { line: from.line, ch: 0 })
    }
    cm.focus()
  } else if (type === 'link') {
    // Ctrl+L in source = elimina riga corrente
    editor.value.execCommand('deleteLine')
    editor.value.focus()
  }
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
  while (cursor.findNext()) {
    const from = cursor.from()
    const to = cursor.to()
    if (from.line === to.line && from.ch === to.ch) break // match a lunghezza zero → stop
    searchPositions.push({ from, to })
    searchMarks.push(cm.markText(from, to, { className: 'cm-search-match' }))
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
    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(cm)
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

    // N12: check immediato isSaved (no debounce) per feedback bollino istantaneo dopo Ctrl+Z.
    // Normalizza ENTRAMBI i lati con adjustTrailingNewlines: originalMarkdown dopo un
    // load/reload è il contenuto GREZZO del disco (non normalizzato). Se i trailing-newline
    // del file ≠ forma normalizzata, confrontare grezzo vs normalizzato dava false-dirty
    // su ogni click cursore anche senza modifiche. normalizeMarkdown è idempotente → sicuro.
    if (currentTab.value && currentTab.value.originalMarkdown !== null) {
      const trim = currentTab.value.trimTrailingNewline
      const normalizedNew = normalizeMarkdown(newMarkdown, trim)
      const normalizedOrig = normalizeMarkdown(currentTab.value.originalMarkdown, trim)
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
    undoDepth: 10000,
    // Ctrl+Shift+↑/↓ liberi → sposta riga su/giù solo in source mode
    // Alt+↑/↓ in source mode = sposta riga su/giù (come Notepad++).
    // Ctrl+Shift+↑/↓ torna al default CM (estensione selezione).
    extraKeys: codeMirror.normalizeKeyMap({
      'Alt-Up': 'swapLineUp',
      'Alt-Down': 'swapLineDown'
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
  // Bug 2: Ctrl+Z/Y intercettato da menu Electron, bus.emit('undo'/'redo') arriva qui
  // ma editor.vue handleUndo/handleRedo escono in sourceCode mode → instradiamo a CodeMirror
  bus.on('undo', handleUndo)
  bus.on('redo', handleRedo)
  bus.on('toUpperCase', handleToUpperCase)
  bus.on('toLowerCase', handleToLowerCase)
  bus.on('format', handleFormatInSource)
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

  setMode(codeMirrorInstance, 'markdown')

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
  })

  codeMirrorInstance.on('contextmenu', (cm, event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  // Bug 6: scroll listener su surface CM (.CodeMirror-scroll) — sostituisce ex
  // listener su .source-code (ora overflow:hidden, non emette scroll).
  codeMirrorInstance.on('scroll', () => {
    handleScroll()
  })

  // Ripristino da snapshot salvato in onBeforeUnmount (cambio tab → smonta/rimonta).
  // cmStatePerTab è a livello modulo → sopravvive ai remount.
  // setHistory va DOPO setCursor per non lasciare un selection event in cima allo stack.
  if (cmStatePerTab.has(id)) {
    const { content, history, cursor: savedCursor } = cmStatePerTab.get(id)
    const storeMarkdown = props.markdown
    if (typeof storeMarkdown === 'string' && storeMarkdown !== content) {
      // FIX: snapshot stale (modifiche fatte in Muya dopo aver lasciato source mode).
      // Lo store è la verità → carica il contenuto dello store; history azzerata perché
      // l'undo dello snapshot sarebbe incoerente col nuovo contenuto.
      codeMirrorInstance.setValue(storeMarkdown)
      setCursorAtFirstLine(codeMirrorInstance)
    } else {
      // snapshot allineato allo store → ripristina contenuto + history (preserva undo cross-tab)
      codeMirrorInstance.setValue(content)
      if (savedCursor) {
        codeMirrorInstance.setCursor(savedCursor)
      } else {
        setCursorAtFirstLine(codeMirrorInstance)
      }
      codeMirrorInstance.setHistory(history)
    }
  } else {
    // Prima visita a questa tab: cursor da muyaIndexCursor (se disponibile)
    if (muyaIndexCursor && muyaIndexCursor.anchor && muyaIndexCursor.focus) {
      const { anchor, focus } = muyaIndexCursor
      codeMirrorInstance.setSelection(anchor, focus, { scroll: true })
    } else {
      setCursorAtFirstLine(codeMirrorInstance)
    }
  }

  editor.value = codeMirrorInstance
  tabId.value = id

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

  bus.off('file-loaded', handleFileChange)
  bus.off('invalidate-image-cache', handleInvalidateImageCache)
  bus.off('file-changed', handleFileChange)
  bus.off('selectAll', handleSelectAll)
  bus.off('image-action', handleImageAction)
  bus.off('undo', handleUndo)
  bus.off('redo', handleRedo)
  bus.off('toUpperCase', handleToUpperCase)
  bus.off('toLowerCase', handleToLowerCase)
  bus.off('format', handleFormatInSource)
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
