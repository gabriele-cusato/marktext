# renderer-no-node-integration — task2 — plan: rimuovere `@electron/remote` (parte meccanica)

## Obiettivo
Rimuovere l'uso di `@electron/remote` dai file dove la sostituzione è meccanica o richiede solo un
piccolo canale IPC nuovo: **window controls** (close/minimize/maximize/fullscreen), **stato finestra**
iniziale, **popup dell'application menu**, **clipboard**. I DUE context menu (sideBar/tabs) NON sono
qui: sono il task3 (round-trip IPC più complesso). La rimozione dell'inizializzazione remote lato main
è nel task3 (dopo che nessun file renderer usa più remote).

## Prerequisiti bloccanti
- Devono esistere i canali IPC già verificati (esplorazione 2026-07-07):
  - `mt::minimize-window`, `mt::maximize-window`, `mt::window-toggle-always-on-top` (`src/main/app/windowManager.js` ~359-413, derivano la finestra da `e.sender`).
  - `mt::cmd-close-window` (`src/main/menu/actions/file.js:570-573`) → chiusura **graceful** (win.close() → flusso ask-for-close). USARE QUESTO per il close, NON `mt::close-window` (che è forceClose, marcato BUG).
  - Eventi main→renderer già esistenti: `mt::window-maximize/unmaximize/enter-full-screen/leave-full-screen` (`src/main/windows/editor.js:311-315`), GIÀ ascoltati da `titleBar/index.vue` (righe ~317-320). NON toccarli.
- `window.electron.clipboard` deve esporre il modulo `clipboard` nativo di Electron (verificato: `src/preload/index.js` customElectronAPI importa `clipboard` da 'electron' → ha `.has()/.read()`).
- `window.electron.ipcRenderer` deve essere disponibile nel renderer (pattern già in uso: `store/layout.js:17-18` fa `window.electron.ipcRenderer.send(...)`).
- NON toccare: i context menu (`src/renderer/src/contextMenu/**` → task3), `fileSystem.js`/`node/`/`pdf.js`/`exportSettings` (task4), `src/main/config.js` e il plugin Vite (task5). NON rimuovere ancora l'init remote lato main (task3).
- NON buildare né avviare l'app. VIETATO qualsiasi comando git. Skill: `coding-standard`.

## File da toccare
Renderer:
1. `src/renderer/src/util/clipboard.js` — righe 3,6,13,22.
2. `src/renderer/src/commands/index.js` — righe 2, 445-463.
3. `src/renderer/src/prefComponents/common/titlebar.vue` — righe 20, 23-25.
4. `src/renderer/src/components/titleBar/index.vue` — righe 160 (import), 226-227 (init stato), close/minimize/maximize handlers (~269,290,293-296).
Main:
5. `src/main/app/windowManager.js` — aggiungere 2 handler nuovi vicino agli altri `mt::window-*`.
6. `src/main/menu/index.js` — aggiungere 1 handler per il popup dell'application menu.

## Decisioni di design (già prese — NON improvvisarne altre)

### Clipboard (meccanico)
`util/clipboard.js`: rimuovere `import { clipboard as remoteClipboard } from '@electron/remote'`;
sostituire ogni `remoteClipboard` con `window.electron.clipboard`. Nessun IPC/main. Semantica identica.

### commands/index.js
- Rimuovere `import { getCurrentWindow } from '@electron/remote'`.
- `window.minimize` (446-449): `window.electron.ipcRenderer.send('mt::minimize-window')`.
- `window.toggle-always-on-top` (451-456): **già IPC**, lasciare invariato.
- `window.toggle-full-screen` (457-463): `window.electron.ipcRenderer.send('mt::window-toggle-full-screen')` (canale NUOVO, vedi main).

### prefComponents/common/titlebar.vue
- Rimuovere `import { getCurrentWindow } from '@electron/remote'`.
- `handleCloseClick`: `window.electron.ipcRenderer.send('mt::cmd-close-window')` (graceful).

### components/titleBar/index.vue
- Rimuovere l'import di `getCurrentWindow`/`Menu` da `@electron/remote` (riga ~160). NON rimuovere l'ascolto degli eventi `mt::window-*` (resta).
- **Stato iniziale (226-227)**: sostituire le letture sincrone `getCurrentWindow().isFullScreen()`/`isMaximized()` con una richiesta IPC request/response al mount:
  ```js
  const { isMaximized: initMax, isFullScreen: initFs } = await window.electron.ipcRenderer.invoke('mt::window-state')
  ```
  Inizializzare i ref `isMaximized`/`isFullScreen` con questi valori. Se il setup del componente non è
  già async, ottenere lo stato dentro `onMounted` (async) e assegnare ai ref, con default `false` prima
  della risposta. Gli aggiornamenti live restano gestiti dai listener `mt::window-*` esistenti.
