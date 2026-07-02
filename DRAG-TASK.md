# DRAG-TASK — Migrazione drag tab: dragula → HTML5 native DnD (parità VS Code)

> **Scopo.** Portare il drag delle tab dal sistema attuale (**dragula**, drag finto a eventi mouse) al
> **drag-and-drop nativo HTML5** (come VS Code), per ottenere: anteprima d'inserimento cross-finestra,
> hover-taskbar che rivela le finestre (anche minimizzate), drop-fuori = nuova finestra.
> Questo file raccoglie: problema, fix proposto, **downgrade/rischi**, e soprattutto le **invarianti
> drag/tab-bar già risolte** da NON reintrodurre con il refactor.
>
> Leggere PRIMA: `DESIGN-TASK.md` (UI v2, dragula, `-webkit-app-region`), `MEDIUM-TASK.md`
> (§Invarianti tab bar BUG-1, 1-10), `EASY-TASK.md` (save/dirty/pre-save), `HARD-TASK.md` (§H5 detach + bug aperti).
> Legenda: ✅ verificato nel codice/doc · ⚠️ da verificare a runtime · 🟡 scelta di design.

---

## 1. Problema

**Stato attuale:**
- Il drag tab usa **dragula** (`tabs.vue`): `mousedown`/`mousemove`/`mouseup` + mirror DOM. **Non è un drag OS**
  → Windows non lo riconosce → niente hover-taskbar, niente promozione a drag OLE.
- Detach H5-2/H5-RE è costruito sopra dragula + rilevazione manuale `screenX/screenY` al `dragend`
  (`revertOnSpill`, `setTimeout(0)`). Funziona ma: nessun feedback live, niente anteprima nella finestra
  destinazione, niente reveal delle finestre minimizzate.
- **VS Code** ottiene tutto questo perché usa **HTML5 native DnD** (`draggable` + `dragstart`/`dragover`/`drop`
  + `dataTransfer` — conferma ricerca 2026-06-28, `dnd.ts`): dentro la finestra → `dragover` per la lineetta
  d'inserimento; fuori → Chromium **promuove a drag OS** (OLE `DoDragDrop` su Windows) → l'hover sulla taskbar
  rivela le finestre come per un file vero.

