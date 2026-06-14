<template>
  <div
    :class="['v2-tabbar', { 'has-multirow': hasMultiRow, 'tabs-hovered': tabsAreaHovered, 'is-osx': isOsx }]"
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

      <!-- Suggerimento "espandibile": freccetta giù centrata orizzontalmente sullo
           SPAZIO RISERVATO ALLE TABS. È figlia di .v2-tabbar-scroll (il flex:1 che occupa
           esattamente il content-box della tab bar: tra il padding-left dei traffic lights
           e il padding-right riservato al topright) → left:50% = centro reale dei tab, non
           dell'intera bar. Appare (fade-in) + lampeggia ~2s SOLO in multi-row collassato;
           scompare (fade-out) se torna single-row o se la bar è espansa (tabs-hovered).
           pointer-events:none → non interferisce con hover-expand / drag. -->
      <div class="v2-multirow-hint" aria-hidden="true">
        <svg
          class="v2-multirow-hint-arrow"
          width="14" height="9" viewBox="0 0 14 9"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="M1 1.5 L7 7 L13 1.5" />
        </svg>
      </div>
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
        class="v2-tr-btn v2-tr-btn-open"
        title="Apri file (Ctrl+O)"
        @click="openFileDialog"
      >
        <!-- NB4: SVG cartella aperta minimal, monocromatica -->
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M1.5 4.5h4.5l1.5 1.5H14.5v7.5H1.5V4.5z" stroke-linejoin="round"/>
        </svg>
      </button>
      <!-- T-ME: su macOS i 3 controlli finestra custom + il loro separatore spariscono
           (li sostituisce il semaforo nativo top-left). Su Windows/Linux invariato. -->
      <template v-if="!isOsx">
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
      </template>
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
// T-ME: flag macOS. Su mac i controlli finestra custom (−/□/×) spariscono
// (li gestisce il semaforo nativo) e si riserva spazio a sinistra per i traffic lights.
import { isOsx } from '@/util'

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
// BUG-1 (1e): timer per defer-not-drop del lock. Prima un update arrivato durante
// il lock veniva PERSO (return secco) → se era l'ultimo del resize, lo stato finale
// restava sbagliato finché un nuovo evento non arrivava (mai, a finestra ferma).
// Ora viene rischedulato una volta a lock scaduto. Un solo timer pendente alla volta.
let lockRetryTimer = null

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
  // BUG-WINCLOSE: la X custom mandava 'mt::close-window' (forceClose immediato) → scartava le
  // modifiche non salvate senza chiedere. 'mt::cmd-close-window' fa win.close() → win.on('close')
  // → 'mt::ask-for-close' → LISTEN_FOR_CLOSE → dialog "salvare?" (stesso flusso della X nativa).
  window.electron.ipcRenderer.send('mt::cmd-close-window')
}

const onWinMaximize = () => { isMaximized.value = true }
const onWinUnmaximize = () => { isMaximized.value = false }

