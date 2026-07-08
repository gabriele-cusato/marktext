# renderer-no-node-integration — task3 — plan: context menu sideBar/tabs nel main + fine di `@electron/remote`

## Obiettivo
Spostare la costruzione e il popup dei due context menu (sideBar, tabs) dal renderer (oggi via
`@electron/remote`) al **main**, con un round-trip IPC che restituisce al renderer l'id della voce
cliccata. Poi rimuovere l'inizializzazione di `@electron/remote` lato main (dopo questo task nessun file
renderer lo usa più). Chiude il capitolo `@electron/remote`.

## Idea chiave (già decisa)
I click handler attuali fanno SOLO `bus.emit('<azione>')` (+ `tabId` per i tab, che il renderer già ha
nel parametro `tab`). Quindi il main NON deve eseguire logica applicativa: costruisce il menu da un
**template serializzabile** `{ id, label, type, enabled }`, fa popup, e **ritorna l'id** della voce
cliccata (o null). Il renderer mappa l'id → funzione di `actions.js`. Perciò `menuItems.js` e
`actions.js` NON si toccano: cambiano solo i due `index.js` + un handler nel main.

## Prerequisiti bloccanti
- Dopo il task2, `@electron/remote` nel renderer resta SOLO in `contextMenu/sideBar/index.js:1` e
  `contextMenu/tabs/index.js:1` (verificato). Se il grep iniziale ne trova altri, fermarsi e segnalare.
- `window.electron.ipcRenderer.invoke` deve essere disponibile (pattern invoke/handle già introdotto nel
  task2 con `mt::window-state`).
- `src/main/menu/index.js` importa già `BrowserWindow`, `Menu`, `ipcMain` da 'electron' (BrowserWindow
  aggiunto nel task2). Verificare e aggiungere solo se manca.
- NON toccare: `menuItems.js`/`actions.js` dei due menu, `fileSystem.js`/`node/`/`pdf.js`/`exportSettings`
  (task4), `src/main/config.js` e il plugin Vite (task5).
- NON buildare né avviare l'app. VIETATO qualsiasi comando git. Skill: `coding-standard`.

## Protocollo IPC (già deciso — NON improvvisarne altri)
Canale unico `mt::popup-context-menu`, invoke/handle. Nel main (`src/main/menu/index.js`), stile
coerente con `mt::popup-app-menu` del task2:
```js
ipcMain.handle('mt::popup-context-menu', (e, { items, x, y }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return null
  return new Promise((resolve) => {
    let clickedId = null
    const template = items.map((it) =>
      it.type === 'separator'
        ? { type: 'separator' }
        : { label: it.label, enabled: it.enabled !== false, click: () => { clickedId = it.id } }
    )
    const menu = Menu.buildFromTemplate(template)
    menu.popup({ window: win, x, y, callback: () => resolve(clickedId) })
  })
})
```
La `callback` di `menu.popup` scatta alla chiusura del menu → risolve con l'id cliccato (null se
chiuso senza scelta). Nessun secondo canale necessario.

## File da toccare
1. `src/main/menu/index.js` — aggiungere l'handler `mt::popup-context-menu` (dove sono registrati gli altri ipcMain, vicino a `mt::popup-app-menu`).
2. `src/renderer/src/contextMenu/sideBar/index.js` — riscrivere `showContextMenu`.
3. `src/renderer/src/contextMenu/tabs/index.js` — riscrivere `showContextMenu`.
4. Rimozione init remote lato main: `src/main/windows/editor.js` (import `enable as remoteEnable` a riga 3 + le sue chiamate), `src/main/windows/setting.js`, `src/main/index.js` (`require('@electron/remote/main').initialize()` e `enable(...)`). Rimuovere import e chiamate; NON toccare package.json.

## Riscrittura `sideBar/index.js` (decisa)
- Rimuovere l'import da `@electron/remote`.
- `showContextMenu(event, hasPathCache)` diventa `async`. Costruire i `contextItems` come oggi (stessi
  getter, stesso ordine, `contextItems[5].enabled = hasPathCache`). Serializzare:
  ```js
  const items = contextItems.map((it) =>
    it.type === 'separator' ? { type: 'separator' } : { id: it.id, label: it.label, enabled: it.enabled !== false }
  )
  const clickedId = await window.electron.ipcRenderer.invoke('mt::popup-context-menu', { items, x: event.clientX, y: event.clientY })
  if (clickedId) SIDEBAR_DISPATCH[clickedId]?.()
  ```
