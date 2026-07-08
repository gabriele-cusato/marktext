# renderer-no-node-integration — task2 — worklog: rimuovere `@electron/remote` (parte meccanica)

## Avanzamento
- [x] Main: `mt::window-toggle-full-screen` + `mt::window-state` (windowManager.js)
- [x] Main: `mt::popup-app-menu` (menu/index.js)
- [x] `util/clipboard.js`: remoteClipboard → `window.electron.clipboard`, rimosso import
- [x] `commands/index.js`: minimize/fullscreen via IPC, rimosso import getCurrentWindow
- [x] `prefComponents/common/titlebar.vue`: close via `mt::cmd-close-window`, rimosso import
- [x] `titleBar/index.vue`: stato iniziale via `mt::window-state`, close/minimize/maximize/app-menu via IPC, rimosso import remote (listener `mt::window-*` invariati)
- [x] Verifica statica: `@electron/remote` nel renderer resta SOLO nei 2 file dei context menu (task3)

TASK: DA TESTARE

## Verifica firma `mt::cmd-close-window`
Confermato in `src/main/menu/actions/file.js:570-573`: l'handler deriva la finestra da `e.sender`
(`BrowserWindow.fromWebContents(e.sender)`), nessun argomento windowId richiesto. Nessuna modifica
necessaria alla firma; usato invariato da `window.electron.ipcRenderer.send('mt::cmd-close-window')`.

## Esito grep di verifica (sottoproblema 7)
`grep -n "@electron/remote" src/renderer/src` → residui SOLO in:
- `src/renderer/src/contextMenu/tabs/index.js:1`
- `src/renderer/src/contextMenu/sideBar/index.js:1`

Nessun altro residuo nel renderer. Corrisponde all'atteso (task3).

## Test
(Da compilare dall'orchestratore dopo il test utente.)
