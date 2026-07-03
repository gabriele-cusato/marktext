# Drag, Detach, Multi-Window — Drag Nativo, Detach Tab a Nuova Finestra, Multi-Finestra Unified Session

**Scopo:** documenta il drag/detach di tab a nuova finestra (H5) e la gestione multi-finestra con sessione unica stile Notepad++ (H5-B). Leggere PRIMA di toccare: drag, finestre multiple, detach, session.json namespacato.

**Origine:** `HARD-TASK.md` sezione H5 (2026-06-25 onward, OPUS implementazione).

**Quando leggerlo:** trascinamento tab rotto / detach non funziona / finestra svuotata non si chiude / tab scomparse dal riavvio / niente anteprima drag / drag non funziona cross-finestra.

**Stato:** ✅ H5-B multi-finestra architecture implementata. ✅ H5-1 detach via context menu implementato. ✅ H5-2 detach via drag implementato e RIFATTO su HTML5 DnD nativo (feature `drag-html5-dnd`, testato PASS 2026-07-03: detach, migrazione cross-finestra, auto-chiusura secondaria svuotata).

---

## ⚠️ SUPERAMENTO DRAGULA → HTML5 DnD NATIVO

**IMPORTANTE:** questo file documenta il **piano H5 con dragula**. Nel frattempo è stata completata la feature `drag-html5-dnd` (vedi `Completed/drag-html5-dnd/drag-html5-dnd.md`) che **migra il drag a HTML5 DnD nativo**, eliminando dragula.

**Conseguenza:** le parti H5 su "dragula + reordine in-window" sono **SUPERATE**. Consultare `drag-html5-dnd.md` per il drag attuale (reorder nativo, detach in nuova finestra, spring-loading, copia file su desktop).

**Cosa rimane valido in questo file:**
- Modello multi-finestra / sessione unica (H5-B)
- Detach via context menu (H5-1)
- Detach via drag (H5-2, anche se ora su HTML5 DnD)
- Invarianti multi-finestra
- Test B1–B7

---

## Modello Multi-Finestra / Sessione Unica (NPP) — 2026-06-25

**Spec utente osservato in Notepad++ (decisione 2026-06-25):**

1. **Single-window di default** (H2): apertura file / New Window / doppio-click NON aprono mai una 2ª finestra.
2. **UNICA eccezione → detach**: trascinare tab fuori oppure "sposta in nuova finestra" crea una **nuova finestra reale**.
3. Generalizza a **N finestre**, nessun massimo.
4. **La sessione è UNICA** = unione di TUTTE le tab di TUTTE le finestre aperte (il "gruppo" di tab). Una tab vive in **una sola** finestra (non duplicata), ma fa parte dell'unico indice di sessione.
5. **Chiudere una tab** (X sulla tab) chiude **solo** quella, nella sua finestra.
6. **Aprire/nuova tab quando NESSUNA tab è aperta** → riapre **UNA sola** finestra con **tutte** le tab di tutte le finestre del gruppo, concatenate nell'ordine di apertura delle finestre.
7. Quindi: a runtime più finestre con sottoinsiemi diversi; al riavvio collassano in **una** finestra.

---

## H5-B — Sessione Multi-Finestra-Aware (✅ IMPLEMENTATO 2026-06-26)

**Prerequisito dei detach H5-1/H5-2.** Il pezzo grosso non è il detach in sé, ma rendere la **sessione multi-finestra-aware**.

### Architettura

**Oggi (H2 single-window):**
- `session.json` = `{version:1, tabs:[...]}` **FLAT** — nessun concetto di finestra
- Cuscinetto `<id>.snapshot` solo per tab non al sicuro su disco
- Backup periodico gira **solo nell'owner** → una 2ª finestra sovrascriverebbe `session.json`

**Conseguenze:** con 2+ finestre, una seconda sovrascrive l'altra → perdita tab.

### Soluzione Realizzata