- Definire nel file la mappa id→azione (import `* as contextMenu from './actions'`):
  ```js
  const SIDEBAR_DISPATCH = {
    newFileMenuItem: () => contextMenu.newFile(),
    newDirectoryMenuItem: () => contextMenu.newDirectory(),
    copyMenuItem: () => contextMenu.copy(),
    cutMenuItem: () => contextMenu.cut(),
    pasteMenuItem: () => contextMenu.paste(),
    renameMenuItem: () => contextMenu.rename(),
    deleteMenuItem: () => contextMenu.remove(),
    showInFolderMenuItem: () => contextMenu.showInFolder()
  }
  ```
  (gli id sono quelli in `menuItems.js`, verificati: newFileMenuItem, newDirectoryMenuItem, copyMenuItem, cutMenuItem, pasteMenuItem, renameMenuItem, deleteMenuItem, showInFolderMenuItem.)

## Riscrittura `tabs/index.js` (decisa)
- Rimuovere l'import da `@electron/remote`.
- `showContextMenu(event, tab)` diventa `async`. Mantenere la costruzione di `CONTEXT_ITEMS` con i getter
  e la logica `FILE_CONTEXT_ITEMS.forEach(item => item.enabled = !!pathname)` (rename/copyPath/showInFolder
  abilitati solo se il tab ha `pathname`). Il `tabId` è `tab.id`, già disponibile nel renderer → NON serve
  passarlo al main. Serializzare e invocare come sopra, poi:
  ```js
  const clickedId = await window.electron.ipcRenderer.invoke('mt::popup-context-menu', { items, x: event.clientX, y: event.clientY })
  if (clickedId) TABS_DISPATCH[clickedId]?.(tab.id)
  ```
- Mappa id→azione (import `* as contextMenu from './actions'`):
  ```js
  const TABS_DISPATCH = {
    closeThisTab: (tabId) => contextMenu.closeThis(tabId),
    closeOtherTabs: (tabId) => contextMenu.closeOthers(tabId),
    closeSavedTabs: () => contextMenu.closeSaved(),
    closeAllTabs: () => contextMenu.closeAll(),
    renameFile: (tabId) => contextMenu.rename(tabId),
    copyPath: (tabId) => contextMenu.copyPath(tabId),
    showInFolder: (tabId) => contextMenu.showInFolder(tabId)
  }
  ```
  (id verificati in `menuItems.js`: closeThisTab, closeOtherTabs, closeSavedTabs, closeAllTabs, renameFile, copyPath, showInFolder.)

> I chiamanti di `showContextMenu` la invocano sull'evento `contextmenu` senza usarne il ritorno: renderla
> `async` è sicuro (il `await` è interno; il chiamante ignora la Promise). NON serve modificare i chiamanti.

## Sottoproblemi (in quest'ordine)
1. Grep iniziale `@electron/remote` in `src/renderer/src`: confermare che restino solo i 2 index dei context menu.
2. Main: handler `mt::popup-context-menu` in `menu/index.js` (verificare import).
3. `sideBar/index.js`: riscrittura async + `SIDEBAR_DISPATCH`, rimosso import remote.
4. `tabs/index.js`: riscrittura async + `TABS_DISPATCH`, rimosso import remote.
5. Rimozione init/enable `@electron/remote` lato main (editor.js, setting.js, index.js), senza toccare package.json.
6. Verifica statica: `grep -n "@electron/remote" src/` → ZERO in `src/renderer/**`; lato main solo eventuali
   riferimenti residui da rimuovere. Registrare l'esito nel worklog.

## Fatti già verificati (lettura diretta 2026-07-07)
- sideBar: 11 voci (con 3 separatori), PASTE (indice 5) abilitato da `hasPathCache`; click → `bus.emit('SIDEBAR::...')` senza args.
- tabs: 8 voci (1 separatore); rename/copyPath/showInFolder abilitati solo con `pathname`; click → `bus.emit('TABS::...', tabId)`.
- Entrambi i `actions.js` fanno solo `bus.emit` → nessuna logica da spostare nel main.
- Init remote lato main: `src/main/windows/editor.js:3` (`enable as remoteEnable`), + `setting.js`, `index.js` (grep `@electron/remote` esplorazione task2).
