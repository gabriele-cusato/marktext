# source-comments-html-open-task8 — Commenti source dopo indent

## Obiettivo

Correggere il posizionamento del commento di linea source: oggi `Ctrl+/`, `Ctrl+K Ctrl+C` e alias collegati possono inserire il marker a inizio riga effettivo. Il comportamento desiderato è stile VS Code: anche con selezione parziale si commenta tutta la riga, ma il marker va dopo l'indent, subito prima del primo testo della riga.

## Prerequisiti bloccanti

- Plan Task2 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task2-plan.md`.
- Worklog Task2 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task2-worklog.md`.
- Plan Task6 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task6-plan.md`.
- Worklog Task6 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task6-worklog.md`.
- Fonte locale addon comment richiesta e leggibile: `node_modules/codemirror/addon/comment/comment.js`.
- Fonte locale CodeMirror mode richiesta e leggibile: `node_modules/codemirror/lib/codemirror.js`.
- File sorgente richiesto e leggibile: `src/renderer/src/components/editorWithTabs/sourceCode.vue`.
- File/cartelle vietate: non toccare drag/tabbar/HTML5 DnD/taskbar/raise/marker; non leggere né modificare segreti esterni al repo.
- Target verifica: parse SFC di `sourceCode.vue` se disponibile; test manuale runtime su righe indentate e selezione parziale.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/sourceCode.vue`
- `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task8-worklog.md`

Non toccare `src/main/windows/editor.js`, Task6 main-side chord, `src/main/filesystem/watcher.js`, Task7, keybindings main, menu, command palette, IPC, drag/tabbar.

## Regole e invarianti rilevanti

- Conservare Task6: `Ctrl+K Ctrl+C/U` deve continuare a funzionare tramite azioni `sourceComment` / `sourceUncomment`.
- Conservare `Ctrl-/`, `Ctrl-K C`, `Ctrl-K U`, `Ctrl-K Ctrl-C`, `Ctrl-K Ctrl-U`, `Cmd-K Cmd-C`, `Cmd-K Cmd-U`.
- Non implementare sintassi commenti hardcoded per ogni linguaggio se CodeMirror mode espone già `lineComment`, `blockCommentStart`, `blockCommentEnd`.
- Anche con selezione parziale, mantenere commento di riga intera come VS Code.
- Usare opzioni CodeMirror `indent: true` per inserire il marker dopo l'indent comune, non a colonna 0.
- Non usare block comment inline per questo task.
- Non cambiare comportamento senza selezione: commentare/decommentare la riga come oggi.
- Gestire selezioni multiple dal basso verso l'alto per evitare spostamenti indice.

## Fatti già verificati

- `sourceCode.vue` usa `applyLineCommentAction(cm, action)` per `Ctrl+K C/U`, `Ctrl+K Ctrl+C/U`, `Cmd-K Cmd-C/U` e azioni Task6 dal main.
- `applyLineCommentAction()` oggi chiama sempre `cm.lineComment(from, to)` per commentare e `cm.uncomment(from, to)` per decommentare.
- `node_modules/codemirror/addon/comment/comment.js` mostra che `lineComment()` lavora per linee.
- In `lineComment()`, con `options.indent` attivo, CodeMirror calcola l'indent comune e sostituisce solo quel prefisso con `baseString + commentString + pad`, quindi il marker va dopo l'indent.
- `CodeMirror.commands.toggleComment` chiama `cm.toggleComment()` senza opzioni; per `Ctrl+/` serve handler esplicito che chiami `cm.toggleComment({ indent: true })`.
- `uncomment(from, to)` rimuove commenti di linea anche quando sono dopo indent.
- Bug utente 2026-07-01: commento inserito a inizio riga invece che subito prima del testo evidenziato; selezionando testo specifico viene commentata tutta la riga.
- Decisione utente 2026-07-01: è accettato che la selezione parziale commenti tutta la riga, come VS Code; resta da correggere solo il posizionamento dopo indent.

## Sottoproblemi in ordine

1. Rileggere `comment.js` e confermare comportamento `lineComment(..., { indent: true })`, `toggleComment({ indent: true })` e `uncomment`.
2. In `sourceCode.vue`, aggiornare helper commenti source perché `comment` usi `cm.lineComment(from, to, { indent: true })`.
3. In `sourceCode.vue`, lasciare `uncomment` su `cm.uncomment(from, to)` se già rimuove correttamente commenti dopo indent; se servono opzioni, passarle in modo coerente e documentato.
4. In `sourceCode.vue`, modificare `Ctrl-/` da `cm.execCommand('toggleComment')` a chiamata esplicita `cm.toggleComment({ indent: true })` o helper equivalente.
5. Conservare tutti i binding Task6/Task4 e il comportamento riga intera con selezione parziale.
6. Conservare `cm.operation()` e iterazione dal basso verso l'alto.
7. Aggiornare worklog task8 con `[x]`, verifiche eseguite e note `DA TESTARE`.

## Verifica richiesta

- Parse SFC di `sourceCode.vue` se disponibile.
- Test manuale atteso:
  - `.js`: su riga indentata `    const x = 1`, `Ctrl+K Ctrl+C` deve produrre `    // const x = 1`, non `//     const x = 1`.
  - `.js`: selezionare solo una parola in mezzo alla riga e premere `Ctrl+K Ctrl+C`: deve commentare tutta la riga, ma marker dopo indent.
  - `.js`: `Ctrl+K Ctrl+U` deve rimuovere quel commento.
  - `.html`: su riga indentata, commento deve restare dopo indent con sintassi commento corretta del mode.
  - `.py`: su riga indentata, commento deve diventare `    # testo`, non `#     testo`.
  - Senza selezione: commento riga resta funzionante con marker dopo indent.
  - `Ctrl+/` e `Ctrl+K Ctrl+C/U` restano funzionanti.