**Comportamenti attesi (parità VS Code, richiesti dall'utente):**
1. Drag tab su un'altra finestra → indicatore d'inserimento (lineetta / ghost) alla posizione di drop; rilascio → la tab migra lì.
2. Drag sulla taskbar → la finestra sotto il mouse si rivela / va in primo piano (gestito dal SO durante un drag OLE).
3. Drop nel desktop / fuori da ogni finestra / zona di divieto → nuova finestra.

**Bug H5 aperti** (da `HARD-TASK.md`, validi a prescindere dalla migrazione):
- **BUG-H5-EMPTYWIN** — finestra detached con tutte le tab chiuse resta vuota, non si auto-chiude.
- **BUG-H5-UNTITLED** — counter Untitled non lineare tra finestre (la nuova riparte da `Untitled-1`).
- **H5-RE-BUG1** — ri-drag di tab omonime non funziona (sospetto match per nome/pathname invece che per id).
  ⚠️ Probabile che si **dissolva** con la migrazione (sparisce il match manuale `screenX`/id dell'impl dragula); riverificare dopo.

---

## 2. Fix proposto

**Migrare il drag tab da dragula → HTML5 native DnD** in `tabs.vue`, usato per **sia** il reorder interno
**sia** il detach/re-attach (un solo sistema, come VS Code).

**Meccanica:**
1. `draggable="true"` sulle `.v2-tab`; `dragstart` → `dataTransfer.setData('text/mt-tab-id', tab.id)` (solo l'**id**,
   non oggetti ricchi: il `dataTransfer` cross-finestra non porta JS); `setDragImage` con un mirror custom
   (o **ghost window** leggera per l'effetto pill fluttuante).
2. `dragover` sulla tab bar (ogni finestra) → `preventDefault()` (abilita il drop) → calcola l'indice
   d'inserimento dalla `x` → disegna l'indicatore (lineetta o ghost).
3. `drop` → **stessa finestra**: reorder nello store; **finestra diversa**: il **main** trasferisce il payload
   della tab (markdown/pathname/cursore via il canale `mt::detach-tab` già esistente + `RESTORE_SESSION`),
   B ricostruisce la tab all'indice, A chiude la sorgente all'ack.
4. `dragend` con `dropEffect === 'none'` (nessun target valido) → detach in nuova finestra (riusa `_createDetachWindow`).
5. **Hover-taskbar** ⚠️ atteso **gratis** dal SO (drag OLE) — da verificare sul nostro setup frameless.

**Conseguenze importanti:**
- **koffi / raise-finestre manuale = NON più necessari**: il SO rivela le finestre minimizzate durante un drag
  OLE reale. Cade anche il problema **Wayland** (niente poll del cursore globale, niente window-raising custom).
- **Cross-platform**: HTML5 DnD è uniforme su Win/mac/Linux. L'hover-taskbar è una resa SO specifica di Windows;
  mac/Linux daranno la loro (o nessuna), ma reorder/anteprima/detach restano portabili.

---

## 3. Downgrade / rischi della migrazione (onesto)

- **Drag image limitata**: `setDragImage` = immagine/elemento esistente, fissato al `dragstart`, reso dal SO,
  niente update live, vincoli di stile/offset. Il mirror dragula è un clone DOM pienamente stilabile/animabile.
  → per l'estetica **pill fluttuante** servirà comunque una **ghost window** o si accetta una resa più povera.
- **Controllo fine ridotto** nella fase cross-finestra: `dragover` throttled e, durante il drag OLE, il JS della
  sorgente può essere in un loop modale (Windows) → logica custom live più limitata.
- **Touch/pen**: HTML5 DnD ha supporto touch scarso/assente (dragula sì). Minore per desktop, conta su schermi touch Windows.
- **Re-implementare reorder + indice d'inserimento**: i fix dragula-specifici (gu-mirror, `.el` staleness) non si
  trasferiscono; si ri-affronta la stessa classe di problemi Vue-vdom (rischio nuovi bug).
- **⚠️ Coesistenza `-webkit-app-region: drag` + `draggable=true`** sulla stessa tab bar: **rischio #1** da
  verificare a runtime su Windows (il window-drag OS potrebbe mangiare il `dragstart`). Le `.v2-tab` sono già
  `no-drag` (DESIGN-TASK) → in teoria `draggable` funziona, ma confermare.

---

## 3bis. Si può EVITARE la migrazione restando su dragula? (ricerca 2026-06-28)

**Verdetto: tutto è replicabile con dragula TRANNE l'hover-taskbar.**

| Comportamento | Con dragula (+IPC/poll) | Note |
|---|---|---|
| Lineetta inserimento, **stessa finestra** | ✅ nativo dragula | use-case base della libreria |
| Lineetta inserimento, **cross-finestra** | ✅ IPC + poll `screen.getCursorScreenPoint` | impl manuale, solida |
| Drop fuori = nuova finestra | ✅ bounds-check dal main | |
| **Hover-taskbar (rivela le finestre)** | ❌ **impossibile** | richiede drag OLE `DoDragDrop` |

- **L'hover-taskbar è un vincolo del SO**, non di codice: Windows lo espone SOLO via loop OLE (`DoDragDrop`; la
  taskbar è un `IDropTarget` registrato). Lo producono SOLO HTML5 `draggable` (Chromium promuove a OLE all'uscita
  finestra) o `webContents.startDrag`. Dragula = soli eventi mouse JS → il SO non vede il drag → la taskbar non reagisce mai.
- **Ibrido dragula + `startDrag` = SCARTATO:** `DoDragDrop` è sincrono → blocca il renderer (nessun feedback durante
  il drag), il Node addon non accede a `ScopedNestableTaskAllower`, `startDrag` richiede un file reale, ed è **rotto
  su Electron 28+** (issue #42252; **noi siamo su Electron 39**). Patch fragile con regressioni documentate.

**→ Due strade pulite (decisione utente):**
- **A. Migrare a HTML5 DnD** — unico percorso stabile per l'hover-taskbar; cross-platform; costo = refactor del drag + downgrade §3.
- **B. Restare su dragula** — lineetta cross-finestra + detach via IPC/poll; per raggiungere le finestre **minimizzate**
  (niente hover-taskbar) si aggiunge il **raise-finestre koffi** (cursor-exit, `SW_SHOWNOACTIVATE`+`SWP_NOACTIVATE`,
  ricerca 2026-06-28). Si perde SOLO il gesto-taskbar nativo; **zero refactor, invarianti §4 intatte**, Wayland escluso dal raise.

---

## 4. ⚠️ INVARIANTI già risolte da NON reintrodurre (drag + tab bar)

Consolidate dai doc storici. La migrazione DEVE preservarle.

### 4.1 Drag / Vue (`DESIGN-TASK.md`)
- **Mai manipolare il DOM a mano nel drop handler** (`removeChild`/`insertBefore`) → corrompe i ref; con Vue
  `v-for` + `:key` la riconciliazione è automatica. (Valeva per dragula; identico col drop HTML5: muta lo **store**, non il DOM.)
- **`.el` staleness post-drag**: dopo lo spostamento dei nodi Vue tiene ref `.el` stale → la nuova tab finisce in
  posizione errata. Fix esistente: `:key` include **`tabsRenderKey`** incrementato su `dragend`. → mantenere
  l'incremento di `tabsRenderKey` su `dragend` anche con HTML5 DnD.
- **`recomputePinnedTab` dal drop handler**, fuori da `layoutLockUntil` (helper DOM-based): l'assegnazione
  pinnedTab si salta se il lock è attivo (burst ResizeObserver durante il drag). → richiamarlo dopo il drop.
- **Filtro dell'elemento trascinato nel calcolo indice**: con dragula si filtrava `gu-mirror` dal sibling per il
  next-tab-id. Con HTML5 DnD non c'è `gu-mirror`, ma l'indice va calcolato **ignorando la tab in drag**.
- **`-webkit-app-region: drag`** su `.v2-tabbar`; **`no-drag`** su `.v2-tab`, `.v2-tab-new-li`, clone, "+", btn, ul
  (Chromium sopprime hover/mouseenter sulle zone drag). → non rimuovere i `no-drag`; verificare con `draggable`.

### 4.2 Layout tab bar BUG-1 (`MEDIUM-TASK.md` §Invarianti 1-10) — ortogonali, ma il drag le tocca via lock/ResizeObserver
- **Inv. 4 — lock defer-not-drop**: `layoutLockUntil` non deve perdere update (return secco = stato finale errato
  congelato); `lockRetryTimer` rischedula. Durante il drag il ResizeObserver fa burst → il lock è attivo → al
  `dragend` rilanciare `updateTabRowsLayout` + `recomputePinnedTab`.
- **Inv. 1** — non convertire `.v2-topright` da `absolute` a in-flow; non togliere la riserva `padding-right`.
- **Inv. 2** — `.editor-middle { min-width:0 }` (`app.vue`) + clamp `tabbarClientW` (`tabs.vue`): non rimuovere.
- **Inv. 5** — costanti JS↔CSS in sync (158/26/10/12/6/3).
- **Inv. 8** — "+" inline absolute, `while(row1Count>1)`.
- ⚠️ Il drag NON deve toccare la detection di wrap (`offsetWidth`/`offsetTop`): per effetti visivi usare
  `transform` (lezione inv. 9), mai larghezze/posizioni che alterino la misura.

### 4.3 Pinned tab (H4, `HARD-TASK.md`)
- Ordine **pinned-first**; drag clampato alla zona pinnata/non-pinnata; `recomputePinnedTab` dopo il drop;
  "Chiudi altre/tutte" non chiude le pinnate. → il reorder HTML5 deve rispettare il clamp pinned.

### 4.4 Save / dirty / detach (`EASY-TASK.md` §B/C, `HARD-TASK.md` §H5)
- Detach di tab **dirty/untitled**: il payload deve passare per il flush **pre-save** (B8/B13) prima di leggere
  `tab.markdown`, e ricostruirsi via **`RESTORE_SESSION`** (uniforme saved/untitled/dirty) — già il canale
  `mt::detach-tab`. Non bypassare baseline/`originalMarkdown`/`pendingSavedMarkdown`.
- **B7** — `.v2-tab-name { flex-grow:1; min-width:0 }` (spazio + ellipsis): non rompere col nuovo markup tab.

---

## 5. Bug H5 da fixare (in parallelo / dopo la migrazione)
- **BUG-H5-EMPTYWIN** — la finestra detached vuota deve auto-chiudersi (solo finestre **non-owner**; l'owner tiene
  la blank tab). Investigare il flusso di chiusura dell'ultima tab + gate single-window.
- **BUG-H5-UNTITLED** — coordinare il prossimo indice `Untitled-N` a livello sessione/main tra tutte le finestre
  (oggi calcolato per-renderer dalle sole tab locali, B-REV8 in `store/editor.js`).
- **H5-RE-BUG1** — ri-drag tab omonime; riverificare dopo la migrazione (probabile dissoluzione).

---

## 6. Prossimi passi
1. ⚠️ **Spike di rischio #1**: verificare a runtime che `draggable=true` conviva con `-webkit-app-region: drag`
   sulla tab bar (Windows). Se il window-drag mangia il `dragstart` → decidere la mitigazione PRIMA di tutto.
2. Mappare con **Agent-Explorer** il cablaggio dragula attuale in `tabs.vue` (init dragula, `drag`/`dragend`/drop,
   `tabsRenderKey`, `recomputePinnedTab`, `layoutLockUntil`, integrazione detach H5-2/H5-RE) → superficie esatta del refactor.
3. Scrivere la spec di migrazione (`Docs/Ai/InProgress/drag-html5-dnd/…`) e implementare con Agent-Code, preservando §4.
4. Verificare a runtime la parità VS Code (anteprima, hover-taskbar, drop-fuori) + non-regressione §4.

---

## Stato decisioni
- 🟡 **Migrazione a HTML5 DnD = approccio scelto** (parità VS Code, 2026-06-28). Pendente: approvazione utente a
  procedere col refactor + spike rischio #1.
- ✅ **Path A** (drag DOM, no `startDrag` nativo per il singolo file) superato: HTML5 DnD dà sia anteprima sia taskbar.
- ❌ **koffi / raise-finestre Win32**: scartato (reso inutile dal drag OLE nativo di HTML5 DnD).
- ❌ **Spike rischio #1 (2026-07-02): FAIL.** `draggable="true"` su `.v2-tab` non produce `dragstart`: il
  window-drag OS intercetta il gesto nonostante `no-drag` sul figlio (dettagli:
  `Docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1-worklog.md`, `Docs/Ai/DECISIONS.md` 2026-07-02).
  Non un bug di configurazione (verificato: nessun hook `WM_NCHITTEST` custom, CSS `no-drag` corretto).
- ❌ **Strada B (dragula + koffi raise-finestre) scartata esplicitamente dall'utente** (2026-07-02): non riproporla
  senza nuova richiesta esplicita.
- ❌ **Mitigazione "JS window drag" (mousedown+move → IPC → `win.setPosition`) scartata come prima scelta**
  (ricerca 2026-07-02): perde il tracking del mouse a velocità normale e fa perdere Snap Layouts Win11,
  doppio-click-massimizza e Aero Snap (nativi dell'hit-test HTCAPTION). Solo fallback estremo. Scartato anche
  il toggle dinamico drag/no-drag (Chromium non ricalcola le regioni in modo affidabile, issue Electron #6970).
- ✅ **Mitigazione risolutiva (2026-07-02): drag region overlay "alla VS Code" — GATE task1b PASS.**
  Overlay `.v2-tabbar-drag-region` (`absolute; inset:0; app-region:drag`) primo figlio di `.v2-tabbar`
  (che perde `drag`): `dragstart` HTML5 scatta sulle tab; drag finestra da zona vuota, doppio-click-maximize,
  click e multi-row conservati. Il FAIL del task1 aveva DUE cause: l'ancestor `app-region:drag` E il
  `preventDefault()` di dragula sul `mousedown` (`dragula.js` ~113) che sopprime il dragstart nativo.
  **Vincoli permanenti per task2-5**: overlay = struttura definitiva (tab mai discendenti di un elemento
  `drag`); dragula NON può coesistere con HTML5 DnD sulle stesse tab → rimozione completa fin dal primo
  task che introduce il DnD nativo. Dettagli: `Docs/Ai/DECISIONS.md` 2026-07-02, worklog task1b.
  **Task2-5 SBLOCCATI.**
