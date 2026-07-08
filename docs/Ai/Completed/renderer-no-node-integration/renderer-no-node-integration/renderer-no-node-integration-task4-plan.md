# renderer-no-node-integration — task4 — plan: letture file export/temi via preload (fs read, basso rischio)

## Obiettivo
Rimuovere gli usi diretti di `fs`/`fs/promises` nel renderer legati alla **lettura di file/tema per
l'export** (`pdf.js`, `exportSettings/index.vue`), instradandoli sul preload (`window.fileUtils`). NON
tocca `crypto`/`os`/`Buffer`/`child_process` (quelli sono in `fileSystem.js` → task5) né la ricerca
file/font (task6) né la config (task7).

## Prerequisiti bloccanti
- `window.fileUtils` esposto dal preload (verificato: `src/preload/index.js`), con `readFile`/`isFile`/`isDirectory` già presenti.
- `global.marktext.paths.userDataPath` disponibile nel renderer (usato oggi da pdf.js/exportSettings).
- NON toccare: `src/renderer/src/util/fileSystem.js` (task5), `src/renderer/src/node/**` e `commands/quickOpen.js` e `fontTextBox` (task6), `src/main/config.js` e plugin Vite (task7).
- NON buildare né avviare l'app. VIETATO qualsiasi comando git. Skill: `coding-standard`.

## File da toccare
1. `src/preload/index.js` — estendere `fileUtilsAPI`: aggiungere `readdir` e supporto `encoding` a `readFile`.
2. `src/renderer/src/util/pdf.js` — riga ~67: `fs.readFileSync(themePath,'utf8')`.
3. `src/renderer/src/components/editorWithTabs/editor.vue` — riga ~834: chiamata a `getCssForOptions`.
4. `src/renderer/src/components/exportSettings/index.vue` — righe ~292-293 (import), ~475/479 (`readdirSync`/`fsPromises.readFile`).

## Decisioni di design (già prese)

### preload (`fileUtilsAPI`)
- Estendere `readFile` per accettare un encoding opzionale:
  ```js
  readFile: (path, encoding) => fs.readFile(path, encoding)
  ```
  (con `encoding` undefined resta il comportamento attuale = Buffer; con `'utf8'` ritorna stringa.)
- Aggiungere:
  ```js
  readdir: (path) => fs.readdir(path)
  ```
  (ritorna array di nomi, come `fs.readdirSync`.) `fs` nel preload è `fs-extra` (già importato).

### pdf.js — `getCssForOptions`
- La funzione diventa **async**. Sostituire `const themeCSS = fs.readFileSync(themePath, 'utf8')` con
  `const themeCSS = await window.fileUtils.readFile(themePath, 'utf8')`. Rimuovere `import fs from 'fs'`.
- Il check `window.fileUtils.isFile(themePath)` resta.

### editor.vue — chiamante
- Riga ~834, dentro `handleExport` (già async): mettere `await` davanti alla chiamata a
  `getCssForOptions(...)`. Verificare che non ci siano altri chiamanti di `getCssForOptions` nel file
  (l'esplorazione indica questo come unico chiamante); se ce ne fossero altri, adeguarli con `await` e
  segnalarli nel worklog.

### exportSettings/index.vue — `loadThemesFromDisk`
- Rendere `loadThemesFromDisk` **async**. Sostituire:
  - `fs.readdirSync(themeDir)` → `await window.fileUtils.readdir(themeDir)`;
  - `await fsPromises.readFile(fullname, 'utf8')` → `await window.fileUtils.readFile(fullname, 'utf8')`.
  - Riscrivere il ciclo per usare `for...of` (invece di `forEach(async ...)` che non attende) così le
    `await` sono effettive e i temi vengono popolati correttamente prima del termine.
- Rimuovere gli import `import fs from 'fs'` e `import fsPromises from 'fs/promises'`.
- Il chiamante `showDialog` (riga ~359) può restare sincrono e invocare `loadThemesFromDisk()` senza
  await (fire-and-forget): popola un array reattivo, la UI si aggiorna alla risoluzione. NON serve
  rendere async `showDialog`.

## Sottoproblemi (in quest'ordine)
1. preload: `readFile(path, encoding)` + `readdir(path)` in `fileUtilsAPI`.
2. pdf.js: `getCssForOptions` async, `readFileSync` → `await window.fileUtils.readFile(...,'utf8')`, rimosso import fs.
3. editor.vue: `await getCssForOptions(...)` al chiamante (~834).
4. exportSettings: `loadThemesFromDisk` async con `for...of`, `readdir`/`readFile` via fileUtils, rimossi import fs/fsPromises.
5. Verifica statica: `grep -n "from 'fs'\|from 'fs/promises'\|readFileSync\|readdirSync" src/renderer/src` → i residui devono restare SOLO in `util/fileSystem.js` (task5). Elencarli nel worklog.

## Fatti già verificati (esplorazione 2026-07-07)
- pdf.js: `getCssForOptions` sync, unico chiamante `editor.vue:834` in `handleExport` (async).
- exportSettings: `loadThemesFromDisk` oggi usa `forEach(async...)` non atteso (bug latente: i temi
  potrebbero non essere pronti); il passaggio a `for...of` con await lo corregge di riflesso.
- `themeDir`/`themePath` derivano da `global.marktext.paths.userDataPath` + `'themes/export'`.
- `fs` nel preload = `fs-extra` (ha `readFile`/`readdir` che ritornano Promise).