Il **main** tiene un registro in memoria `windowId → { order, tabs }`; **ogni finestra** (non solo l'owner) manda il suo `COLLECT_SESSION` (periodico + alla chiusura); il main aggiorna lo slice di quella finestra e **riscrive il `session.json` flat MERGIATO** ordinando per `order` di creazione finestra, poi ordine tab interno.

**Ordine finestre** = contatore incrementale assegnato in `_createEditorWindow`/`_restoreSessionWindow`.

### Flusso

1. **Finestra A (owner, first) nasce** → `_sessionOrder=1`, manda `COLLECT_SESSION` periodicamente
2. **Detach crea Finestra B** → `_sessionOrder=2`, manda il suo slice
3. Main tiene `{1:{order:1,tabs:[...]}, 2:{order:2,tabs:[...]}}`
4. Al merge per write: ordina per order (1, 2, …) e concatena tab → `session.json` flat ordinato
5. **Restore al riavvio:** finestra A legge il flat mergiato, **riceve TUTTE le tab** di tutte le finestre ormai chiuse, le assembla in un'unica finestra

**Snapshot namespacato:** `<winId>-<id>.snapshot` per evitare conflitto tra finestre.

### Q1 Risolto (2026-06-25)

**Chiusura di UNA finestra mentre altre restano aperte:** le tab **RESTANO nella sessione** (opzione b). Chiudere una **finestra** è silenzioso e NON scarta nulla: le sue tab (ordine + snapshot) **restano nell'indice di sessione unico** e riappaiono nel merge al prossimo riavvio. L'unico modo di togliere una tab dalla sessione è chiudere la **tab**.

Conseguenza su B: lo slice di una finestra **NON va cancellato alla sua chiusura** — resta "congelato" finché non avviene un **riavvio completo**.

### File Toccati (3)

- **`src/main/filesystem/session.js`** — `writeSession` aggiornato: riceve windowId+order, aggiorna slice, merge, write + snapshot namespacato
- **`src/main/app/index.js`** — `_sessionRegistry`, `_sessionWriteQueue`, `_sessionOrderSeq`; helper `_mergeSession`/`_enqueueSessionWrite`; `editor._sessionOrder` assegnato in `_createEditorWindow`+`_restoreSessionWindow`; handler riscritti per registro per-finestra + merge
- **`src/renderer/src/store/editor.js`** — FIX: tick senza gate owner (ogni finestra manda); FIX: `contentVersion++` in 6 azioni tab; var `isSessionOwner` (rimossa = morta); `COLLECT_SESSION` + `RESTORE_SESSION` + `LISTEN_FOR_SESSION`

### Test B1–B7 (Pianificati)

Eseguire con 2+ finestre reali (da H5-1 detach context menu):

- **B1** singola finestra, no regressioni
- **B2** 2 finestre: snapshot `<winId1>-<id>` e `<winId2>-<id>` distinti su disco
- **B3** 2 finestre: race write (simultanei `session-save`)
- **B4** richiudi finestra B mentre A aperta → slice B congelato
- **B5** riapri app → merge collassa in unica finestra con tutte le tab
- **B6** tab di una finestra non scompaiono quando altra finestra chiude
- **B7** ordine finestre (1, 2, 3…) determina ordine tab nel merge

---

## H5-1 — Detach via Context Menu (✅ IMPLEMENTATO 2026-06-26)

**Voce** "Move to New Window" nel context menu della tab.

**Implementazione:** `mt::detach-tab` → `_createDetachWindow` riusa il flusso restore (saved/untitled/dirty uniforme) → ack `mt::detach-tab-ack` chiude la tab sorgente.

**Test:**
- Pinna 2 tab, "Move to New Window" su una → nuova finestra con quella tab (pinnata), sorgente chiude quella tab
- Dirty tab → nuova finestra, bollino acceso, contenuto preservato
- Untitled → nuova finestra, nome Untitled preservato

---

## H5-2 — Detach via Drag-Out (✅ IMPLEMENTATO 2026-06-26)

**Dragula** `drag`/`dragend` + `mousemove` screen-pos; `revertOnSpill` → drop fuori finestra → `DETACH_TAB` in setTimeout(0).

**NOTA:** questo piano era per **dragula**. Con il **drag HTML5 DnD nativo** (feature `drag-html5-dnd`), il detach è implementato via overfill della zona drop → nuova finestra creata automaticamente. Consultare `Completed/drag-html5-dnd/drag-html5-dnd.md` per il dettaglio attuale.

**Test (con dragula):** trascinare tab fuori → finestra si crea, tab migra, sorgente chiude la tab.

---

## H5-RE — Re-Attach: Drag Tab in Finestra Esistente alla Posizione del Drop (✅ IMPLEMENTATO, 🧪 Funziona, ⚠️ 3 Problemi Noti)

**Dettaglio:** finestra destinazione contiene tab di finestra A; trascina una tab da finestra B su finestra A → la tab migra in A alla posizione del drop.

**Implementazione:** hit-test `getBounds` + `INSERT_DETACHED_TAB`.

**Funziona:** tabelle migrazioni avvengono. Cross-link a `drag-html5-dnd.md` per il nativo.

### Problemi noti — stato aggiornato al 2026-07-03 (feature drag-html5-dnd conclusa)

1. **BUG-H5-EMPTYWIN** ✅ RISOLTO (drag-html5-dnd, round 6 + 9b) — la finestra non-owner
   svuotata (migrazione ultima tab O chiusura manuale dell'ultima tab con la X) ora si
   auto-chiude: `FORCE_CLOSE_TAB`/`CLOSE_TABS` a 0 tab inviano `mt::window-emptied`, il
   main chiude solo se non `_isSessionOwner`. Owner sempre aperto. Testato PASS.

2. **BUG-H5-UNTITLED** ✅ RISOLTO (2026-07-04, feature `untitled-counter-globale`, verificato utente) — counter Untitled ora globale e monotono nel main (`_untitledIdSeq` + handler invoke `mt::next-untitled-index` in `app/index.js`; renderer `NEW_UNTITLED_TAB` async con fallback locale). Dettagli: `Completed/untitled-counter-globale/untitled-counter-globale.md`.

3. **H5-RE-BUG1** ✅ CONSIDERATO DISSOLTO (drag-html5-dnd) — il ri-drag di tab omonime
   falliva per il match manuale screenX/id di dragula, rimosso con la migrazione a HTML5
   DnD nativo. Non ri-osservato nei test 2026-07-03. Riaprire solo se il sintomo ricompare.

---

## H5-3 — Ghost Window (❌ Rimandato)

Anteprima leggera che segue il cursore durante drag. Rimandato.

---

## Bypass del Gate Single-Window (Per Detach)

Oggi `_createEditorWindow` (`app/index.js`), con `sessionSnapshotEnabled` ON, dirotta SEMPRE sulla finestra esistente. Il detach deve avere un percorso che crea una **nuova** `EditorWindow` anche a feature ON.

**Soluzione:** param additivo `forceNewWindow` (salta il blocco di riuso) oppure handler dedicato `mt::detach-tab`.

---

## Bring-to-Front Live Durante Drag (⏸️ Decisione Aperta)

Ricerca 2026-06-28: de-iconizzare + alzare le altre finestre **senza rompere il drag dragula** è possibile SOLO con `ShowWindow(hWnd, SW_SHOWNOACTIVATE)` + `SetWindowPos(SWP_NOACTIVATE|SWP_NOMOVE|SWP_NOSIZE)` su `win.getNativeWindowHandle()`, via **FFI nativa (`koffi`)**

**Perché:** dragula usa listener mouse sul `document` + Chromium tiene `SetCapture` sull'HWND sorgente → la finestra A continua a ricevere `mousemove` (coord fuori bounds = uscita) e con NOACTIVATE non perde focus/capture.

**Limiti:** finestre su altro desktop virtuale Windows non alzabili; multi-monitor ok.

**Costo:** dipendenza nativa `koffi`.

**Alternativa senza dipendenza:** pattern Chrome/VS Code (minimizzate non sono target; drop fuori = nuova finestra).

---

## Invarianti Multi-Finestra

1. **Sessione UNICA:** il merge in `session.json` determina l'ordine tab totale al riavvio.
2. **Owner assegnato dinamicamente:** `_getExistingEditorWindow()===null` → finestra A diventa owner (decide chi fa backup).
3. **Snapshot namespacato:** `<winId>-<id>.snapshot` evita conflitti.
4. **Registro main:** `windowId → { order, tabs }` aggiornato ad ogni `session-save` di una finestra.
5. **Ordinamento:** sort by `order` (creation time), poi ordine tab interno.

---

## Mappa File

| Cosa | File |
|---|---|
| Multi-finestra session merge | `src/main/filesystem/session.js` |
| Multi-finestra registry + restore | `src/main/app/index.js` |
| Collect session ogni finestra | `src/renderer/src/store/editor.js` |
| Detach context menu | TabContextMenu.vue (voce "Move to New Window") |
| Detach via drag | dragula config + drop handler (SUPERATO da HTML5 DnD) |

---

## Cross-Link

- **Session Persistence** (`session-persistence/session-persistence.md`): H2 base, prerequisito di H5-B
- **Drag HTML5 DnD** (`Completed/drag-html5-dnd/drag-html5-dnd.md`): drag nativo che **SUPERA** il drag dragula di H5-2; reorder nativo, detach in nuova finestra, anteprima insert-marker, copia file desktop
