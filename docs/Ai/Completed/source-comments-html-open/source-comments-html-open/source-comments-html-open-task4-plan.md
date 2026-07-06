# source-comments-html-open-task4 — Fix chord commenti source

## Obiettivo

Correggere il comportamento dei commenti source collegato a Task2: supportare la sequenza stile VS Code tenendo premuto Ctrl, cioè `Ctrl+K Ctrl+C` per commentare e `Ctrl+K Ctrl+U` per decommentare, senza rompere `Ctrl+/` né gli alias già implementati.

## Prerequisiti bloccanti

- Plan precedente richiesto e leggibile: `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task2-plan.md`.
- Worklog precedente richiesto e leggibile: `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task2-worklog.md`.
- Fonte locale API CodeMirror richiesta e leggibile: `node_modules/codemirror/src/input/keymap.js` oppure `node_modules/codemirror/lib/codemirror.js`.
- Fonte locale esempio chord richiesta e leggibile: `node_modules/codemirror/keymap/sublime.js`.
- Fonte locale addon comment richiesta e leggibile: `node_modules/codemirror/addon/comment/comment.js`.
- File sensibili/vietati: nessuno indicato per questo task; non leggere né modificare segreti esterni al repo.
- Target verifica: parse SFC di `sourceCode.vue` se disponibile; test runtime manuale in source mode.
- Comandi version control: `Docs/Ai/DECISIONS.md` è vuoto; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control salvo autorizzazione esplicita successiva dell'utente.
- Se uno dei prerequisiti è mancante o ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/sourceCode.vue`
- `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task4-worklog.md`

Non toccare `src/renderer/src/codeMirror/index.js`, keybindings main, menu, command palette, IPC, T-M5, drag/tabbar.

## Regole e invarianti rilevanti

- Task collegato a Task2; non riscrivere l'infrastruttura commenti già aggiunta.
- Mantenere `Ctrl-/` invariato.
- Mantenere `Ctrl-K C` e `Ctrl-K U` come alias compatibili se non causano conflitti.
- Aggiungere `Ctrl-K Ctrl-C` e `Ctrl-K Ctrl-U` perché, tenendo Ctrl premuto, CodeMirror riceve `Ctrl-C`/`Ctrl-U` come seconda battuta.
- Non reintrodurre accelerator main `Ctrl+K` per `view.toggle-toc`.
- Commenti source-only: nessun impatto su Muya.
- Non implementare sintassi commenti manuale per linguaggio: usare `applyLineCommentAction` e addon CodeMirror già verificati.

## Fatti già verificati

- `sourceCode.vue` oggi binda `Ctrl-/`, `Ctrl-K C`, `Ctrl-K U` nelle `extraKeys`.
- Test utente 2026-07-01: tenere Ctrl e premere `K`, poi `C`, non commenta come VS Code; rilasciare Ctrl e premere `C` rischia di scrivere `C`.
- CodeMirror 5 supporta chord multi-stroke con nomi separati da spazio tramite `normalizeKeyMap`.
- Esempio locale in `node_modules/codemirror/keymap/sublime.js`: chord come `Ctrl-K Ctrl-C`, `Ctrl-K Ctrl-U`.
- Addon locale comment espone `toggleComment`, `lineComment`, `blockComment`, `uncomment`.

## Sottoproblemi in ordine

1. Rileggere le fonti locali CodeMirror indicate nei prerequisiti e confermare sintassi chord.
2. In `sourceCode.vue`, aggiungere in `extraKeys` mapping `Ctrl-K Ctrl-C` verso `applyLineCommentAction(cm, 'comment')`.
3. In `sourceCode.vue`, aggiungere in `extraKeys` mapping `Ctrl-K Ctrl-U` verso `applyLineCommentAction(cm, 'uncomment')`.
4. Lasciare invariati `Ctrl-K C`, `Ctrl-K U` e `Ctrl-/`, salvo conflitto documentato dalle fonti locali.
5. Verificare che non siano state toccate keybindings main o menu.
6. Aggiornare worklog task4 con `[x]`, verifiche eseguite e note `DA TESTARE` runtime.

## Verifica richiesta

- Verifica statica SFC se disponibile.
- Controllare che in `sourceCode.vue` esistano sia `Ctrl-K Ctrl-C/U` sia gli alias precedenti.
- Test manuale atteso:
  - In `.js`, tenere Ctrl: `Ctrl+K`, poi `Ctrl+C` deve aggiungere `//`.
  - In `.js`, tenere Ctrl: `Ctrl+K`, poi `Ctrl+U` deve rimuovere `//`.
  - In `.html`, commento deve usare `<!-- -->`.
  - In `.py`, commento deve usare `#`.
  - `Ctrl+/` deve restare funzionante.
  - `Ctrl+K` solo non deve aprire TOC/sidebar.
