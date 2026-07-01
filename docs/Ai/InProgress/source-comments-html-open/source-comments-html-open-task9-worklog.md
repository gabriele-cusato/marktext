# source-comments-html-open-task9 — worklog

## Avanzamento

- [ ] Confermare comportamento reale di `uncomment()` su block-comment indentato.
- [ ] Aggiungere rilevamento mode con solo `blockCommentStart`/`blockCommentEnd` (no `lineComment`).
- [ ] Implementare inserimento indent-aware per il ramo block-comment-only.
- [ ] Conservare invariato il ramo `lineComment` nativo (`.js`/`.py`, Task8).
- [ ] Aggiornare `Ctrl-/`/toggle per il ramo block-comment-only.
- [ ] Verificare staticamente e riportare esito.

## Test

DA TESTARE lato utente: `Ctrl+K Ctrl+C`/`Ctrl+K Ctrl+U`/`Ctrl+/` su `.html` e `.md` con righe indentate; marker `<!--`/`-->` dopo indent, non a colonna 0; nessuna regressione su `.js`/`.py`.
