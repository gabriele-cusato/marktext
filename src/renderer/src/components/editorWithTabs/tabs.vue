<template>
  <div
    :class="['v2-tabbar', { 'has-multirow': hasMultiRow, 'tabs-hovered': tabsAreaHovered }]"
    @mouseleave="onTabbarLeave"
  >
    <!-- B1: Tabs pill multi-row con hover-expand. Hover SOLO su quest'area:
         passare il mouse su .v2-topright NON espande la tab bar.
         B3: @mouseleave montato sul wrapper esterno .v2-tabbar — uscire dalle
         righe 2+ verso la zona di scrittura passa per padding-bottom di .v2-tabbar
         e .contains(self) restituiva true bloccando il collasso. -->
    <div
      ref="tabContainer"
      class="v2-tabbar-scroll"
      @mouseenter="onTabsEnter"
    >
      <ul
        ref="tabDropContainer"
        class="v2-tabs"
      >
        <li
          v-for="file of tabs"
          :key="`${file.id}-${tabsRenderKey}`"
          :title="file.pathname || file.filename"
          :class="['v2-tab', {
            'v2-tab-active': currentFile.id === file.id,
            'v2-tab-active-hidden': currentFile.id === file.id && pinnedTab && pinnedTab.id === file.id
          }]"
          :data-id="file.id"
          @click.stop="selectFile(file)"
          @click.middle="closeTab(file.id)"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <!-- Dot unsaved -->
          <span
            v-if="!file.isSaved"
            class="v2-tab-dot"
          />
          <span class="v2-tab-name">{{ file.filename }}</span>
          <button
            class="v2-tab-x"
            @click.stop="removeFileInTab(file)"
          >×</button>
        </li>
        <!-- B1: "+" inline solo in single-row. In multi-row si sposta nel topright. -->
        <li
          v-if="!hasMultiRow"
          class="v2-tab-new-li"
          @click.stop="newFile()"
          title="New Tab (Ctrl+T)"
        >+</li>
      </ul>
    </div>

    <!-- B1: zona topright si espande verso sinistra quando multi-row,
         clone tab + "+" appaiono SOLO dopo che l'espansione è completata.
         B14: ref per misurare offsetWidth runtime → padding-right dinamico tabbar.
         B14f: `topright-expanded` legata a hasMultiRow (= esistono 2+ righe).
         + topright deve restare visibile finché c'è multi-row, indipendentemente
         dal clone. Clone ha v-if separato su pinnedTab (active in row 2+). -->
    <div
      ref="topRightEl"
      :class="['v2-topright', { 'topright-expanded': hasMultiRow }]"
    >
      <!-- N4: wrapper animato max-width+opacity per espansione visibile verso sinistra.
           Sempre in DOM (no v-if) così CSS può fare transizione 0→max-width. -->
      <div class="v2-topright-dynamic">
        <!-- B1: clone tab attiva (su riga 2+) nel topright.
             B14f: Transition fade dedicato per clone (independente da wrapper).
             Quando active passa row 1↔row 2+ in multi-row, clone fade in/out
             senza che + topright sia coinvolto (resta visibile via wrapper). -->
        <Transition name="v2-clone-fade">
          <div
            v-if="pinnedTab"
            class="v2-topright-clone"
            :title="pinnedTab.pathname || pinnedTab.filename"
            @click.stop="selectFile(pinnedTab)"
            @contextmenu.prevent="handleContextMenu($event, pinnedTab)"
          >
            <span v-if="!pinnedTab.isSaved" class="v2-tab-dot" />
            <span class="v2-tab-name">{{ pinnedTab.filename }}</span>
            <span class="v2-tab-pinned-badge">↑</span>
          </div>
        </Transition>

        <!-- B1: "+" nel topright -->
        <button
          class="v2-tr-plus"
          title="New Tab (Ctrl+T)"
          @click.stop="newFile()"
        >+</button>

        <!-- B1: separatore tra elementi tab (clone, +) e icone app (⌘, 📂) -->
        <div class="v2-tr-sep" />
      </div>

      <button
        class="v2-tr-btn"
        title="Command Palette (Ctrl+K)"
        @click="openCommandPalette"
      >⌘</button>
      <button
        class="v2-tr-btn"
        title="Apri file (Ctrl+O)"
        @click="openFileDialog"
      >
        <!-- NB4: SVG cartella aperta minimal, monocromatica -->
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M1.5 4.5h4.5l1.5 1.5H14.5v7.5H1.5V4.5z" stroke-linejoin="round"/>
        </svg>
      </button>
      <!-- B12: separatore visivo tra icone app (⌘, 📂) e icone finestra (−, □, ×) -->
      <div class="v2-tr-sep" />
      <!-- NB14: icone finestra in stile VS Code (SVG inline) -->
      <button
        class="v2-tr-btn v2-tr-btn-win"
        title="Riduci a icona"
        @click="winMinimize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
      <button
        class="v2-tr-btn v2-tr-btn-win"
        :title="isMaximized ? 'Ripristina' : 'Massimizza'"
        @click="winMaximize"
      >
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.6" y="0.6" width="8.8" height="8.8" stroke="currentColor" stroke-width="1.2" fill="none"/>
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="0.6" width="7.4" height="7.4" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <rect x="0.6" y="2" width="7.4" height="7.4" stroke="currentColor" stroke-width="1.2" fill="var(--v2-bg)"/>
        </svg>
      </button>
      <button
        class="v2-tr-btn v2-tr-btn-win v2-tr-btn-close"
        title="Chiudi"
        @click="winClose"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/>
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
    </div>

    <!-- Context menu custom Vue (sostituisce nativo Electron) -->
    <TabContextMenu
      v-if="ctxOpen"
      :x="ctxPos.x"
      :y="ctxPos.y"
      :tab="ctxTab"
      @close="ctxOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import autoScroll from 'dom-autoscroller'
