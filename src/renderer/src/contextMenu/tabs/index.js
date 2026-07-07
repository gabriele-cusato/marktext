/* eslint-disable camelcase */
import {
  SEPARATOR,
  getCLOSE_THIS,
  getCLOSE_OTHERS,
  getCLOSE_SAVED,
  getCLOSE_ALL,
  getRENAME,
  getCOPY_PATH,
  getSHOW_IN_FOLDER
} from './menuItems'
import * as contextMenu from './actions'
/* eslint-enable camelcase */

// Mappa id (definiti in menuItems.js) → azione da eseguire nel renderer, con tabId già noto
// lato renderer (non serve farlo transitare per il main).
const TABS_DISPATCH = {
  closeThisTab: (tabId) => contextMenu.closeThis(tabId),
  closeOtherTabs: (tabId) => contextMenu.closeOthers(tabId),
  closeSavedTabs: () => contextMenu.closeSaved(),
  closeAllTabs: () => contextMenu.closeAll(),
  renameFile: (tabId) => contextMenu.rename(tabId),
  copyPath: (tabId) => contextMenu.copyPath(tabId),
  showInFolder: (tabId) => contextMenu.showInFolder(tabId)
}

export const showContextMenu = async (event, tab) => {
  const { pathname } = tab
  // 动态获取菜单项以确保翻译正确
  const closeThis = getCLOSE_THIS()
  const closeOthers = getCLOSE_OTHERS()
  const closeSaved = getCLOSE_SAVED()
  const closeAll = getCLOSE_ALL()
  const rename = getRENAME()
  const copyPath = getCOPY_PATH()
  const showInFolder = getSHOW_IN_FOLDER()

  const CONTEXT_ITEMS = [
    closeThis,
    closeOthers,
    closeSaved,
    closeAll,
    SEPARATOR,
    rename,
    copyPath,
    showInFolder
  ]
  const FILE_CONTEXT_ITEMS = [rename, copyPath, showInFolder]

  FILE_CONTEXT_ITEMS.forEach((item) => {
    item.enabled = !!pathname
  })

  // Serializza il template per l'IPC: il main costruisce e apre il menu, poi ritorna l'id cliccato.
  const items = CONTEXT_ITEMS.map((it) =>
    it.type === 'separator'
      ? { type: 'separator' }
      : { id: it.id, label: it.label, enabled: it.enabled !== false }
  )
  const clickedId = await window.electron.ipcRenderer.invoke('mt::popup-context-menu', {
    items,
    x: event.clientX,
    y: event.clientY
  })
  if (clickedId) TABS_DISPATCH[clickedId]?.(tab.id)
}