// B3 + B4: calcola se le tab sono su più righe e posiziona "+" alla fine
// della prima riga quando multi-row.
// NB3: escludere il clone pinned dal calcolo — la sua presenza/assenza
// non deve far saltare la posizione del "+".
// B4: misurazione layout dopo nextTick + rAF, per evitare flash multi-row
// transitorio durante il commit DOM (es. nuova tab) che farebbe scattare CSS hover.
const scheduleUpdate = (src = '?') => {
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
  if (Date.now() < layoutLockUntil) {
    // BUG-1 (1e): defer-not-drop — rilancia a lock scaduto, l'update non va perso.
    if (!lockRetryTimer) {
      lockRetryTimer = setTimeout(() => {
        lockRetryTimer = null
        nextTick(() => requestAnimationFrame(() => updateTabRowsLayout()))
      }, Math.max(layoutLockUntil - Date.now(), 0) + 20)
    }
    return
  }

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
  // BUG-1 (1e): il topright cambia width con lo stato (slot dinamico 0↔158 via
  // `.topright-expanded`) → misurarlo "as is" rendeva la detection stato-dipendente:
  // isteresi (soglie wrap diverse tra shrink ed expand) + 1° frame post-flip calcolato
  // col padding stale. Normalizzo a `baseTopRight` (solo parte statica: sottraggo lo
  // slot dinamico misurato) e scelgo il padding in base allo stato FINALE calcolato.
  const TOPRIGHT_RIGHT_OFFSET = 10 // CSS .v2-topright { right: 10px }
  const HOVER_BUFFER = 12          // clearance per hover/box-shadow ultima tab
  const DYN_SLOT_W = 158           // CSS .topright-expanded .v2-topright-dynamic { width }
  const tre = topRightEl.value
  const dynEl = tre ? tre.querySelector('.v2-topright-dynamic') : null
  const baseTopRight = tre ? tre.offsetWidth - (dynEl ? dynEl.offsetWidth : 0) : 160
  const padSingle = baseTopRight + TOPRIGHT_RIGHT_OFFSET + HOVER_BUFFER
  const padMulti = baseTopRight + DYN_SLOT_W + TOPRIGHT_RIGHT_OFFSET + HOVER_BUFFER

  // Detection + row1Width SIMULATI (non dipendono da DOM offsetTop attuale, che è
  // condizionato da ul.style.width già settata in iterazioni precedenti → causava
  // loop downgrade row 1 a 1 tab). offsetWidth tab è intrinseco (min/max-clamped,
  // flex-shrink:0) → stabile a prescindere da ul width. Simulo wrap iterativo.
  // T-ME: clientWidth include il padding-left (riservato al semaforo nativo su macOS).
  // Va sottratto, altrimenti su mac lo spazio disponibile è sovrastimato → ultima tab
  // coperta/clippata. Su Win/Linux padding-left=0 → leftPad=0 → calcolo invariato.
  const leftPad = parseFloat(getComputedStyle(tabbarEl).paddingLeft) || 0
  // BUG-1 (1f): clamp al viewport. Se un ancestor non può restringersi (regressione
  // min-width:auto, vedi app.vue .editor-middle), clientWidth resta ≥ ulW+padding
  // (pavimento = nostro stesso output) → la detection non demoterebbe mai (loop).
  // Col clamp la detection vede la finestra vera e si sblocca da sola.
  const tabbarClientW = Math.min(tabbarEl.clientWidth, document.documentElement.clientWidth)
  // Helper first-fit: quante tab entrano in riga 1 dato lo spazio disponibile.
  const fitRow1 = (available) => {
    let width = 0
    let count = 0
    for (const item of items) {
      const itemW = item.offsetWidth
      const addedWidth = count === 0 ? itemW : (GAP + itemW)
      if (count > 0 && width + addedWidth > available) break
      width += addedWidth
      count++
    }
    return { width, count }
  }

  // PASS 1: ipotesi single-row (topright collassato, padSingle) → decide multiRow.
  // Soglia UNICA in entrambe le direzioni di resize → niente isteresi.
  let fit = fitRow1(tabbarClientW - padSingle - ulPadding - leftPad)
  let row1ContentWidth = fit.width
  let row1Count = fit.count
  let multiRow = row1Count < items.length
  // Verify inline "+" fits. It's absolute (not flex), placed at (ulPadding + row1ContentWidth + GAP).
  // If its right edge exceeds the scroll area, demote the last tab to row 2.
  if (!multiRow && items.length > 0) {
    const scrollRight = tabbarClientW - padSingle - leftPad
    while (row1Count > 1) {
      if (ulPadding + row1ContentWidth + GAP + 26 <= scrollRight) break  // 26 = .v2-tab-new-li CSS width
      const lastIdx = row1Count - 1
      row1ContentWidth -= lastIdx === 0 ? items[0].offsetWidth : GAP + items[lastIdx].offsetWidth
      row1Count--
    }
    multiRow = row1Count < items.length
  }

  // PASS 2: se multi-row, riga 1 va ricalcolata con topright ESPANSO (padMulti):
  // ul width corretta già in QUESTO run, niente frame transitorio con tab sotto il
  // topright in attesa che obs:topright/retry rifirino (prima era lì la fragilità).
  if (multiRow) {
    fit = fitRow1(tabbarClientW - padMulti - ulPadding - leftPad)
    row1ContentWidth = fit.width
    row1Count = fit.count
  }

  // Padding committato = stato FINALE calcolato (non quello misurato pre-flip):
  // scroll-area/drag-region coerenti subito col layout deciso.
  const dynamicPaddingRight = multiRow ? padMulti : padSingle
  tabbarEl.style.paddingRight = `${dynamicPaddingRight}px`
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
    tabResizeObs = new ResizeObserver(() => scheduleUpdate('obs:ul'))
    tabResizeObs.observe(tabDropContainer.value)
  }
  // B14: ResizeObserver su .v2-topright. Clone tab width cambia quando filename
  // attivo cambia → padding-right dinamico va ricalcolato per evitare overlap X.
  if (window.ResizeObserver && topRightEl.value) {
    topRightResizeObs = new ResizeObserver(() => scheduleUpdate('obs:topright'))
    topRightResizeObs.observe(topRightEl.value)
  }
  // ResizeObserver su tabbar root → triggera recalc su resize finestra.
  // Senza questo, ul.style.width settata in updateTabRowsLayout resta fissa →
  // su resize finestra ul può eccedere scroll-area → tabs overlap topright.
  const tabbarRoot = tabDropContainer.value?.closest('.v2-tabbar')
  if (window.ResizeObserver && tabbarRoot) {
    tabbarResizeObs = new ResizeObserver(() => scheduleUpdate('obs:tabbar-resize'))
    tabbarResizeObs.observe(tabbarRoot)
  }
  scheduleUpdate('onMounted')

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
  // BUG-1 (1e): cleanup timer defer lock
  if (lockRetryTimer) {
    clearTimeout(lockRetryTimer)
    lockRetryTimer = null
  }
})