import dragula from 'dragula'
import bus from '../../bus'
import TabContextMenu from '../contextMenu/TabContextMenu.vue'

// Larghezza stimata del bottone "+" inline: 26px width + 3px gap + 6px margini
const PLUS_W = 35

const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const preferencesStore = usePreferencesStore()

const { currentFile, tabs } = storeToRefs(editorStore)
const { theme } = storeToRefs(preferencesStore)

const tabContainer = ref(null)
const tabDropContainer = ref(null)
const topRightEl = ref(null) // B14: zona topright (.v2-topright) — misurata runtime per padding tabbar
let autoScroller = null
let drake = null
let tabResizeObs = null
let topRightResizeObs = null // B14: ResizeObserver su topright — clone width cambia con file/filename
let tabbarResizeObs = null // ResizeObserver su tabbar root → trigger recalc su resize finestra

// hasMultiRow: true se tabs occupano > 1 riga (controlla anche posizione di "+" e clone)
const hasMultiRow = ref(false)

// P-DF8-3: lock per evitare flicker durante transizione CSS padding-right (0.3-0.5s).
// Quando hasMultiRow flippa, ResizeObserver fires multipli durante l'animazione →
// updateTabRowsLayout legge larghezze intermedie → flicker. Skip aggiornamenti per
// la durata della transition + buffer.
let layoutLockUntil = 0

// B1: hover scope - true solo quando il cursore è sull'area tabs (NON sul topright).
// Espande la tab bar in multi-row solo via questa flag, non con CSS :hover globale.
const tabsAreaHovered = ref(false)

// B5: tab "pinned" temporanea = la tab attiva quando NON è in prima riga.
// Effetto temporaneo: cambia se si clicca un'altra tab non in riga 1, sparisce se
// si clicca una tab di riga 1 o si apre nuova tab.
const pinnedTab = ref(null)

// Context menu state (custom Vue, sostituisce Electron nativo)
const ctxOpen = ref(false)
const ctxPos = ref({ x: 0, y: 0 })
const ctxTab = ref(null)

const currentTheme = computed(() => theme.value)

const selectFile = (file) => {
  if (file.id !== currentFile.value.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file) => {
  if (file.isSaved) {
    editorStore.FORCE_CLOSE_TAB(file)
  } else {
    editorStore.CLOSE_UNSAVED_TAB(file)
  }
}

const newFile = () => {
  editorStore.NEW_UNTITLED_TAB({})
}

// B1: handler hover area tabs. Mantiene espansione anche se cursore va sul topright
// (evita collasso a metà), perché alcune azioni utili sono lì.
const onTabsEnter = () => {
  tabsAreaHovered.value = true
}
// B3: mouseleave sul wrapper .v2-tabbar (root). Quando il mouse esce
// dall'intera tab bar (incluso topright/clone) collassa.
const onTabbarLeave = () => {
  tabsAreaHovered.value = false
}

// Scroll handler quando barra collassata (su row singola)
const handleTabScroll = (event) => {
  let delta = event.deltaY
  if (event.deltaX !== 0) delta = event.deltaX
  const el = tabContainer.value
  if (!el) return
  el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + delta, el.scrollWidth))
}

const closeTab = (tabId) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab) editorStore.CLOSE_TAB(tab)
}

const closeOthers = (tabId) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab) editorStore.CLOSE_OTHER_TABS(tab)
}

const closeSaved = () => editorStore.CLOSE_SAVED_TABS()
const closeAll = () => editorStore.CLOSE_ALL_TABS()

const changeMaxWidth = (width) => {
  layoutStore.CHANGE_SIDE_BAR_WIDTH(width)
}

const rename = (tabId) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) editorStore.RENAME_FILE(tab)
}

const copyPath = (tabId) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) window.electron.clipboard.writeText(tab.pathname)
}

const showInFolder = (tabId) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) window.electron.shell.showItemInFolder(tab.pathname)
}

