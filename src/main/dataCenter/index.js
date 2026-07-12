import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import keytar from 'keytar'
import schema from './schema'
import Store from 'electron-store'
import log from 'electron-log'
import { exec, execFile, spawn } from 'child_process'
import commandExists from 'command-exists'
import { ensureDirSync } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'
import { rgPath as vscodeRgPath } from '@vscode/ripgrep'
import { getFonts } from 'font-list'

const DATA_CENTER_NAME = 'dataCenter'

// Chiavi di registro Windows contenenti i font installati (a livello macchina e per utente).
const WINDOWS_FONT_REGISTRY_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
  'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
]

/**
 * Legge i font installati da registro Windows tramite `reg query`.
 * Fallback usato quando `font-list` fallisce (es. PowerShell/WSH bloccati da policy aziendale):
 * `reg.exe` non dipende da Add-Type/cscript quindi non è soggetto agli stessi blocchi.
 * Ritorna un array di nomi famiglia, stessa shape di `getFonts()` di `font-list`.
 */
function queryFontRegistryKey(key) {
  return new Promise((resolve) => {
    execFile('reg', ['query', key], (err, stdout) => {
      // Una chiave assente (es. HKCU senza font per-utente) non deve far fallire il totale.
      if (err) return resolve([])
      resolve(String(stdout || '').split(/\r?\n/))
    })
  })
}

async function getFontsFromRegistry() {
  const linesPerKey = await Promise.all(WINDOWS_FONT_REGISTRY_KEYS.map(queryFontRegistryKey))
  const families = new Set()
  for (const lines of linesPerKey) {
    for (const line of lines) {
      // Righe dati hanno formato: "    NomeValore    REG_SZ    file.ttf"
      const match = line.match(/^\s{4}(.+?)\s{4}REG_(?:SZ|MULTI_SZ|EXPAND_SZ)\s{4}/)
      if (!match) continue
      // Il nome valore è tipo "Arial (TrueType)": togliere il suffisso finale tra parentesi.
      const family = match[1].replace(/\s*\([^()]*\)\s*$/, '').trim()
      if (family) families.add(family)
    }
  }
  return Array.from(families).sort((a, b) => a.localeCompare(b))
}

// --- Ricerca contenuto in cartella (mt::search-in-folder) ---------------------------------

// Tetti coerenti con quelli della sidebar di ricerca esistente (search.vue: MAX_MATCHES_PER_TAB/
// MAX_MATCHES_TOTAL), riusati qui per il motore di ricerca su cartella.
const SEARCH_MAX_MATCHES_PER_FILE = 500
const SEARCH_MAX_MATCHES_TOTAL = 2000
// Lunghezza massima (in caratteri) della riga restituita al chiamante: oltre questa soglia si
// tronca centrando la finestra sul match, per non spedire righe enormi (es. minified) al renderer.
const SEARCH_MAX_LINE_TEXT_LENGTH = 250
// Timeout di sicurezza per cartelle enormi: oltre questa soglia si termina rg e si ritorna
// quanto raccolto finora con `truncated: true`.
const SEARCH_TIMEOUT_MS = 30000

// Estensioni di file non testuali da escludere sempre dalla ricerca contenuto (oltre a
// IMAGE_EXTENSIONS): evitano sia falsi match binari sia I/O inutile su file che rg scarterebbe
// comunque per contenuto. Elenco non esaustivo ma copre i formati più comuni.
const SEARCH_BASE_EXCLUDED_EXTENSIONS = Object.freeze([
  ...IMAGE_EXTENSIONS,
  // video
  'mp4',
  'mkv',
  'mov',
  'avi',
  'webm',
  // audio
  'mp3',
  'wav',
  'flac',
  'ogg',
  'm4a',
  // archivi
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  // binari/eseguibili noti
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'pdf',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'eot'
])

// Default delle preferenze `search*` (schema.json): usati quando la preferenza non è ancora
// stata scritta su disco o in caso di errore di lettura.
const SEARCH_PREFERENCE_DEFAULTS = Object.freeze({
  searchExclusions: [],
  searchMaxFileSize: '',
  searchIncludeHidden: false,
  searchNoIgnore: false,
  searchFollowSymlinks: true
})

