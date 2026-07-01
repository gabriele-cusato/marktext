# source-comments-html-open-task8 — worklog

## Avanzamento

- [ ] Confermare API CodeMirror `lineComment(..., { indent: true })`, `toggleComment({ indent: true })` e `uncomment`.
- [ ] Usare `indent: true` nei commenti source espliciti senza rompere Task6.
- [ ] Usare `indent: true` anche per `Ctrl+/`.
- [ ] Conservare comportamento commento riga intera anche con selezione parziale.
- [ ] Conservare rimozione commento con marker dopo indent.
- [ ] Verificare staticamente e riportare esito.

## Test

DA TESTARE lato utente: su righe indentate in `.js/.html/.py`, il marker commento deve comparire dopo l'indent e prima del testo; selezione parziale continua a commentare tutta la riga come VS Code; `Ctrl+/` e `Ctrl+K Ctrl+C/U` restano funzionanti.
