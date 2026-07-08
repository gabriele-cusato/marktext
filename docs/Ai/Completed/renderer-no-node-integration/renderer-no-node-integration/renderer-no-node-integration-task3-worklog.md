# renderer-no-node-integration — task3 — worklog: context menu nel main + fine `@electron/remote`

## Stato: DA TESTARE
Tutte le caselle completate. Non buildato/avviato per vincolo del plan (nessun comando di build/run
richiesto in questo task).

## Avanzamento
- [x] Grep iniziale: `@electron/remote` nel renderer resta solo nei 2 index dei context menu
  - Esito: confermato, solo `contextMenu/tabs/index.js:1` e `contextMenu/sideBar/index.js:1`.
- [x] Main: handler `mt::popup-context-menu` in `menu/index.js` (verificati import)
  - Import BrowserWindow/Menu/ipcMain già presenti; aggiunto handler dopo `mt::popup-app-menu`.
- [x] `sideBar/index.js`: riscrittura async + `SIDEBAR_DISPATCH`, rimosso import remote
- [x] `tabs/index.js`: riscrittura async + `TABS_DISPATCH`, rimosso import remote
- [x] Rimozione init/enable `@electron/remote` lato main (editor.js, setting.js, index.js), package.json invariato
  - Rimossi import + chiamate `remoteEnable`/`remoteInitializeServer` nei 3 file; package.json non toccato.
- [x] Verifica statica finale: `@electron/remote` = ZERO nel renderer; residui main rimossi
  - Esito: `grep "@electron/remote" src/` → ZERO in `src/renderer/**`. Residui in `src/main`: solo
    commenti (windowManager.js:415, menu/index.js:430,439) che citano `@electron/remote` a scopo
    storico/documentativo, nessun import o chiamata attiva. `package.json` non toccato (dipendenza
    resta dichiarata, ma non più usata in `src/`; rimozione dipendenza fuori scope task3).

## Test
(Da compilare dall'orchestratore dopo il test utente.)
