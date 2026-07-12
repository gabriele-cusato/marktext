# folder-search — task2 (finestra risultati `_createFolderSearchWindow`) — plan — 2026-07-12

Riferimento generale: `folder-search-plan.md`.

## Obiettivo del task
Aprire una NUOVA finestra editor con: le tab aperte sui primi file trovati (max 20) e lo stato di
ricerca (query + risultati completi) consegnato al renderer per la sidebar (ramo del task3).
Solo main process.

## Prerequisiti bloccanti
- Questo plan + worklog `folder-search-task2-worklog.md`.
- Leggere PRIMA `docs/Ai/Completed/drag-detach-multi-window/drag-detach-multi-window.md`
  (invarianti multi-finestra; se il path differisce cercarlo con fd in Completed).
- Pattern di riferimento VERIFICATO: `_createDetachWindow` (`src/main/app/index.js:639-649`) —
  bypass del gate single-window (`_createEditorWindow` con `sessionSnapshotEnabled` redirige
  sempre alla finestra esistente, righe 570-603), `_isRestoreSession = true`, stash dati su
  istanza (`_detachTab`), consumo in `mt::request-session-restore` (righe 990-1063).
- Contratto dati dal task1 (vedi `folder-search-task1-plan.md`, sezione Contratto).
- VIETATO version control; NIENTE build (build unica finale).

## Sottoproblemi (in ordine)
1. Canale d'innesco: `ipcMain.handle('mt::open-folder-search-window', (e, { directory, query,
   options }))` in app/index.js: esegue la ricerca invocando la STESSA logica del task1
   (estrarre/riusare la funzione interna, non duplicare il codice rg: se serve, esportare dal
   dataCenter una funzione richiamabile oltre all'handler IPC) e poi apre la finestra coi
   risultati. Ritorna al chiamante `{ ok, error }` (per il riquadro errore dell'overlay).
2. `_createFolderSearchWindow(directory, query, options, results)`: come `_createDetachWindow` —
   `new EditorWindow`, `_isRestoreSession = true`, stash su istanza (`_folderSearchState`).
3. Consegna stato al renderer: in `mt::request-session-restore` (o messaggio post-restore
   dedicato `mt::folder-search-state` inviato dopo il bootstrap — scegliere la via più pulita
   guardando come `_detachTab` viene consumato), consegnare `{ directory, query, options,
   results, truncated }`.
4. Apertura tab: primi 20 file di `results` (ordine di arrivo) aperti nella finestra nuova con
   `openTabsFromPaths` (`src/main/windows/editor.js:377`). Gli altri file restano SOLO nei
   risultati sidebar (li aprirà il click, task3).
5. Naming: NON riusare `edit.find-in-folder` (trappola nota: quel comando storico è la ricerca
   nelle tab aperte). Tutti i canali nuovi con nomi `folder-search`.

## Regole
- File attesi: `src/main/app/index.js`, `src/main/windows/editor.js` (solo se serve),
  `src/main/dataCenter/index.js` SOLO per l'eventuale export della funzione di ricerca del task1.
- Commenti in italiano, forma all'infinito.

## Skill di codice
`coding-standard`.
