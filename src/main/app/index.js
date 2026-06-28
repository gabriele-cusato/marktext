import path from 'path'
import fsPromises from 'fs/promises'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import log from 'electron-log'
import { app, BrowserWindow, clipboard, dialog, nativeTheme, shell, ipcMain } from 'electron'
import { isChildOfDirectory } from 'common/filesystem/paths'
import { isLinux, isOsx, isWindows } from '../config'
import parseArgs from '../cli/parser'
import { normalizeAndResolvePath } from '../filesystem'
import { normalizeMarkdownPath } from '../filesystem/markdown'
import { writeSession, hasSessionSync, loadSessionTabs } from '../filesystem/session'
import { registerKeyboardListeners } from '../keyboard'
import { selectTheme } from '../menu/actions/theme'
import { dockMenu } from '../menu/templates'
import registerSpellcheckerListeners from '../spellchecker'
import { watchers } from '../utils/imagePathAutoComplement'
import { WindowType, WindowLifecycle } from '../windows/base'
import EditorWindow from '../windows/editor'
import SettingWindow from '../windows/setting'
import { setLanguage } from '../i18n'

class App {
  /**
   * @param {Accessor} accessor The application accessor for application instances.
   * @param {arg.Result} args Parsed application arguments.
   */
  constructor(accessor, args) {
    this._accessor = accessor
    this._args = args || { _: [] }
    this._openFilesCache = []
    this._openFilesTimer = null
    this._windowManager = this._accessor.windowManager
    // B (2026-06-25): sessione multi-finestra-aware. Registro per-finestra (win.id → slice),
    // queue di scrittura serializzata (no race + no collisione tmp), contatore ordine creazione.
    this._sessionRegistry = new Map() // win.id → { winId, order, tabs }
    this._sessionWriteQueue = Promise.resolve()
    this._sessionOrderSeq = 0
    // this.launchScreenshotWin = null // The window which call the screenshot.
    // this.shortcutCapture = null

    // Initialize main process language
    this._initializeLanguage()
    this._listenForIpcMain()
    // Initialize theme listener
    this._themeListenerRegistered = false
  }

  /**
   * The entry point into the application.
   */
  init() {
    // Enable these features to use `backdrop-filter` css rules!
    if (isOsx) {
      app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true')
    }

    app.on('second-instance', (event, argv, workingDirectory) => {
      const { _openFilesCache, _windowManager } = this
      const args = parseArgs(argv.slice(1))

      const buf = []
      for (const pathname of args._) {
        // Ignore all unknown flags
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(path.resolve(workingDirectory, pathname))
        if (info) {
          buf.push(info)
        }
      }

      if (args['--new-window']) {
        this._openPathList(buf, true)
        return
      }

      _openFilesCache.push(...buf)
      if (_openFilesCache.length) {
        this._openFilesToOpen()
      } else {
        const activeWindow = _windowManager.getActiveWindow()
        if (activeWindow) {
          activeWindow.bringToFront()
        }
      }
    })

    app.on('open-file', this.openFile) // macOS only

    app.on('ready', this.ready)

    app.on('window-all-closed', () => {
      // Close all the image path watcher
      for (const watcher of watchers.values()) {
        watcher.close()
      }
      this._windowManager.closeWatcher()
      if (!isOsx) {
        app.quit()
      }
    })

    app.on('activate', () => {
      // macOS only
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (this._windowManager.windowCount === 0) {
        this.ready()
      }
    })

    // Prevent to load webview and opening links or new windows via HTML/JS.
    app.on('web-contents-created', (event, contents) => {
      contents.on('will-attach-webview', (event) => {
        event.preventDefault()
      })
      contents.on('will-navigate', (event) => {
        event.preventDefault()
      })
      contents.setWindowOpenHandler((details) => {
        return { action: 'deny' }
      })
    })
  }

