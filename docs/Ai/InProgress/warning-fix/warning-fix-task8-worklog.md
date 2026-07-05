# warning-fix — task8 — worklog (DA TESTARE)

## Avanzamento
- [x] Prop cursor in index.vue → type Object, default null (no required)
- [x] Grep consumatori della prop cursor: tutti gestiscono null (editor.vue già type:Object/default:null, props.cursor non altrimenti consumato in script)
- [x] Normalizzazione `?? null` in app.vue:142 (nessun effetto collaterale: coerente col default null del prop)
- [x] Build di verifica (`npm run build`, exit 0)

## Test
- 2026-07-06 (utente): nessun Vue warn "cursor" (anche con attesa >7s). Task CHIUSO per il warn.
- Emersi durante il test (NON regressioni del warn, tracciati nella feature editor-ui-fixes):
  1) errore `selectionChange: expected cursor but cursor is null` (paragraphCtrl.js:21) al rename
     di un file esistente dal context menu tab (il rename poi riesce);
  2) posizione cursore NON mantenuta passando da md a source mode (source->md invece funziona).
