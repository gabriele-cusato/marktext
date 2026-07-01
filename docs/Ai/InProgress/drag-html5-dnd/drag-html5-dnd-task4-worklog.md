# drag-html5-dnd-task4 — worklog

## Avanzamento

- [ ] Chiarire meccanismo di rilevamento cross-finestra nativo (IPC necessario o no) — documentare scelta con fonte.
- [ ] Ri-confermare punti `INSERT_DETACHED_TAB`/`LISTEN_FOR_SESSION`/routing IPC (righe possono essere shiftate).
- [ ] Correggere selettore `v2-tab-pinned`→`is-pinned` e rimuovere filtro `.gu-mirror` obsoleto.
- [ ] Implementare trigger drop su finestra esistente (distinto da task2/task3).
- [ ] Implementare indicatore d'inserimento cross-finestra nella finestra destinazione.
- [ ] Gestire ack per chiusura tab sorgente solo dopo conferma.
- [ ] Pulire stato locale drag su entrambe le finestre dopo il drop.
- [ ] Verificare staticamente e riportare esito.

## Test

DA TESTARE lato utente: drop cross-finestra su finestra esistente (indicatore, indice corretto, dirty/untitled, clamp pinned) + esito osservato su H5-RE-BUG1 (tab omonime).
