<template>
  <div
    :class="['v2-tabbar', { 'has-multirow': hasMultiRow, 'tabs-hovered': tabsAreaHovered, 'is-osx': isOsx }]"
    @mouseleave="onTabbarLeave"
  >
    <!-- Overlay drag "alla VS Code" (struttura DEFINITIVA dal GATE task1b, 2026-07-02) —
         pattern verificato nel sorgente VS Code (titlebarPart.ts): la zona app-region:drag
         vive in un elemento FRATELLO, mai antenato delle tab, così le .v2-tab non sono MAI
         discendenti di un contenitore drag (causa n.1 del FAIL task1, vedi DRAG-TASK.md
         §3/"Stato decisioni"). PRIMO figlio → dipinto per primo; i fratelli successivi
         (scroll-area, topright) vengono dopo nell'ordine sorgente e ricevono gli hit DOM
         sopra l'overlay, senza bisogno di z-index. Invariante 5 (drag-html5-dnd-task2): non
         rimuovere né spostare, il drag HTML5 nativo sulle tab dipende da questa struttura. -->
    <div class="v2-tabbar-drag-region" />
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
        @dragenter.prevent
        @dragover.prevent="onTabsDragOver"
        @dragleave="onTabsDragLeave"
        @drop.prevent="onTabsDrop"
      >
        <li
          v-for="file of tabs"
          :key="`${file.id}-${tabsRenderKey}`"
          :title="file.pathname || file.filename"
          :class="['v2-tab', {
            'v2-tab-active': currentFile.id === file.id,
            'v2-tab-active-hidden': currentFile.id === file.id && pinnedTab && pinnedTab.id === file.id,
            'is-pinned': !!file.pinned
          }]"
          :data-id="file.id"
          draggable="true"
          @click.stop="selectFile(file)"
          @click.middle="closeTab(file.id)"
          @contextmenu.prevent="handleContextMenu($event, file)"
          @dragstart="onTabDragStart($event, file)"
          @dragend="onTabDragEnd($event)"
        >
          <!-- H4: indicatore pin (puntina da disegno) — solo tab pinnate -->
          <span
            v-if="file.pinned"
            class="v2-tab-pin"
            title="Pinned"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          </span>
          <!-- Dot unsaved -->
          <span
            v-if="!file.isSaved"
            class="v2-tab-dot"
          />
          <span class="v2-tab-name">{{ file.filename }}</span>
          <button
            class="v2-tab-x"
            @click.stop="removeFileInTab(file)"
          >
            ×
          </button>
        </li>
        <!-- drag-html5-dnd-task2: indicatore d'inserimento del drag HTML5 nativo (sostituisce
             il mirror DOM di dragula, rimosso). position:absolute (come il "+" sotto) → fuori
             dal flex flow, non altera offsetWidth/offsetTop delle tab (nessun impatto sulla
             detection multi-row, Inv. MEDIUM-TASK.md). Posizione/altezza calcolate in
             onTabsDragOver dalla riga della tab target (fix round 1, BUG-INDICATORE-ALTEZZA):
             confinata alla riga della tab target, non più alta quanto l'intera ul. Visibilità
             legata a `dragIndicatorVisible` (non a `draggedTabId`, che resta true per tutta la
             durata del drag anche fuori dalla ul) → sparisce davvero quando il cursore lascia
             la tab bar (fix round 1, BUG-INDICATORE-STILE: sparizione onTabsDragLeave). -->
        <li
          v-if="dragIndicatorVisible"
          class="v2-tab-drop-indicator"
          :style="{ left: `${dragIndicatorLeft}px`, top: `${dragIndicatorTop}px`, height: `${dragIndicatorHeight}px` }"
          aria-hidden="true"
        />
        <!-- B1: "+" inline solo in single-row. In multi-row si sposta nel topright. -->
        <li
          v-if="!hasMultiRow"
          class="v2-tab-new-li"
          title="New Tab (Ctrl+T)"
          @click.stop="newFile()"
        >
          +
        </li>
      </ul>

      <!-- Suggerimento "espandibile": freccetta giù centrata orizzontalmente sullo
           SPAZIO RISERVATO ALLE TABS. È figlia di .v2-tabbar-scroll (il flex:1 che occupa
           esattamente il content-box della tab bar: tra il padding-left dei traffic lights
           e il padding-right riservato al topright) → left:50% = centro reale dei tab, non
           dell'intera bar. Appare (fade-in) + lampeggia ~2s SOLO in multi-row collassato;
           scompare (fade-out) se torna single-row o se la bar è espansa (tabs-hovered).
           pointer-events:none → non interferisce con hover-expand / drag. -->
      <div
        class="v2-multirow-hint"
        aria-hidden="true"
      >
        <svg
          class="v2-multirow-hint-arrow"
          width="14"
          height="9"
          viewBox="0 0 14 9"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
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
            <span
              v-if="!pinnedTab.isSaved"
              class="v2-tab-dot"
            />
            <span class="v2-tab-name">{{ pinnedTab.filename }}</span>
            <span class="v2-tab-pinned-badge">↑</span>
          </div>
        </Transition>

        <!-- B1: "+" nel topright -->
        <button
          class="v2-tr-plus"
          title="New Tab (Ctrl+T)"
          @click.stop="newFile()"
        >
          +
        </button>

        <!-- B1: separatore tra elementi tab (clone, +) e icone app (⌘, 📂) -->
        <div class="v2-tr-sep" />
      </div>

      <!-- window-minwidth-hamburger: sopra soglia, le 3 icone singole (palette, recenti,
           cartella) restano come oggi. Sotto soglia le sostituisce un unico bottone
           hamburger (v-else sotto), stato aggiornato in updateTabRowsLayout(). -->
      <template v-if="!isToprightCollapsed">
        <button
          class="v2-tr-btn"
          title="Command Palette (Ctrl+K)"
          @click="openCommandPalette"
        >
          ⌘
        </button>
        <button
          class="v2-tr-btn"
          title="Recent Files"
          @click="openRecentFiles"
        >
          <!-- T-RFI: SVG "orologio con freccia antioraria" (stile history), monocromatico,
               coerente con l'icona cartella qui sotto. -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
          </svg>
        </button>
        <button
          class="v2-tr-btn v2-tr-btn-open"
          title="Apri file (Ctrl+O)"
          @click="openFileDialog"
        >
          <!-- NB4: SVG cartella aperta minimal, monocromatica -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
          >
            <path
              d="M1.5 4.5h4.5l1.5 1.5H14.5v7.5H1.5V4.5z"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="v2-tr-btn"
          title="Search in Folder"
          @click="openFolderSearch"
        >
          <!-- folder-search-task4: SVG cartella + lente, monocromatica, stesso stile
               dell'icona "Apri file" qui sopra (viewBox/stroke coerenti). -->
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
          >
            <path
              d="M1.5 4.5h4.5l1.5 1.5H14.5v6.2H1.5V4.5z"
              stroke-linejoin="round"
            />
            <circle
              cx="10.8"
              cy="10.6"
              r="2.3"
            />
            <line
              x1="12.5"
              y1="12.3"
              x2="14"
              y2="13.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </template>
      <!-- window-minwidth-hamburger: bottone unico + popover con le 3 voci, ancorato
           al bottone. Chiusura su click fuori / Esc gestita da watch(hamburgerMenuOpen). -->
      <div
        v-else
        ref="hamburgerWrapEl"
        class="v2-tr-hamburger-wrap"
      >
        <button
          ref="hamburgerBtnEl"
          class="v2-tr-btn"
          title="Menu"
          @click.stop="hamburgerMenuOpen = !hamburgerMenuOpen"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          >
            <line x1="1.5" y1="4" x2="14.5" y2="4" />
            <line x1="1.5" y1="8" x2="14.5" y2="8" />
            <line x1="1.5" y1="12" x2="14.5" y2="12" />
          </svg>
        </button>
        <!-- BUGFIX popover-clip: teleportato su body (fuori da .v2-tabbar, che ha
             overflow:hidden e taglierebbe il popover) e ancorato in position:fixed
             col rect del bottone (positionPopover). Stesso pattern di BaseContextMenu.vue
             e folderSearchOverlay/index.vue. -->
        <Teleport to="body">
          <div
            v-if="hamburgerMenuOpen"
            ref="popoverEl"
            class="v2-tr-popover"
            :style="popoverStyle"
            @mousedown.stop
            @click.stop
          >
            <div
              class="v2-tr-popover-item"
              @click="hamburgerCommandPalette"
            >
              Command Palette
            </div>
            <div
              class="v2-tr-popover-item"
              @click="hamburgerOpenFile"
            >
              Apri file
            </div>
            <div
              class="v2-tr-popover-item"
              @click="hamburgerRecentFiles"
            >
              File recenti
            </div>
            <div
              class="v2-tr-popover-item"
              @click="hamburgerFolderSearch"
            >
              Search in Folder
            </div>
          </div>
        </Teleport>
      </div>
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
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
          >
            <line
              x1="0"
              y1="5"
              x2="10"
              y2="5"
              stroke="currentColor"
              stroke-width="1.2"
            />
          </svg>
        </button>
        <button
          class="v2-tr-btn v2-tr-btn-win"
          :title="isMaximized ? 'Ripristina' : 'Massimizza'"
          @click="winMaximize"
        >
          <svg
            v-if="!isMaximized"
            width="10"
            height="10"
            viewBox="0 0 10 10"
          >
            <rect
              x="0.6"
              y="0.6"
              width="8.8"
              height="8.8"
              stroke="currentColor"
              stroke-width="1.2"
              fill="none"
            />
          </svg>
          <svg
            v-else
            width="10"
            height="10"
            viewBox="0 0 10 10"
          >
            <rect
              x="2"
              y="0.6"
              width="7.4"
              height="7.4"
              stroke="currentColor"
              stroke-width="1.2"
              fill="none"
            />
            <rect
              x="0.6"
              y="2"
              width="7.4"
              height="7.4"
              stroke="currentColor"
              stroke-width="1.2"
              fill="var(--v2-bg)"
            />
          </svg>
        </button>
        <button
          class="v2-tr-btn v2-tr-btn-win v2-tr-btn-close"
          title="Chiudi"
          @click="winClose"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
          >
            <line
              x1="0"
              y1="0"
              x2="10"
              y2="10"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <line
              x1="10"
              y1="0"
              x2="0"
              y2="10"
              stroke="currentColor"
              stroke-width="1.2"
            />
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
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
// T-RFI: store command center, serve solo a leggere se file.quick-open è già registrato
// (vedi openRecentFiles) prima di emettere cmd::execute.
import { useCommandCenterStore } from '@/store/commandCenter'
import { storeToRefs } from 'pinia'
import bus from '../../bus'
import TabContextMenu from '../contextMenu/TabContextMenu.vue'
// T-ME: flag macOS. Su mac i controlli finestra custom (−/□/×) spariscono
// (li gestisce il semaforo nativo) e si riserva spazio a sinistra per i traffic lights.
import { isOsx } from '@/util'

