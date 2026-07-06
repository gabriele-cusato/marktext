# drag-html5-dnd-task4 — worklog

## Esito: CHIUSO COME ASSORBITO DA TASK3 (2026-07-03, decisione a feature completata)

Il requisito funzionale del task (spostare una tab su un'altra finestra MarkText
esistente) è risultato GIÀ coperto dall'implementazione di task3: il ramo detach di
`onTabDragEnd` invia sempre le coordinate schermo a `mt::detach-tab`, e il main
(`_findEditorWindowAt`) dirotta la tab alla finestra esistente sotto il punto di rilascio
via `mt::receive-detached-tab` → `INSERT_DETACHED_TAB` (con inserimento all'indice
calcolato dalle coordinate). Testato PASS dall'utente (2026-07-03, round 5/6/9 di task3):
migrazione cross-finestra funzionante, incluso il caso ultima-tab con auto-chiusura della
secondaria. Non è quindi servito il trigger dedicato ipotizzato dal plan.

## Avanzamento

- [x] Chiarire meccanismo di rilevamento cross-finestra nativo (IPC necessario o no).
      Risolto de facto in task3: nessun `drop` nativo cross-finestra necessario — la
      decisione avviene al `dragend` nella sorgente (coordinate schermo) e il routing lo
      fa il main con `_findEditorWindowAt`. Il `dataTransfer` non deve attraversare i
      renderer.
- [x] Correggere selettore `v2-tab-pinned`→`is-pinned` e rimuovere filtro `.gu-mirror`
      obsoleto in `INSERT_DETACHED_TAB` (`store/editor.js` ~1042). FATTO (orchestratore,
      2026-07-03, chiusura feature): `li.v2-tab:not(.is-pinned)`, commento esplicativo.
      `node --check` OK.
- [ ] ~~Implementare trigger drop su finestra esistente~~ — non necessario (vedi sopra).
- [ ] **Indicatore d'inserimento cross-finestra nella finestra destinazione: NON
      implementato.** Unico punto di parità VS Code rimasto fuori: durante il drag sopra
      la tab bar di un'altra finestra non compare la lineetta (la tab viene comunque
      inserita all'indice corretto al rilascio). Richiederebbe un canale IPC di notifica
      dragover cross-finestra. Rimandato: riaprire solo su richiesta utente.
- [x] Pulizia stato locale su entrambe le finestre: già coperta dai percorsi task3
      (reset/ricalcolo al dragend sorgente; `INSERT_DETACHED_TAB` lato destinazione).
- [x] Verifica statica: `node --check store/editor.js` OK (fix selettore).

## Test

- Migrazione cross-finestra (anche ultima-tab): PASS utente 2026-07-03 (vedi worklog
  task3, round 5/6/9).
- H5-RE-BUG1 (ri-drag tab omonime): non ri-osservato dall'utente nei test della
  migrazione nativa; considerato dissolto con la rimozione di dragula (nessun match
  manuale screenX/id). Riaprire solo se il sintomo ricompare.
- Indicatore cross-finestra: non testabile (non implementato, vedi sopra).
