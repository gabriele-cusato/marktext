# debug-log-cleanup — plan

## Obiettivo
Rimuovere tutti i log di debug temporanei confermati chiusi dai test utente (2026-07-13):
prefissi `[PARTE-F-DEBUG]` e `[FMT-TOGGLE-DEBUG]`. Nessun cambio di comportamento: si tolgono
solo i log e le strutture aggiunte esclusivamente per i log.

## Prerequisiti bloccanti
Verificare PRIMA di toccare codice; se uno manca o non corrisponde, fermarsi e segnalare senza modificare nulla:
- Worklog con l'elenco dei punti: `docs/Ai/InProgress/menu-shortcut-overhaul/worklog-parteF.md`
  (sezione "Log temporanei aggiunti", righe ~32-71) e
  `docs/Ai/InProgress/format-toggle-off/format-toggle-off-worklog.md` (elenco righe ~29-38).
- File sorgente da toccare (esistenza verificata dall'orchestratore con grep, occorrenze attese):
  - `src/muya/lib/contentState/backspaceCtrl.js` — 46 righe con `[PARTE-F-DEBUG]`
  - `src/muya/lib/eventHandler/keyboard.js` — 6 righe con `[PARTE-F-DEBUG]`
  - `src/muya/lib/contentState/formatCtrl.js` — 1 riga con `[FMT-TOGGLE-DEBUG]` (~riga 294)
  - `src/muya/lib/ui/formatPicker/index.js` — 1 riga con `[FMT-TOGGLE-DEBUG]` (in `selectItem()`, ~riga 114)
- Target di verifica: `node node_modules/electron-vite/bin/electron-vite.js build` (o `npm run build` se il wrapper npm funziona; sessione su PC principale, build consentito).
- Version control: VIETATO usare git o altri VCS (niente commit/add/checkout; le verifiche read-only le fa l'orchestratore).
- Nessun file sensibile/vietato coinvolto.

## Regole rilevanti
- Muya (`src/muya/lib/`) è engine isolato: solo JS puro + DOM, no Electron/Node. Non introdurre import.
- Rimuovere SOLO i log e ciò che esiste esclusivamente per loro. Zero modifiche di logica.
- ATTENZIONE `backspaceCtrl.js`: esiste un `else` finale aggiunto SOLO per un log
  (ramo "nessun ramo del blocco principale preso") — rimuovere anche l'`else` vuoto risultante,
  ripristinando la struttura precedente (nessuna azione quando nessuna condizione è vera).
- In `formatCtrl.js` e `formatPicker/index.js`: rimuovere anche gli eventuali commenti
  `// eslint-disable-next-line no-console` immediatamente sopra i log rimossi.
- Non toccare altri `console.log`/`console.warn` non prefissati: fuori scope.

## Fatti già verificati (dall'orchestratore)
- Grep `PARTE-F-DEBUG|FMT-TOGGLE-DEBUG` su `src/`: 54 occorrenze totali, SOLO nei 4 file sopra.
- Fix confermati dai test utente: la rimozione è sicura (sezioni "Test" dei due worklog).

## Sottoproblemi in ordine
1. Leggere i due worklog (sezioni elenco log) per la mappa esatta dei punti.
2. Rimuovere i log `[PARTE-F-DEBUG]` da `keyboard.js`.
3. Rimuovere i log `[PARTE-F-DEBUG]` da `backspaceCtrl.js`, incluso l'`else` finale vuoto.
4. Rimuovere il log `[FMT-TOGGLE-DEBUG]` da `formatCtrl.js` (+ eventuale commento eslint).
5. Rimuovere il log `[FMT-TOGGLE-DEBUG]` da `formatPicker/index.js` (+ eventuale commento eslint).
6. Verifica: grep dei due prefissi su `src/` deve dare ZERO occorrenze.
7. Build di verifica (comando nei prerequisiti); se fallisce, correggere solo errori introdotti dalla rimozione.
8. Aggiornare il worklog `debug-log-cleanup-worklog.md` (sezione Avanzamento, `[x]` + tag `DA TESTARE` a fine task).

## Skill di codice
Caricare `coding-standard` (Muya = JS puro, nessuna skill più specifica).
