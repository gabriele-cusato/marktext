<template>
  <div class="v2-tabbar">
    <!-- Tabs pill multi-row con hover-expand -->
    <div
      ref="tabContainer"
      class="v2-tabbar-scroll"
    >
      <ul
        ref="tabDropContainer"
        class="v2-tabs"
      >
        <li
          v-for="file of tabs"
          :key="file.id"
          :title="file.pathname || file.filename"
          :class="['v2-tab', { 'v2-tab-active': currentFile.id === file.id }]"
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
      </ul>
    </div>

    <!-- New tab button -->
    <button
      class="v2-tab-new"
      title="New Tab (Ctrl+T)"
      @click.stop="newFile()"
    >+</button>

    <!-- Top-right controls (Command palette / Settings / Theme toggle) -->
    <div class="v2-topright">
      <button
        class="v2-tr-btn"
        title="Command Palette (Ctrl+K)"
        @click="openCommandPalette"
      >⌘</button>
      <button
        class="v2-tr-btn"
        title="Settings"
        @click="openSettings"
      >⚙</button>
      <button
        class="v2-tr-btn"
        :title="`Toggle theme (current: ${currentTheme})`"
        @click="toggleTheme"
      >{{ currentTheme === 'dark' ? '◐' : '◑' }}</button>
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
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
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

const openSettings = () => {
  bus.emit('show-settings-modal')
}

const toggleTheme = () => {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  preferencesStore.SET_SINGLE_PREFERENCE({ type: 'theme', value: next })
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

  const el = tabContainer.value
  if (el) el.addEventListener('wheel', handleTabScroll)

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
  transition:
    max-height var(--v2-t-slow) ease-in-out,
    box-shadow var(--v2-t-mid) ease-in-out;
  display: flex;
  align-items: flex-start;
  padding-right: 110px; /* spazio per top-right controls */
  user-select: none;
}

/* Hover sull'intera tabbar = espande multi-row */
.v2-tabbar:hover {
  max-height: 260px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
}

.v2-tabbar-scroll {
  flex: 1;
  overflow: hidden;
  min-height: var(--v2-tab-h);
}

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

/* + new tab button */
.v2-tab-new {
  height: 26px;
  min-width: 26px;
  font-size: 17px;
  color: var(--v2-text3);
  border-radius: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--v2-t-fast) ease-in-out;
  padding: 0 8px;
  border: none;
  background: none;
  cursor: pointer;
  margin-top: 6px;
  margin-right: 4px;
}

.v2-tab-new:hover {
  background: var(--v2-surface2);
  color: var(--v2-text);
}

/* Top-right controls (sovrapposti tab bar) */
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