/**
 * Legge i valori correnti delle preferenze `search*` dal file preferenze utente.
 * DataCenter non riceve un riferimento all'istanza `Preference` (costruita separatamente in
 * `app/accessor.js`), quindi qui si apre in sola lettura lo stesso store electron-store
 * (`name: 'preferences'`) usato da `Preference`, senza passare schema (nessuna scrittura prevista).
 */
function readSearchPreferences() {
  try {
    const preferencesStore = new Store({ name: 'preferences' })
    return {
      searchExclusions: preferencesStore.get(
        'searchExclusions',
        SEARCH_PREFERENCE_DEFAULTS.searchExclusions
      ),
      searchMaxFileSize: preferencesStore.get(
        'searchMaxFileSize',
        SEARCH_PREFERENCE_DEFAULTS.searchMaxFileSize
      ),
      searchIncludeHidden: preferencesStore.get(
        'searchIncludeHidden',
        SEARCH_PREFERENCE_DEFAULTS.searchIncludeHidden
      ),
      searchNoIgnore: preferencesStore.get(
        'searchNoIgnore',
        SEARCH_PREFERENCE_DEFAULTS.searchNoIgnore
      ),
      searchFollowSymlinks: preferencesStore.get(
        'searchFollowSymlinks',
        SEARCH_PREFERENCE_DEFAULTS.searchFollowSymlinks
      )
    }
  } catch (err) {
    log.error('Impossibile leggere le preferenze di ricerca, uso i default:', err)
    return { ...SEARCH_PREFERENCE_DEFAULTS }
  }
}

/**
 * Ritorna il buffer di byte grezzo di un campo testo di rg (`--json`): rg usa la chiave `text`
 * quando il contenuto è UTF-8 valido, altrimenti `bytes` (base64) per dati binari/non-UTF8.
 * Serve il buffer (non la stringa) per convertire correttamente gli offset byte→carattere.
 */
function rgFieldToBuffer(field) {
  if (!field) return Buffer.alloc(0)
  if (typeof field.text === 'string') return Buffer.from(field.text, 'utf8')
  if (typeof field.bytes === 'string') return Buffer.from(field.bytes, 'base64')
  return Buffer.alloc(0)
}

/**
 * Converte un offset in byte (come riportato da rg nei submatch) nel corrispondente offset in
 * caratteri JS dentro il buffer di riga: necessario perché rg conta in byte UTF-8 mentre
 * `lineText` è una stringa JS (indicizzata per unità UTF-16).
 */
function rgByteOffsetToCharOffset(lineBuffer, byteOffset) {
  return lineBuffer.slice(0, byteOffset).toString('utf8').length
}

/**
 * Tronca `lineText` a `SEARCH_MAX_LINE_TEXT_LENGTH` caratteri centrando la finestra sul match
 * (start/end), così il match resta visibile anche su righe molto lunghe (es. minified). Ricalcola
 * start/end relativi al testo troncato, tenendo conto dei marcatori di troncamento (`…`).
 */
function truncateLineText(lineText, start, end) {
  if (lineText.length <= SEARCH_MAX_LINE_TEXT_LENGTH) {
    return { text: lineText, start, end }
  }
  const matchLength = Math.max(end - start, 0)
  const contextBudget = Math.max(SEARCH_MAX_LINE_TEXT_LENGTH - matchLength, 0)
  const before = Math.floor(contextBudget / 2)
  let windowStart = Math.max(0, start - before)
  let windowEnd = Math.min(lineText.length, windowStart + SEARCH_MAX_LINE_TEXT_LENGTH)
  windowStart = Math.max(0, windowEnd - SEARCH_MAX_LINE_TEXT_LENGTH)
  const prefix = windowStart > 0 ? '…' : ''
  const suffix = windowEnd < lineText.length ? '…' : ''
  const text = prefix + lineText.slice(windowStart, windowEnd) + suffix
  const shift = windowStart - prefix.length
  return { text, start: start - shift, end: end - shift }
}

