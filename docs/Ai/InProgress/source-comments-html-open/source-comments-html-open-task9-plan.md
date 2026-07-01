# source-comments-html-open-task9 — Fix indent block-comment HTML/Markdown

## Obiettivo

Task8 ha aggiunto `{ indent: true }` a `cm.lineComment`/`cm.uncomment`/`cm.toggleComment` per far comparire il marker di commento dopo l'indent invece che a colonna 0. Funziona per `.js`/`.py` (mode con `lineComment` tipo `//`/`#`). Per `.html`/`.htm` e `.md` (commento `<!-- -->`) il fix NON funziona: il marker torna a inizio riga (colonna 0), ignorando l'indent.

Correggere l'inserimento del commento `<!-- -->` perché rispetti l'indent comune delle righe selezionate, come già avviene per i linguaggi a `lineComment`.

## Prerequisiti bloccanti

- Plan Task8 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task8-plan.md`.
- Worklog Task8 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task8-worklog.md` (contiene l'analisi root cause già confermata dall'orchestratore, da NON rifare da zero).
- Fonte locale addon comment richiesta e leggibile: `node_modules/codemirror/addon/comment/comment.js`.
- Fonti locali mode richieste e leggibili: `node_modules/codemirror/mode/xml/xml.js`, `node_modules/codemirror/mode/markdown/markdown.js`.
- File sorgente richiesto e leggibile: `src/renderer/src/components/editorWithTabs/sourceCode.vue`.
- File/cartelle vietate: non toccare drag/tabbar/HTML5 DnD/taskbar/raise/marker; non leggere né modificare segreti esterni al repo.
- Target verifica: parse SFC di `sourceCode.vue` se disponibile; test manuale runtime su `.html` e `.md` con righe indentate.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/sourceCode.vue`
- `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task9-worklog.md`

Non toccare `src/main/windows/editor.js`, Task6 main-side chord, `src/main/filesystem/watcher.js`, Task7, `src/main/filesystem/index.js`, `src/main/filesystem/session.js` (Task10 se in corso in parallelo — file disgiunti, nessuna sovrapposizione prevista), keybindings main, menu, command palette, IPC, drag/tabbar.

## Regole e invarianti rilevanti

- Conservare tutto il comportamento Task2/Task4/Task6/Task8 per i linguaggi con `lineComment` (`.js`, `.py`, ecc.): questo task tocca SOLO il ramo dei mode senza `lineComment` (block-comment-only: HTML/XML, Markdown).
- Non implementare sintassi commenti hardcoded per linguaggio: usare comunque `mode.blockCommentStart`/`mode.blockCommentEnd` esposti da CodeMirror, non stringhe fisse `<!--`/`-->` sparse nel codice (evitare di duplicare la sorgente di verità del mode).
- Comportamento atteso stile VS Code: marker `<!--`/`-->` dopo l'indent comune delle righe selezionate, non a colonna 0. Selezione parziale continua a commentare la riga intera (comportamento già accettato in Task8).
- Non toccare `_isPendingIgnore`/`_shouldIgnoreEvent`/watcher: nessuna relazione con questo bug.
- `Ctrl-/`/`toggleComment` deve continuare a fare toggle corretto (comment se non commentato, uncomment se già commentato) anche per HTML/Markdown.
- Gestire selezioni multiple dal basso verso l'alto come negli altri binding (invariante già in `applyLineCommentAction`).

## Fatti già verificati

- Root cause confermata leggendo `node_modules/codemirror/addon/comment/comment.js`:
  - `mode/xml/xml.js:388-389` e `mode/markdown/markdown.js:874-875` definiscono solo `blockCommentStart: "<!--"` / `blockCommentEnd: "-->"`, NON `lineComment`.
  - `lineComment()` (comment.js:57-99): se `mode.lineComment` è assente, delega sempre a `self.blockComment(from, to, { ...options, fullLines: true })` (comment.js:63-69), qualunque sia `options.indent`.
  - `blockComment()` (comment.js:101-135) **non implementa affatto `options.indent`**: inserisce sempre `startString + pad` a `Pos(from.line, 0)` (comment.js:123) — colonna 0 fissa, indipendente dall'indent della riga o dal valore di `from.ch`.
  - `uncomment()` (comment.js:137-210): il ramo block-comment (righe 168-209) cerca `startString`/`endString` con `indexOf` sulla riga, NON assume colonna 0 → rimozione del commento probabilmente già funzionante anche con indent, ma da confermare a runtime in questo task (nessuna prova diretta ancora raccolta).
- `applyLineCommentAction` in `sourceCode.vue` (riga ~475) oggi chiama sempre `cm[method](range.from(), range.to(), { indent: true })` con `method` = `lineComment`/`uncomment`, senza distinguere il mode.
- Handler `Ctrl-/` (riga ~941) chiama `cm.toggleComment({ indent: true })`, che internamente richiama `cm.uncomment`/`cm.lineComment` (stesso problema).
- `getMode(cm, pos)` (comment.js:52-55) permette di ottenere il mode effettivo alla posizione (utile per XML embedded in Markdown/HTML misto).

## Sottoproblemi in ordine

1. Rileggere `comment.js` e confermare a runtime (o per lettura statica precisa) se `uncomment()` gestisce già correttamente la rimozione di `<!-- -->` indentato, o se serve intervenire anche lì.
2. In `sourceCode.vue`, aggiungere un helper che rilevi se il mode alla posizione corrente ha `lineComment` oppure solo `blockCommentStart`/`blockCommentEnd` (usare `cm.getModeAt(pos)` o equivalente già usato da CodeMirror).
3. Per il ramo block-comment-only (HTML/XML, Markdown), implementare l'inserimento indent-aware: replicare la logica di calcolo dell'indent comune già presente in `lineComment()` (comment.js:77-91: whitespace comune tra le righe del range), poi inserire `blockCommentStart + pad` subito dopo l'indent sulla prima riga e `pad + blockCommentEnd` a fine contenuto dell'ultima riga (comportamento `fullLines` equivalente a quello di `blockComment()` ma con offset di colonna corretto invece di colonna 0).
4. Per il ramo con `lineComment` nativo (`.js`/`.py`), non cambiare nulla: continuare a usare `cm[method](from, to, { indent: true })` come da Task8.
5. Aggiornare `Ctrl-/`/toggle: se il mode è block-comment-only, il toggle deve provare prima `uncomment` (o l'helper del punto 1) e solo se non rimuove nulla eseguire l'inserimento indent-aware del punto 3; altrimenti mantenere `cm.toggleComment({ indent: true })` per i mode con `lineComment`.
6. Conservare `cm.operation()` e iterazione dal basso verso l'alto su selezioni multiple.
7. Aggiornare worklog task9 con `[x]`, verifiche eseguite e note `DA TESTARE`.

## Verifica richiesta

- Parse SFC di `sourceCode.vue` se disponibile.
- Test manuale atteso:
  - `.html`: su riga indentata (es. dentro `<body>`), `Ctrl+K Ctrl+C` deve produrre `    <!-- testo -->`, non `<!--     testo -->` né marker a colonna 0.
  - `.html`: `Ctrl+K Ctrl+U` deve rimuovere quel commento correttamente.
  - `.html`: `Ctrl+/` deve fare toggle corretto (commenta se non commentato, decommenta se già commentato) rispettando l'indent.
  - `.md`: stesso comportamento su riga indentata (es. dentro una lista).
  - Selezione parziale su riga indentata: commenta comunque tutta la riga, marker dopo indent (comportamento Task8 già accettato).
  - Nessuna regressione su `.js`/`.py` (Task8 deve continuare a funzionare identico).
  - Selezioni multiple miste (alcune righe HTML indentate diversamente): marker allineato all'indent minimo comune, come già fa `lineComment` nativo.
