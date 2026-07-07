/* eslint-disable camelcase */
import {
  SEPARATOR,
  getNEW_FILE,
  getNEW_DIRECTORY,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getSHOW_IN_FOLDER
} from './menuItems'
import * as contextMenu from './actions'
/* eslint-enable camelcase */

// Mappa id (definiti in menuItems.js) → azione da eseguire nel renderer: il main non conosce
// la logica applicativa, ritorna solo l'id della voce cliccata.
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

export const showContextMenu = async (event, hasPathCache) => {
  // 动态获取菜单项以确保翻译正确
  const contextItems = [
    getNEW_FILE(),
    getNEW_DIRECTORY(),
    SEPARATOR,
    getCOPY(),
    getCUT(),
    getPASTE(),
    SEPARATOR,
    getRENAME(),
    getDELETE(),
    SEPARATOR,
    getSHOW_IN_FOLDER()
  ]

  contextItems[5].enabled = hasPathCache // PASTE item

  // Serializza il template per l'IPC: il main costruisce e apre il menu, poi ritorna l'id cliccato.
  const items = contextItems.map((it) =>
    it.type === 'separator'
      ? { type: 'separator' }
      : { id: it.id, label: it.label, enabled: it.enabled !== false }
  )
  const clickedId = await window.electron.ipcRenderer.invoke('mt::popup-context-menu', {
    items,
    x: event.clientX,
    y: event.clientY
  })
  if (clickedId) SIDEBAR_DISPATCH[clickedId]?.()
}
