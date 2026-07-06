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

Bug utente 2026-07-02: in HTML source mode, tag tipo `<body>` risultano rossi; quando il tokenizer segnala errore di sintassi (es. `<` non chiuso), il token può ottenere classi combinate `cm-tag cm-error` e diventare illeggibile per contrasto rosso su rosso. Analisi orchestratore: causa confermata nel tema `railscasts` (`node_modules/codemirror/theme/railscasts.css:28-30`) e nel tokenizer XML (`node_modules/codemirror/mode/xml/xml.js:126-131`). Aggiunto al plan Task5 il sottopunto 7 per fix CSS scoped in `src/renderer/src/codeMirror/index.css`.

Fix applicato 2026-07-02:
- Aggiunto override scoped in `src/renderer/src/codeMirror/index.css`: `.source-code .CodeMirror.cm-s-railscasts span.cm-tag.cm-error { color: #f8f8f2; }`.
- Motivazione: mantenere tag validi rossi nel tema `railscasts`, ma forzare testo chiaro quando lo stesso token ha anche classe `cm-error` e riceve sfondo rosso.
- Scope: solo source mode + tema `railscasts` (`dark/material-dark`); nessuna modifica a `node_modules`, mode loader, one-dark/default.
- Verifica statica post-fix: `git diff --check` OK; `grep` conferma presenza del selettore `cm-tag.cm-error` in `index.css` e note plan/worklog aggiornate.

Estensione fix 2026-07-02:
- Aggiunti selettori scoped per evidenziare anche i bracket HTML/XML adiacenti al token `cm-tag.cm-error`:
  - `span.cm-tag.cm-bracket:has(+ span.cm-tag.cm-error)` per il bracket prima del nome tag errato.
  - `span.cm-tag.cm-error + span.cm-tag.cm-bracket` per il bracket dopo il nome tag errato.
- Motivazione: CodeMirror tokenizza un tag in più span (`</`/`>` come `cm-tag cm-bracket`, nome tag come `cm-tag`/`cm-error`), quindi il solo `.cm-tag.cm-error` non evidenzia sempre l'intero tag visibile.
- Limite noto: soluzione CSS adiacente, non parser. Copre il caso comune in cui bracket e token errore sono sibling consecutivi; può non coprire markup più complesso se l'errore finisce su attributi/valori o se CodeMirror produce token non adiacenti.
- Test utente 2026-07-02: OK. Confermato funzionante; bug segnalato come fixato.

Verifica statica eseguita:
- Confermata selezione tema source in `sourceCode.vue`: `railscasts` per `dark/material-dark`, `one-dark` per tema `one-dark`.
- Confermato import CSS locali in `codeMirror/index.js`: `codemirror/lib/codemirror.css`, `./index.css`, `codemirror/theme/railscasts.css`.
- Aggiunti override solo in `src/renderer/src/codeMirror/index.css`, tutti scoped a `.source-code .CodeMirror...`.
- Nessuna modifica a Muya/Prism, mode loader, keybindings/menu/IPC/drag-tabbar, `node_modules`.
- `npm run build` tentato a fine task: bloccato dall'ambiente con errore `Il programma è bloccato dai Criteri di gruppo`.
- Verifica pattern CSS con grep: presenti override scoped per `railscasts`, `default`, `one-dark` nelle classi token attese.