- **close**: `window.electron.ipcRenderer.send('mt::cmd-close-window')` (graceful, NON forceClose).
- **minimize**: `window.electron.ipcRenderer.send('mt::minimize-window')`.
- **maximize (`handleMaximizeClick`)**: il ref reattivo `isFullScreen` è già aggiornato via IPC → usarlo
  localmente per decidere, senza remote:
  - se `isFullScreen.value` è true → `window.electron.ipcRenderer.send('mt::window-toggle-full-screen')` (esce dal fullscreen);
  - altrimenti → `window.electron.ipcRenderer.send('mt::maximize-window')` (toggle maximize).
  Preservare la logica condizionale attuale di `handleMaximizeClick`, cambiando solo la sorgente dello
  stato (ref locale invece di `getCurrentWindow().isFullScreen()`) e l'azione (IPC invece di remote).
- **app menu popup (`handleMenuClick`, ~293-296)**: `window.electron.ipcRenderer.send('mt::popup-app-menu', { x: 23, y: 20 })` (canale NUOVO, vedi main).

### Main — `src/main/app/windowManager.js` (stile identico agli handler `mt::window-*` esistenti)
Aggiungere in `_listenForIpcMain()`:
- `ipcMain.on('mt::window-toggle-full-screen', (e) => { const win = BrowserWindow.fromWebContents(e.sender); if (win) win.setFullScreen(!win.isFullScreen()) })`.
- `ipcMain.handle('mt::window-state', (e) => { const win = BrowserWindow.fromWebContents(e.sender); return win ? { isMaximized: win.isMaximized(), isFullScreen: win.isFullScreen() } : { isMaximized: false, isFullScreen: false } })`.
  Verificare che `BrowserWindow` sia già importato nel file (lo è: usato dagli handler esistenti). Se manca `ipcMain.handle` altrove nel file, usare comunque `ipcMain` già in scope.

### Main — `src/main/menu/index.js`
Aggiungere un handler per il popup dell'application menu della finestra chiamante:
- `ipcMain.on('mt::popup-app-menu', (e, { x, y }) => { const win = BrowserWindow.fromWebContents(e.sender); const menu = Menu.getApplicationMenu(); if (win && menu) menu.popup({ window: win, x, y }) })`.
  Verificare gli import (`ipcMain`, `BrowserWindow`, `Menu` da 'electron') nel file; aggiungerli solo se
  mancanti, coerenti con lo stile del file. Registrarlo dove il file già inizializza gli handler/menu.

## Sottoproblemi (in quest'ordine)
1. Main: `mt::window-toggle-full-screen` + `mt::window-state` in windowManager.js.
2. Main: `mt::popup-app-menu` in menu/index.js.
3. `util/clipboard.js`: remoteClipboard → window.electron.clipboard, rimuovere import.
4. `commands/index.js`: minimize/fullscreen via IPC, rimuovere import getCurrentWindow.
5. `prefComponents/common/titlebar.vue`: close via `mt::cmd-close-window`, rimuovere import.
6. `titleBar/index.vue`: stato iniziale via `mt::window-state`, close/minimize/maximize/app-menu via IPC, rimuovere import remote (lasciare i listener `mt::window-*`).
7. Verifica statica: `grep -n "@electron/remote" src/renderer/src` → devono restare SOLO i 2 file dei context menu (`contextMenu/sideBar/index.js`, `contextMenu/tabs/index.js`), che sono del task3. Elencarli nel worklog. Nessun altro residuo renderer.

## Fatti già verificati (esplorazione 2026-07-07)
- Canali window esistenti derivano la finestra da `e.sender` (no windowId): close/minimize/maximize/always-on-top.
- `mt::cmd-close-window` = chiusura graceful (già usata in `tabs.vue:783`); `mt::close-window` = forceClose (NON usare).
- Eventi stato finestra `mt::window-*` già emessi dal main e già ascoltati da titleBar → serve solo lo stato INIZIALE via IPC.
- `window.electron.clipboard` = modulo clipboard nativo (stessi metodi di remote clipboard).
- `commands/index.js` toggle-always-on-top è già IPC; toggle-full-screen no → nuovo canale.
- windowId nel renderer: `global.marktext.env.windowId` (da `bootstrap.js`), NON serve per questi canali (usano e.sender).
