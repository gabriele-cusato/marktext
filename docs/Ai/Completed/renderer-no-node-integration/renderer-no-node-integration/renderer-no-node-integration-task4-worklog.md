# renderer-no-node-integration — task4 — worklog: letture file export/temi via preload

## Avanzamento
- [x] preload: `readFile(path, encoding)` + `readdir(path)` in `fileUtilsAPI`
- [x] pdf.js: `getCssForOptions` async, `readFileSync` → `window.fileUtils.readFile(...,'utf8')`, rimosso import fs
- [x] editor.vue: `await getCssForOptions(...)` al chiamante (~834)
- [x] exportSettings: `loadThemesFromDisk` async con `for...of`, `readdir`/`readFile` via fileUtils, rimossi import fs/fsPromises
- [x] Verifica statica: residui `fs`/`readFileSync`/`readdirSync` nel renderer solo in `util/fileSystem.js` (task5)

## Stato: DA TESTARE

## Verifica statica finale
Grep eseguito su `src/renderer/src`:
```
grep -rn "from 'fs'\|from 'fs/promises'\|readFileSync\|readdirSync" src/renderer/src
```
Unico risultato residuo: `src/renderer/src/util/fileSystem.js:3` — `import { statSync, constants } from 'fs'`
(fuori scope task4, di competenza task5, come previsto dal plan). Nessun residuo negli altri file del
renderer.

## Chiamanti di getCssForOptions
Grep su tutto `src`: unico chiamante confermato `src/renderer/src/components/editorWithTabs/editor.vue:834`
(dentro `handleExport`, già async). Nessun altro chiamante trovato; non sono state necessarie modifiche
aggiuntive oltre a `editor.vue`.

## Test
(Da compilare dall'orchestratore dopo il test utente.)