/**
 * Cerca `query` nel contenuto dei file sotto `directory` tramite ripgrep e ritorna i match
 * strutturati. Funzione pura (nessuna dipendenza da `this`/IPC) riusabile sia dall'handler
 * `mt::search-in-folder` sia, in futuro, da codice main che non passa da IPC (es. task2:
 * `_createFolderSearchWindow` potrà richiamarla direttamente).
 *
 * @param {string} directory Cartella radice da cercare.
 * @param {string} query Testo o pattern regex da cercare.
 * @param {{isCaseSensitive?: boolean, isWholeWord?: boolean, isRegexp?: boolean,
 *   exclusions?: string[]}} options Opzioni della query, dall'overlay di ricerca.
 * @param {{searchExclusions: string[], searchMaxFileSize: string, searchIncludeHidden: boolean,
 *   searchNoIgnore: boolean, searchFollowSymlinks: boolean}} preferences Default persistenti
 *   delle preferenze `search*` (vedi `readSearchPreferences`).
 * @returns {Promise<{results: Array<{filePath: string, matches: Array<{line: number, start:
 *   number, end: number, lineText: string}>>}>, truncated: boolean, error?: string}>}
 */
function searchInFolder(directory, query, options = {}, preferences = SEARCH_PREFERENCE_DEFAULTS) {
  if (!query) {
    return Promise.resolve({ results: [], truncated: false })
  }
  if (!directory || !fs.existsSync(directory)) {
    return Promise.resolve({
      results: [],
      truncated: false,
      error: `Cartella non trovata: ${directory}`
    })
  }

  const rg =
    process.env.MARKTEXT_RIPGREP_PATH || vscodeRgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')

  const args = ['--json']
  if (options.isRegexp) {
    // pattern regex: nessun flag aggiuntivo, la query è passata così com'è a rg
  } else {
    args.push('--fixed-strings')
  }
  if (!options.isCaseSensitive) args.push('--ignore-case')
  if (options.isWholeWord) args.push('--word-regexp')
  if (preferences.searchMaxFileSize) args.push('--max-filesize', preferences.searchMaxFileSize)
  if (preferences.searchIncludeHidden) args.push('--hidden')
  if (preferences.searchNoIgnore) args.push('--no-ignore')
  if (preferences.searchFollowSymlinks) args.push('--follow')
  for (const ext of SEARCH_BASE_EXCLUDED_EXTENSIONS) args.push('-g', `!*.${ext}`)
  const userExclusions = Array.isArray(options.exclusions)
    ? options.exclusions
    : preferences.searchExclusions || []
  for (const pattern of userExclusions) {
    if (pattern) args.push('-g', `!${pattern}`)
  }
  args.push('--', query, directory)

  return new Promise((resolve) => {
    let child
    try {
      child = spawn(rg, args, { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      resolve({ results: [], truncated: false, error: err.message })
      return
    }

    const resultsByFile = new Map()
    let totalMatches = 0
    let truncated = false
    let stopped = false
    let done = false
    let stdoutBuffer = ''
    let stderrBuffer = ''

    const timeoutHandle = setTimeout(() => {
      truncated = true
      stopped = true
      child.kill()
    }, SEARCH_TIMEOUT_MS)

    const finish = (extra = {}) => {
      if (done) return
      done = true
      clearTimeout(timeoutHandle)
      const results = Array.from(resultsByFile.entries()).map(([filePath, matches]) => ({
        filePath,
        matches
      }))
      resolve({ results, truncated, ...extra })
    }

    child.stdout.on('data', (chunk) => {
      if (done || stopped) return
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop()
      for (const line of lines) {
        if (!line) continue
        let event
        try {
          event = JSON.parse(line)
        } catch {
          continue
        }
        if (!event || event.type !== 'match') continue
        const data = event.data
        const filePath = rgFieldToBuffer(data.path).toString('utf8')
        const lineNumber = data.line_number
        const lineBuffer = rgFieldToBuffer(data.lines)
        const lineTextFull = lineBuffer.toString('utf8').replace(/\r?\n$/, '')
        let fileMatches = resultsByFile.get(filePath)
        if (!fileMatches) {
          fileMatches = []
          resultsByFile.set(filePath, fileMatches)
        }
        for (const submatch of data.submatches || []) {
          if (fileMatches.length >= SEARCH_MAX_MATCHES_PER_FILE || totalMatches >= SEARCH_MAX_MATCHES_TOTAL) {
            truncated = true
            stopped = true
            child.kill()
            break
          }
          const startChar = rgByteOffsetToCharOffset(lineBuffer, submatch.start)
          const endChar = rgByteOffsetToCharOffset(lineBuffer, submatch.end)
          const { text: lineText, start, end } = truncateLineText(lineTextFull, startChar, endChar)
          fileMatches.push({ line: lineNumber, start, end, lineText })
          totalMatches++
        }
        if (stopped) break
      }
    })

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk
    })

    child.on('error', (err) => finish({ error: err.message }))

    child.on('close', (code) => {
      // Codice 0 = match trovati, 1 = nessun match (non è un errore), >1 = errore rg (es. regex
      // non valida, path inaccessibile): lo si segnala solo se non erano già stati raccolti match.
      if (code !== null && code > 1 && totalMatches === 0) {
        finish({ error: stderrBuffer.trim() || `ripgrep è uscito con codice ${code}` })
      } else {
        finish()
      }
    })
  })
}