// Apre context menu Vue custom (al posto Electron nativo)
const handleContextMenu = (event, tab) => {
  if (!tab.id) return
  ctxPos.value = { x: event.clientX, y: event.clientY }
  ctxTab.value = tab
  ctxOpen.value = true
}

// Top-right controls
const openCommandPalette = () => {
  bus.emit('show-command-palette')
}

// F6: apertura file via dialog Electron (canale già esistente in main)
const openFileDialog = () => {
  window.electron.ipcRenderer.send('mt::cmd-open-file')
}

// F7: gestione finestra (minimize / maximize / close)
const isMaximized = ref(false)

const winMinimize = () => {
  window.electron.ipcRenderer.send('mt::minimize-window')
}

const winMaximize = () => {
  window.electron.ipcRenderer.send('mt::maximize-window')
}

const winClose = () => {
  window.electron.ipcRenderer.send('mt::close-window')
}

const onWinMaximize = () => { isMaximized.value = true }
const onWinUnmaximize = () => { isMaximized.value = false }

// B3 + B4: calcola se le tab sono su più righe e posiziona "+" alla fine
// della prima riga quando multi-row.
// NB3: escludere il clone pinned dal calcolo — la sua presenza/assenza
// non deve far saltare la posizione del "+".
// B4: misurazione layout dopo nextTick + rAF, per evitare flash multi-row
// transitorio durante il commit DOM (es. nuova tab) che farebbe scattare CSS hover.
const scheduleUpdate = () => {
  nextTick(() => {
    requestAnimationFrame(() => updateTabRowsLayout())
  })
}

// Incrementato su ogni dragend → forza Vue a ricreare tutti i li.v2-tab fresh,
// eliminando i riferimenti .el stale nel vdom che causano inserimento nella posizione sbagliata.
const tabsRenderKey = ref(0)

const resyncDomToStore = () => {
  const ul = tabDropContainer.value
  if (!ul) return
  const storeOrder = tabs.value.map(t => String(t.id))
  const domOrder = Array.from(ul.querySelectorAll('li.v2-tab')).map(e => e.getAttribute('data-id'))
  if (JSON.stringify(domOrder) === JSON.stringify(storeOrder)) return

  // Rimuovi duplicati prima di riordinare
  const seen = new Set()
  Array.from(ul.querySelectorAll('li.v2-tab')).forEach(el => {
    const id = el.getAttribute('data-id')
    if (seen.has(id)) ul.removeChild(el)
    else seen.add(id)
  })

  // Inserisce ogni tab nell'ordine corretto prima del "+" inline
  const anchor = ul.querySelector('.v2-tab-new-li') || null
  storeOrder.forEach(id => {
    const el = ul.querySelector(`li.v2-tab[data-id="${id}"]`)
    if (el) ul.insertBefore(el, anchor)
  })
}

let currentDragDropHandled = false

// P-DF8-4: rilevazione multi-row state-aware con larghezza tabbar STABILE.
// Causa flicker precedente: ul.clientWidth varia durante transition padding-right
// (160→320 in 0.3s). Soluzione: usare .v2-tabbar.clientWidth (NON cambia con padding
// interno) − 160 = larghezza ul "sarebbe" in single-row mode.
const updateTabRowsLayout = () => {
  // P-DF8-5: lock dentro la funzione → gates ANCHE chiamate dirette
  // (currentFile watcher line 463 bypassava il vecchio scheduleUpdate-only lock).
  if (Date.now() < layoutLockUntil) return

  const ul = tabDropContainer.value
  if (!ul) return
  const items = Array.from(ul.querySelectorAll('li.v2-tab'))
  if (items.length === 0) {
    hasMultiRow.value = false
    return
  }

  // .v2-tabbar è il root .closest. clientWidth NON dipende da padding-right (clientWidth =
  // padding-box width). Quindi misura stabile durante transition.
  const tabbarEl = ul.closest('.v2-tabbar')
  if (!tabbarEl) return
  const ulPadding = 6 // padding orizzontale .v2-tabs (left 6px, right 0)
  const GAP = 3        // gap CSS .v2-tabs

  // B14: padding-right dinamico = larghezza reale .v2-topright + offset right + buffer.
  const TOPRIGHT_RIGHT_OFFSET = 10 // CSS .v2-topright { right: 10px }
  const HOVER_BUFFER = 12          // clearance per hover/box-shadow ultima tab
  const tre = topRightEl.value
  const topRightWidth = tre ? tre.offsetWidth : 160
  const dynamicPaddingRight = topRightWidth + TOPRIGHT_RIGHT_OFFSET + HOVER_BUFFER
  tabbarEl.style.paddingRight = `${dynamicPaddingRight}px`

  // Detection + row1Width SIMULATI (non dipendono da DOM offsetTop attuale, che è
  // condizionato da ul.style.width già settata in iterazioni precedenti → causava
  // loop downgrade row 1 a 1 tab). offsetWidth tab è intrinseco (min/max-clamped,
  // flex-shrink:0) → stabile a prescindere da ul width. Simulo wrap iterativo.
  const availableForContent = tabbarEl.clientWidth - dynamicPaddingRight - ulPadding
  let row1ContentWidth = 0
  let row1Count = 0
  for (const item of items) {
    const itemW = item.offsetWidth
    const addedWidth = row1Count === 0 ? itemW : (GAP + itemW)
    if (row1Count > 0 && row1ContentWidth + addedWidth > availableForContent) break
    row1ContentWidth += addedWidth
    row1Count++
  }
  const multiRow = row1Count < items.length
  hasMultiRow.value = multiRow

  // Restringe ul a width REALE di row 1. Spazio liberato dentro scroll-area
  // (flex:1 = full width) diventa drag region → drag finestra subito dopo last tab.
  // Ul resta no-drag per eventi mouse / dragula.
  const row1Width = ulPadding + row1ContentWidth
  const newUlWidth = `${row1Width}px`
  if (ul.style.width !== newUlWidth) {
    ul.style.width = newUlWidth
  }

  // S7-fix: posiziona inline + assoluto dopo ultima tab (single-row state).
  // Fuori flex flow → non wrappa mai. In multi-row state il + è rimosso via v-if.
  if (!multiRow) {
    const plusEl = ul.querySelector('.v2-tab-new-li')
    if (plusEl) {
      const last = items[items.length - 1]
      plusEl.style.left = `${last.offsetLeft + last.offsetWidth + GAP}px`
    }
  }

  // Pinned recalc via helper (chiamabile anche fuori updateTabRowsLayout per
  // bypassare layoutLock — necessario post-drag dragula dove lock può essere
  // attivo da ResizeObserver burst durante drag).
  recomputePinnedTab(items, multiRow)
}

