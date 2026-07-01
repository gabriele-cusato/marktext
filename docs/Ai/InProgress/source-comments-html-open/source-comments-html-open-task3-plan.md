# source-comments-html-open-task3 — T-M5 Apri HTML nel browser

## Obiettivo

Implementare T-M5: aggiungere comando dedicato `Ctrl+Shift+O` per aprire il file corrente `.html/.htm` nel browser di sistema.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/common/commands/constants.js`
- `src/renderer/src/commands/descriptions.js`
- `src/renderer/src/commands/index.js`
- `src/main/menu/templates/edit.js`
- `src/main/menu/actions/edit.js`
- `src/main/keyboard/keybindingsWindows.js`
- `src/main/keyboard/keybindingsLinux.js`
- `src/main/keyboard/keybindingsDarwin.js`
- `src/renderer/src/store/listenForMain.js`
- `src/main/menu/actions/file.js`
- `static/locales/en.json` solo se il pattern menu/comandi lo richiede
- `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task3-worklog.md`

Non toccare CodeMirror mode/commenti, source editor behaviour, drag/tabbar.

## Regole e invarianti rilevanti

- Usare catena analoga a `edit.find-in-folder`: main action edit → `mt::editor-edit-action` → renderer router.
- `Ctrl+Shift+O` è shortcut scelta; `Ctrl+Shift+B` è occupato e non va usato.
- I non-.md restano editabili in source; questa feature apre solo `.html/.htm` nel browser.
- Se file corrente non è HTML o non ha `pathname`, fare no-op silenzioso.
- Validare estensione sia lato renderer sia lato main.
- Usare `shell.openExternal(pathToFileURL(pathname).href)`, non `shell.openPath()`.
- Testare path con spazi.
- Non toccare drag/HTML5 DnD/taskbar/raise/marker.

## Fatti già verificati

- Esiste catena simile per `edit.find-in-folder` in `menu/actions/edit.js`, `menu/templates/edit.js`, `store/listenForMain.js`.
- Non esiste branch `openInBrowser` in `listenForMain.js`.
- Non esiste IPC `mt::open-file-in-browser`.
- `src/main/menu/actions/file.js` importa già `shell`; può servire import `pathToFileURL` da `url`.
- `shell.openPath` aprirebbe app associata, non browser; non usarlo.

## Sottoproblemi in ordine

1. Aggiungere command id per open in browser in `src/common/commands/constants.js`, seguendo pattern esistente.
2. Aggiungere descrizione comando in `src/renderer/src/commands/descriptions.js`.
3. Aggiungere static command in `src/renderer/src/commands/index.js` se il pattern corrente lo richiede.
4. Aggiungere voce menu in `src/main/menu/templates/edit.js` con accelerator `Ctrl+Shift+O` e label coerente.
5. Aggiungere action in `src/main/menu/actions/edit.js` che invia `edit(win, 'openInBrowser')`.
6. Aggiungere keybinding `Ctrl+Shift+O` nelle tre keymap se richiesto dal pattern.
7. In `src/renderer/src/store/listenForMain.js`, intercettare `openInBrowser` prima del fallback `bus.emit`; se current file `.html/.htm`, inviare `mt::open-file-in-browser` con pathname.
8. In `src/main/menu/actions/file.js`, registrare `ipcMain.on('mt::open-file-in-browser', ...)`; validare `.html/.htm`; aprire con `shell.openExternal(pathToFileURL(pathname).href)`.
9. Aggiornare locale `en.json` solo se pattern richiede stringa i18n.
10. Aggiornare worklog task3 con `[x]`, eventuali `DA TESTARE`, comandi eseguiti o note.

## Verifica richiesta

- Controllare che `Ctrl+Shift+O` non confligga con keybinding esistenti.
- Eseguire build/test ragionevoli se possibile.

## Test manuale atteso

- Aprire file `.html` con path contenente spazi e premere `Ctrl+Shift+O`: deve aprirsi nel browser.
- Ripetere con `.htm`.
- Premere `Ctrl+Shift+O` su `.js`, `.md`, untitled: no-op senza errori visibili.
- Verificare che file HTML resti editabile in source.
