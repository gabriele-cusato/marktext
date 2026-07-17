# image-drag-in-doc — task "move" — worklog

Plan di riferimento: `image-drag-in-doc-move-plan.md`.

## Avanzamento

### Task0 — spike strumentazione (test preventivo runtime)

- [x] Spike applicato (orchestratore, 2026-07-18): dragstart consentito su IMG dentro
  `.ag-inline-image` + log `[SPIKE-IMG-DRAG]` in dragstart/dragover/drop/dragleave/dragend,
  ghost attivo, stato locale `internalImageDrag` in contentState, NESSUNA mutazione documento.
  File toccati: `src/muya/lib/eventHandler/dragDrop.js`, `src/muya/lib/contentState/dragDropCtrl.js`
- [x] Test utente spike (2026-07-18): dragstart parte su IMG ✓; ghost compare e segue i
  paragrafi ✓; **drop interno CONSEGNATO** (sorpresa: electron#42252 NON morde su questo
  target — `dropEffect:'move'` round-trippa al dragend) ✓; flag anti-doppia funzionante
  (`dropConsegnato:true` al dragend, fallback non scatta) ✓; dragleave azzera ghost/anchor
  tra paragrafi e fuori editor ✓; rilascio su tab bar: nessun effetto ✓
- [x] Test utente spike NON-regressione: nessuna regressione (drop esterni, taskbar spring,
  selezione/resize immagine OK)
- [x] Esito spike nel worklog; plan aggiornato: drop = percorso primario REALE (fallback
  dragend mantenuto per robustezza), aggiunto `clearData()` al dragstart — il payload nativo
  del drag IMG incollava testo (`Screenshot...jpg`) nelle app esterne (visto in Visual Studio)

### Task move — implementazione — TESTATA ✓ (2026-07-18)

- [x] dragstart condizionato: consentire il drag sulle IMG dentro `.ag-inline-image`
  (`clearData()` anti-payload nativo + `text/mt-image-move` + `effectAllowed='move'` +
  stato locale in contentState), mantenere `preventDefault` per le altre IMG
- [x] rimozione/sostituzione completa del codice spike (`SPIKE-IMG-DRAG`: log e commenti)
  nei 2 file (verificato con grep: nessun residuo `SPIKE-IMG-DRAG`/`console.log`)
- [x] dragoverHandler: ramo interno (gate su stato locale) con `preventDefault` + ghost +
  `dropEffect='move'`, rami esistenti invariati
- [x] dropHandler: ramo interno con chiamata al move + flag anti-doppia-esecuzione
- [x] dragend nuovo: fallback decisione (electron#42252) + cleanup ghost/stato sempre
- [x] moveImageToDropAnchor: rimozione token dal blocco sorgente (+ rimozione `p` vuoto),
  reinserimento con `createBlockP` + insertBefore/After, no-op su se stesso, cursore +
  render + stateChange, niente imageAction
- [x] verifica: diff rami esterni invariati (`git diff` confermato, rami uri-list/Files/
  else passivo intatti), `npm run build` OK, `npm run test:unit` a baseline (42 verdi)

## Test

### Round 1 (utente, 2026-07-18)

- Move immagine nel documento: FUNZIONA ✓ (anche undo/redo, rilascio su se stessa, rilascio
  fuori editor, drag verso app esterne senza incollare nulla, taskbar spring, selezione/resize,
  drag tab: tutti OK)
- **BUG trovato: drop immagine esterna (da Explorer) morto** — ghost visibile, nessun
  inserimento, zero errori. Dopo Ctrl+Z "riprendeva a funzionare" (in apparenza).
- **Causa radice**: move interno riuscito via `drop` → `render()` stacca l'IMG sorgente dal
  DOM → il `dragend` non risale al container → cleanup mai eseguito → `internalImageDrag`
  stale dirotta ogni drag successivo nel ramo interno (`getBlock(chiave vecchia)` → return
  silenzioso). Il Ctrl+Z ripristinava i blocchi con le stesse chiavi → lo stato stale tornava
  a puntare a un blocco esistente e il ramo interno "funzionava" spostando il blocco
  ripristinato (non era il vero percorso esterno).
- **Fix round 1** (orchestratore, diretto, 3 righe + commento): nel ramo interno del
  `dropHandler` azzerare subito `internalImageDrag`/`internalImageDragHandled` dopo il move,
  senza affidarsi al dragend. Il dragend resta per i gesti annullati (sorgente ancora nel DOM)
  e per il fallback move.

### Round 2 (utente, 2026-07-18) — PASS, feature verificata

- Sequenza move interno → drop esterno da Explorer: FUNZIONA ✓ (ripetuta più volte alternando)
- Undo e taskbar: OK ✓
- Nessun punto aperto. Feature COMPLETA e testata. Commit a carico dell'utente.
- Agent-Summary NON ancora avviato (richiesta utente: rimandato).

(compilare dopo il test utente su PC principale — obbligatori:
- move immagine su/giù nel documento, anche dentro/fuori liste e blockquote
- rilascio sull'immagine stessa → nessuna modifica, nessuna duplicazione
- undo/redo dopo un move
- NON-regressione: drop immagine esterna da Explorer, drop link immagine web
- NON-regressione: resize con le maniglie del transformer, selezione immagine al click
- NON-regressione: spring-loading taskbar durante drag di testo e di tab
- rilascio fuori dalla finestra → nessun move, nessun errore console)
