# warning-fix — task6 — worklog

## Stato: DA TESTARE

## Avanzamento
- [x] Sdoppiare chiave searchInTabs in search.vue (titolo vs placeholder)
- [x] Aggiungere le 3 chiavi in en.json
- [x] Aggiungere le 3 chiavi negli altri 8 locale (de, es, fr, ja, ko, pt, zh-CN, zh-TW)
- [x] Grep: nessun altro uso della vecchia chiave / conflitti su common.close
- [x] Build di verifica (`npm run build`, exit 0, nessun errore)

## Note traduzioni
Tutte le 8 lingue non-en traducibili con confidenza in base allo stile delle voci vicine
(`searchInFolder`, `close` già esistenti nello stesso file): nessuna lingua ha richiesto
fallback in inglese.

## Test
- 2026-07-06 (utente): Ctrl+Shift+F OK, nessun warning intlify "Not found". Task CHIUSO.