  /**
   * Initialize main process language from preferences
   */
  async _initializeLanguage() {
    try {
      let currentLanguage = this._accessor.preferences.getItem('language')

      // 如果没有设置语言，则根据系统语言自动设置
      if (!currentLanguage) {
        const systemLanguage = app.getLocale()
        console.log(`System language detected: ${systemLanguage}`)

        // 支持的语言列表（根据项目实际支持的语言）
        const supportedLanguages = [
          'en',
          'zh-CN',
          'zh-TW',
          'ja',
          'ko',
          'fr',
          'de',
          'es',
          'pt',
          'ru'
        ]

        // 语言映射：系统语言代码 -> 应用语言代码
        const languageMap = {
          'zh-CN': 'zh-CN',
          'zh-TW': 'zh-TW',
          'zh-HK': 'zh-TW',
          zh: 'zh-CN',
          en: 'en',
          'en-US': 'en',
          'en-GB': 'en',
          ja: 'ja',
          'ja-JP': 'ja',
          ko: 'ko',
          'ko-KR': 'ko',
          fr: 'fr',
          'fr-FR': 'fr',
          de: 'de',
          'de-DE': 'de',
          es: 'es',
          'es-ES': 'es',
          pt: 'pt',
          'pt-BR': 'pt',
          ru: 'ru',
          'ru-RU': 'ru'
        }

        currentLanguage = languageMap[systemLanguage] || 'en'

        // 如果检测到的语言不在支持列表中，使用英语
        if (!supportedLanguages.includes(currentLanguage)) {
          currentLanguage = 'en'
        }

        // 保存检测到的语言设置
        this._accessor.preferences.setItem('language', currentLanguage)
        console.log(`Auto-detected and set language to: ${currentLanguage}`)
      }

      setLanguage(currentLanguage)
      console.log(`Main process language initialized to: ${currentLanguage}`)
    } catch (error) {
      console.error('Failed to initialize main process language:', error)
      // 如果出错，使用英语作为默认语言
      setLanguage('en')
    }
  }

  async getScreenshotFileName() {
    const screenshotFolderPath = await this._accessor.dataCenter.getItem('screenshotFolderPath')
    const fileName = `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-screenshot.png`
    return path.join(screenshotFolderPath, fileName)
  }

