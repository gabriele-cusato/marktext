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
        return await getFonts()
      } catch {
        return []
      }
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
  }
}

export default DataCenter