// Helper: aggiorna pinnedTab basato su layout DOM corrente.
// `items` opzionale (querySelectorAll fresh se non passato), `multiRow` opzionale
// (deriva da hasMultiRow.value se non passato).
const recomputePinnedTab = (items = null, multiRow = null) => {
  const ul = tabDropContainer.value
  if (!ul) return
  if (!items) items = Array.from(ul.querySelectorAll('li.v2-tab'))
  if (multiRow === null) multiRow = hasMultiRow.value

  if (!multiRow || !items.length) {
    pinnedTab.value = null
    return
  }
  if (!currentFile.value || !currentFile.value.id) {
    pinnedTab.value = null
    return
  }
  const firstTop = items[0].offsetTop
  const activeEl = items.find(
    (el) => el.getAttribute('data-id') === String(currentFile.value.id)
  )
  if (!activeEl || activeEl.offsetTop <= firstTop) {
    pinnedTab.value = null
    return
  }
  const tab = tabs.value.find((t) => t.id === currentFile.value.id) || null
  if (!pinnedTab.value || pinnedTab.value.id !== tab?.id) {
    pinnedTab.value = tab
  }
}

onMounted(() => {
  // Bus listener per context menu legacy (mantenuti per compatibilità)
  bus.on('TABS::close-this', closeTab)
  bus.on('TABS::close-others', closeOthers)
  bus.on('TABS::close-saved', closeSaved)
  bus.on('TABS::close-all', closeAll)
  bus.on('TABS::rename', rename)
  bus.on('TABS::copy-path', copyPath)
  bus.on('TABS::show-in-folder', showInFolder)
  bus.on('EDITOR_TABS::change-max-width', changeMaxWidth)

  // F7: stato finestra max/restore (eventi inviati da main process editor.js)
  window.electron.ipcRenderer.on('mt::window-maximize', onWinMaximize)
  window.electron.ipcRenderer.on('mt::window-unmaximize', onWinUnmaximize)

  const el = tabContainer.value
  if (el) el.addEventListener('wheel', handleTabScroll)

  // B3 + B4: ResizeObserver per ricalcolare layout su resize finestra/tab list
  if (window.ResizeObserver && tabDropContainer.value) {
    tabResizeObs = new ResizeObserver(() => scheduleUpdate())
    tabResizeObs.observe(tabDropContainer.value)
  }
  // B14: ResizeObserver su .v2-topright. Clone tab width cambia quando filename
  // attivo cambia → padding-right dinamico va ricalcolato per evitare overlap X.
  if (window.ResizeObserver && topRightEl.value) {
    topRightResizeObs = new ResizeObserver(() => scheduleUpdate())
    topRightResizeObs.observe(topRightEl.value)
  }
  // ResizeObserver su tabbar root → triggera recalc su resize finestra.
  // Senza questo, ul.style.width settata in updateTabRowsLayout resta fissa →
  // su resize finestra ul può eccedere scroll-area → tabs overlap topright.
  const tabbarRoot = tabDropContainer.value?.closest('.v2-tabbar')
  if (window.ResizeObserver && tabbarRoot) {
    tabbarResizeObs = new ResizeObserver(() => scheduleUpdate())
    tabbarResizeObs.observe(tabbarRoot)
  }
  scheduleUpdate()

  // Drag and drop ordering

  drake = dragula([tabDropContainer.value], {
    direction: 'horizontal',
    revertOnSpill: true,
    mirrorContainer: tabDropContainer.value,
    ignoreInputTextSelection: false,
    moves: (el) => el.classList.contains('v2-tab')
  })
  .on('drag', () => {
    currentDragDropHandled = false
  })
  .on('dragend', () => {
    nextTick(() => {
      resyncDomToStore()
      // Forza Vue a ricreare tutti i li.v2-tab con key fresca → azzera .el stale nel vdom
      tabsRenderKey.value++
    })
  })
  .on('drop', (el, target, source, sibling) => {
    const droppedId = el.getAttribute('data-id')
    const isMirror = sibling && sibling.classList.contains('gu-mirror')
    if (isMirror && currentDragDropHandled) return
    currentDragDropHandled = true

    const realSibling = sibling
      && !sibling.classList.contains('v2-tab-new-li')
      && !sibling.classList.contains('gu-mirror')
      ? sibling : null
    const nextTabId = realSibling && realSibling.getAttribute('data-id')
    if (!droppedId || (realSibling && !nextTabId)) return
    editorStore.EXCHANGE_TABS_BY_ID({ fromId: droppedId, toId: nextTabId || null })
    nextTick(() => requestAnimationFrame(() => recomputePinnedTab()))
  })

  autoScroller = autoScroll([el], {
    margin: 20,
    maxSpeed: 6,
    scrollWhenOutside: false,
    autoScroll: () => autoScroller.down && drake.dragging
  })
})