// B3+B4: ricalcola layout quando cambiano le tab
watch(tabs, () => {
  // Apertura nuova tab → resetta pinned (B5)
  pinnedTab.value = null
  scheduleUpdate()
}, { deep: false })

// Riposiziona "+" inline quando dot isSaved appare/sparisce o filename cambia
// (causano variazione di offsetWidth della pill → serve recalc left del +).
// deep:false non catcherebbe queste variazioni interne agli oggetti tab.
watch(
  () => tabs.value.map(t => `${t.isSaved}|${t.filename}`).join(','),
  () => scheduleUpdate()
)

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

/* T-ME: su macOS riserva spazio a sinistra per il semaforo nativo (traffic lights,
   top-left). ~78px copre i 3 cerchi inset di titleBarStyle:'hiddenInset'. Solo macOS:
   la classe `is-osx` è applicata solo se isOsx → Win/Linux invariati (padding-left 0). */
.v2-tabbar.is-osx {
  padding-left: 78px;
}

/* T-ME (macOS, SOLO single-row): la riga unica di tab è centrata nei 40px della bar
   → sta più in basso del semaforo nativo (i traffic lights, tarati via
   trafficLightPosition sulla PRIMA riga multi-row, che resta già allineata). Qui la
   alziamo e assottigliamo lievemente le tab così da combaciare col semaforo anche in
   single-row. La leva è `transform: translateY` sulla `ul.v2-tabs` (non sulle singole
   .v2-tab): muove insieme tab + "+" (absolute, relativo alla ul) ed è puramente visiva
   → NON altera offsetWidth/offsetTop, quindi updateTabRowsLayout/recomputePinnedTab
   restano invariati. Gated `is-osx` + `:not(.has-multirow)` → Win/Linux e lo stato
   multi-row non vengono toccati; `trafficLightPosition` (config.js) resta invariato. */
.v2-tabbar.is-osx:not(.has-multirow) .v2-tabs {
  transform: translateY(-5px);
}
.v2-tabbar.is-osx:not(.has-multirow) .v2-tab {
  height: 25px;
}

/* Win/Linux single-row: rimuove padding verticale sull'ul per permettere ad align-items:center
   di centrare esattamente le pill nel centro visivo della title bar (y=20px in 40px bar),
   allineandole ai window controls (.v2-topright h:40px align:center → center y=20px).
   Tab assottigliate a 23px. transform non necessario: padding-block:0 basta.
   Gated :not(.is-osx) + :not(.has-multirow) → mac e multi-row invariati. */