  ready = () => {
    const { _args: args, _openFilesCache } = this
    const { preferences } = this._accessor

    // 初始化语言设置
    const { language } = preferences.getAll()
    if (language) {
      setLanguage(language)
    }

    if (args._.length) {
      for (const pathname of args._) {
        // Ignore all unknown flags
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(pathname)
        if (info) {
          _openFilesCache.push(info)
        }
      }
    }

    const {
      startUpAction,
      defaultDirectoryToOpen,
      followSystemTheme,
      lightModeTheme,
      darkModeTheme,
      theme
    } = preferences.getAll()

    if (startUpAction === 'folder' && defaultDirectoryToOpen) {
      const info = normalizeMarkdownPath(defaultDirectoryToOpen)
      if (info) {
        _openFilesCache.unshift(info)
      }
    }

    // Configure native theme to follow system preferences
    // Setting themeSource to 'system' allows Electron to track system theme changes
    nativeTheme.themeSource = 'system'

    // Apply theme at startup if "Follow system theme" is enabled
    const isDarkTheme = /dark/i.test(theme)
    const systemIsDark = nativeTheme.shouldUseDarkColors

    if (followSystemTheme && isDarkTheme !== systemIsDark) {
      const newTheme = systemIsDark ? darkModeTheme : lightModeTheme
      log.info(
        `Following system theme at startup: ${newTheme} (system ${systemIsDark ? 'dark' : 'light'})`
      )
      selectTheme(newTheme)
    }

    ipcMain.on('broadcast-preferences-changed', (change) => {
      // When followSystemTheme is enabled, immediately switch to match system
      if (change.followSystemTheme === true) {
        const systemIsDark = nativeTheme.shouldUseDarkColors
        const { lightModeTheme, darkModeTheme } = preferences.getAll()
        const newTheme = systemIsDark ? darkModeTheme : lightModeTheme

        log.info(
          `followSystemTheme enabled, switching to: ${newTheme} (system ${systemIsDark ? 'dark' : 'light'})`
        )
        selectTheme(newTheme)
        preferences.setItem('theme', newTheme)
      }
      // When light/dark mode theme preferences change, apply immediately if following system
      if (
        preferences.getItem('followSystemTheme') &&
        (change.lightModeTheme || change.darkModeTheme)
      ) {
        const systemIsDark = nativeTheme.shouldUseDarkColors

        // Get current values, but prefer the NEW values from the change event
        let { lightModeTheme, darkModeTheme } = preferences.getAll()

        // If these preferences were just changed, use the new values from the change object
        if (change.lightModeTheme !== undefined) {
          lightModeTheme = change.lightModeTheme
        }
        if (change.darkModeTheme !== undefined) {
          darkModeTheme = change.darkModeTheme
        }

        const newTheme = systemIsDark ? darkModeTheme : lightModeTheme

        log.info(`Theme preference changed, applying: ${newTheme}`)
        selectTheme(newTheme)
        preferences.setItem('theme', newTheme)
      }
    })

    // Listen for system theme changes and auto-switch if enabled
    if (!this._themeListenerRegistered) {
      nativeTheme.on('updated', () => {
        const { followSystemTheme, lightModeTheme, darkModeTheme } = preferences.getAll()

        if (followSystemTheme) {
          const systemIsDark = nativeTheme.shouldUseDarkColors
          const newTheme = systemIsDark ? darkModeTheme : lightModeTheme
          const currentTheme = preferences.getItem('theme')

          // Only switch if the theme actually needs to change
          if (newTheme !== currentTheme) {
            log.info(
              `System theme changed, switching to: ${newTheme} (system ${systemIsDark ? 'dark' : 'light'})`
            )
            selectTheme(newTheme)
            preferences.setItem('theme', newTheme)
          }
        }
      })
      this._themeListenerRegistered = true
    }

    if (isOsx) {
      app.dock.setMenu(dockMenu)
    } else if (isWindows) {
      app.setJumpList([
        {
          type: 'recent'
        },
        {
          type: 'tasks',
          items: [
            {
              type: 'task',
              title: 'New Window',
              description: 'Opens a new window',
              program: process.execPath,
              args: '--new-window',
              iconPath: process.execPath,
              iconIndex: 0
            }
          ]
        }
      ])
    }

    const { sessionSnapshotEnabled } = preferences.getAll()
    const createWindow = () => {
      if (sessionSnapshotEnabled && hasSessionSync(preferences)) {
        // H2: ripristina SEMPRE la sessione (tutte le tab della scorsa volta) e ACCODA gli eventuali
        // file/cartella da CLI/doppio-click nella stessa finestra (dedup nel renderer) — comportamento NPP.
        const appendFiles = _openFilesCache.filter((p) => !p.isDir).map((p) => p.path)
        const rootDir = (_openFilesCache.find((p) => p.isDir) || {}).path || null
        _openFilesCache.length = 0
        this._restoreSessionWindow(appendFiles, rootDir)
      } else if (_openFilesCache.length) {
        // Feature OFF (o nessuna sessione): apri i file da CLI normalmente.
        this._openFilesToOpen()
      } else {
        this._createEditorWindow()
      }
    }

    if (isLinux) {
      let windowCreated = false

      const createWindowOnce = () => {
        if (windowCreated) return
        windowCreated = true
        createWindow()
      }

      // Wait for theme to settle (Linux-specific issue?)
      nativeTheme.once('updated', createWindowOnce)
      // Fallback timeout in case 'updated' never fires (no theme change)
      setTimeout(createWindowOnce, 150)
    } else {
      // Create immediately on Windows/macOS
      createWindow()
    }

    // this.shortcutCapture = new ShortcutCapture()
    // if (process.env.NODE_ENV === 'development') {
    //   this.shortcutCapture.dirname = path.resolve(path.join(__dirname, '../../../node_modules/shortcut-capture'))
    // }
    // this.shortcutCapture.on('capture', async ({ dataURL }) => {
    //   const { screenshotFileName } = this
    //   const image = nativeImage.createFromDataURL(dataURL)
    //   const bufferImage = image.toPNG()

    //   if (this.launchScreenshotWin) {
    //     this.launchScreenshotWin.webContents.send('mt::screenshot-captured')
    //     this.launchScreenshotWin = null
    //   }

    //   try {
    //     // write screenshot image into screenshot folder.
    //     await fse.writeFile(screenshotFileName, bufferImage)
    //   } catch (err) {
    //     log.error(err)
    //   }
    // })
  }

  openFile = (event, pathname) => {
    event.preventDefault()
    const info = normalizeMarkdownPath(pathname)
    if (info) {
      this._openFilesCache.push(info)

      if (app.isReady()) {
        // It might come more files
        if (this._openFilesTimer) {
          clearTimeout(this._openFilesTimer)
        }
        this._openFilesTimer = setTimeout(() => {
          this._openFilesTimer = null
          this._openFilesToOpen()
        }, 100)
      }
    }
  }

  // --- private --------------------------------

  // H2: ritorna la prima editor window viva (non chiusa), READY o ancora in LOADING (i metodi open*
  // accodano da soli se non è ancora READY). Serve per il single-window stile Notepad++.
  _getExistingEditorWindow() {
    for (const window of this._windowManager.windows.values()) {
      if (window.type === WindowType.EDITOR && window.lifecycle !== WindowLifecycle.QUITTED) {
        return window
      }
    }
    return null
  }

