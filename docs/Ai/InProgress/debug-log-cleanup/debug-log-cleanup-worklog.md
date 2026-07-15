# debug-log-cleanup — worklog

## Avanzamento
- [x] Rimozione `[PARTE-F-DEBUG]` da `src/muya/lib/eventHandler/keyboard.js` (6 righe di log rimosse,
      incluse le variabili di debug usate solo per costruirli; 330 → 309 righe, -21)
- [x] Rimozione `[PARTE-F-DEBUG]` da `src/muya/lib/contentState/backspaceCtrl.js` (46 righe di log
      rimosse + `else` finale vuoto ripristinato a nessuna azione; 749 → 684 righe, -65)
- [x] Rimozione `[FMT-TOGGLE-DEBUG]` da `src/muya/lib/contentState/formatCtrl.js` (1 log + commento
      eslint-disable + variabile `activeFormatRange` usata solo dal log; -6 righe)
- [x] Rimozione `[FMT-TOGGLE-DEBUG]` da `src/muya/lib/ui/formatPicker/index.js` (1 log + commento
      eslint-disable; -2 righe)
- [x] Verifica grep: zero occorrenze dei due prefissi in `src/` (confermato)
- [x] Build di verifica passata (`node node_modules/electron-vite/bin/electron-vite.js build`,
      nessun errore, solo warning preesistenti non correlati)

## Stato: DA TESTARE

## Test
(da compilare dopo verifica dell'utente)
