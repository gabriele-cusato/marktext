# folder-search — task2 — worklog

Plan: `folder-search-task2-plan.md`.

## Avanzamento
- [x] Canale `mt::open-folder-search-window` + riuso funzione di ricerca del task1 (no duplicazione)
- [x] `_createFolderSearchWindow` sul pattern `_createDetachWindow` (bypass gate single-window)
- [x] Consegna stato ricerca al renderer (restore o canale post-bootstrap dedicato)
- [x] Apertura max 20 tab con `openTabsFromPaths`
- [x] Naming pulito `folder-search` (no riuso `edit.find-in-folder`)

## Meccanismo di consegna scelto (per il task3)

Canale dedicato **`mt::folder-search-state`** (`win.webContents.send`), inviato dal main
DENTRO l'handler esistente `mt::request-session-restore` (`src/main/app/index.js`), in un nuovo
branch analogo a quello di `_detachTab`:

- Condizione: `editorWin._folderSearchState` valorizzato (stashato da `_createFolderSearchWindow`
  su `editor._folderSearchState = { directory, query, options, results, truncated }`).
- Il branch NON invia `mt::restore-session` (evitato apposta: con `tabs: []` la RESTORE_SESSION
  del renderer farebbe scattare `NEW_UNTITLED_TAB` — blank tab indesiderata). Le tab vengono
  aperte invece con `editorWin.openTabsFromPaths(firstFiles)` (canale `mt::open-new-tab`,
  indipendente, gestisce da solo watcher + recently-used via `_doOpenTab`).
- Subito dopo: `win.webContents.send('mt::folder-search-state', state)` con
  `state = { directory, query, options, results, truncated }` (results COMPLETI, non solo i
  primi 20 — la sidebar del task3 li mostra tutti, l'apertura oltre i 20 è on-demand al click).
- Trigger lato renderer per raggiungere questo branch: la finestra ha `_isRestoreSession = true`
  (come detach) → al bootstrap il renderer manda comunque `mt::request-session-restore` (stesso
  meccanismo esistente in `LISTEN_FOR_SESSION`/bootstrap-editor, isRestore=true). Il task3 deve
  solo aggiungere un listener `window.electron.ipcRenderer.on('mt::folder-search-state', ...)`
  lato renderer (nessuna altra modifica al bootstrap necessaria).

Nessuna modifica al preload: `ipcRenderer` è esposto senza whitelist per canale (verificato,
`src/preload/index.js`), quindi sia `invoke('mt::open-folder-search-window', ...)` sia
`on('mt::folder-search-state', ...)` sono già chiamabili dal renderer.

`openTabsFromPaths` (`src/main/windows/editor.js:377`), firma verificata:
`openTabsFromPaths(filePaths: string[])` — nessun secondo parametro; apre tab per ciascun path,
seleziona il primo.

## Test
Build `electron-vite build` eseguita: OK, nessun errore (main+preload+renderer compilati).
Esito utente (2026-07-12/13, PC principale): OK — verifica end-to-end insieme a task3/task4,
nessuna anomalia riportata. Chiuso.