class DataCenter extends EventEmitter {
  constructor(paths) {
    super()

    const { dataCenterPath, userDataPath } = paths
    this.dataCenterPath = dataCenterPath
    this.userDataPath = userDataPath
    this.serviceName = 'marktext'
    this.encryptKeys = ['githubToken']
    this.hasDataCenterFile = fs.existsSync(
      path.join(this.dataCenterPath, `./${DATA_CENTER_NAME}.json`)
    )
    this.store = new Store({
      schema,
      name: DATA_CENTER_NAME
    })

    this.init()
  }

  init() {
    const defaultData = {
      imageFolderPath: path.join(this.userDataPath, 'images'),
      screenshotFolderPath: path.join(this.userDataPath, 'screenshot'),
      webImages: [],
      cloudImages: [],
      currentUploader: 'none',
      imageBed: {
        github: {
          owner: '',
          repo: '',
          branch: ''
        }
      }
    }

    if (!this.hasDataCenterFile) {
      this.store.set(defaultData)
      ensureDirSync(this.store.get('screenshotFolderPath'))
    }
    this._listenForIpcMain()
  }

  async getAll() {
    const { serviceName, encryptKeys } = this
    const data = this.store.store
    try {
      const encryptData = await Promise.all(
        encryptKeys.map((key) => {
          return keytar.getPassword(serviceName, key)
        })
      )
      const encryptObj = encryptKeys.reduce((acc, k, i) => {
        return {
          ...acc,
          [k]: encryptData[i]
        }
      }, {})

      return Object.assign(data, encryptObj)
    } catch (err) {
      log.error('Failed to decrypt secure keys:', err)
      return data
    }
  }

  addImage(key, url) {
    const items = this.store.get(key)
    const alreadyHas = items.some((item) => item.url === url)
    let item
    if (alreadyHas) {
      item = items.find((item) => item.url === url)
      item.timeStamp = +new Date()
    } else {
      item = {
        url,
        timeStamp: +new Date()
      }
      items.push(item)
    }

    ipcMain.emit('broadcast-web-image-added', { type: key, item })
    return this.store.set(key, items)
  }

  removeImage(type, url) {
    const items = this.store.get(type)
    const index = items.indexOf(url)
    const item = items[index]
    if (index === -1) return
    items.splice(index, 1)
    ipcMain.emit('broadcast-web-image-removed', { type, item })
    return this.store.set(type, items)
  }

  /**
   *
   * @param {string} key
   * return a promise
   */
  getItem(key) {
    const { encryptKeys, serviceName } = this
    if (encryptKeys.includes(key)) {
      return keytar.getPassword(serviceName, key)
    } else {
      const value = this.store.get(key)
      return Promise.resolve(value)
    }
  }

  async setItem(key, value) {
    const { encryptKeys, serviceName } = this
    if (key === 'screenshotFolderPath') {
      ensureDirSync(value)
    }
    ipcMain.emit('broadcast-user-data-changed', { [key]: value })
    if (encryptKeys.includes(key)) {
      try {
        return await keytar.setPassword(serviceName, key, value)
      } catch (err) {
        log.error('Keytar error:', err)
      }
    } else {
      return this.store.set(key, value)
    }
  }

