<template>
  <div
    ref="sourceCodeContainer"
    class="source-code"
  />
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, markRaw } from 'vue'
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

const { theme, sourceCode } = storeToRefs(preferencesStore)
const { currentFile: currentTab } = storeToRefs(editorStore)

watch(
  () => props.textDirection,
  (value, oldValue) => {
    if (value !== oldValue && editor.value) {
      setTextDirection(editor.value, value)
    }
  }
)

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
    isFirstLoad.value = false
    tabId.value = null // invalidate tab id
  }
}

const scrollToCords = (y) => {
  requestAnimationFrame(() => {
    // Ensures there we have scrolled to that position before the browser paints the next frame
    // prevents "flickers"
    // B7: guard, componente può smontarsi prima del frame → null deref
    if (sourceCodeContainer.value) {
      sourceCodeContainer.value.scrollTop = y
    }
  })
}

const handleFileChange = ({ id, markdown: newMarkdown, cursor, scrollTop }) => {
  prepareTabSwitch()

  if (typeof newMarkdown === 'string') {
    editor.value.setValue(newMarkdown)
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
    // v2: emette posizione cursor per status bar (Ln/Col)
    const cmCursor = cm.getCursor()
    if (cmCursor && typeof cmCursor.line === 'number') {
      bus.emit('statusbar::cursor-change', {
        line: cmCursor.line + 1,
        col: cmCursor.ch + 1
      })
    }

    // N12: check immediato isSaved (no debounce) per feedback bollino istantaneo dopo Ctrl+Z.
    // Non passa da LISTEN_FOR_CONTENT_CHANGE (pesante, 1s di debounce).
    if (currentTab.value && currentTab.value.originalMarkdown !== null) {
      if (newMarkdown === currentTab.value.originalMarkdown && !currentTab.value.isSaved) {
        currentTab.value.isSaved = true
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
  container.addEventListener('scroll', handleScroll)
  const codeMirrorConfig = {
    value: markdown,
    lineNumbers: true,
    autofocus: true,
    // v2: lineWrapping pilotato da preferences.wordWrap (default true)
    lineWrapping: preferencesStore.wordWrap !== false,
    styleActiveLine: true,
    direction: textDirection,
    viewportMargin: Infinity
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

  codeMirrorInstance.on('contextmenu', (cm, event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  if (muyaIndexCursor && muyaIndexCursor.anchor && muyaIndexCursor.focus) {
    const { anchor, focus } = muyaIndexCursor
    codeMirrorInstance.setSelection(anchor, focus, { scroll: true })
  } else {
    setCursorAtFirstLine(codeMirrorInstance)
  }

  editor.value = codeMirrorInstance
  tabId.value = id

  // P-DF8-8: fix tiny line + click-shift via setTimeout(150ms).
  // Doppio rAF non basta: layout + flex computations richiedono più tempo a settle.
  // setTimeout(150) garantisce che container abbia dimensioni reali.
  // Tab switch funziona perché avviene SECONDI dopo mount (layout già completo).
  setTimeout(() => {
    if (!editor.value || viewDestroyed.value) return
    const cm = editor.value
    const cur = cm.getCursor()
    const scrollTop = container ? container.scrollTop : 0
    cm.setValue(cm.getValue())   // forza re-creation lineView con dimensioni stabili
    cm.setCursor(cur)
    if (container) container.scrollTop = scrollTop
    cm.refresh()
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

  const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
  bus.emit('file-changed', {
    id: tabId.value,
    markdown: newMarkdown,
    muyaIndexCursor: cursor,
    renderCursor: true
  })

  sourceCodeContainer.value.removeEventListener('scroll', handleScroll)
})

const handleScroll = debounce(() => {
  editorStore.updateScrollPosition(sourceCodeContainer.value.scrollTop)
}, 50)
</script>

<style>
.source-code {
  height: calc(100vh - var(--titleBarHeight));
  box-sizing: border-box;
  overflow: auto;
}
.source-code .CodeMirror {
  height: auto;
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
</style>