const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const commandCenterStore = useCommandCenterStore()

const { currentFile, tabs } = storeToRefs(editorStore)

const tabContainer = ref(null)
const tabDropContainer = ref(null)
const topRightEl = ref(null) // B14: zona topright (.v2-topright) — misurata runtime per padding tabbar
let tabResizeObs = null
let topRightResizeObs = null // B14: ResizeObserver su topright — clone width cambia con file/filename
let tabbarResizeObs = null // ResizeObserver su tabbar root → trigger recalc su resize finestra

// hasMultiRow: true se tabs occupano > 1 riga (controlla anche posizione di "+" e clone)
const hasMultiRow = ref(false)

// window-minwidth-hamburger: true sotto la soglia HAMBURGER_THRESHOLD → la sezione destra
// (⌘/📂/recenti) collassa in un unico bottone hamburger con popover. Aggiornato dentro
// updateTabRowsLayout (stesso ResizeObserver esistente, nessun listener window nuovo).
const isToprightCollapsed = ref(false)
// stato apertura popover hamburger (chiuso su click fuori / Esc, vedi watch sotto)
const hamburgerMenuOpen = ref(false)

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

// drag-html5-dnd-task2: stato locale del drag HTML5 nativo (reorder stessa finestra).
// draggedTabId: id della tab sorgente, tracciato via ref perché durante `dragover` il
// `dataTransfer` non è leggibile (solo in `drop`, restrizione HTML5 DnD) — letto anche
// dal template per mostrare l'indicatore d'inserimento.
const draggedTabId = ref(null)
// dragTargetId: id della tab prima della quale verrebbe inserita la tab trascinata
// (null = in fondo alla zona pinnata/non-pinnata di appartenenza). Calcolato in
// onTabsDragOver, passato as-is a EXCHANGE_TABS_BY_ID (che già clampa la zona H4).
const dragTargetId = ref(null)
// Posizione (px, relativa alla ul) dell'indicatore d'inserimento — vedi onTabsDragOver.
const dragIndicatorLeft = ref(0)
// Fix round 1 (BUG-INDICATORE-ALTEZZA): top/height dell'indicatore, presi dalla riga della
// tab target (non più l'intera altezza della ul) — evita che l'indicatore attraversi le
// righe successive in multi-row.
const dragIndicatorTop = ref(0)
const dragIndicatorHeight = ref(0)
// Fix round 1 (BUG-INDICATORE-STILE): visibilità dell'indicatore scollegata da
// `draggedTabId` (che resta valorizzato per tutta la durata del drag anche fuori dalla
// tab bar) — così l'indicatore sparisce davvero quando il cursore lascia la ul
// (onTabsDragLeave) invece di restare fermo nell'ultima posizione calcolata.
const dragIndicatorVisible = ref(false)
// Fix round 2 (BUG-GHOST): nodo DOM del drag image "a pillola" creato in onTabDragStart e
// rimosso in onTabDragEnd/onBeforeUnmount. Non un ref: non serve reattività, è solo un
// riferimento al nodo appeso temporaneamente a document.body per setDragImage.
let dragGhostEl = null
// Fix round 3 (BUG-DROP, bug piattaforma electron#42252 — DECISIONS.md 2026-07-03): su
// Windows/Electron 28+ il `drop` per i drag HTML5 interni alla stessa finestra non viene
// MAI consegnato (refactor Chromium in WebContentsViewAura, mai fixato upstream). Il
// reorder si decide quindi in onTabDragEnd (punto di rilascio dentro i bounds della tab
// bar propria → computeDragTarget + EXCHANGE_TABS_BY_ID); onTabsDrop resta il percorso
// preferenziale e questo flag evita la doppia esecuzione se un futuro Electron fixa il
// bug (drop consegnato → il dragend non ripete l'EXCHANGE).
let dropHandledThisDrag = false
// Spike round 7 (taskbar spring-loading "alla VS Code"): blob URL del contenuto della tab
// untitled, offerto come "file virtuale" via DownloadURL (vedi onTabDragStart). NON viene
// revocato al dragend: con il CF_HDROP differito il target esterno (es. Explorer) può
// materializzare il file ANCHE DOPO la fine del gesto (async data extraction OLE) — la
// revoca avviene al dragstart successivo (sostituzione) e allo smontaggio.
let dragBlobUrl = null

