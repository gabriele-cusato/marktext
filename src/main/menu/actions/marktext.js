import { BrowserWindow, Menu, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'
import { COMMANDS } from '../../commands'
import { isOsx } from '../../config'

const { autoUpdater } = electronUpdater

let runningUpdate = false
let win = null

autoUpdater.autoDownload = false

autoUpdater.on('error', (error) => {
  if (win) {
    win.webContents.send(
      'mt::UPDATE_ERROR',
      error === null ? 'Error: unknown' : (error.message || error).toString()
    )
  }
})

autoUpdater.on('update-available', () => {
  if (win) {
    win.webContents.send(
      'mt::UPDATE_AVAILABLE',
      'Found an update, do you want download and install now?'
    )
  }
  runningUpdate = false
})

autoUpdater.on('update-not-available', () => {
  if (win) {
    win.webContents.send('mt::UPDATE_NOT_AVAILABLE', 'Current version is up-to-date.')
  }
  runningUpdate = false
})

autoUpdater.on('update-downloaded', () => {
  // TODO: We should ask the user, so that the user can save all documents and
  // not just force close the application.

  if (win) {
    win.webContents.send(
      'mt::UPDATE_DOWNLOADED',
      'Update downloaded, application will be quit for update...'
    )
  }
  setImmediate(() => autoUpdater.quitAndInstall())
})

ipcMain.on('mt::NEED_UPDATE', (e, { needUpdate }) => {
  if (needUpdate) {
    autoUpdater.downloadUpdate()
  } else {
    runningUpdate = false
  }
})

ipcMain.on('mt::check-for-update', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  checkUpdates(win)
})

// --------------------------------------------------------

// v2: la voce "Preferences" ora apre il settings modal in-app invece della finestra separata.
// Inviamo IPC al renderer del focused window che mostrerà il modal v2 via bus.
export const userSetting = () => {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused) {
    focused.webContents.send('mt::show-settings-modal')
  } else {
    // fallback alla finestra legacy
    ipcMain.emit('app-create-settings-window')
  }
}

export const checkUpdates = (browserWindow) => {
  if (!runningUpdate) {
    runningUpdate = true
    win = browserWindow
    autoUpdater.checkForUpdates()
  }
}

export const osxHide = () => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hide:')
  }
}

export const osxHideAll = () => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hideOtherApplications:')
  }
}

export const osxShowAll = () => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('unhideAllApplications:')
  }
}

// --- Commands -------------------------------------------------------------

export const loadMarktextCommands = (commandManager) => {
  commandManager.add(COMMANDS.MT_HIDE, osxHide)
  commandManager.add(COMMANDS.MT_HIDE_OTHERS, osxHideAll)
}
