# source-comments-html-open-task7 — Fix falso file changed dopo save/open HTML

## Obiettivo

Correggere il bug segnalato su file `.html`: dopo salvataggio o dopo `Ctrl+Shift+O`, compare il prompt `file changed on disk` anche senza modifiche esterne. La causa più probabile è il watcher che non ignora correttamente tutti gli eventi prodotti dal save atomico (`tmp + rename`).

## Prerequisiti bloccanti

- Plan Task3 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task3-plan.md`.
- Worklog Task3 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task3-worklog.md`.
- Fonti locali richieste e leggibili: `src/main/filesystem/watcher.js`, `src/main/app/windowManager.js`, `src/main/filesystem/index.js`, `src/main/filesystem/markdown.js`, `src/renderer/src/store/editor.js`, `src/renderer/src/store/listenForMain.js`, `src/main/menu/actions/file.js`, `src/renderer/src/components/editorWithTabs/sourceCode.vue`.
- File/cartelle vietate: non toccare drag/tabbar/HTML5 DnD/taskbar/raise/marker; non leggere né modificare segreti esterni al repo.
- Target verifica: test statico/unitario se disponibile sul watcher; in alternativa verifica statica mirata e test manuale runtime.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/main/filesystem/watcher.js`
- `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task7-worklog.md`

Toccare `src/main/app/windowManager.js` o `src/renderer/src/store/editor.js` solo se, dopo verifica locale, il fix watcher-only risulta insufficiente; in tal caso documentare il motivo nel worklog prima di modificare.

Non toccare Task6 commenti, `src/main/windows/editor.js`, `sourceCode.vue` salvo blocco motivato, keybindings, menu, command palette, drag/tabbar.

## Regole e invarianti rilevanti

- Non cambiare comportamento di apertura browser `Ctrl+Shift+O`: deve restare no-op su file non `.html/.htm` e usare `shell.openExternal(pathToFileURL(...).href)`.
- Non disabilitare watcher per modifiche esterne reali.
- Non nascondere prompt quando il file è davvero modificato fuori dall'app.
- Conservare gestione `unlink`/file removed.
- Preferire fix sul self-save ignore in watcher, non workaround UI nel renderer.
- Evitare soluzioni basate su timeout troppo lunghi se esiste fix più preciso.

## Fatti già verificati

- `Ctrl+Shift+O` invia solo `{ pathname }` e apre con `shell.openExternal(file://...)`; non salva, non scrive, non tocca watcher.
- Save source mode fa `pre-save` e flush del buffer CodeMirror prima di inviare contenuto al main.
- Scrittura su disco usa write atomico: `pathname.tmp` + move/overwrite.
- Watcher registra ignore self-save per circa 1300ms dopo `window-file-saved`.
- In `watcher.js`, `_shouldIgnoreEvent()` consuma l'entry ignore al primo `add/change`; un save atomico può generare più eventi, quindi eventi successivi possono arrivare al renderer e aprire falso prompt.
- Renderer mostra prompt su `add/change` senza confronto contenuto/hash, tranne rami limitati auto-save/isSaved.
- Il bug sembra più legato al save atomico/watcher che a `shell.openExternal`; browser o estensioni esterne restano causa reale possibile ma non provata dal codice.
- Task6 commenti può procedere in parallelo se Task7 resta watcher-only: file disgiunti.

## Sottoproblemi in ordine

1. Rileggere fonti locali indicate e confermare flusso save → `window-file-saved` → ignore watcher → eventi watcher.
2. Analizzare `_shouldIgnoreEvent()` e `_isPendingIgnore()` per capire quando l'entry viene rimossa e quali eventi successivi passano.
3. Modificare il self-save ignore perché ignori tutti gli eventi `add/change` coerenti col path durante la finestra di ignore, non solo il primo evento.
4. Conservare pulizia delle entry scadute per evitare leak.
5. Conservare gestione `unlink` esistente o adattarla senza far sparire notifiche di cancellazione reale fuori finestra.
6. Non cambiare la catena `openInBrowser` salvo evidenza nuova nel codice.
7. Aggiornare worklog task7 con `[x]`, verifiche eseguite e note `DA TESTARE`.

## Verifica richiesta

- Verifica statica JS su `watcher.js` se possibile.
- Se esistono test watcher, eseguirli; altrimenti motivare assenza/non praticabilità.
- Test manuale atteso:
  - Aprire file `.html` esistente locale, modificare in source mode, `Ctrl+S`, attendere almeno 2 secondi: nessun falso prompt `file changed on disk`.
  - Ripetere con browser già aperto sul file.
  - Premere `Ctrl+Shift+O` su `.html/.htm`: browser si apre e non compare prompt se file non cambia esternamente.
  - Modificare davvero file da editor esterno: prompt deve comparire ancora.
  - Ripetere con `.md` e `.js` per verificare nessuna regressione watcher.
