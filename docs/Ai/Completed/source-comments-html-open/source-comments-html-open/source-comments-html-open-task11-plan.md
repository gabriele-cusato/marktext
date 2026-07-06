# source-comments-html-open-task11 — Implement indent-aware block-comment in source mode

## Obiettivo

Implementare il fix finale per il bug dei commenti multiline/block-comment in source mode: su `.html`, `.htm`, `.xml` e `.md`, i marker `<!--` / `-->` devono essere inseriti dopo l'indent comune delle righe selezionate, non a colonna 0.

Questo task è l'esecuzione operativa del problema già isolato in Task9. Task9 contiene analisi/root cause; Task11 deve modificare il codice, aggiornare il worklog durante l'avanzamento e lasciare verifiche ripetibili.

Comportamento atteso stile VS Code:

```html
    testo
```

con `Ctrl+K Ctrl+C` o `Ctrl+/` deve diventare:

```html
    <!-- testo -->
```

e non:

```html
<!--     testo -->
```

né:

```html
<!-- testo -->
```

## Prerequisiti bloccanti

- Decisioni progetto richieste e leggibili: `docs/Ai/DECISIONS.md`.
- Plan Task8 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task8-plan.md`.
- Worklog Task8 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task8-worklog.md`.
- Plan Task9 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task9-plan.md`.
- Worklog Task9 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task9-worklog.md`.
- Fonte locale addon comment richiesta e leggibile: `node_modules/codemirror/addon/comment/comment.js`.
- Fonti locali mode richieste e leggibili: `node_modules/codemirror/mode/xml/xml.js`, `node_modules/codemirror/mode/markdown/markdown.js`.
- File sorgente richiesto e leggibile: `src/renderer/src/components/editorWithTabs/sourceCode.vue`.
- File/cartelle vietate: non toccare drag/tabbar/HTML5 DnD/taskbar/raise/marker; non leggere né modificare segreti esterni al repo.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/sourceCode.vue`
- `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task11-worklog.md`

Non toccare `src/main/windows/editor.js`, Task6 main-side chord, `src/main/filesystem/*`, watcher/session/save, keybindings main, menu, command palette, IPC, drag/tabbar, Task10.

## Regole e invarianti rilevanti

- Conservare invariato il comportamento Task8 per i linguaggi con `lineComment` (`.js`, `.py`, ecc.): devono continuare a usare CodeMirror addon con `{ indent: true }`.
- Non patchare `node_modules/codemirror/addon/comment/comment.js`: implementare il fix locale in `sourceCode.vue` per ridurre rischio regressioni globali.
- Non hardcodare la sintassi per estensione file: usare `mode.blockCommentStart` e `mode.blockCommentEnd` esposti dal mode CodeMirror.
- Gestire i mode block-comment-only: HTML/XML e Markdown espongono `blockCommentStart`/`blockCommentEnd` ma non `lineComment`.
- `Ctrl+K Ctrl+C`, `Ctrl+K C`, `Cmd+K Cmd+C` devono commentare con indent corretto.
- `Ctrl+K Ctrl+U`, `Ctrl+K U`, `Cmd+K Cmd+U` devono decommentare correttamente.
- `Ctrl+/` deve fare toggle corretto anche per block-comment-only: prima provare `uncomment`, se non rimuove nulla inserire block comment indent-aware.
- Conservare `cm.operation()` e iterazione delle selezioni dal basso verso l'alto, così le modifiche a range inferiori non spostano gli indici dei range superiori.
- Selezione parziale continua a commentare la riga intera, come accettato in Task8.
- Evitare helper troppo generici o refactor non necessari: fix piccolo, localizzato, leggibile.

## Fatti già verificati

- `src/renderer/src/components/editorWithTabs/sourceCode.vue:475-483`: `applyLineCommentAction` chiama oggi `cm[method](range.from(), range.to(), { indent: true })` per comment/uncomment.
- `src/renderer/src/components/editorWithTabs/sourceCode.vue:941-943`: `Ctrl-/` chiama oggi `cm.toggleComment({ indent: true })`.
- `node_modules/codemirror/mode/xml/xml.js:388-389`: mode XML/HTML espone `blockCommentStart: "<!--"` e `blockCommentEnd: "-->"`, non `lineComment`.
- `node_modules/codemirror/mode/markdown/markdown.js:874-875`: mode Markdown espone `blockCommentStart: "<!--"` e `blockCommentEnd: "-->"`, non `lineComment`.
- `node_modules/codemirror/addon/comment/comment.js:63-68`: se `mode.lineComment` manca, `lineComment()` delega a `blockComment(..., { fullLines: true })`.
- `node_modules/codemirror/addon/comment/comment.js:120-123`: `blockComment()` ignora `options.indent` e inserisce apertura con `Pos(from.line, 0)`, cioè colonna 0 fissa.
- `node_modules/codemirror/addon/comment/comment.js:173-200`: `uncomment()` cerca `blockCommentStart` con `indexOf`, quindi non richiede marker a colonna 0; deve funzionare anche con marker indentato, da confermare con test/manuale.
- `comment.js:52-55`: il mode effettivo può essere ottenuto con logica equivalente a `cm.getModeAt(pos)` quando il mode supporta inner comments.

## Sottoproblemi in ordine

1. Rileggere prerequisiti e riportare nel worklog che sono stati verificati prima di modificare codice.
2. Rinominare o sostituire localmente `applyLineCommentAction` con un helper più corretto semanticamente, ad esempio `applySourceCommentAction(cm, action)`, mantenendo chiamanti esistenti aggiornati.
3. Aggiungere helper piccolo per leggere il mode effettivo alla posizione del range (`cm.getModeAt(from)` se disponibile, fallback a `cm.getMode()`).
4. Aggiungere helper per riconoscere mode block-comment-only: mode con `blockCommentStart` e `blockCommentEnd`, ma senza `lineComment`.
5. Per mode con `lineComment`, mantenere ramo esistente:
   - `comment` → `cm.lineComment(from, to, { indent: true })`
   - `uncomment` → `cm.uncomment(from, to, { indent: true })`
   - `toggle` → `cm.toggleComment({ indent: true })`
6. Per mode block-comment-only, calcolare la riga finale con comportamento full-lines equivalente a CodeMirror: se la selezione termina a `ch === 0` su riga non vuota e non è selezione singola, escludere quella riga.
7. Per mode block-comment-only, calcolare indent comune minimo tra righe del range, usando solo whitespace iniziale delle righe non vuote e gestendo righe vuote senza rompere il calcolo.
8. Per `comment` block-comment-only, inserire prima la chiusura `padding + mode.blockCommentEnd` a fine ultima riga, poi l'apertura `mode.blockCommentStart + padding` dopo l'indent comune della prima riga. Inserire in questo ordine per non spostare la posizione di chiusura quando range è su una sola riga.
9. Per `uncomment` block-comment-only, chiamare `cm.uncomment(from, to, { indent: true })` e riportare nel worklog se il ritorno booleano conferma rimozione.
10. Per `toggle` block-comment-only, chiamare prima `cm.uncomment(from, to, { indent: true })`; se ritorna `false`, inserire block comment indent-aware.
11. Aggiornare handler `Ctrl-/` per usare il nuovo helper con azione `toggle`, così non passa più dal `blockComment()` nativo che ignora `indent`.
12. Conservare `cm.focus()` dopo operazione e non introdurre side effect su store/salvataggio.
13. Aggiornare il worklog Task11 progressivamente: ogni sottoproblema completato deve diventare `[x]`, con note su modifiche e verifiche.

## Verifica richiesta

- Parse/check statico del file modificato, scegliendo il comando disponibile più mirato per SFC/Vue nel repo. Se non esiste un parser SFC diretto, eseguire almeno comando lint mirato o build/check leggero disponibile e documentare il limite.
- Test manuale atteso lato utente:
  - `.html`: su riga indentata dentro `<body>`, `Ctrl+K Ctrl+C` produce `    <!-- testo -->`.
  - `.html`: `Ctrl+K Ctrl+U` rimuove correttamente il commento indentato.
  - `.html`: `Ctrl+/` fa toggle corretto rispettando indent.
  - `.md`: stesso comportamento su riga indentata, ad esempio dentro una lista.
  - Selezione parziale su riga indentata: commenta comunque tutta la riga, marker dopo indent.
  - Selezione multi-riga con indent comune: marker apertura dopo indent comune, chiusura a fine ultima riga utile.
  - `.js`/`.py`: nessuna regressione, `//`/`#` restano dopo indent come Task8.

## Note per Agent-Code

- Usare un solo Agent-Code per questo task: scope piccolo, un solo file sorgente.
- Non aprire refactor più ampi.
- Non implementare comportamento VS Code oltre al bug richiesto.
- Non aggiornare Task8/Task9 salvo blocchi documentali gravi: aggiornare solo Task11 worklog.