  /**
   * H5-RE: trova la finestra editor (≠ sorgente) i cui bounds schermo contengono il punto (x, y).
   * Usata dal drag-out per droppare la tab in una finestra esistente sotto il puntatore.
   * @param {number} x Coordinata schermo X del drop.
   * @param {number} y Coordinata schermo Y del drop.
   * @param {number} excludeId id della finestra sorgente da escludere.
   * @returns {EditorWindow|null}
   */
  _findEditorWindowAt(x, y, excludeId) {
    for (const w of this._windowManager.windows.values()) {
      if (w.type !== WindowType.EDITOR || w.lifecycle === WindowLifecycle.QUITTED) continue
      if (w.id === excludeId) continue
      const bw = w.browserWindow
      if (!bw || bw.isDestroyed() || !bw.isVisible()) continue
      const b = bw.getBounds()
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return w
    }
    return null
  }

  /**
   * B: fonde gli slice di tutte le finestre in una lista piatta ordinata per `order` di creazione
   * (finestra1-tab, poi finestra2-tab, ...). Ogni tab porta `_winId` per lo snapshot namespacato.
   * Gli slice delle finestre chiuse restano (congelati) finché non si riavvia → al restart il
   * processo è nuovo e il registro riparte vuoto (le tab collassano in una sola finestra). Q1.
   * @returns {Array}
   */
  _mergeSession() {
    const slices = [...this._sessionRegistry.values()].sort((a, b) => a.order - b.order)
    const tabs = []
    for (const s of slices) {
      for (const t of s.tabs) tabs.push({ ...t, _winId: s.winId })
    }
    return tabs
  }

  /**
   * B: scrittura sessione SERIALIZZATA (FIX 4 — niente race tra finestre, niente collisione su
   * session.json.tmp). Ritorna la promise dell'ultima scrittura (la chiusura silenziosa la attende).
   * @param {Preference} preferences
   * @returns {Promise}
   */
  _enqueueSessionWrite(preferences) {
    this._sessionWriteQueue = this._sessionWriteQueue
      .then(() => writeSession(preferences, this._mergeSession()))
      .catch((err) => log.error('[session] write failed:', err))
    return this._sessionWriteQueue
  }