onBeforeUnmount(() => {
  const el = tabContainer.value
  if (el) el.removeEventListener('wheel', handleTabScroll)
  if (autoScroller) autoScroller.destroy(true)
  if (drake) drake.destroy()

  bus.off('TABS::close-this', closeTab)
  bus.off('TABS::close-others', closeOthers)
  bus.off('TABS::close-saved', closeSaved)
  bus.off('TABS::close-all', closeAll)
  bus.off('TABS::rename', rename)
  bus.off('TABS::copy-path', copyPath)
  bus.off('TABS::show-in-folder', showInFolder)
  bus.off('EDITOR_TABS::change-max-width', changeMaxWidth)

  // F7: cleanup IPC listener finestra
  window.electron.ipcRenderer.removeListener('mt::window-maximize', onWinMaximize)
  window.electron.ipcRenderer.removeListener('mt::window-unmaximize', onWinUnmaximize)

  // B3+B4: cleanup ResizeObserver
  if (tabResizeObs) {
    tabResizeObs.disconnect()
    tabResizeObs = null
  }
  // B14: cleanup ResizeObserver topright
  if (topRightResizeObs) {
    topRightResizeObs.disconnect()
    topRightResizeObs = null
  }
  // cleanup ResizeObserver tabbar root
  if (tabbarResizeObs) {
    tabbarResizeObs.disconnect()
    tabbarResizeObs = null
  }
})

// B3+B4: ricalcola layout quando cambiano le tab
watch(tabs, () => {
  // Apertura nuova tab → resetta pinned (B5)
  pinnedTab.value = null
  scheduleUpdate()
}, { deep: false })

// B5: aggiorna pinnedTab al cambio di tab attiva.
// - Se la nuova tab attiva è in riga 1 → pinned sparisce
// - Se è su riga 2+ → diventa pinned (cloned in riga 1)
watch(() => currentFile.value && currentFile.value.id, () => {
  nextTick(() => {
    const ul = tabDropContainer.value
    if (!ul) return
    const realTabs = Array.from(ul.querySelectorAll('li.v2-tab:not(.v2-tab-pinned)'))
    if (realTabs.length === 0) {
      pinnedTab.value = null
      return
    }
    const firstTop = realTabs[0].offsetTop
    const activeEl = realTabs.find((el) => el.getAttribute('data-id') === String(currentFile.value.id))
    if (!activeEl) {
      pinnedTab.value = null
      return
    }
    if (activeEl.offsetTop > firstTop) {
      // Tab attiva è in riga 2+ → mostra pinned
      pinnedTab.value = tabs.value.find((t) => t.id === currentFile.value.id) || null
    } else {
      // Tab attiva è in riga 1 → nessun pinned
      pinnedTab.value = null
    }
    // P1A: rAF garantisce misura post-paint → offsetTop stabili → no false multi-row con 2 tab
    requestAnimationFrame(() => updateTabRowsLayout())
  })
})

