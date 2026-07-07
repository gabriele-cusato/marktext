# renderer-no-node-integration — task5 — plan: `fileSystem.js` (upload immagini) — crypto/os/Buffer/child_process fuori dal renderer

## Obiettivo
Eliminare da `src/renderer/src/util/fileSystem.js` ogni uso diretto di Node: `crypto`, `os.tmpdir`,
`Buffer`, `child_process` (`exec`/`execFile` per picgo/cliScript), `fs` (`statSync`/`constants`). Il
lancio dei processi picgo/cliScript va **nel main** via IPC; hashing e base64 diventano API web; tmpdir,
readFileBase64, isFileExecutableSync, unlink vanno esposti dal preload.

> Nota d'uso: l'utente NON usa l'uploader immagini a runtime (feature poco esercitata). Qui la priorità
> è che il codice **compili e sopravviva al flip** (task7) senza `Buffer`/`child_process`/`crypto` Node;
> la correttezza funzionale va comunque preservata 1:1.

## Prerequisiti bloccanti
- `window.fileUtils` (preload) già presente; `window.marktextEnv` già esiste (task1). `window.crypto.subtle`
  (Web Crypto) è disponibile nel renderer indipendentemente da nodeIntegration.
- `dataCenter/index.js` (main) ha `_listenForIpcMain()` con `ipcMain` e `BrowserWindow` già in scope (verificato).
- `command-exists` è già dipendenza (usata nel preload) → riutilizzabile nel main.
- NON toccare: `src/renderer/src/node/**`, `commands/quickOpen.js`, `fontTextBox` (task6), `src/main/config.js` e plugin Vite (task7). NON toccare `pdf.js`/`exportSettings` (già fatti task4).
- NON buildare né avviare l'app. VIETATO qualsiasi comando git. Skill: `coding-standard`.

## File da toccare
1. `src/preload/index.js` — aggiungere a `fileUtilsAPI`: `readFileBase64`, `isFileExecutableSync`, `unlink`; aggiungere a `processExtraAPI` (marktextEnv): `tmpdir`.
2. `src/main/dataCenter/index.js` — nuovo handler `ipcMain.handle('mt::picgo-upload', ...)` + helper (resolveBinary/PATH/parse) + import `child_process`.
3. `src/renderer/src/util/fileSystem.js` — rimuovere gli import Node e riscrivere hashing/tmpdir/Buffer/uploadByCommand/isFileExecutableSync.

## Decisioni di design (già prese — NON improvvisarne altre)

### preload
Aggiungere a `fileUtilsAPI`:
```js
readFileBase64: (path) => fs.readFile(path, 'base64'),   // fs-extra ritorna stringa base64
unlink: (path) => fs.remove(path),                        // fs-extra remove (idempotente)
isFileExecutableSync: (filepath) => {
  try {
    const stat = statSync(filepath)
    if (process.platform === 'win32') return stat.isFile()
    return stat.isFile() && (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
  } catch { return false }
}
```
Serve importare nel preload `statSync, constants` da `'fs'` (il preload è processo Node, lecito) — aggiungere l'import.
Aggiungere a `processExtraAPI`:
```js
tmpdir: tmpdir()
```
importando `{ tmpdir } from 'os'` nel preload.

### main — `dataCenter/index.js`
Importare in testa: `import { exec, execFile } from 'child_process'`, `import fs from 'fs'` (o `fs-extra`; per `existsSync` basta 'fs'), `import commandExists from 'command-exists'`.
Aggiungere dentro `_listenForIpcMain()` (stile coerente con gli altri handler del file):
```js
ipcMain.handle('mt::picgo-upload', async (e, { uploader, cliScript, localPath }) => {
  const getPreferredPathEnv = () => {
    const extras = process.platform === 'darwin'
      ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
      : process.platform === 'linux' ? ['/usr/local/bin', '/usr/bin', '/bin'] : []
    const cur = (process.env.PATH || '').split(':')
    const merged = [...cur]
    for (const p of extras) if (p && !merged.includes(p)) merged.push(p)
    return merged.filter(Boolean).join(':')
  }
  const resolvePicgoBinary = () => {
    const candidates = process.platform === 'win32'
      ? ['picgo', 'picgo.exe']
      : ['picgo', '/opt/homebrew/bin/picgo', '/usr/local/bin/picgo', '/usr/bin/picgo',
         `${process.env.HOME}/.npm-global/bin/picgo`, `${process.env.HOME}/.npm/bin/picgo`,
         '/usr/local/lib/node_modules/.bin/picgo']
    for (const c of candidates) {
      try {
        if (c.startsWith('/')) { if (fs.existsSync(c)) return c }
        else if (commandExists.sync(c)) return c
      } catch {}
    }
    return null
  }
  const parsePicgoOutput = (text) => { /* PORTARE IDENTICA la funzione da fileSystem.js righe 165-205 */ }
  return await new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: getPreferredPathEnv() }
    if (uploader === 'picgo') {
      const cmd = resolvePicgoBinary()
      if (!cmd) return reject(new Error('PicGo command not found in PATH'))
      exec(`${cmd} u "${localPath}"`, { env }, (err, data, stderr) => {
        if (err) return reject(err)
        const url = parsePicgoOutput(String(data || '') + (stderr ? `\n${String(stderr)}` : ''))
        if (url) resolve(url); else reject(new Error(`PicGo upload error: cannot parse output`))
      })
    } else {
      execFile(cliScript, [localPath], { env }, (err, data) => {
        if (err) return reject(err)
        resolve(String(data || '').trim())
      })
    }
  })
})
```
`parsePicgoOutput` va copiata **identica** da `fileSystem.js` (righe 165-205) nel main. NON reinventarla.

