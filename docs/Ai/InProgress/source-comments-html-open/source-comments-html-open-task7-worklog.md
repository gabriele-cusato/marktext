# source-comments-html-open-task7 — worklog

## Avanzamento

- [ ] Confermare flusso save → `window-file-saved` → ignore watcher → eventi watcher.
- [ ] Analizzare consumo entry in `_shouldIgnoreEvent()` / `_isPendingIgnore()`.
- [ ] Fare ignorare tutti gli eventi self-save coerenti durante finestra di ignore.
- [ ] Conservare pulizia entry scadute e notifiche di modifiche esterne reali.
- [ ] Verificare staticamente e riportare esito.

## Test

DA TESTARE lato utente: dopo `Ctrl+S` su `.html` source mode e dopo `Ctrl+Shift+O`, nessun falso prompt `file changed on disk`; modifica esterna reale deve continuare a mostrare prompt.
