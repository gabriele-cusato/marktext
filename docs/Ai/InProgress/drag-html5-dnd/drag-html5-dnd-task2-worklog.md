# drag-html5-dnd-task2 — worklog

## Avanzamento

- [ ] Ri-confermare punti cablaggio dragula attuale (righe possono essere shiftate).
- [ ] Aggiungere `draggable`/`dragstart` su `.v2-tab`.
- [ ] Aggiungere `dragover` con indicatore d'inserimento e calcolo indice.
- [ ] Aggiungere `drop` con mutazione store (no manipolazione DOM diretta).
- [ ] Aggiungere `dragend` con `tabsRenderKey`++/`recomputePinnedTab`/`updateTabRowsLayout`.
- [ ] Implementare clamp pinned + fix selettore `v2-tab-pinned`→`is-pinned`.
- [ ] Decidere/documentare approccio autoscroll.
- [ ] Rimuovere cablaggio dragula non più necessario per il reorder interno (con cautela su parti condivise col detach).
- [ ] Verificare staticamente e riportare esito.

## Test

DA TESTARE lato utente: reorder tab stessa finestra (indicatore, drop, clamp pinned), nessun `.el` stale, layout multi-riga invariato, autoscroll se implementato.
