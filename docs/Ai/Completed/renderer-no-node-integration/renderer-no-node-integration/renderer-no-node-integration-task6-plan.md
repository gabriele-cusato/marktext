# renderer-no-node-integration — task6 — plan: ricerca file (ripgrep) + font-list nel main

## Obiettivo
Spostare nel main gli ultimi due usi di `child_process` del renderer:
1. **Ricerca file** (Quick Open): oggi `FileSearcher`/`RipgrepDirectorySearcher` lanciano `rg --files` nel
   renderer via `spawn`. Portare lo spawn + `prepareGlobs` nel main dietro un IPC che ritorna l'elenco
   dei path (cap a 30, come oggi). Eliminare i due moduli `node/` morti.
2. **font-list** (`fontTextBox/index.vue:111`): `require('font-list')` dinamico → handler IPC nel main.

## Prerequisiti bloccanti
- `commands/quickOpen.js` usa `FileSearcher` solo per la ricerca su disco (verificato); il filtro tab in
  RAM (`_doSearch`, righe 99-118) resta nel renderer, invariato.
- `node/fileSearcher.js` importato SOLO da `quickOpen.js:3`; `node/ripgrepSearcher.js` importato SOLO da
  `fileSearcher.js:2` (verificato) → dopo la riscrittura di quickOpen sono morti e vanno eliminati.
- `node/paths.js` (RendererPaths) è usato da `bootstrap.js:2,67` per altri path → NON toccarlo.
- Nel main sono importabili `@vscode/ripgrep` (rgPath) e `font-list` (già dipendenze del progetto).
- `dataCenter/index.js` ha `_listenForIpcMain()` già registrato all'avvio (vi è già l'handler `mt::picgo-upload` del task5): home pragmatica per i nuovi handler renderer-service.
- NON toccare: `fileSystem.js` (task5), `src/main/config.js` e plugin Vite (task7), `node/paths.js`.
- NON buildare né avviare l'app. VIETATO qualsiasi comando git. Skill: `coding-standard`.

## File da toccare
1. `src/main/dataCenter/index.js` — 2 handler nuovi: `mt::search-files`, `mt::get-system-fonts` + import (`spawn` da 'child_process' — già importato nel task5, `rgPath` da '@vscode/ripgrep', `path`, `getFonts` da 'font-list').
2. `src/renderer/src/commands/quickOpen.js` — rimuovere `FileSearcher`; riscrivere il branch ricerca-disco di `_doSearch`.
3. `src/renderer/src/components/prefComponents/common/fontTextBox/index.vue` — riga ~111: `require('font-list')` → IPC.
4. ELIMINARE: `src/renderer/src/node/fileSearcher.js`, `src/renderer/src/node/ripgrepSearcher.js`.

## Decisioni di design (già prese — snippet vincolanti)

