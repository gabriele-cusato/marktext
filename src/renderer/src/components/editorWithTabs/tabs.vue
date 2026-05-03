<template>
  <div :class="['v2-tabbar', { 'has-multirow': hasMultiRow, 'tabs-hovered': tabsAreaHovered }]">
    <!-- B1: Tabs pill multi-row con hover-expand. Hover SOLO su quest'area:
         passare il mouse su .v2-topright NON espande la tab bar. -->
    <div
      ref="tabContainer"
      class="v2-tabbar-scroll"
      @mouseenter="onTabsEnter"
      @mouseleave="onTabsLeave"
    >
      <ul
        ref="tabDropContainer"
        class="v2-tabs"
      >
        <li
          v-for="file of tabs"
          :key="file.id"
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
         clone tab + "+" appaiono SOLO dopo che l'espansione è completata. -->
    <div :class="['v2-topright', { 'topright-expanded': hasMultiRow }]">
      <!-- B1: clone tab attiva (su riga 2+) nel topright, fade-in con delay = durata espansione -->
      <Transition name="topright-clone-fade">
        <div
          v-if="hasMultiRow && pinnedTab"
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

      <!-- B1: "+" nel topright, solo multi-row -->
      <Transition name="topright-plus-fade">
        <button
          v-if="hasMultiRow"
          class="v2-tr-plus"
          title="New Tab (Ctrl+T)"
          @click.stop="newFile()"
        >+</button>
      </Transition>

      <!-- B1: separatore tra elementi tab (clone, +) e icone app (⌘, 📂) -->
      <div v-if="hasMultiRow" class="v2-tr-sep" />

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

const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const preferencesStore = usePreferencesStore()

const { currentFile, tabs } = storeToRefs(editorStore)
const { theme } = storeToRefs(preferencesStore)

const tabContainer = ref(null)
const tabDropContainer = ref(null)
let autoScroller = null
let drake = null
let tabResizeObs = null

// hasMultiRow: true se tabs occupano > 1 riga (controlla anche posizione di "+" e clone)
const hasMultiRow = ref(false)

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
const onTabsLeave = (e) => {
  // Se relatedTarget è dentro la tab bar (es. topright), mantieni hover.
  const tabbar = e.currentTarget.parentElement
  if (!e.relatedTarget || !tabbar.contains(e.relatedTarget)) {
    tabsAreaHovered.value = false
  }
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

// B1: solo rilevazione multi-row. Posizione di "+" non più calcolata (è nel topright).
const updateTabRowsLayout = () => {
  const ul = tabDropContainer.value
  if (!ul) return
  const items = Array.from(ul.querySelectorAll('li.v2-tab'))
  if (items.length === 0) {
    hasMultiRow.value = false
    return
  }
  const firstTop = items[0].offsetTop
  let multiRow = false
  for (const it of items) {
    if (it.offsetTop > firstTop) { multiRow = true; break }
  }
  hasMultiRow.value = multiRow
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
  scheduleUpdate()

  // Drag and drop ordering
  drake = dragula([tabDropContainer.value], {
    direction: 'horizontal',
    revertOnSpill: true,
    mirrorContainer: tabDropContainer.value,
    ignoreInputTextSelection: false
  }).on('drop', (el, target, source, sibling) => {
    const droppedId = el.getAttribute('data-id')
    const nextTabId = sibling && sibling.getAttribute('data-id')
    const isLastTab = !sibling || sibling.classList.contains('gu-mirror')
    if (!droppedId || (sibling && !nextTabId)) {
      console.error('Tab reorder error: invalid tab IDs')
      return
    }
    editorStore.EXCHANGE_TABS_BY_ID({
      fromId: droppedId,
      toId: isLastTab ? null : nextTabId
    })
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
    updateTabRowsLayout()
  })
})

