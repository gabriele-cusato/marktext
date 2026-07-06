# source-comments-html-open-task2 — worklog

## Avanzamento

- [x] Verificare API addon comment CodeMirror locale.
- [x] Importare addon comment in `codeMirror/index.js`.
- [x] Aggiungere `Ctrl+/` source-only in `sourceCode.vue`.
- [x] Aggiungere `Ctrl+K C` source-only in `sourceCode.vue`.
- [x] Aggiungere `Ctrl+K U` source-only in `sourceCode.vue`.
- [x] Liberare `Ctrl+K` da `view.toggle-toc` nelle tre keymap senza rimuovere comando/menu.
- [x] Verificare staticamente/buildare e riportare esito.

## Test

DA TESTARE lato utente: `Ctrl+/`, `Ctrl+K C`, `Ctrl+K U` in source mode; `Ctrl+K` solo non deve aprire TOC.

Risultato test utente 2026-07-01:
- `Ctrl+K C` non si comporta come atteso in stile VS Code.
- Tenere premuto Ctrl e premere `K`, poi `C`, non commenta; l'utente nota che VS Code usa di fatto `Ctrl+K Ctrl+C`.
- Rilasciare Ctrl e premere `C` dopo `Ctrl+K` rischia di scrivere `C`.
- Da correggere: coprire chord `Ctrl-K Ctrl-C` e `Ctrl-K Ctrl-U` oltre o al posto di `Ctrl-K C/U`.

Verifica locale: `node_modules/codemirror/addon/comment/comment.js` espone `CodeMirror.commands.toggleComment` e le extension `toggleComment`, `lineComment`, `blockComment`, `uncomment`.

Esito fix reale 2026-07-01:
- Task4 ha aggiunto i binding CodeMirror `Ctrl-K Ctrl-C/U`, ma non ha risolto perché il secondo stroke veniva intercettato dagli shortcut globali main (`Ctrl+C` copy, `Ctrl+U` lowercase) prima di CodeMirror.
- Task6 ha risolto intercettando nel main `Ctrl/Cmd+K` solo quando il focus è nel source editor, consumando il secondo stroke `Ctrl/Cmd+C/U` e inviando al renderer `sourceComment` / `sourceUncomment`.
- Test utente: ora `Ctrl+K Ctrl+C/U` funziona.
