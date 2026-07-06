# source-comments-html-open-task3 — worklog

## Avanzamento

- Stato task: DA TESTARE

- [x] FATTO - Aggiungere command id/descrizione/static command per open in browser.
- [x] FATTO - Aggiungere voce menu/action edit con `Ctrl+Shift+O`.
- [x] FATTO - Aggiungere keybinding `Ctrl+Shift+O` nelle tre piattaforme se richiesto dal pattern.
- [x] FATTO - Aggiungere routing renderer `openInBrowser` con guardia `.html/.htm`.
- [x] FATTO - Aggiungere IPC main `mt::open-file-in-browser` con `shell.openExternal(pathToFileURL(...).href)`.
- [x] FATTO - Verificare staticamente/buildare e riportare esito.

## Test

- Verifica statica FATTO: controllo riferimenti `edit.open-in-browser`/`openInBrowser`/`mt::open-file-in-browser` su file renderer/main/menu/keybindings/locales.
- Verifica statica FATTO: controllata assenza conflitti shortcut con ricerca su keybindings (`Ctrl+Shift+O` libero; assegnato anche `Shift+Command+O` su macOS).
- Verifica sintassi FATTO: `node --check` sui file JS toccati dal task e parse JSON di `static/locales/en.json` ok.
- Build DA TESTARE: eseguito `npm run build`, comando bloccato da sistema con errore `Il programma è bloccato dai Criteri di gruppo. Per ulteriori informazioni, contattare l'amministratore del sistema.`.
- Test manuale utente DA TESTARE: non eseguibile in questo ambiente.
- Risultato test utente 2026-07-01: `Ctrl+Shift+O` funziona; il browser viene aperto.
- Bug da verificare 2026-07-01: su un file `.html` usato per test colori/source mode, a volte il file non si riesce a salvare correttamente.
- Bug da verificare 2026-07-01: poco dopo il salvataggio o dopo `Ctrl+Shift+O`, compare il prompt `file changed on disk` anche se l'utente non ha modificato il file esternamente.
- Da analizzare: possibile interazione tra apertura `.html/.htm` nel browser, salvataggio/source mode, watcher file e rilevamento modifiche esterne.