### renderer — `fileSystem.js`
- Rimuovere gli import: `crypto`, `{ statSync, constants } from 'fs'`, `{ exec, execFile } from 'child_process'`, `{ tmpdir } from 'os'`.
- **Hashing (Web Crypto)**:
  ```js
  export const getHash = async (content, encoding, type) => {
    const algo = type === 'sha1' ? 'SHA-1' : type === 'sha256' ? 'SHA-256' : type.toUpperCase()
    const buf = await window.crypto.subtle.digest(algo, new TextEncoder().encode(content))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  export const getContentHash = async (content) => getHash(content, 'utf8', 'sha1')
  ```
  (encoding usato solo con 'utf8' → TextEncoder è utf8; verificato: unico chiamante è interno.)
  Al chiamante `moveImageToFolder` riga ~74: `const hash = await getContentHash(imagePath)`.
- **Buffer**:
  - riga ~87: `const buffer = new Uint8Array(await image.arrayBuffer())` (poi `writeFile(imagePath, buffer)`; il 3° arg `'binary'` era già ignorato dal wrapper preload, ometterlo).
  - riga ~269 (branch github, immagine-path): sostituire le due righe `readFile`+`Buffer.from(...).toString('base64')` con `const base64 = await window.fileUtils.readFileBase64(imagePath)`.
  - riga ~290 (branch github, FileReader su ArrayBuffer): definire in modulo un helper e usarlo:
    ```js
    const arrayBufferToBase64 = (ab) => {
      const bytes = new Uint8Array(ab)
      let binary = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
      return btoa(binary)
    }
    ```
    e `uploadByGithub(arrayBufferToBase64(reader.result), image.name)`.
- **tmpdir** (riga ~213): `localPath = window.path.join(window.marktextEnv.tmpdir, \`${Date.now()}${suffix}\`)`.
- **uploadByCommand → IPC**: rimuovere `getPreferredPathEnv`/`resolvePicgoBinary`/`parsePicgoOutput` dal
  renderer (spostate nel main). Riscrivere `uploadByCommand`:
  ```js
  const uploadByCommand = async (uploader, filepath, suffix = '') => {
    let localIsPath = true
    let localPath = filepath
    if (typeof filepath !== 'string') {
      localIsPath = false
      const data = new Uint8Array(filepath)
      localPath = window.path.join(window.marktextEnv.tmpdir, `${Date.now()}${suffix}`)
      await window.fileUtils.writeFile(localPath, data)
    }
    try {
      const url = await window.electron.ipcRenderer.invoke('mt::picgo-upload', { uploader, cliScript, localPath })
      resolvePromise(url)
    } catch (err) {
      rejectPromise(err && err.message ? err.message : String(err))
    } finally {
      try { if (!localIsPath) await window.fileUtils.unlink(localPath) } catch {}
    }
  }
  ```
  (`cliScript` è già nello scope di `uploadImage` da `preferences`.)
- **isFileExecutableSync** (righe 299-313): sostituire il corpo con un wrapper al preload:
  ```js
  export const isFileExecutableSync = (filepath) => window.fileUtils.isFileExecutableSync(filepath)
  ```
  (resta SYNC per il chiamante `uploader/index.vue:394`.)

## Sottoproblemi (in quest'ordine)
1. preload: `readFileBase64`, `unlink`, `isFileExecutableSync` in fileUtils + `tmpdir` in marktextEnv + import `statSync,constants`/`tmpdir`.
2. main dataCenter: handler `mt::picgo-upload` + helper + `parsePicgoOutput` portata identica + import child_process/fs/command-exists.
3. renderer fileSystem.js: rimuovere import Node; hashing web-crypto (+ await al chiamante 74).
4. renderer fileSystem.js: Buffer → Uint8Array/readFileBase64/arrayBufferToBase64 (righe 87,269,290).
5. renderer fileSystem.js: tmpdir → marktextEnv; uploadByCommand → IPC; isFileExecutableSync → wrapper preload.
6. Verifica statica: `grep -n "from 'crypto'\|from 'os'\|from 'child_process'\|from 'fs'\|Buffer" src/renderer/src/util/fileSystem.js` → ZERO. Registrare nel worklog.

## Fatti già verificati (2026-07-07)
- `getContentHash` unico chiamante: fileSystem.js:74 (async). `getHash` solo interno. → hashing async safe.
- `isFileExecutableSync` chiamante: `uploader/index.vue:394` in contesto **sync** → NON renderlo async.
- `dataCenter/index.js:157-192` `_listenForIpcMain()` usa `ipcMain.on` + `BrowserWindow` + `dialog`; aggiungere lì `ipcMain.handle`.
- `writeFile` preload ignora il 3° argomento (encoding) → passare `Uint8Array` è sufficiente per la scrittura binaria.
- `command-exists` è già dipendenza del progetto (import nel preload).