  /**
   * Creates a new editor window.
   *
   * @param {string} [rootDirectory] The root directory to open.
   * @param {string[]} [fileList] A list of markdown files to open.
   * @param {string[]} [markdownList] Array of markdown data to open.
   * @param {*} [options] The BrowserWindow options.
   * @returns {EditorWindow} The created editor window.
   */
  _createEditorWindow(rootDirectory = null, fileList = [], markdownList = [], options = {}) {
    // H2: single-window stile Notepad++. Con la feature attiva NON si apre mai una seconda finestra:
    // ogni richiesta (New Window, --new-window, apertura file da CLI/doppio-click, ecc.) viene
    // dirottata sulla finestra esistente — apre lì le tab (dedup nel renderer) e la porta in primo piano.
    if (this._accessor.preferences.getItem('sessionSnapshotEnabled')) {
      const existing = this._getExistingEditorWindow()
      if (existing) {
        if (rootDirectory) existing.openFolder(rootDirectory)
        if (fileList.length) existing.openTabsFromPaths(fileList)
        if (markdownList.length) {
          markdownList.forEach((md, i) => existing.openUntitledTab(i === 0, md))
        }
        // "New Window" puro (niente da aprire) → nuova tab vuota nella finestra unica (come Ctrl+N di NPP).
        if (!rootDirectory && !fileList.length && !markdownList.length) {
          existing.openUntitledTab(true, '')
        }
        existing.bringToFront()
        return existing
      }
    }

    const editor = new EditorWindow(this._accessor)
    // H2: owner della sessione = unica editor window viva al momento della creazione (determinato in modo
    // dinamico → corretto anche su macOS dopo chiusura+riapertura, e con feature OFF resta "prima finestra").
    editor._isSessionOwner = this._getExistingEditorWindow() === null
    // B: ordine di creazione → determina la concatenazione delle tab nel merge sessione.
    editor._sessionOrder = this._sessionOrderSeq++
    editor.createWindow(rootDirectory, fileList, markdownList, options)
    this._windowManager.add(editor)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(editor.id)
    }
    return editor
  }

  /**
   * H2: crea la finestra di ripristino sessione (nessuna blank tab; le tab arrivano via mt::restore-session).
   * Eventuali file/cartella da CLI vengono ACCODATI alla sessione ripristinata (dedup nel renderer).
   * @param {string[]} [appendFiles] File da aprire dopo il restore.
   * @param {string|null} [rootDirectory] Cartella da aprire dopo il restore.
   * @returns {EditorWindow}
   */
  _restoreSessionWindow(appendFiles = [], rootDirectory = null) {
    const editor = new EditorWindow(this._accessor)
    editor._isSessionOwner = this._getExistingEditorWindow() === null
    // B: la finestra di restore è la prima → order 0 (o successivo se già esistono finestre).
    editor._sessionOrder = this._sessionOrderSeq++
    editor._isRestoreSession = true
    // Stash: il main li apre nella stessa finestra DOPO aver inviato mt::restore-session (ordine garantito).
    editor._restoreAppendFiles = appendFiles
    editor._restoreRootDirectory = rootDirectory
    editor.createWindow()
    this._windowManager.add(editor)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(editor.id)
    }
    return editor
  }

  /**
   * H5-1: crea una NUOVA finestra che riceve UNA tab detachata da un'altra finestra. Bypassa il gate
   * single-window (è un'azione esplicita): crea direttamente l'EditorWindow, non passa da _createEditorWindow.
   * Riusa il flusso restore (no blank tab; la tab arriva via mt::restore-session) → gestione uniforme
   * di saved/untitled/dirty. Stash `_detachTab`/`_detachSource`: usati nel handler mt::request-session-restore.
   * @param {Object} resolvedTab Tab già risolta dal renderer sorgente (shape di RESTORE_SESSION).
   * @param {number} sourceWinId id BrowserWindow sorgente (per l'ack di chiusura tab).
   * @param {string} sourceTabId id della tab nella finestra sorgente.
   * @returns {EditorWindow}
   */
  _createDetachWindow(resolvedTab, sourceWinId, sourceTabId) {
    const editor = new EditorWindow(this._accessor)
    editor._isSessionOwner = this._getExistingEditorWindow() === null
    editor._sessionOrder = this._sessionOrderSeq++
    editor._isRestoreSession = true // niente blank tab; la tab arriva via mt::restore-session
    editor._detachTab = resolvedTab
    editor._detachSource = { winId: sourceWinId, tabId: sourceTabId }
    editor.createWindow()
    this._windowManager.add(editor)
    return editor
  }

  /**
   * Create a new setting window.
   */
  _createSettingWindow(category) {
    const setting = new SettingWindow(this._accessor)
    setting.createWindow(category)
    this._windowManager.add(setting)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(setting.id)
    }
  }

  _openFilesToOpen() {
    this._openPathList(this._openFilesCache, false)
  }

  /**
   * Open the path list in the best window(s).
   *
   * @param {string[]} pathsToOpen The path list to open.
   * @param {boolean} openFilesInSameWindow Open all files in the same window with
   * the first directory and discard other directories.
   */
  _openPathList(pathsToOpen, openFilesInSameWindow = false) {
    const { _windowManager } = this
    const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')

    const fileSet = new Set()
    const directorySet = new Set()
    for (const { isDir, path } of pathsToOpen) {
      if (isDir) {
        directorySet.add(path)
      } else {
        fileSet.add(path)
      }
    }

    // Filter out directories that are already opened.
    for (const window of _windowManager.windows.values()) {
      if (window.type === WindowType.EDITOR) {
        const { openedRootDirectory } = window
        if (directorySet.has(openedRootDirectory)) {
          window.bringToFront()
          directorySet.delete(openedRootDirectory)
        }
      }
    }

    const directoriesToOpen = Array.from(directorySet).map((dir) => ({
      rootDirectory: dir,
      fileList: []
    }))
    const filesToOpen = Array.from(fileSet)

    // Discard all directories except first one and add files.
    if (openFilesInSameWindow) {
      if (directoriesToOpen.length) {
        directoriesToOpen[0].fileList.push(...filesToOpen)
        directoriesToOpen.length = 1
      } else {
        directoriesToOpen.push({ rootDirectory: null, fileList: [...filesToOpen] })
      }
      filesToOpen.length = 0
    }

    // Find the best window(s) to open the files in.
    if (!openFilesInSameWindow && !openFilesInNewWindow) {
      const isFirstWindow = _windowManager.getActiveEditorId() === null

      // Prefer new directories
      for (let i = 0; i < directoriesToOpen.length; ++i) {
        const { fileList, rootDirectory } = directoriesToOpen[i]

        let breakOuterLoop = false
        for (let j = 0; j < filesToOpen.length; ++j) {
          const pathname = filesToOpen[j]
          if (isChildOfDirectory(rootDirectory, pathname)) {
            if (isFirstWindow) {
              fileList.push(...filesToOpen)
              filesToOpen.length = 0
              breakOuterLoop = true
              break
            }
            fileList.push(pathname)
            filesToOpen.splice(j, 1)
            --j
          }
        }

        if (breakOuterLoop) {
          break
        }
      }

      // Find for the remaining files the best window to open the files in.
      if (isFirstWindow && directoriesToOpen.length && filesToOpen.length) {
        const { fileList } = directoriesToOpen[0]
        fileList.push(...filesToOpen)
        filesToOpen.length = 0
      } else {
        const windowList = _windowManager.findBestWindowToOpenIn(filesToOpen)
        for (const item of windowList) {
          const { windowId, fileList } = item

          // File list is empty when all files are already opened.
          if (fileList.length === 0) {
            continue
          }

          if (windowId !== null) {
            const window = _windowManager.get(windowId)
            if (window) {
              window.openTabsFromPaths(fileList)
              window.bringToFront()
              continue
            }
            // else: fallthrough
          }
          this._createEditorWindow(null, fileList)
        }
      }

      // Directores are always opened in a new window if not already opened.
      for (const item of directoriesToOpen) {
        const { rootDirectory, fileList } = item
        this._createEditorWindow(rootDirectory, fileList)
      }
    } else {
      // Open each file and directory in a new window.

      for (const pathname of filesToOpen) {
        this._createEditorWindow(null, [pathname])
      }

      for (const item of directoriesToOpen) {
        const { rootDirectory, fileList } = item
        this._createEditorWindow(rootDirectory, fileList)
      }
    }

    // Empty the file list
    pathsToOpen.length = 0
  }

  _openSettingsWindow(category) {
    const settingWins = this._windowManager.getWindowsByType(WindowType.SETTINGS)
    if (settingWins.length >= 1) {
      // A setting window is already created
      const browserSettingWindow = settingWins[0].win.browserWindow
      browserSettingWindow.webContents.send('settings::change-tab', category)
      if (isLinux) {
        browserSettingWindow.focus()
      } else {
        browserSettingWindow.moveTop()
      }
      return
    }
    this._createSettingWindow(category)
  }

  _listenForIpcMain() {
    registerKeyboardListeners()
    registerSpellcheckerListeners()

    // 处理语言设置请求
    ipcMain.on('mt::get-current-language', (event) => {
      const { language } = this._accessor.preferences.getAll()
      event.reply('mt::current-language', language || 'en')
    })

    ipcMain.on('app-create-editor-window', () => {
      this._createEditorWindow()
    })

    ipcMain.on('screen-capture', async (win) => {
      if (isOsx) {
        // Use macOs `screencapture` command line when in macOs system.
        const screenshotFileName = await this.getScreenshotFileName()
        exec('screencapture -i -c', async (err) => {
          if (err) {
            log.error(err)
            return
          }
          try {
            // Write screenshot image into screenshot folder.
            const image = clipboard.readImage()
            const bufferImage = image.toPNG()
            await fsPromises.writeFile(screenshotFileName, bufferImage)
          } catch (err) {
            log.error(err)
          }
          win.webContents.send('mt::screenshot-captured')
        })
      } else {
        // TODO: Do nothing, maybe we'll add screenCapture later on Linux and Windows.
        // if (this.shortcutCapture) {
        //   this.launchScreenshotWin = win
        //   this.shortcutCapture.shortcutCapture()
        // }
      }
    })

    ipcMain.on('app-create-settings-window', (category) => {
      this._openSettingsWindow(category)
    })

    ipcMain.on('app-open-file-by-id', (windowId, filePath) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [filePath])
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openTab(filePath, {}, true)
        }
      }
    })
    ipcMain.on('app-open-files-by-id', (windowId, fileList) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, fileList)
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          // P3: normalizeMarkdownPath filtrava qualsiasi estensione fuori da
          // MARKDOWN_EXTENSIONS (.md, .txt, ...) → file .js/.py/.css mai aperti.
          // Sostituito con normalizeAndResolvePath che valida solo il path.
          // Dialog usa properties:['openFile'] → no directory selezionabili.
          editor.openTabsFromPaths(
            fileList
              .map((p) => normalizeAndResolvePath(p))
              .filter(Boolean)
          )
        }
      }
    })

    ipcMain.on('app-open-markdown-by-id', (windowId, data) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [], [data])
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openUntitledTab(true, data)
        }
      }
    })

    ipcMain.on('app-open-directory-by-id', (windowId, pathname, openInSameWindow) => {
      const { openFolderInNewWindow } = this._accessor.preferences.getAll()
      if (openInSameWindow || !openFolderInNewWindow) {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openFolder(pathname)
          return
        }
      }
      this._createEditorWindow(pathname)
    })

    // --- renderer -------------------

    ipcMain.on('mt::app-try-quit', () => {
      app.quit()
    })

    ipcMain.on('mt::open-file-by-window-id', (e, windowId, filePath) => {
      const resolvedPath = normalizeAndResolvePath(filePath)
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [resolvedPath])
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openTab(resolvedPath, {}, true)
        }
      }
    })

    ipcMain.on('mt::select-default-directory-to-open', async (e) => {
      const { preferences } = this._accessor
      const { defaultDirectoryToOpen } = preferences.getAll()
      const win = BrowserWindow.fromWebContents(e.sender)

      const { filePaths } = await dialog.showOpenDialog(win, {
        defaultPath: defaultDirectoryToOpen,
        properties: ['openDirectory', 'createDirectory']
      })
      if (filePaths && filePaths[0]) {
        preferences.setItems({ defaultDirectoryToOpen: filePaths[0] })
      }
    })

    // H2 — Session snapshot & periodic backup -------------------------------------------------

    // B: backup periodico — ogni finestra invia il PROPRIO slice; il main aggiorna il registro per-finestra
    // e scrive il merge in modo SERIALIZZATO (la queue evita race e collisione sul tmp di session.json).
    ipcMain.on('mt::session-save', (e, payload) => {
      const { preferences } = this._accessor
      const win = BrowserWindow.fromWebContents(e.sender)
      const editorWin = win && this._windowManager.get(win.id)
      if (!preferences.getItem('sessionSnapshotEnabled') || !editorWin) return
      this._sessionRegistry.set(win.id, {
        winId: win.id,
        order: editorWin._sessionOrder ?? 0,
        tabs: (payload && payload.tabs) || []
      })
      this._enqueueSessionWrite(preferences) // fire-and-forget: la queue serializza
    })

    // B: chiusura silenziosa — aggiorna lo slice, scrivi il merge (await) e POI chiudi (niente popup "salvare?").
    // Lo slice NON viene cancellato (Q1): le tab della finestra chiusa restano in sessione fino al riavvio.
    ipcMain.on('mt::session-save-and-close', async (e, payload) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const { preferences } = this._accessor
      try {
        if (win && preferences.getItem('sessionSnapshotEnabled')) {
          const editorWin = this._windowManager.get(win.id)
          this._sessionRegistry.set(win.id, {
            winId: win.id,
            order: (editorWin && editorWin._sessionOrder) ?? 0,
            tabs: (payload && payload.tabs) || []
          })
          await this._enqueueSessionWrite(preferences)
        }
      } catch (err) {
        log.error('[session] final save failed:', err)
      }
      if (win && win.id) {
        ipcMain.emit('window-close-by-id', win.id)
      }
    })

    // Il renderer (finestra di restore) chiede di ricostruire la sessione.
    ipcMain.on('mt::request-session-restore', async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      const editorWin = this._windowManager.get(win.id)
      const { preferences, menu: appMenu } = this._accessor

      // H5-1: finestra di DETACH → ricostruisci la SINGOLA tab passata dalla finestra sorgente
      // (NON leggere la sessione da disco), poi conferma alla sorgente che può chiudere la sua tab.
      if (editorWin && editorWin._detachTab) {
        const tab = editorWin._detachTab
        const src = editorWin._detachSource
        editorWin._detachTab = null
        editorWin._detachSource = null
        if (tab.pathname) {
          editorWin.addToOpenedFiles(tab.pathname)
          appMenu.addRecentlyUsedDocument(tab.pathname)
        }
        win.webContents.send('mt::restore-session', { tabs: [tab] })
        // Ack alla sorgente DOPO il restore → la tab vecchia si chiude solo a contenuto migrato.
        if (src) {
          const srcWin = BrowserWindow.fromId(src.winId)
          if (srcWin && !srcWin.isDestroyed()) {
            srcWin.webContents.send('mt::detach-tab-ack', { tabId: src.tabId })
          }
        }
        return
      }

      try {
        const result = await loadSessionTabs(preferences)
        if (result && result.tabs.length) {
          // Per le tab con pathname: attiva watcher + recently-used dalla pipeline standard.
          for (const t of result.tabs) {
            if (t.pathname && editorWin) {
              editorWin.addToOpenedFiles(t.pathname)
              appMenu.addRecentlyUsedDocument(t.pathname)
            }
          }
          win.webContents.send('mt::restore-session', result)
          if (result.missing && result.missing.length) {
            win.webContents.send('mt::show-notification', {
              title: 'Session restore',
              type: 'warning',
              message: 'Some files could not be fully restored:\n' + result.missing.join('\n')
            })
          }
        } else {
          // Niente da ripristinare → tab vuota normale.
          win.webContents.send('mt::new-untitled-tab', true, '')
        }
      } catch (err) {
        log.error('[session] restore failed:', err)
        win.webContents.send('mt::new-untitled-tab', true, '')
      }

      // H2: DOPO aver inviato il restore, accoda gli eventuali file/cartella da CLI/doppio-click nella
      // stessa finestra. mt::restore-session è già stato spedito → arriva prima di open-new-tab (ordine
      // dei messaggi sullo stesso webContents) → RESTORE_SESSION costruisce le tab, poi NEW_TAB_WITH_CONTENT
      // accoda/deduplica il file (se già in sessione → porta solo il focus su quella tab).
      if (editorWin) {
        if (editorWin._restoreRootDirectory) {
          editorWin.openFolder(editorWin._restoreRootDirectory)
        }
        if (editorWin._restoreAppendFiles && editorWin._restoreAppendFiles.length) {
          editorWin.openTabsFromPaths(editorWin._restoreAppendFiles)
        }
        editorWin._restoreAppendFiles = null
        editorWin._restoreRootDirectory = null
      }
    })

    // H5-1: detach di una tab in una NUOVA finestra. Crea la finestra bypassando il gate single-window
    // (azione esplicita); la tab arriva al renderer via il flusso restore (request-session-restore → _detachTab).
    ipcMain.on('mt::detach-tab', (e, payload) => {
      const sourceWin = BrowserWindow.fromWebContents(e.sender)
      if (!sourceWin || !payload || !payload.tab) return
      const { tab, sourceTabId, screenX, screenY } = payload
      const { menu: appMenu } = this._accessor
      // H5-RE: drag-out CON coordinate → se il puntatore è su una finestra editor esistente, droppa la tab LÌ
      // (alla posizione del drop). Altrimenti (o context menu = coord null) → nuova finestra (detach classico).
      const targetWin =
        typeof screenX === 'number'
          ? this._findEditorWindowAt(screenX, screenY, sourceWin.id)
          : null
      if (targetWin) {
        if (tab.pathname) {
          targetWin.addToOpenedFiles(tab.pathname) // watcher sulla finestra di destinazione PRIMA di chiudere la sorgente
          appMenu.addRecentlyUsedDocument(tab.pathname)
        }
        targetWin.browserWindow.webContents.send('mt::receive-detached-tab', { tab, screenX, screenY })
        targetWin.bringToFront()
        sourceWin.webContents.send('mt::detach-tab-ack', { tabId: sourceTabId }) // la sorgente chiude la tab migrata
      } else {
        this._createDetachWindow(tab, sourceWin.id, sourceTabId)
      }
    })

    // Folder-picker per la cartella di backup (mirror di select-default-directory-to-open).
    ipcMain.on('mt::select-session-backup-path', async (e) => {
      const { preferences } = this._accessor
      const win = BrowserWindow.fromWebContents(e.sender)
      const { sessionBackupPath } = preferences.getAll()
      const { filePaths } = await dialog.showOpenDialog(win, {
        defaultPath: sessionBackupPath || undefined,
        properties: ['openDirectory', 'createDirectory']
      })
      if (filePaths && filePaths[0]) {
        preferences.setItems({ sessionBackupPath: filePaths[0] })
        win.webContents.send('mt::user-preference', { sessionBackupPath: filePaths[0] })
      }
    })

    ipcMain.on('mt::open-setting-window', () => {
      this._openSettingsWindow()
    })

    ipcMain.on('mt::make-screenshot', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      ipcMain.emit('screen-capture', win)
    })

    ipcMain.on('mt::request-keybindings', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const { keybindings } = this._accessor
      // Convert map to object
      win.webContents.send('mt::keybindings-response', Object.fromEntries(keybindings.keys))
    })

    ipcMain.on('mt::open-keybindings-config', () => {
      const { keybindings } = this._accessor
      keybindings.openConfigInFileManager()
    })

    ipcMain.handle('mt::keybinding-get-pref-keybindings', () => {
      const { keybindings } = this._accessor
      const defaultKeybindings = keybindings.getDefaultKeybindings()
      const userKeybindings = keybindings.getUserKeybindings()
      return { defaultKeybindings, userKeybindings }
    })

    ipcMain.handle('mt::keybinding-save-user-keybindings', async (event, userKeybindings) => {
      const { keybindings } = this._accessor
      return keybindings.setUserKeybindings(userKeybindings)
    })

    ipcMain.handle('mt::fs-trash-item', async (event, fullPath) => {
      return shell.trashItem(fullPath)
    })
  }
}

export default App
