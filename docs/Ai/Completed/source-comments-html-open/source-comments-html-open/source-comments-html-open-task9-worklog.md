# source-comments-html-open-task9 — worklog

## Avanzamento

- [x] Confermare comportamento reale di `uncomment()` su block-comment indentato.
- [x] Aggiungere rilevamento mode con solo `blockCommentStart`/`blockCommentEnd` (no `lineComment`).
- [x] Implementare inserimento indent-aware per il ramo block-comment-only.
- [x] Conservare invariato il ramo `lineComment` nativo (`.js`/`.py`, Task8).
- [x] Aggiornare `Ctrl-/`/toggle per il ramo block-comment-only.
- [x] Verificare staticamente e riportare esito.

## Test

- 2026-07-06 (utente): `Ctrl+K Ctrl+C` su HTML commenta inline correttamente anche su commento multi-riga; marker dopo l'indent, non a colonna 0. Funzionalità OK.
- Verifica codice (orchestratore): `sourceCode.vue` implementa `getModeAtPosition` (476), `isBlockCommentOnlyMode` (484), calcolo `commonIndent` (501-503), inserimento indent-aware `blockCommentStart`/`blockCommentEnd` (518-519), branch che preserva `lineComment` nativo (558-575). Coincide col plan.