// Context menu state (custom Vue, sostituisce Electron nativo)
const ctxOpen = ref(false)
const ctxPos = ref({ x: 0, y: 0 })
const ctxTab = ref(null)

const selectFile = (file) => {
  if (file.id !== currentFile.value.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

// drag-html5-dnd-task2: dragstart reale (sostituisce lo spike task1/task1b). Il
// dataTransfer porta SOLO l'id della tab (mai oggetti ricchi, DRAG-TASK.md §2.1) —
// coerente col detach cross-finestra che task3/4 costruiranno sullo stesso canale.
const onTabDragStart = (event, file) => {
  draggedTabId.value = file.id
  dragTargetId.value = null
  dropHandledThisDrag = false
  // Spike round 7: 'copyMove' (non più solo 'move') — il DownloadURL sotto richiede che
  // l'effetto 'copy' sia consentito, altrimenti Explorer/desktop non possono accettare
  // la copia del file e la taskbar non vede un drag "da file".
  event.dataTransfer.effectAllowed = 'copyMove'
  // Solo il MIME custom con l'id (DRAG-TASK.md §2.1): il `text/plain` aggiunto durante la
  // diagnosi del BUG-DROP è stato rimosso — escluso come causa (bug piattaforma
  // electron#42252, il drop non arrivava comunque) e avrebbe incollato l'id nelle app esterne.
  event.dataTransfer.setData('text/mt-tab-id', String(file.id))

  // Fix round 9a (drop esterni, 2026-07-03): formato `DownloadURL` al posto del
  // `text/uri-list` dello spike 7c. Motivi: (1) l'harness round 8 ha dimostrato che
  // NESSUN formato è necessario per lo spring-loading taskbar (il blocco era nei nostri
  // handler dragover globali, non nel payload); (2) `text/uri-list` produceva
  // nell'IDataObject OLE anche testo semplice (CF_UNICODETEXT) e uno shortcut `.url`
  // virtuale → qualunque target testuale (Chrome, Notepad, ...) incollava l'URI al drop;
  // (3) `DownloadURL` ("mime:nomefile:url", lo stesso formato usato da VS Code in dnd.ts
  // per le tab salvate) genera SOLO il CF_HDROP differito: drop su desktop/Explorer =
  // COPIA del file (requisito utente), nessun testo esposto ai target testuali.
  // Tab salvata → URI file:// del documento reale; untitled → blob URL con il contenuto
  // corrente (file virtuale, verificato funzionante nel retest spike 7).
  if (dragBlobUrl) {
    // Revoca del blob del drag PRECEDENTE (mai al dragend: col CF_HDROP differito il
    // target può materializzare il file anche dopo la fine del gesto).
    URL.revokeObjectURL(dragBlobUrl)
    dragBlobUrl = null
  }
  let downloadHref
  if (file.pathname) {
    downloadHref = 'file:///' + encodeURI(String(file.pathname).replace(/\\/g, '/'))
  } else {
    dragBlobUrl = URL.createObjectURL(
      new Blob([file.markdown || ''], { type: 'text/markdown' })
    )
    downloadHref = dragBlobUrl
  }
  const downloadName = /\.[^.\\/:]+$/.test(file.filename || '')
    ? file.filename
    : `${file.filename || 'Untitled'}.md`
  event.dataTransfer.setData('DownloadURL', `text/markdown:${downloadName}:${downloadHref}`)

  // Fix round 2 (BUG-GHOST): il drag image di default è lo screenshot rettangolare del
  // `li` (sfondo opaco su Windows), incoerente con le tab a pillola. Si clona il `li`
  // sorgente (mantiene l'attributo scoped di Vue, quindi lo stile scoped si applica anche
  // alla classe aggiunta a mano) e lo si posiziona fuori viewport prima di passarlo a
  // setDragImage: il browser lo usa come snapshot per il drag image, il nodo reale in
  // pagina non viene mai mostrato.
  const sourceEl = event.currentTarget
  const ghost = sourceEl.cloneNode(true)
  ghost.classList.add('v2-tab-drag-ghost')
  document.body.appendChild(ghost)
  dragGhostEl = ghost
  const rect = sourceEl.getBoundingClientRect()
  event.dataTransfer.setDragImage(ghost, event.clientX - rect.left, event.clientY - rect.top)
}

// Calcola, dalle coordinate del cursore, davanti a quale tab andrebbe inserita la tab
// trascinata (null = in fondo alla propria zona). Esclude esplicitamente la tab
// sorgente dal calcolo (invariante 4: niente equivalente di gu-mirror con HTML5 DnD) e
// clampa i candidati alla zona pinnata/non-pinnata della tab trascinata (invariante 7,
// H4): una pinnata non può calcolare un indice oltre l'ultima pinnata e viceversa. Se la
// zona di appartenenza è vuota (es. unica pinnata) ricade sull'intera lista, coerente col
// clamp che EXCHANGE_TABS_BY_ID applica comunque sul toIndex risultante.
// Fix round 4 (BUG-MULTIROW): il calcolo era X-only (ignorava clientY) e scandiva i
// candidati in ordine DOM (riga 1 → riga 2 → ...), prendendo la prima tab con centro-x
// oltre il cursore — quasi sempre una tab di riga 1, qualunque fosse la riga sotto il
// cursore reale. Ora i candidati vengono raggruppati per riga visiva
// (getBoundingClientRect, coordinate viewport coerenti con clientX/clientY) e il match X
// avviene SOLO dentro la riga individuata da clientY.
const computeDragTarget = (clientX, clientY) => {
  const ul = tabDropContainer.value
  if (!ul || !draggedTabId.value) {
    return { targetId: null, indicatorEl: null, indicatorAfter: false }
  }
  const draggedTab = tabs.value.find((t) => t.id === draggedTabId.value)
  if (!draggedTab) return { targetId: null, indicatorEl: null, indicatorAfter: false }

  const items = Array.from(ul.querySelectorAll('li.v2-tab'))
    .filter((el) => el.getAttribute('data-id') !== String(draggedTabId.value))
  const zoneItems = items.filter((el) => {
    const t = tabs.value.find((tt) => tt.id === el.getAttribute('data-id'))
    return t && !!t.pinned === !!draggedTab.pinned
  })
  const candidates = zoneItems.length ? zoneItems : items
  if (!candidates.length) return { targetId: null, indicatorEl: null, indicatorAfter: false }

  // Raggruppa i candidati per riga visiva. I candidati sono già in ordine DOM (= ordine
  // di lettura riga per riga), quindi una nuova riga inizia quando il `top` del rect si
  // discosta dal `top` della riga corrente di più di metà della sua altezza.
  const rows = []
  let currentRow = null
  for (const el of candidates) {
    const rect = el.getBoundingClientRect()
    if (!currentRow || Math.abs(rect.top - currentRow.top) > rect.height / 2) {
      currentRow = { top: rect.top, bottom: rect.bottom, cells: [] }
      rows.push(currentRow)
    }
    currentRow.bottom = Math.max(currentRow.bottom, rect.bottom)
    currentRow.cells.push({ el, rect })
  }

  // Sceglie la riga sotto il cursore: prima riga il cui bottom è ≥ clientY (aggancia
  // anche il cursore sopra la prima riga o nei gap tra righe). Se il cursore è sotto
  // tutte le righe usa l'ultima riga.
  let rowIdx = rows.findIndex((r) => clientY <= r.bottom)
  if (rowIdx === -1) rowIdx = rows.length - 1
  const row = rows[rowIdx]

  for (const { el, rect } of row.cells) {
    if (clientX < rect.left + rect.width / 2) {
      return { targetId: el.getAttribute('data-id'), indicatorEl: el, indicatorAfter: false }
    }
  }

  // Cursore oltre l'ultima tab della riga: l'inserimento è a fine riga, cioè prima
  // della prima tab della riga successiva (la lista è lineare) — ma l'indicatore va
  // disegnato dove punta il mouse, cioè dopo l'ultima tab della riga corrente.
  const lastCell = row.cells[row.cells.length - 1]
  const nextRow = rows[rowIdx + 1]
  const targetId = nextRow ? nextRow.cells[0].el.getAttribute('data-id') : null
  return { targetId, indicatorEl: lastCell.el, indicatorAfter: true }
}

// Handler dragover sul contenitore (ul.v2-tabs): preventDefault (via .prevent nel
// template, abilita il drop) + ricalcolo indicatore d'inserimento + autoscroll manuale
// vicino ai bordi della tab bar (decisione autoscroll, vedi worklog task2: HTML5 DnD non
// offre un autoscroll nativo affidabile su contenitori custom).
const AUTOSCROLL_EDGE_PX = 40
const AUTOSCROLL_STEP_PX = 12
const onTabsDragOver = (event) => {
  if (!draggedTabId.value) return
  // Fix round 2 (BUG-DROP): senza dichiarazione esplicita del dropEffect nel dragover del
  // target, con effectAllowed='move' Chromium risolve l'operazione a 'none' → il drop non
  // viene mai generato (quirk noto HTML5 DnD, causa confermata dal retest 2026-07-03).
  event.dataTransfer.dropEffect = 'move'
  dragIndicatorVisible.value = true

  const { targetId, indicatorEl, indicatorAfter } = computeDragTarget(event.clientX, event.clientY)
  dragTargetId.value = targetId

  const ul = tabDropContainer.value
  // Fix round 4: `indicatorEl`/`indicatorAfter` arrivano già risolti da
  // computeDragTarget (raggruppamento per riga, vedi sopra). `offsetLeft/offsetTop`
  // sono relativi alla ul (sistema di coordinate dell'indicatore, diverso da
  // getBoundingClientRect usato SOLO dentro computeDragTarget per il confronto col
  // cursore) — non vanno mischiati i due sistemi.
  if (indicatorEl) {
    dragIndicatorLeft.value = indicatorAfter
      ? indicatorEl.offsetLeft + indicatorEl.offsetWidth + 1
      : indicatorEl.offsetLeft - 2 // 2px ≈ metà del GAP=3 tra le tab
    dragIndicatorTop.value = indicatorEl.offsetTop
    dragIndicatorHeight.value = indicatorEl.offsetHeight
  } else if (ul) {
    dragIndicatorLeft.value = 6 // ulPadding, ul vuota (solo la tab trascinata esiste)
  }

  const scrollEl = tabContainer.value
  if (scrollEl) {
    const rect = scrollEl.getBoundingClientRect()
    if (event.clientX - rect.left < AUTOSCROLL_EDGE_PX) {
      scrollEl.scrollLeft = Math.max(0, scrollEl.scrollLeft - AUTOSCROLL_STEP_PX)
    } else if (rect.right - event.clientX < AUTOSCROLL_EDGE_PX) {
      scrollEl.scrollLeft = Math.min(scrollEl.scrollLeft + AUTOSCROLL_STEP_PX, scrollEl.scrollWidth)
    }
  }
}

// Nasconde l'indicatore solo quando il cursore lascia DAVVERO la ul (non un suo figlio):
// dragleave fa bubbling ad ogni passaggio tra tab, relatedTarget distingue i due casi.
const onTabsDragLeave = (event) => {
  const ul = tabDropContainer.value
  if (ul && !ul.contains(event.relatedTarget)) {
    dragTargetId.value = null
    dragIndicatorVisible.value = false
  }
}

// Handler drop: SOLO mutazione store (invariante 1, mai removeChild/insertBefore a mano
// — Vue v-for + :key riconcilia il DOM da solo). EXCHANGE_TABS_BY_ID applica già il clamp
// di zona pinnata/non-pinnata (store/editor.js) sul toIndex risultante da toId.
// Su questa piattaforma l'evento NON viene mai consegnato per i drag stessa-finestra
// (bug electron#42252, vedi dropHandledThisDrag): resta come percorso preferenziale per
// un futuro Electron fixato, il reorder effettivo lo fa il fallback in onTabDragEnd.
const onTabsDrop = (event) => {
  const droppedId = event.dataTransfer.getData('text/mt-tab-id') || draggedTabId.value
  if (!droppedId) return
  editorStore.EXCHANGE_TABS_BY_ID({ fromId: droppedId, toId: dragTargetId.value })
  dropHandledThisDrag = true
}

// Handler dragend (fine gesto, sia su drop riuscito sia su drop annullato): reset dello
// stato locale, incremento di tabsRenderKey (invariante 2, evita .el stale nel vdom) e
// ricalcolo pinnedTab/layout fuori dal lock (invariante 3/6).
const onTabDragEnd = (event) => {
  // Fix round 2 (BUG-GHOST): rimuove dal DOM il nodo ghost creato in onTabDragStart, ora
  // che il drag è terminato (successo o annullato) e non serve più al browser.
  if (dragGhostEl) {
    dragGhostEl.remove()
    dragGhostEl = null
  }
  // Fix round 3 (BUG-DROP, electron#42252): il reorder stessa-finestra si decide QUI.
  // Su questa piattaforma il `drop` non viene mai consegnato e `dropEffect` è sempre
  // 'none' per i drag interni → non usarli come segnale (regola DECISIONS.md 2026-07-03).
  // Il dragend arriva sempre e porta le coordinate del punto di rilascio: se cade dentro
  // i bounds della tab bar propria si ricalcola il target con lo stesso computeDragTarget
  // del dragover (coerenza con l'indicatore mostrato) e si muta SOLO lo store (invariante 1).
  // drag-html5-dnd-task3: se il rilascio cade FUORI dai bounds della finestra propria
  // (non solo fuori dalla tab bar) si tratta di un detach in nuova finestra (o su
  // un'altra finestra MarkText: quella decisione resta al main via `_findEditorWindowAt`,
  // non toccata qui — vedi DETACH_TAB/mt::detach-tab). Le due condizioni sono mutuamente
  // esclusive: dentro la tabbar → reorder; fuori dalla finestra → detach; dentro la
  // finestra ma fuori dalla tabbar → nessuna azione (drag annullato, invariato).
  if (!dropHandledThisDrag && draggedTabId.value && event) {
    const tabbarEl = tabDropContainer.value ? tabDropContainer.value.closest('.v2-tabbar') : null
    const insideTabbar = tabbarEl
      ? (() => {
        const rect = tabbarEl.getBoundingClientRect()
        return event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom
      })()
      : false
    if (insideTabbar) {
      const { targetId } = computeDragTarget(event.clientX, event.clientY)
      editorStore.EXCHANGE_TABS_BY_ID({ fromId: draggedTabId.value, toId: targetId })
    } else {
      // Bounds della finestra propria in coordinate schermo (non client): `screenX/Y` del
      // `dragend` sono nativamente in coordinate schermo, quindi il confronto va fatto con
      // `window.screenX/screenY/outerWidth/outerHeight` (bounds della finestra corrente),
      // MAI con `dropEffect` (sempre 'none' su questa piattaforma, electron#42252).
      const outsideWindow =
        event.screenX < window.screenX ||
        event.screenX > window.screenX + window.outerWidth ||
        event.screenY < window.screenY ||
        event.screenY > window.screenY + window.outerHeight
      // Fix round 9d (2026-07-03): se un target ESTERNO ha consumato il drop come copia
      // (desktop/Explorer col DownloadURL → dropEffect 'copy', round-trip verificato nei
      // retest spike 7/7b) NON va aperta anche la nuova finestra: la copia è l'esito del
      // gesto. Il gate non blocca mai il detach normale: per i drag rifiutati o interni
      // dropEffect è sempre 'none' su questa piattaforma (electron#42252), e la
      // migrazione verso altra finestra MarkText passa comunque da DETACH_TAB ('move'
      // o 'none', mai 'copy').
      const consumedExternally =
        event.dataTransfer && event.dataTransfer.dropEffect === 'copy'
      if (outsideWindow && !consumedExternally) {
        const tab = tabs.value.find((t) => t.id === draggedTabId.value)
        if (tab) {
          editorStore.DETACH_TAB(tab, { x: event.screenX, y: event.screenY })
        }
      }
    }
  }
  dropHandledThisDrag = false
  draggedTabId.value = null
  dragTargetId.value = null
  dragIndicatorVisible.value = false
  nextTick(() => {
    tabsRenderKey.value++
    recomputePinnedTab()
    requestAnimationFrame(() => updateTabRowsLayout())
  })
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

// T-RFI: apertura command palette scoped sui file recenti (comando file.quick-open, la cui
// sorgente è ora la lista dei file aperti di recente persistita dal main, vedi quickOpen.js).
// Il comando viene registrato a runtime ~400ms dopo il bootstrap (store/editor.js, setTimeout);
// se il click arriva prima che sia registrato, cmd::execute lancerebbe un errore in console
// (commandCenter.js executeCommand non trova il comando) → si verifica la presenza prima di
// emettere e, se non ancora disponibile, si esegue un no-op silenzioso.
const openRecentFiles = () => {
  const isRegistered = commandCenterStore.rootCommand.subcommands.some(
    (c) => c.id === 'file.quick-open'
  )
  if (!isRegistered) {
    return
  }
  bus.emit('cmd::execute', 'file.quick-open')
}

// F6: apertura file via dialog Electron (canale già esistente in main)
const openFileDialog = () => {
  window.electron.ipcRenderer.send('mt::cmd-open-file')
}

// folder-search-task4: apre l'overlay di ricerca in cartella. Stato locale
// dell'overlay vive nel componente dedicato (folderSearchOverlay), qui si emette
// solo il segnale di apertura via bus (stesso pattern di openCommandPalette).
const openFolderSearch = () => {
  bus.emit('show-folder-search')
}

// window-minwidth-hamburger: wrapper delle 3 voci del popover — richiamano gli stessi
// handler dei bottoni singoli e chiudono il popover dopo il click.
const hamburgerCommandPalette = () => {
  openCommandPalette()
  hamburgerMenuOpen.value = false
}
const hamburgerOpenFile = () => {
  openFileDialog()
  hamburgerMenuOpen.value = false
}
const hamburgerRecentFiles = () => {
  openRecentFiles()
  hamburgerMenuOpen.value = false
}
const hamburgerFolderSearch = () => {
  openFolderSearch()
  hamburgerMenuOpen.value = false
}

// window-minwidth-hamburger: chiusura popover su click fuori / Esc. Listener aggiunti
// solo mentre il popover è aperto (stesso pattern di BaseContextMenu.vue), rimossi
// anche in onBeforeUnmount per evitare listener orfani.
// BUGFIX popover-clip: il popover è teleportato su body (v. template), quindi non è più
// discendente DOM di hamburgerWrapEl — il check di contenimento non può più affidarsi
// alla sola gerarchia del wrapper. Si verifica ANCHE popoverEl (ref sul nodo teleportato).
const hamburgerWrapEl = ref(null)
const hamburgerBtnEl = ref(null) // bottone hamburger — rect di riferimento per l'ancoraggio
const popoverEl = ref(null) // nodo teleportato su body
const popoverStyle = ref({ top: '0px', left: '0px' })
const handleHamburgerOutside = (e) => {
  const insideWrap = hamburgerWrapEl.value && hamburgerWrapEl.value.contains(e.target)
  const insidePopover = popoverEl.value && popoverEl.value.contains(e.target)
  if (!insideWrap && !insidePopover) {
    hamburgerMenuOpen.value = false
  }
}
const handleHamburgerEsc = (e) => {
  if (e.key === 'Escape') hamburgerMenuOpen.value = false
}
// BUGFIX popover-clip: ancoraggio in position:fixed calcolato dal rect del bottone
// (stesso pattern di BaseContextMenu.vue adjustPosition) — sotto il bottone, allineato
// a destra, clampato dentro il viewport se sborda. Ricalcolato ad ogni apertura (dopo
// nextTick, quando il nodo teleportato è montato e offsetWidth/Height sono misurabili).
const positionPopover = () => {
  const btn = hamburgerBtnEl.value
  const pop = popoverEl.value
  if (!btn || !pop) return
  const rect = btn.getBoundingClientRect()
  const GAP = 4
  const margin = 8
  const popW = pop.offsetWidth
  const popH = pop.offsetHeight
  let left = rect.right - popW // allineato a destra col bottone
  let top = rect.bottom + GAP // ancorato sotto il bottone
  left = Math.min(Math.max(left, margin), window.innerWidth - popW - margin)
  top = Math.min(Math.max(top, margin), window.innerHeight - popH - margin)
  popoverStyle.value = { top: `${top}px`, left: `${left}px` }
}
// Ridimensionamento finestra a popover aperto: si chiude invece di ricalcolare la
// posizione (via più semplice, accettata dal plan) — l'ancoraggio si rifà alla
// riapertura successiva sul bottone nella posizione aggiornata.
const closeHamburgerOnResize = () => {
  hamburgerMenuOpen.value = false
}
watch(hamburgerMenuOpen, (open) => {
  if (open) {
    nextTick(() => positionPopover())
    window.addEventListener('mousedown', handleHamburgerOutside)
    window.addEventListener('keydown', handleHamburgerEsc)
    window.addEventListener('resize', closeHamburgerOnResize)
  } else {
    window.removeEventListener('mousedown', handleHamburgerOutside)
    window.removeEventListener('keydown', handleHamburgerEsc)
    window.removeEventListener('resize', closeHamburgerOnResize)
  }
})

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

  // window-minwidth-hamburger: soglia collasso sezione destra (⌘/📂/recenti → hamburger).
  // Decisione pura funzione di tabbarClientW (soglia UNICA nei due versi, no isteresi,
  // stesso principio del PASS 1 sotto — invariante 3 tab-bar-layout.md). Volutamente NON
  // dipende da baseTopRight/tre.offsetWidth (misurato più sotto): eviterebbe un loop
  // auto-referenziale (la larghezza del topright dipenderebbe dallo stato che sta decidendo).
  // Se il toggle rende stale la misura di tre.offsetWidth in QUESTO run, il ResizeObserver
  // su topRightEl (già attivo, vedi onMounted) rifira al prossimo render e ricalcola.
  const HAMBURGER_THRESHOLD = 700
  isToprightCollapsed.value = tabbarClientW < HAMBURGER_THRESHOLD
  if (!isToprightCollapsed.value) hamburgerMenuOpen.value = false

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
  // Ul resta no-drag per eventi mouse / drag HTML5 nativo.
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
  // bypassare layoutLock — necessario post-drag HTML5 dove lock può essere
  // attivo da ResizeObserver burst durante drag, Inv. 3/6 drag-html5-dnd-task2).
  recomputePinnedTab(items, multiRow)
}

// Helper: aggiorna pinnedTab basato su layout DOM corrente.
// `items` opzionale (querySelectorAll fresh se non passato), `multiRow` opzionale
// (deriva da hasMultiRow.value se non passato).
const recomputePinnedTab = (items = null, multiRow = null) => {
  const ul = tabDropContainer.value
  if (!ul) return
  // Bug pre-esistente (drag-html5-dnd-task2, plan punto 8): il selettore filtrava
  // `.v2-tab-pinned`, classe MAI applicata nel template (la classe reale per H4-pinned
  // è `is-pinned`) → il `:not()` non escludeva mai nulla. Corretto in `is-pinned`.
  if (!items) items = Array.from(ul.querySelectorAll('li.v2-tab:not(.is-pinned)'))
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

// Fix round 1 (BUG-DRAG-ZONA-TESTO): il drag di una tab veniva accettato anche sopra la
// zona testo (editor Muya, contenteditable = drop target di default per drag generici).
// Ascoltatore PERMANENTE in fase capture su window: intercetta l'evento PRIMA che
// raggiunga il dragover handler di Muya sul container editor, e blocca il drop SOLO se
// il dataTransfer porta il MIME type dedicato delle tab. Basato sui `types` (sempre
// leggibili in dragover, a differenza dei dati) e non su `draggedTabId` locale: vale
// anche per un drag di tab in arrivo da un'ALTRA finestra (serve a task3/4; nota: il
// detach NON userà `dropEffect === 'none'` come segnale — inaffidabile per bug
// electron#42252, si useranno le coordinate schermo del dragend). `event.target` può
// essere un nodo di testo (niente `.closest`) → normalizzato sul parentElement in quel caso.
// Fix round 5 (regressione taskbar/cross-finestra, 2026-07-03): SOLO stopPropagation, MAI
// preventDefault. preventDefault su dragover significa "ACCETTO il drop" (poi negato con
// dropEffect 'none'): quel accetta-poi-nega generalizzato a livello window innesca il
// meccanismo di electron#42252 (CompleteDragExit azzera current_drag_data_ → stato del
// drag OLE corrotto per tutto il resto del gesto: niente spring-loading taskbar, drop
// cross-finestra mai consegnato). Il rifiuto corretto nel modello HTML5 DnD è NON
// cancellare il dragover: senza preventDefault il target resta non-accettante di default
// (il dataTransfer porta solo il MIME custom, il contenteditable non ha flavor testuali
// da incollare), e lo stopPropagation impedisce comunque all'handler di Muya di
// accettarlo per conto suo.
const blockForeignTabDropOutsideTabbar = (event) => {
  if (!event.dataTransfer || !event.dataTransfer.types.includes('text/mt-tab-id')) return
  const targetEl = event.target.closest ? event.target : event.target.parentElement
  if (targetEl && targetEl.closest('.v2-tabbar')) return
  event.stopPropagation()
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

  // drag-html5-dnd-task2 (invariante 5bis): il cablaggio dragula (init, accepts H4,
  // handler drag/dragend/drop, detach H5-2 su dragend, dom-autoscroller) è stato
  // rimosso PER INTERO — dragula NON può coesistere con l'HTML5 DnD nativo sulle
  // stesse tab (grab() fa preventDefault() sul mousedown, sopprime dragstart in
  // Chromium, GATE task1b). Il reorder è ora gestito dai listener draggable/dragstart/
  // dragover/drop/dragend sul template. Il detach via drag-out resta TEMPORANEAMENTE
  // non funzionante: task3/4 lo re-implementeranno sopra l'HTML5 DnD (vedi worklog).

  // Fix round 1 (BUG-DRAG-ZONA-TESTO): listener permanente, fase capture (terzo arg
  // `true`), rimosso simmetricamente in onBeforeUnmount.
  window.addEventListener('dragover', blockForeignTabDropOutsideTabbar, true)
})

onBeforeUnmount(() => {
  const el = tabContainer.value
  if (el) el.removeEventListener('wheel', handleTabScroll)
  window.removeEventListener('dragover', blockForeignTabDropOutsideTabbar, true)

  // window-minwidth-hamburger: cleanup listener popover (attivi solo se rimasto aperto)
  window.removeEventListener('mousedown', handleHamburgerOutside)
  window.removeEventListener('keydown', handleHamburgerEsc)
  window.removeEventListener('resize', closeHamburgerOnResize)

  // Fix round 2 (BUG-GHOST): rimozione di sicurezza del ghost se il componente viene
  // smontato a metà di un drag (caso limite, es. chiusura finestra durante il gesto).
  if (dragGhostEl) {
    dragGhostEl.remove()
    dragGhostEl = null
  }
  // Spike round 7: revoca del blob URL del file virtuale (untitled) allo smontaggio.
  if (dragBlobUrl) {
    URL.revokeObjectURL(dragBlobUrl)
    dragBlobUrl = null
  }

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
watch(() => currentFile.value && currentFile.value.id, () => {
  nextTick(() => {
    recomputePinnedTab()
    // P1A: rAF garantisce misura post-paint → offsetTop stabili → no false multi-row con 2 tab
    requestAnimationFrame(() => updateTabRowsLayout())
  })
})

// B2: clone non scompare quando si compatta a riga singola.
// Se hasMultiRow passa a false (resize finestra/chiusura tab), pinnedTab va azzerato.
// Se torna a true, ricalcola pinnedTab.
// Trappola anti-loop (BUG-FLICKER, 2026-07-03, non ancora riprodotto): se hasMultiRow
// flippa troppe volte in poco tempo siamo nel loop di layout segnalato dall'utente (visto
// una volta dopo snap a metà schermo) — console.error con dump dello stato, così
// un'eventuale occorrenza futura lascia una traccia diagnostica certa. Costo nullo a
// regime; rimuovere solo a causa trovata e fixata.
let flickerFlipTimes = []
watch(hasMultiRow, (newVal) => {
  const now = Date.now()
  flickerFlipTimes.push(now)
  flickerFlipTimes = flickerFlipTimes.filter((t) => now - t < 3000)
  if (flickerFlipTimes.length >= 6) {
    const tabbarEl = tabDropContainer.value ? tabDropContainer.value.closest('.v2-tabbar') : null
    console.error('[DEBUG flicker] LOOP RILEVATO: ' + flickerFlipTimes.length +
      ' flip di hasMultiRow in <3s. Stato: ' + JSON.stringify({
      newVal,
      tabbarClientW: tabbarEl ? tabbarEl.clientWidth : null,
      innerWidth: window.innerWidth,
      paddingRight: tabbarEl ? tabbarEl.style.paddingRight : null,
      ulWidth: tabDropContainer.value ? tabDropContainer.value.style.width : null,
      hovered: tabsAreaHovered.value,
      pinnedTab: pinnedTab.value ? pinnedTab.value.id : null,
      tabsCount: tabs.value.length,
      dragging: draggedTabId.value
    }))
  }
  // P-DF8-3 (rev S7-fix): lock ridotto da 500ms → 150ms.
  layoutLockUntil = Date.now() + 150
  setTimeout(() => {
    nextTick(() => requestAnimationFrame(() => updateTabRowsLayout()))
  }, 170)
  if (!newVal) {
    pinnedTab.value = null
    return
  }
  nextTick(() => recomputePinnedTab())
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
  /* Drag OS-native NON sta su .v2-tabbar stesso (struttura DEFINITIVA dal GATE
     task1b): le .v2-tab non devono MAI essere discendenti di un contenitore drag,
     altrimenti Chromium sopprime il dragstart HTML5 nativo (causa n.1 del FAIL
     task1, DRAG-TASK.md §3). La zona titolo/doppio-click-maximize la fornisce
     l'overlay fratello .v2-tabbar-drag-region (vedi sotto), che copre l'intera bar
     via inset:0 e segue l'espansione max-height senza bisogno di height esplicite. */
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
  /* La zona drag NON la eredita da .v2-tabbar — la fornisce l'overlay
     .v2-tabbar-drag-region sottostante (fratello, primo figlio di .v2-tabbar,
     struttura DEFINITIVA dal GATE task1b). Questo elemento resta implicitamente
     no-drag (nessuna regola app-region propria): riceve gli hit DOM sopra l'overlay
     perché viene dopo nell'ordine sorgente. */
}

/* Overlay drag "alla VS Code" (struttura DEFINITIVA, Inv. 5 drag-html5-dnd-task2) —
   position:absolute + inset:0 → fuori dal flow, non altera offsetWidth/offsetTop di
   ul/tab (nessun impatto sulla detection multi-row). Nessun z-index: i fratelli
   successivi (.v2-tabbar-scroll relative, .v2-topright absolute) vengono dopo
   nell'ordine sorgente → dipingono e ricevono hit DOM sopra l'overlay. Segue
   automaticamente l'animazione max-height di .v2-tabbar (40px ↔ 260px multi-row)
   perché inset:0 non fissa un'altezza esplicita. Le .v2-tab NON devono mai tornare
   discendenti di un elemento app-region:drag (vedi commento su .v2-tabbar sopra). */
.v2-tabbar-drag-region {
  position: absolute;
  inset: 0;
  /* Spike round 3 (2026-07-03) CHIUSO: app-region disattivata temporaneamente per
     verificare se la regione drag OS bloccasse la consegna OLE del drop → il drop NON
     arrivava comunque, overlay scagionato e ripristinato. */
  -webkit-app-region: drag;
  app-region: drag;
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
  /* no-drag: click select, contextmenu, drag HTML5 nativo (dragstart) funzionano */
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

/* H4: Pin tab — icona puntina + sfondo in rilievo + accento ("spicchio") SULLA tab pinnata */
.v2-tab-pin {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-right: 3px;
  color: var(--v2-accent);
  opacity: 0.85;
}

/* Sfondo leggermente in rilievo + accento verticale a sinistra (lo "spicchio" ora è sulla tab
   pinnata, non più sulla vicina). `.v2-tab.is-pinned` ha specificità > `.v2-tab-active` (2 classi
   vs 1) → l'accento resta anche quando la tab pinnata è attiva. */
.v2-tab.is-pinned {
  box-shadow: inset 2px 0 0 var(--v2-accent), var(--v2-shadow-sm);
}
.v2-tab.is-pinned:not(.v2-tab-active) {
  background: var(--v2-surface2);
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

/* drag-html5-dnd-task2 (fix round 1, BUG-INDICATORE-STILE/ALTEZZA): indicatore
   d'inserimento del drag HTML5 nativo, sostituisce il mirror DOM di dragula (rimosso).
   position:absolute come .v2-tab-new-li → fuori dal flex flow, non altera
   offsetWidth/offsetTop delle tab (Inv. MEDIUM-TASK.md). `left`/`top`/`height`
   calcolati in onTabsDragOver dalla riga della tab target (non dall'intera ul, che in
   multi-row sarebbe più alta della singola riga). "Barretta arrotondata" (decisione
   utente) coerente con le pill arrotondate delle tab, con leggero glow per distinguerla
   dal bordo/accento statico delle tab pinnate. pointer-events:none → non interferisce
   con dragover/drop (che restano sulla ul/tab, mai su questo elemento). */
.v2-tab-drop-indicator {
  position: absolute;
  width: 3px;
  border-radius: 2px;
  background: var(--v2-accent);
  box-shadow: 0 0 4px var(--v2-accent);
  pointer-events: none;
  list-style: none;
  z-index: 5;
}

/* Fix round 2 (BUG-GHOST): drag image "a pillola" per il drag HTML5 nativo (sostituisce lo
   screenshot rettangolare di default, con angoli quadrati/sfondo opaco su Windows). Il
   nodo è un cloneNode(true) del `li.v2-tab` sorgente (onTabDragStart) — mantiene quindi
   l'attributo scoped di Vue e riceve regolarmente anche questa regola, pur essendo
   appeso a document.body via JS. position:fixed fuori viewport: renderizzato (necessario
   perché setDragImage possa fare lo snapshot) ma mai visibile e senza impatto sul layout
   della tab bar reale. */
.v2-tab-drag-ghost {
  position: fixed;
  top: -1000px;
  left: -1000px;
  pointer-events: none;
  /* Aspetto pillola esplicito (fix round 3): il clone eredita da .v2-tab background
     transparent (solo active/hover hanno sfondo) → il drag image mostrava solo il testo
     senza forma. Sfondo, bordo e radius dichiarati qui rendono la pillola visibile nello
     snapshot di setDragImage. */
  background: var(--v2-surface2);
  color: var(--v2-text2);
  border: 1px solid var(--v2-border);
  border-radius: 100px;
  padding: 0 12px;
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

/* window-minwidth-hamburger: wrapper relative per ancorare il popover al bottone. */
.v2-tr-hamburger-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

/* window-minwidth-hamburger: popover ancorato sotto il bottone hamburger, coerente
   coi token --v2-* già usati da BaseContextMenu.vue (v2-ctx).
   BUGFIX popover-clip: teleportato su body (v. template) — .v2-tabbar ha
   overflow:hidden (riga ~1385) e lo tagliava. position:fixed + top/left calcolati in
   JS (positionPopover) invece di absolute ancorato al wrapper relative; z-index 4000
   allineato a BaseContextMenu.vue (.v2-ctx), che vive nello stesso layer "popover su
   body" sopra tab bar/editor. */
.v2-tr-popover {
  position: fixed;
  min-width: 168px;
  background: var(--v2-surface);
  border: 1px solid var(--v2-border);
  border-radius: 10px;
  box-shadow: var(--v2-shadow-lg);
  padding: 4px;
  z-index: 4000;
  font-family: var(--v2-sans);
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.v2-tr-popover-item {
  padding: 7px 11px;
  border-radius: 6px;
  cursor: default;
  font-size: 12.5px;
  color: var(--v2-text);
  white-space: nowrap;
  transition: background var(--v2-t-fast) ease-in-out, color var(--v2-t-fast) ease-in-out;
}

.v2-tr-popover-item:hover {
  background: var(--v2-accent-dim, var(--v2-surface2));
  color: var(--v2-accent);
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