// B2: clone non scompare quando si compatta a riga singola.
// Se hasMultiRow passa a false (resize finestra/chiusura tab), pinnedTab va azzerato.
// Se torna a true, ricalcola pinnedTab usando stessa logica del watch currentFile.id.
watch(hasMultiRow, (newVal) => {
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
  /* B11: animazione espansione più lenta (0.5s)
     B1: padding-right animato al passaggio multi-row (clone+ entrano nel topright). */
  transition:
    max-height 0.5s ease-in-out,
    box-shadow var(--v2-t-mid) ease-in-out,
    padding-right 0.3s ease;
  display: flex;
  align-items: flex-start;
  /* NB2: 160px riservati per topright (5 buttons: ⌘ 📂 min max close) */
  padding-right: 160px;
  /* B2: padding-bottom default per non far attaccare le tabs alla barra di separazione */
  padding-bottom: 4px;
  user-select: none;
}

/* B1: in multi-row il topright ospita anche clone tab + "+" + separator,
   serve più spazio. ~120 (clone) + 28 (+) + 9 (sep) + 160 (icone) = 320px */
.v2-tabbar.has-multirow {
  padding-right: 320px;
}

/* B1: hover-expand attivato SOLO da hover su area tab (classe `tabs-hovered`).
   Hovering su .v2-topright NON deve espandere la tab bar. */
.v2-tabbar.has-multirow.tabs-hovered {
  max-height: 260px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
}

.v2-tabbar-scroll {
  flex: 1;
  overflow: hidden;
  min-height: var(--v2-tab-h);
}

/* NB5: rimossa regola .v2-tabbar.has-multirow:not(:hover) .v2-tabs
   max-height — causava doppio movimento durante chiusura (snap istantaneo
   sull'ul + transition lenta sull'outer). L'outer .v2-tabbar ha già
   overflow: hidden + max-height transition, sufficiente per clippare. */

.v2-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  padding: 5px 6px;
  min-height: var(--v2-tab-h);
  margin: 0;
  list-style: none;
}

/* Pill tab */
.v2-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px 0 12px;
  border-radius: 100px;
  font-size: 12.5px;
  color: var(--v2-text3);
  cursor: default;
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
  flex: 1;
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

/* B3: "+" tondo come bolla circolare, inline subito dopo l'ultima tab */
.v2-tab-new-li {
  width: 26px;
  height: 26px;
  font-size: 16px;
  color: var(--v2-text3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  background: var(--v2-surface2);
  list-style: none;
  transition: all var(--v2-t-fast) ease-in-out;
  user-select: none;
  align-self: center;
}

.v2-tab-new-li:hover {
  background: var(--v2-accent-dim, var(--v2-surface));
  color: var(--v2-accent);
  transform: scale(1.05);
}

/* B1: "+" inline single-row resta tondo. In multi-row si usa .v2-tr-plus dentro topright. */

/* Top-right controls (sovrapposti tab bar)
   B1: padding-left animato. In multi-row si crea spazio per clone + "+" + separatore. */
.v2-topright {
  position: absolute;
  top: 0;
  right: 10px;
  height: var(--v2-tab-h);
  display: flex;
  align-items: center;
  gap: 2px;
  z-index: 20;
  padding-left: 0;
  transition: padding-left 0.3s ease;
}

.v2-topright.topright-expanded {
  padding-left: 8px;
}

/* B1: clone della tab attiva (riga 2+) nel topright. Pill compatta. */
.v2-topright-clone {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  max-width: 140px;
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
}

.v2-topright-clone .v2-tab-name {
  flex: 1;
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

/* B1: clone fade. Delay 0.3s = durata espansione del topright (entrano DOPO l'espansione). */
.topright-clone-fade-enter-active {
  transition: opacity 0.2s ease 0.3s;
}
.topright-clone-fade-leave-active {
  transition: opacity 0.15s ease;
}
.topright-clone-fade-enter-from,
.topright-clone-fade-leave-to {
  opacity: 0;
}

/* B1: "+" fade leggermente prima del clone */
.topright-plus-fade-enter-active {
  transition: opacity 0.2s ease 0.25s;
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
.v2-tabbar:hover .v2-tab-active-hidden,
.v2-tabbar.tabs-hovered .v2-tab-active-hidden {
  background: var(--v2-surface) !important;
  box-shadow: var(--v2-shadow-sm) !important;
  font-weight: 500 !important;
  color: var(--v2-text) !important;
}
.v2-tabbar:hover .v2-tab-active-hidden::before,
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
