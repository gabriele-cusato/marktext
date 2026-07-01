# source-comments-html-open-task8 — worklog

## Avanzamento

- [x] Confermare API CodeMirror `lineComment(..., { indent: true })`, `toggleComment({ indent: true })` e `uncomment`.
- [x] Usare `indent: true` nei commenti source espliciti senza rompere Task6.
- [x] Usare `indent: true` anche per `Ctrl+/`.
- [x] Conservare comportamento commento riga intera anche con selezione parziale.
- [x] Conservare rimozione commento con marker dopo indent.
- [x] Verificare staticamente e riportare esito.

Modifiche applicate in `sourceCode.vue`:
- `applyLineCommentAction`: `cm[method](range.from(), range.to())` → aggiunto terzo argomento `{ indent: true }` (vale sia per `lineComment` sia per `uncomment`).
- Handler `Ctrl-/`: da `cm.execCommand('toggleComment')` a `cm.toggleComment({ indent: true })`.
- Nessun altro binding toccato: `Ctrl-K C/U`, `Ctrl-K Ctrl-C/U`, `Cmd-K Cmd-C/U` restano su `applyLineCommentAction`, ora corretta.

## Test

Testato dall'utente in data 2026-07-01: OK. Confermato funzionante sia `Ctrl+/` sia `Ctrl+K Ctrl+C` / `Ctrl+K Ctrl+U` — marker commento compare dopo l'indent, non a inizio riga. Task8 concluso per JS/Python.

Regressione segnalata dall'utente 2026-07-01: per `.html` e `.md` (commento `<!-- -->`), il marker torna a inizio riga invece di seguire l'indent. Non risolto da questo task per questi due linguaggi.

Root cause confermata (orchestratore, lettura `node_modules/codemirror/addon/comment/comment.js`):
- `mode/xml/xml.js:388-389` e `mode/markdown/markdown.js:874-875` definiscono solo `blockCommentStart`/`blockCommentEnd` (`<!--`/`-->`), NON `lineComment`.
- `lineComment()` (comment.js:57-99), quando `mode.lineComment` è assente, delega sempre a `self.blockComment(from, to, { ...options, fullLines: true })` (comment.js:63-69).
- `blockComment()` (comment.js:101-135) **ignora completamente `options.indent`**: inserisce sempre `startString` a `Pos(from.line, 0)` (colonna 0 fissa, comment.js:123), indipendentemente dall'indent della riga.
- Per questo `{ indent: true }` non ha alcun effetto su HTML/Markdown: la chiamata arriva a `blockComment()` che non implementa affatto l'opzione.
- `uncomment()` (comment.js:137-210) invece cerca `startString` con `indexOf` sulla riga, non assume colonna 0 — quindi la rimozione del commento probabilmente già funziona anche con indent; da confermare a test.

Serve task dedicato per gestire indent-aware l'inserimento block-comment full-lines per i mode senza `lineComment` (HTML/XML, Markdown), con logica custom in `sourceCode.vue` (l'addon CodeMirror non lo supporta).