// B2: clone non scompare quando si compatta a riga singola.
// Se hasMultiRow passa a false (resize finestra/chiusura tab), pinnedTab va azzerato.
// Se torna a true, ricalcola pinnedTab usando stessa logica del watch currentFile.id.
watch(hasMultiRow, (newVal) => {
  // P-DF8-3 (rev S7-fix): lock ridotto da 500ms → 150ms.
  // Post B14e (topright-dynamic width fissa 150px) la padding-right tabbar non
  // cambia mai → transition CSS non si attiva → flicker quasi impossibile.
  // 150ms = sotto soglia percezione umana, mantiene debounce contro burst
  // ResizeObserver (es. drag-resize finestra continuo) e protezione parziale
  // per eventuali future regressioni su transition dimensionali.
  layoutLockUntil = Date.now() + 150
  setTimeout(() => {
    nextTick(() => requestAnimationFrame(() => updateTabRowsLayout()))
  }, 170)
  if (!newVal) {
    pinnedTab.value = null
    return
  }
  nextTick(() => {
    const ul = tabDropContainer.value
    if (!ul) return
    const realTabs = Array.from(ul.querySelectorAll('li.v2-tab:not(.v2-tab-pinned)'))
    if (!realTabs.length) {
      pinnedTab.value = null
      return
    }
    const firstTop = realTabs[0].offsetTop
    const activeEl = realTabs.find((el) => el.getAttribute('data-id') === String(currentFile.value.id))
    if (!activeEl || activeEl.offsetTop <= firstTop) {
      pinnedTab.value = null
    } else {
      pinnedTab.value = tabs.value.find((t) => t.id === currentFile.value.id) || null
    }
  })
})
</script>

<style scoped>
/* Tab bar v2 — multi-row hover-expand container */
.v2-tabbar {
  position: relative;
  flex-shrink: 0;
  z-index: 10;
  background: var(--v2-bg);
  border-bottom: 1px solid var(--v2-border);
  overflow: hidden;
  max-height: var(--v2-tab-h);
  /* Drag finestra OS-native: tabbar = zona titolo. Doppio-click toggle maximize.
     Figli interattivi (tab, +, bottoni topright) hanno no-drag → click liberi. */
  -webkit-app-region: drag;
  app-region: drag;
  /* B11: animazione espansione più lenta (0.5s)
     B1: padding-right animato al passaggio multi-row (clone+ entrano nel topright).
     B14: padding-right ora settato inline via JS in updateTabRowsLayout (= offsetWidth
     reale .v2-topright + offset + buffer). Le costanti 160/320 erano hardcoded ma
     non coprivano clone tab con filename lungo → X ultima tab coperta. */
  transition:
    max-height 0.5s ease-in-out,
    box-shadow var(--v2-t-mid) ease-in-out,
    padding-right 0.3s ease;
  display: flex;
  align-items: flex-start;
  /* B2: padding-bottom default per non far attaccare le tabs alla barra di separazione */
  padding-bottom: 4px;
  user-select: none;
}

/* B1: in multi-row il topright ospita anche clone tab + "+" + separator.
   B14: padding-right rimosso (gestito inline da JS). Solo durata transition mantenuta
   per sincronia con v2-topright-dynamic. */
.v2-tabbar.has-multirow {
  transition:
    max-height 0.5s ease-in-out,
    box-shadow var(--v2-t-mid) ease-in-out,
    padding-right 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* B1: hover-expand attivato SOLO da hover su area tab (classe `tabs-hovered`).
   Hovering su .v2-topright NON deve espandere la tab bar. */
.v2-tabbar.has-multirow.tabs-hovered {
  max-height: 260px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
}

.v2-tabbar-scroll {
  flex: 1;
  /* S7-fix: visible per permettere inline + assoluto di sconfinare nello
     slot riservato topright-dynamic (invisibile in single-row).
     Clipping verticale row 2+ resta gestito da .v2-tabbar (max-height + overflow:hidden). */
  overflow: visible;
  min-height: var(--v2-tab-h);
  /* Scroll-area resta DRAG (eredita da .v2-tabbar): spazio dopo ul ristretta =
     zona draggable finestra. Hover events fire su drag region in Chromium. */
}

/* NB5: rimossa regola .v2-tabbar.has-multirow:not(:hover) .v2-tabs
   max-height — causava doppio movimento durante chiusura (snap istantaneo
   sull'ul + transition lenta sull'outer). L'outer .v2-tabbar ha già
   overflow: hidden + max-height transition, sufficiente per clippare. */

.v2-tabs {
  position: relative; /* S7-fix: anchor per inline + assoluto */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  /* padding-right 0 → ultima tab della riga arriva fino al bordo destro ul.
     Width settata runtime da updateTabRowsLayout() = row 1 content width →
     ul si restringe al contenuto reale. Spazio oltre (entro scroll-area) =
     drag finestra. */
  padding: 5px 0 5px 6px;
  min-height: var(--v2-tab-h);
  margin: 0;
  list-style: none;
  /* No-drag su ul → eventi mouse OK su tabs + gap interno → hover-expand multirow funziona. */
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* Pill tab */
.v2-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 4px 0 10px;
  border-radius: 100px;
  font-size: 12.5px;
  color: var(--v2-text3);
  cursor: default;
  /* no-drag: click select, contextmenu, dragula reorder funzionano */
  -webkit-app-region: no-drag;
  app-region: no-drag;
  flex-shrink: 0;
  min-width: 88px;
  max-width: 172px;
  white-space: nowrap;
  overflow: hidden;
  background: transparent;
  transition:
    background var(--v2-t-fast) ease-in-out,
    color var(--v2-t-fast) ease-in-out,
    box-shadow var(--v2-t-fast) ease-in-out;
}

.v2-tab:hover:not(.v2-tab-active) {
  background: var(--v2-surface2);
  color: var(--v2-text2);
}

/* Tab attivo: filled + accent stripe */
.v2-tab-active {
  background: var(--v2-surface);
  color: var(--v2-text);
  font-weight: 500;
  box-shadow: var(--v2-shadow-sm);
  /* B6: spazio tra barra blu e nome file */
  padding-top: 3px;
}

/* B1: badge ↑ usato dalla clone tab nel topright */
.v2-tab-pinned-badge {
  font-size: 10px;
  color: var(--v2-accent);
  margin-left: 2px;
  flex-shrink: 0;
  font-weight: bold;
}

.v2-tab-active::before {
  content: '';
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  border-radius: 1px;
  background: var(--v2-accent);
  opacity: 0.75;
}

/* Dot unsaved (amber) */
.v2-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--v2-unsaved);
  flex-shrink: 0;
}

