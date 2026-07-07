# renderer-no-node-integration — task1 — worklog: eliminare `process.*` diretto dal renderer

## Avanzamento
- [x] `preload/index.js`: `processExtraAPI` + `window.marktextEnv` esposto in entrambi i branch
- [x] `util/index.js` 162-164: `isOsx/isWindows/isLinux` da `window.electron.process.platform`
- [x] `bootstrap.js`, `store/project.js`, `sideBar/config.js`: `NODE_ENV` da `window.electron.process.env`
- [x] `commands/utils.js`: `resourcesPath` da `window.marktextEnv`, `APPIMAGE`/`platform` da `window.electron.process`
- [x] `editor.vue` 1113: `UNSPLASH_ACCESS_KEY` da `window.electron.process.env`
- [x] `node/paths.js` 21,23: `MARKTEXT_RIPGREP_PATH` da `window.electron.process.env`
- [x] Verifica statica: nessun `process.*` diretto residuo nel renderer fuori dai file di task3

## Verifica statica finale
Grep eseguito: `process\.(platform|env|resourcesPath)` su `src/renderer/src`.
Tutti gli usi diretti trattati da questo task sono stati sostituiti con
`window.electron.process.*` / `window.marktextEnv.resourcesPath`.

Residui `process.*` diretti (NON toccati, fuori scope di questo task):
- `src/renderer/src/util/fileSystem.js` righe 126, 128, 131, 139, 146, 147, 231, 238, 302
  (`process.platform`, `process.env.PATH`, `process.env.HOME`, `process.env` spread) — di competenza
  task3, come indicato esplicitamente nel plan ("`process.platform` diretto resta usato anche in
  `util/fileSystem.js` (task3)").

Nessun altro residuo trovato. Gli usi già `window.electron.process.*` preesistenti
(`store/index.js:8-9`) restano invariati come da plan.

## Test
(Da compilare dall'orchestratore dopo il test utente.)
