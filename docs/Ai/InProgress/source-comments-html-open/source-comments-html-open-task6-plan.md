# source-comments-html-open-task6 — Fix chord commenti source intercettati dal main

## Obiettivo

Correggere il bug residuo di Task4: `Ctrl+K Ctrl+C` e `Ctrl+K Ctrl+U` in source mode non commentano/decommentano perché il secondo stroke viene intercettato dagli shortcut globali finestra (`Ctrl+C` copy, `Ctrl+U` lowercase) prima di CodeMirror.

## Prerequisiti bloccanti

- Plan precedente richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task2-plan.md`.
- Worklog precedente richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task2-worklog.md`.
- Plan fix precedente richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task4-plan.md`.
- Worklog fix precedente richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task4-worklog.md`.
- Fonti locali richieste e leggibili: `src/main/windows/editor.js`, `src/main/keyboard/shortcutHandler.js`, `src/renderer/src/components/editorWithTabs/sourceCode.vue`, `src/renderer/src/store/listenForMain.js`, `node_modules/codemirror/lib/codemirror.js`, `node_modules/codemirror/keymap/sublime.js`.
- File/cartelle vietate: non toccare drag/tabbar/HTML5 DnD/taskbar/raise/marker; non leggere né modificare segreti esterni al repo.
- Target verifica: parse/static check JS/Vue sui file toccati se disponibile; test runtime manuale in source mode.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/main/windows/editor.js`
- `src/renderer/src/components/editorWithTabs/sourceCode.vue`
- `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task6-worklog.md`

Non toccare `src/main/filesystem/watcher.js`, fix HTML/save Task7, keybindings main, menu, command palette, IPC generici non necessari, drag/tabbar.

## Regole e invarianti rilevanti

- Conservare `Ctrl-/`, `Ctrl-K C`, `Ctrl-K U`, `Ctrl-K Ctrl-C`, `Ctrl-K Ctrl-U` già presenti in CodeMirror come fallback.
- Non reintrodurre accelerator main `Ctrl+K` per `view.toggle-toc`.
- Non disabilitare `Ctrl+C` copy o `Ctrl+U` lowercase fuori dalla sequenza chord source.
- Gestire il chord nel main prima di `electron-localshortcut` solo quando il focus è dentro CodeMirror source mode.
- Se il focus non è source mode, non consumare `Ctrl/Cmd+K` né i tasti successivi.
- Usare timeout/cancel del prefisso `Ctrl/Cmd+K` per evitare stato appeso.
- Commenti source-only: nessun impatto su Muya.
- Non implementare sintassi commenti manuale per linguaggio: continuare a usare `applyLineCommentAction` e addon CodeMirror già verificati.

## Fatti già verificati

- Task4 ha aggiunto correttamente `Ctrl-K Ctrl-C` e `Ctrl-K Ctrl-U` in `sourceCode.vue`, ma test utente dice che non risolve.
- CodeMirror 5.65 supporta multi-stroke con `normalizeKeyMap`; `sublime.js` locale usa `Ctrl-K Ctrl-C/U` e `Cmd-K Cmd-C/U`.
- `electron-localshortcut` registra shortcut globali su `before-input-event` e fa `preventDefault()`.
- `src/main/keyboard/keybindingsWindows.js` e Linux hanno `edit.copy = Ctrl+C` e `edit.to-lowercase = Ctrl+U`; Darwin ha `Command+C` e `Command+U`.
- `view.toggle-toc` è già senza accelerator, quindi il problema non sembra il primo stroke `Ctrl+K`.
- `src/renderer/src/store/listenForMain.js` inoltra tipi `mt::editor-edit-action` al bus renderer; si può riusare per `sourceComment` / `sourceUncomment` se non serve nuovo canale.
- Task7 HTML/save consigliato tocca `src/main/filesystem/watcher.js`; disgiunto da questo task se Task6 resta su `editor.js` + `sourceCode.vue`.

## Sottoproblemi in ordine

1. Rileggere fonti locali indicate nei prerequisiti e confermare ordine `before-input-event` / shortcut globali.
2. In `sourceCode.vue`, tracciare focus source CodeMirror e comunicare al main quando il focus entra/esce dal source editor con IPC minimale dedicato o canale esistente sicuro.
3. In `editor.js`, mantenere stato per finestra: source focus attivo, chord prefix `Ctrl/Cmd+K` pending, timer breve di reset.
4. In `editor.js`, dentro `before-input-event`, se source focus è attivo e arriva `Ctrl/Cmd+K`, impostare prefix pending e consumare l'evento.
5. In `editor.js`, se prefix pending e arriva `C` con `Ctrl/Cmd`, consumare l'evento e inviare al renderer azione source comment.
6. In `editor.js`, se prefix pending e arriva `U` con `Ctrl/Cmd`, consumare l'evento e inviare al renderer azione source uncomment.
7. In `editor.js`, su altri tasti/blur/timeout, resettare prefix senza rompere gli shortcut globali normali.
8. In `sourceCode.vue`, gestire le azioni source comment/uncomment ricevute dal bus/main chiamando `applyLineCommentAction(cm, 'comment')` o `applyLineCommentAction(cm, 'uncomment')`, solo se editor CodeMirror esiste e source mode è attivo.
9. Aggiungere varianti `Cmd-K Cmd-C` e `Cmd-K Cmd-U` negli `extraKeys` CodeMirror come fallback macOS, senza rimuovere varianti esistenti.
10. Aggiornare worklog task6 con `[x]`, verifiche eseguite e note `DA TESTARE`.

## Verifica richiesta

- Verifica statica dei file toccati se possibile (`node --check` su JS; parse SFC se disponibile).
- Controllare staticamente che `Ctrl+C`/`Ctrl+U` normali restino registrati e non vengano consumati senza prefix source.
- Test manuale atteso:
  - In `.js` source mode, tenere Ctrl: `Ctrl+K`, poi `Ctrl+C` deve aggiungere `//`.
  - In `.js` source mode, tenere Ctrl: `Ctrl+K`, poi `Ctrl+U` deve rimuovere `//`.
  - In `.html`, commento deve usare `<!-- -->`.
  - In `.py`, commento deve usare `#`.
  - `Ctrl+/` deve restare funzionante.
  - `Ctrl+C` normale deve continuare a copiare quando non preceduto da `Ctrl+K`.
  - `Ctrl+U` normale deve continuare a fare lowercase dove previsto quando non preceduto da `Ctrl+K`.
  - `Ctrl+K` solo non deve aprire TOC/sidebar e non deve bloccare shortcut successivi dopo timeout.