.v2-tab-name {
  /* No flex:1 → span = larghezza testo intrinseca → X subito dopo nome.
     min-width:0 abilita shrink sotto content quando tab eccede max-width 172. */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Close button (× circolare) */
.v2-tab-x {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  font-size: 13px;
  color: var(--v2-text3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all var(--v2-t-fast) ease-in-out;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
}

.v2-tab:hover .v2-tab-x,
.v2-tab-active .v2-tab-x {
  opacity: 1;
}

.v2-tab-x:hover {
  background: var(--v2-border);
  color: var(--v2-text);
}

/* B3: "+" tondo come bolla circolare, inline subito dopo l'ultima tab.
   S7-fix: position: absolute → fuori dal flex flow → non wrappa mai in row 2.
   Posizione `left` calcolata da JS in updateTabRowsLayout() (ultima tab right + GAP).
   Può sconfinare nello slot invisibile del topright-dynamic (single-row state). */
.v2-tab-new-li {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  font-size: 16px;
  color: var(--v2-text3);
  border-radius: 50%;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  background: var(--v2-surface2);
  list-style: none;
  transition: background var(--v2-t-fast) ease-in-out,
              color var(--v2-t-fast) ease-in-out,
              transform var(--v2-t-fast) ease-in-out;
  user-select: none;
}

.v2-tab-new-li:hover {
  background: var(--v2-accent-dim, var(--v2-surface));
  color: var(--v2-accent);
  /* S7-fix: combinare translateY(-50%) base + scale hover */
  transform: translateY(-50%) scale(1.05);
}

/* B1: "+" inline single-row resta tondo. In multi-row si usa .v2-tr-plus dentro topright. */

/* Top-right controls (sovrapposti tab bar) */
/* N4: rimosso padding-left animato (sostituito da v2-topright-dynamic max-width) */
.v2-topright {
  position: absolute;
  top: 0;
  right: 10px;
  height: var(--v2-tab-h);
  display: flex;
  align-items: center;
  gap: 2px;
  z-index: 20;
}

/* N4: wrapper clone + "+" + sep. Sempre in DOM.
   B14c: width FISSA 180px sempre. `max-width` era limite superiore non garanzia
   di occupazione → senza clone (pinnedTab=null) il wrapper si restringeva al
   contenuto residuo (+ + sep ≈ 35px) → topright totale variabile → padding-right
   tabbar variabile (calcolato da offsetWidth) → tabs si riallineavano provocando
   shift di row 1 last tab quando clone riappariva. Width fissa = topright costante. */
.v2-topright-dynamic {
  display: flex;
  align-items: center;
  /* B14d: clone+plus allineati a destra dentro lo slot → niente gap visibile
     tra ".v2-topright-dynamic" e i pulsanti statici (cmd, open file). */
  justify-content: flex-end;
  overflow: hidden;
  /* B14e: width 158px. Era 150px ma contenuto reale ~151px (clone 110 + margin-r 6
     + plus 26 + sep 9) eccedeva → bordo sinistro clone tagliato da overflow:hidden.
     158px lascia ~7px buffer a sinistra del clone (flex-end) → bordo dashed visibile. */
  width: 158px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  /* B14f: fade più fluido (0.4s ease-out) per appearance/disappearance + topright */
  transition: opacity 0.4s ease-out;
}

.v2-topright.topright-expanded .v2-topright-dynamic {
  opacity: 1;
  pointer-events: auto;
}

/* B14f: Vue Transition `v-clone-fade` per clone (indipendente da wrapper).
   Fade in/out clone quando active passa row 1↔row 2+ entro stesso multi-row state. */
.v2-clone-fade-enter-active,
.v2-clone-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.v2-clone-fade-enter-from,
.v2-clone-fade-leave-to {
  opacity: 0;
}

/* B1: clone della tab attiva (riga 2+) nel topright. Pill compatta.
   B14b: width FISSA (era max-width) per layout stabile al cambio tab attiva.
   Filename troppo lungo → ellipsis su .v2-tab-name (già configurato sotto).
   Senza width fissa, cambio tab attiva con filename diverso ridimensionava clone
   → ResizeObserver triggera ricalcolo padding-right tabbar → tabs row 1 saltavano. */
.v2-topright-clone {
  box-sizing: border-box; /* P2: width include padding → box=110px, 110+6+26=142px < 180px container */
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  width: 110px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 100px;
  background: var(--v2-accent-dim, var(--v2-surface2));
  border: 1px dashed var(--v2-accent);
  color: var(--v2-text);
  cursor: default;
  white-space: nowrap;
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
  /* N7: spazio tra clone e "+" */
  margin-right: 6px;
}

.v2-topright-clone .v2-tab-name {
  flex: 1;
  min-width: 0; /* permette shrink sotto larghezza testo → ellipsis funziona */
  overflow: hidden;
  text-overflow: ellipsis;
}

/* B1: "+" all'interno del topright */
.v2-tr-plus {
  width: 26px;
  height: 26px;
  font-size: 16px;
  line-height: 1;
  color: var(--v2-text3);
  border-radius: 50%;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--v2-surface2);
  cursor: pointer;
  transition: all var(--v2-t-fast) ease-in-out;
  padding: 0;
  flex-shrink: 0;
}

.v2-tr-plus:hover {
  background: var(--v2-accent-dim, var(--v2-surface));
  color: var(--v2-accent);
  transform: scale(1.05);
}

/* N4: clone/plus fade obsoleti (ora animati dal wrapper v2-topright-dynamic).
   Leave-active rimangono per eventuali v-if interni al wrapper. */
.topright-clone-fade-leave-active {
  transition: opacity 0.15s ease;
}
.topright-clone-fade-leave-to {
  opacity: 0;
}

.topright-plus-fade-leave-active {
  transition: opacity 0.15s ease;
}
.topright-plus-fade-enter-from,
.topright-plus-fade-leave-to {
  opacity: 0;
}

.v2-tr-btn {
  height: 26px;
  width: 28px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--v2-text3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--v2-t-fast) ease-in-out;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.v2-tr-btn:hover {
  background: var(--v2-surface2);
  color: var(--v2-text);
}

/* F7: button gestione finestra (più stretti e font specifico) */
.v2-tr-btn-win {
  width: 32px;
  font-size: 13px;
}

/* Close button hover rosso (Windows-like) */
.v2-tr-btn-close:hover {
  background: #e81123 !important;
  color: white !important;
}

/* B12: separatore verticale tra gruppo app e gruppo finestra */
.v2-tr-sep {
  width: 1px;
  height: 16px;
  background: var(--v2-border);
  margin: 0 4px;
  flex-shrink: 0;
}

/* B5: sopprime sfondo tab attiva quando è rappresentata dalla clone (pinnedTab),
   ma SOLO con tab bar collassata. Quando l'utente espande (hover), torna visibile. */
.v2-tab-active-hidden {
  background: transparent !important;
  box-shadow: none !important;
  font-weight: 400 !important;
  color: var(--v2-text3) !important;
}
.v2-tab-active-hidden::before {
  display: none;
}
/* N6: rimosso .v2-tabbar:hover — si attivava anche su hover del topright (clone).
   Solo tabs-hovered (set da onTabsEnter, non dal topright) deve riattivare lo stile. */
.v2-tabbar.tabs-hovered .v2-tab-active-hidden {
  background: var(--v2-surface) !important;
  box-shadow: var(--v2-shadow-sm) !important;
  font-weight: 500 !important;
  color: var(--v2-text) !important;
}
.v2-tabbar.tabs-hovered .v2-tab-active-hidden::before {
  display: block;
}

</style>

<!-- Stili dragula globali (non scoped) per drag-and-drop tab -->
<style>
.gu-mirror {
  position: fixed !important;
  margin: 0 !important;
  z-index: 9999 !important;
  opacity: 0.8;
  cursor: grabbing;
}
.gu-hide {
  display: none !important;
}
.gu-unselectable {
  user-select: none !important;
}
.gu-transit {
  opacity: 0.2;
}
</style>