### main — `dataCenter/index.js`
Import in testa (aggiungere quelli mancanti): `import { spawn } from 'child_process'` (già dal task5),
`import { rgPath as vscodeRgPath } from '@vscode/ripgrep'`, `import path from 'path'`,
`import { getFonts } from 'font-list'`.
Dentro `_listenForIpcMain()`:
```js
ipcMain.handle('mt::get-system-fonts', async () => {
  try { return await getFonts() } catch { return [] }
})

ipcMain.handle('mt::search-files', async (e, { directories, inclusions, options = {} }) => {
  const rg = process.env.MARKTEXT_RIPGREP_PATH || vscodeRgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')
  const LIMIT = 30
  const results = []
  const prepareGlobs = (globs, projectRootPath) => {
    const out = []
    for (let pattern of globs || []) {
      pattern = pattern.replace(new RegExp(`\\${path.sep}`, 'g'), '/')
      if (pattern.length === 0) continue
      const projectName = path.basename(projectRootPath)
      if (pattern === projectName) { out.push('**/*'); continue }
      if (pattern.startsWith(projectName + '/')) pattern = pattern.slice(projectName.length + 1)
      if (pattern.endsWith('/')) pattern = pattern.slice(0, -1)
      pattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`
      out.push(pattern)
      out.push(pattern.endsWith('/**') ? pattern : `${pattern}/**`)
    }
    return out
  }
  const searchDir = (directoryPath) => new Promise((resolve, reject) => {
    const args = ['--files']
    if (options.followSymlinks) args.push('--follow')
    if (options.includeHidden) args.push('--hidden')
    if (options.noIgnore) args.push('--no-ignore')
    for (const inc of prepareGlobs(inclusions, directoryPath)) args.push('--iglob', inc)
    args.push('--', directoryPath)
    let child
    try { child = spawn(rg, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] }) }
    catch (err) { return reject(err) }
    let buffer = '', bufferError = '', done = false
    const finish = (fn, arg) => { if (!done) { done = true; fn(arg) } }
    child.on('close', (code) => { if (code !== null && code > 1) finish(reject, new Error(bufferError)); else finish(resolve) })
    child.on('error', (err) => finish(reject, err))
    child.stderr.on('data', (c) => { bufferError += c })
    child.stdout.on('data', (chunk) => {
      if (done) return
      buffer += chunk
      const lines = buffer.split('\n'); buffer = lines.pop()
      for (const line of lines) {
        if (line) results.push(line)
        if (results.length > LIMIT) { child.kill(); finish(resolve); return }
      }
    })
  })
  for (const dir of directories) {
    if (results.length > LIMIT) break
    await searchDir(dir)
  }
  return results
})
```
Note: `rg --files -- <dirAssoluto>` con `cwd=<dirAssoluto>` stampa path ASSOLUTI (come oggi). Il cap a 30
replica `didSearchPaths > 30 → cancel` dell'originale.

### renderer — `quickOpen.js`
- Rimuovere `import FileSearcher from '@/node/fileSearcher'`.
- Nel costruttore: rimuovere `this._directorySearcher = new FileSearcher()` (lasciare `this._cancelFn = null`).
- In `_doSearch`, il **branch iniziale** (opened files/tabs in RAM, righe ~95-128) resta INVARIATO.
- Sostituire il branch finale "Search root directory on disk" (righe ~131-174, quello con `new Promise`
  e `this._directorySearcher.search(...)`) con:
  ```js
  return window.electron.ipcRenderer
    .invoke('mt::search-files', {
      directories: [rootPath],
      inclusions: this._getInclusions(query),
      options: {}
    })
    .then((paths) => {
      this._cancelFn = null
      for (const p of paths) searchResult.push(p)
      return searchResult.map((pathname) => {
        const item = { id: pathname }
        Object.assign(item, this._getPath(pathname))
        return item
      })
    })
    .catch((error) => {
      this._cancelFn = null
      throw error
    })
  ```
  (`_getInclusions`, `_getPath`, il filtro tab e tutto il resto restano invariati.)
- Nota comportamento (accettata): la cancellazione della ricerca-disco in volo non è più immediata; il
  debounce da 300ms in `search()` (righe 40-46) e il cap a 30 lato main la rendono ininfluente. `searchResult`
  è locale alla singola chiamata → nessuna contaminazione tra query successive.

### renderer — `fontTextBox/index.vue`
Riga ~111, dentro `onMounted(async () => {...})`: sostituire
```js
const { getFonts } = require('font-list')
const fonts = await getFonts()
```
con
```js
const fonts = await window.electron.ipcRenderer.invoke('mt::get-system-fonts')
```
(Il resto della gestione `fonts` resta invariato.)

### Eliminazione moduli morti
Cancellare i file `src/renderer/src/node/fileSearcher.js` e `src/renderer/src/node/ripgrepSearcher.js`
(nessun altro importer dopo la riscrittura di quickOpen — verificare con grep prima di cancellare).

## Sottoproblemi (in quest'ordine)
1. main: handler `mt::get-system-fonts` + `mt::search-files` in dataCenter + import mancanti.
2. quickOpen.js: rimosso FileSearcher, branch disco → invoke `mt::search-files`.
3. fontTextBox/index.vue: `require('font-list')` → invoke `mt::get-system-fonts`.
4. Grep di sicurezza: confermare che `node/fileSearcher` e `node/ripgrepSearcher` non abbiano più importer, poi ELIMINARE i due file.
5. Verifica statica: `grep -rn "child_process\|require('font-list')\|from '@/node/fileSearcher'\|from '@/node/ripgrepSearcher'" src/renderer` → ZERO. Registrare nel worklog.

## Fatti già verificati (2026-07-07)
- quickOpen `_doSearch`: filtro tab in RAM (invariato) + ricerca disco via FileSearcher (`rg --files`, inclusions da `_getInclusions(query)`, cap 30).
- rg output = path assoluti (dir arg assoluto). `prepareGlobs` porta i glob a `**/pattern` + `pattern/**`.
- Importer unici: fileSearcher←quickOpen, ripgrepSearcher←fileSearcher. paths.js←bootstrap (NON toccare).
- `font-list` e `@vscode/ripgrep` sono dipendenze già presenti, importabili dal main.
