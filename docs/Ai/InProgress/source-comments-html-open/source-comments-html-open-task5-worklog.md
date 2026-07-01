# source-comments-html-open-task5 — worklog

## Avanzamento

- [x] Confermare tema CodeMirror applicato e fonti CSS locali.
- [x] Aggiungere override scoped per migliorare token `railscasts` usato da dark/material-dark.
- [x] Aggiungere override scoped per completare token default/light se necessario.
- [x] Completare classi mancanti one-dark se necessario.
- [x] Verificare staticamente e riportare esito.

Stato task5: DA TESTARE.

## Test

DA TESTARE lato utente: colori source mode su `.js`, `.py`, `.html`, `.css` nei temi `light`, `dark`, `material-dark`, `one-dark`; confermare che `.js` resta `text/javascript` e che non ricompare errore Vite `504 (Outdated Optimize Dep)`.

Test utente 2026-07-01: Task5 funziona; colori source nettamente migliori.

Verifica statica eseguita:
- Confermata selezione tema source in `sourceCode.vue`: `railscasts` per `dark/material-dark`, `one-dark` per tema `one-dark`.
- Confermato import CSS locali in `codeMirror/index.js`: `codemirror/lib/codemirror.css`, `./index.css`, `codemirror/theme/railscasts.css`.
- Aggiunti override solo in `src/renderer/src/codeMirror/index.css`, tutti scoped a `.source-code .CodeMirror...`.
- Nessuna modifica a Muya/Prism, mode loader, keybindings/menu/IPC/drag-tabbar, `node_modules`.
- `npm run build` tentato a fine task: bloccato dall'ambiente con errore `Il programma è bloccato dai Criteri di gruppo`.
- Verifica pattern CSS con grep: presenti override scoped per `railscasts`, `default`, `one-dark` nelle classi token attese.