  /**
   * Change multiple setting entries.
   *
   * @param {Object.<string, *>} settings A settings object or subset object with key/value entries.
   */
  setItems(settings) {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    Object.keys(settings).forEach((key) => {
      this.setItem(key, settings[key])
    })
  }

  _listenForIpcMain() {
    // local main events
    ipcMain.on('set-image-folder-path', (newPath) => {
      this.setItem('imageFolderPath', newPath)
    })

    // events from renderer process
    ipcMain.on('mt::ask-for-user-data', async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const userData = await this.getAll()
      win.webContents.send('mt::user-preference', userData)
    })

    ipcMain.on('mt::ask-for-modify-image-folder-path', async (e, imagePath) => {
      if (!imagePath) {
        const win = BrowserWindow.fromWebContents(e.sender)
        const { filePaths } = await dialog.showOpenDialog(win, {
          properties: ['openDirectory', 'createDirectory']
        })
        if (filePaths && filePaths[0]) {
          imagePath = filePaths[0]
        }
      }
      if (imagePath) {
        this.setItem('imageFolderPath', imagePath)
      }
    })

    ipcMain.on('mt::set-user-data', (e, userData) => {
      this.setItems(userData)
    })

    // TODO: Replace sync. call.
    ipcMain.on('mt::ask-for-image-path', async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const { filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          {
            name: 'Images',
            extensions: IMAGE_EXTENSIONS
          }
        ]
      })

      if (filePaths && filePaths[0]) {
        e.returnValue = filePaths[0]
      } else {
        e.returnValue = ''
      }
    })

    ipcMain.handle('mt::picgo-upload', async (e, { uploader, cliScript, localPath }) => {
      const getPreferredPathEnv = () => {
        const extras =
          process.platform === 'darwin'
            ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
            : process.platform === 'linux'
              ? ['/usr/local/bin', '/usr/bin', '/bin']
              : []
        const cur = (process.env.PATH || '').split(':')
        const merged = [...cur]
        for (const p of extras) if (p && !merged.includes(p)) merged.push(p)
        return merged.filter(Boolean).join(':')
      }
      const resolvePicgoBinary = () => {
        const candidates =
          process.platform === 'win32'
            ? ['picgo', 'picgo.exe']
            : [
              'picgo',
              '/opt/homebrew/bin/picgo',
              '/usr/local/bin/picgo',
              '/usr/bin/picgo',
              `${process.env.HOME}/.npm-global/bin/picgo`,
              `${process.env.HOME}/.npm/bin/picgo`,
              '/usr/local/lib/node_modules/.bin/picgo'
            ]
        for (const c of candidates) {
          try {
            if (c.startsWith('/')) {
              if (fs.existsSync(c)) return c
            } else if (commandExists.sync(c)) {
              return c
            }
          } catch {}
        }
        return null
      }
      const parsePicgoOutput = (text) => {
        const raw = String(text || '')
        // eslint-disable-next-line no-control-regex
        const cleaned = raw.replace(/\u001b\[[0-9;]*m/g, '') // strip ANSI colors
        try {
          const lines = cleaned
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
          for (const line of lines) {
            if (
              (line.startsWith('{') && line.endsWith('}')) ||
              (line.startsWith('[') && line.endsWith(']'))
            ) {
              try {
                const obj = JSON.parse(line)
                if (obj) {
                  // 仅在明确成功时返回 URL
                  if (obj.success === true && typeof obj.imgUrl === 'string') return obj.imgUrl
                  if (obj.success === true && Array.isArray(obj.result) && obj.result.length > 0) {
                    return String(obj.result[obj.result.length - 1])
                  }
                  if (obj.success === true && typeof obj.url === 'string') return obj.url
                }
              } catch {}
            }
            // 仅在包含 success 关键词时接受 URL
            const kv = line.match(/(?:success|succeeded|uploaded)\s*:?\s*(https?:\/\/\S+)/i)
            if (kv && kv[1]) return kv[1]
          }
          // last non-empty line may be the URL itself
          // 不再使用最后一行 URL 兜底，避免误判成功
        } catch {}
        const marker = cleaned.split('[PicGo SUCCESS]:')
        if (marker.length >= 2) {
          const candidate = marker[marker.length - 1].trim()
          if (/^https?:\/\//i.test(candidate)) return candidate
        }
        // 不再用任意 URL 兜底
        return null
      }
      return await new Promise((resolve, reject) => {
        const env = { ...process.env, PATH: getPreferredPathEnv() }
        if (uploader === 'picgo') {
          const cmd = resolvePicgoBinary()
          if (!cmd) return reject(new Error('PicGo command not found in PATH'))
          exec(`${cmd} u "${localPath}"`, { env }, (err, data, stderr) => {
            if (err) return reject(err)
            const url = parsePicgoOutput(String(data || '') + (stderr ? `\n${String(stderr)}` : ''))
            if (url) resolve(url)
            else reject(new Error(`PicGo upload error: cannot parse output`))
          })
        } else {
          execFile(cliScript, [localPath], { env }, (err, data) => {
            if (err) return reject(err)
            resolve(String(data || '').trim())
          })
        }
      })
    })

    ipcMain.handle('mt::get-system-fonts', async () => {
      try {
        const fonts = await getFonts()
        if (fonts && fonts.length) return fonts
      } catch {
        // fallthrough al fallback da registro (solo Windows)
      }
      if (process.platform === 'win32') {
        try {
          return await getFontsFromRegistry()
        } catch {
          return []
        }
      }
      return []
    })

    ipcMain.handle('mt::search-files', async (e, { directories, inclusions, options = {} }) => {
      const rg =
        process.env.MARKTEXT_RIPGREP_PATH || vscodeRgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')
      const LIMIT = 30
      const results = []
      const prepareGlobs = (globs, projectRootPath) => {
        const out = []
        for (let pattern of globs || []) {
          pattern = pattern.replace(new RegExp(`\\${path.sep}`, 'g'), '/')
          if (pattern.length === 0) continue
          const projectName = path.basename(projectRootPath)
          if (pattern === projectName) {
            out.push('**/*')
            continue
          }
          if (pattern.startsWith(projectName + '/')) pattern = pattern.slice(projectName.length + 1)
          if (pattern.endsWith('/')) pattern = pattern.slice(0, -1)
          pattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`
          out.push(pattern)
          out.push(pattern.endsWith('/**') ? pattern : `${pattern}/**`)
        }
        return out
      }
      const searchDir = (directoryPath) =>
        new Promise((resolve, reject) => {
          const args = ['--files']
          if (options.followSymlinks) args.push('--follow')
          if (options.includeHidden) args.push('--hidden')
          if (options.noIgnore) args.push('--no-ignore')
          for (const inc of prepareGlobs(inclusions, directoryPath)) args.push('--iglob', inc)
          args.push('--', directoryPath)
          let child
          try {
            child = spawn(rg, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] })
          } catch (err) {
            return reject(err)
          }
          let buffer = ''
          let bufferError = ''
          let done = false
          const finish = (fn, arg) => {
            if (!done) {
              done = true
              fn(arg)
            }
          }
          child.on('close', (code) => {
            if (code !== null && code > 1) finish(reject, new Error(bufferError))
            else finish(resolve)
          })
          child.on('error', (err) => finish(reject, err))
          child.stderr.on('data', (c) => {
            bufferError += c
          })
          child.stdout.on('data', (chunk) => {
            if (done) return
            buffer += chunk
            const lines = buffer.split('\n')
            buffer = lines.pop()
            for (const line of lines) {
              if (line) results.push(line)
              if (results.length > LIMIT) {
                child.kill()
                finish(resolve)
                return
              }
            }
          })
        })
      for (const dir of directories) {
        if (results.length > LIMIT) break
        await searchDir(dir)
      }
      return results
    })

    // Ricerca full-text nel contenuto di una cartella (thin wrapper IPC su `searchInFolder`):
    // legge i default persistenti dalle preferenze `search*` e li passa alla funzione riusabile,
    // che il task2 potrà richiamare direttamente dal main senza passare da IPC.
    ipcMain.handle('mt::search-in-folder', async (e, { directory, query, options = {} } = {}) => {
      const preferences = readSearchPreferences()
      return searchInFolder(directory, query, options, preferences)
    })
  }
}

export default DataCenter
export { searchInFolder, readSearchPreferences }
