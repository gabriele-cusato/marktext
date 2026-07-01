# drag-html5-dnd-task3 — worklog

## Avanzamento

- [ ] Ri-confermare punti rilevamento H5-2 attuale (righe possono essere shiftate).
- [ ] Rimuovere `lastDragScreen`/`onDragMove`/listener `mousemove` globale.
- [ ] Aggiungere ramo `dropEffect === 'none'` → `DETACH_TAB` nel `dragend` HTML5.
- [ ] Verificare/documentare eventuale bounds-check residuo lato main per posizionamento finestra.
- [ ] Pulire stato locale drag dopo detach.
- [ ] Verificare staticamente e riportare esito.

## Test

DA TESTARE lato utente: drop fuori finestra → nuova finestra con tab corretta (anche dirty/untitled); nessuna tab fantasma; distinzione corretta da drop su altra finestra MarkText (task4).