.v2-tabbar:not(.is-osx):not(.has-multirow) .v2-tabs {
  padding-block: 0;
}
.v2-tabbar:not(.is-osx):not(.has-multirow) .v2-tab {
  height: 28px;
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

/* Hint "espandibile": freccetta giù centrata orizzontalmente in basso.
   Due layer separati per avere fade-in/out PULITO + blink senza che si annullino:
   - il wrapper .v2-multirow-hint gestisce il fade (transition opacity);
   - la freccia interna lampeggia per ~2s alla comparsa, poi SVANISCE (fade a opacity 0,
     fill-mode forwards → resta invisibile, l'elemento sta nel DOM ma non si vede).
     Riparte da capo a ogni ri-collasso (il selettore torna a matchare). I due opacity
     si moltiplicano → nessun conflitto. Default: invisibile. */
.v2-multirow-hint {
  position: absolute;
  /* ancorata in basso nella prima riga (bar collassata = var(--v2-tab-h)). top stabile
     anche se .v2-tabbar-scroll cresce in altezza coi rows nascosti (overflow visible). */
  top: calc(var(--v2-tab-h) - 9px);
  left: 50%;
  /* Centraggio su: spazio tabs + zona clone/"+" (.v2-topright-dynamic), ESCLUSI i
     controlli di destra (⌘/📂; su Win anche i controlli finestra). La freccia parte
     centrata sullo scroll (= solo tabs) e va spostata a destra di metà della zona
     dinamica + buffer: (DYN_SLOT_W 158 + HOVER_BUFFER 12)/2 = 85px. L'offset è esatto e
     indipendente da OS/larghezza (baseTopRight, leftPad, clientWidth si annullano).
     ⚠️ Sync JS↔CSS: se cambi 158/12 in updateTabRowsLayout, aggiorna 85 qui. */
  transform: translateX(calc(-50% + 85px));
  display: flex;
  align-items: center;
  justify-content: center;
  height: 9px;
  /* stesso accent della tab clone (bordo dashed + badge ↑) → coerenza visiva.
     --v2-accent è definito per tema → coerente anche con chiaro/scuro. */
  color: var(--v2-accent);
  opacity: 0;
  pointer-events: none;
  z-index: 15;
  transition: opacity 0.35s ease-out;
}

/* Visibile SOLO in multi-row collassato (2+ righe, bar non espansa).
   transition-delay 0.5s = attende che la bar abbia finito di collassare (max-height 0.5s)
   prima di comparire → niente blink mentre la bar si richiude. Il delay è solo in questo
   stato (entrata); uscendo (hover → espansione) il fade-out torna immediato (base rule). */
.v2-tabbar.has-multirow:not(.tabs-hovered) .v2-multirow-hint {
  opacity: 1;
  transition-delay: 0.5s;
}

.v2-multirow-hint-arrow {
  display: block;
  /* base invisibile: la visibilità è guidata SOLO dall'animazione (keyframe). Così,
     tolta l'animazione (hover/espansione o fine blink), la freccia resta a 0 e NON
     riappare per un istante mentre il wrapper sfuma → niente flash all'hover. */
  opacity: 0;
}

/* Delay 0.5s (= attesa collasso bar, sincronizzato col wrapper sopra) poi blink ~2s,
   poi fade-out a 0 (fill forwards → resta invisibile). Durante il delay il wrapper è
   ancora opacity 0 → la freccia non si vede comunque. */
.v2-tabbar.has-multirow:not(.tabs-hovered) .v2-multirow-hint-arrow {
  animation: v2-multirow-hint-blink 2.6s ease-in-out 0.5s forwards;
}

@keyframes v2-multirow-hint-blink {
  0%   { opacity: 1; }
  19%  { opacity: 0.2; }
  38%  { opacity: 1; }
  58%  { opacity: 0.2; }
  77%  { opacity: 1; }   /* fine blink (~2s) */
  100% { opacity: 0; }   /* poi svanisce */
}

.v2-tabbar-scroll {
  flex: 1;
  /* anchor per .v2-multirow-hint → la centra sul content-box (= spazio tabs), non
     sull'intera bar. Non tocca il "+" (ancorato alla ul, già position:relative). */
  position: relative;
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
  top: 4px;
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
  /* flex-grow:1 → nome riempie spazio disponibile → X sempre al bordo destro.
     min-width:0 abilita shrink quando tab è a max-width 172. */
  flex-grow: 1;
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
  /* BUG-1 fix: width collassata a 0 in single-row (il clone esiste SOLO in multi-row).
     I 158px ora vivono in `.topright-expanded` sotto → la sezione destra non riserva
     ~158px inutili a finestra/tabbar stretta → ⌘/📂 e tab non vengono più clippati. */
  width: 0;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  /* B14f: fade più fluido (0.4s ease-out) per appearance/disappearance + topright */
  transition: opacity 0.4s ease-out;
}

.v2-topright.topright-expanded .v2-topright-dynamic {
  /* BUG-1 fix: i 158px (derivati in B14e per contenere il clone) valgono SOLO in
     multi-row. Width COSTANTE qui dentro → invariante B14c preservata: nessuno shift
     di row 1 quando il clone appare/sparisce restando nello stato multi-row. */
  width: 158px;
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

/* Allineamento ottico SVG cartella rispetto all'icona ⌘ */
.v2-tr-btn-open svg {
  padding-bottom: 3px;
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
