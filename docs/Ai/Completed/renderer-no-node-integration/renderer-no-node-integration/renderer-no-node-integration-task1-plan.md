# renderer-no-node-integration — task1 — plan: eliminare `process.*` diretto dal renderer

## Obiettivo
Rimuovere ogni accesso diretto a `process.*` (Node) dal processo **renderer**, usando ciò che il
preload già espone (`window.electron.process.platform` / `window.electron.process.env`, forniti da
`@electron-toolkit/preload`) e aggiungendo la sola primitiva mancante (`resourcesPath`). Questo task
NON tocca `fs`, `crypto`, `os`, `child_process`, `Buffer`, né `@electron/remote` (task successivi).
Motivo: è il gruppo a più basso rischio e più alta leva (l'hub `util/index.js` copre ~47 consumatori
di `process.platform` cambiando 3 righe).

## Prerequisiti bloccanti
- `src/preload/index.js` deve esporre `window.electron` con `...electronAPI` (verificato: righe 86-89/99).
- `window.electron.process.platform` e `window.electron.process.env.<VAR>` devono funzionare già oggi
  (verificato: usati in `src/renderer/src/store/index.js:8-9` in codice funzionante). Se non fosse
  così, fermarsi senza modificare.
- NON toccare: `fs`, `crypto`, `os`, `child_process`, `Buffer`, `@electron/remote`, la config finestra
  (`src/main/config.js`), il plugin Vite. Sono di altri task; toccarli qui creerebbe conflitti.
- NON buildare né avviare l'app (lo fa l'utente). VIETATO qualsiasi comando git (DECISIONS 2026-07-01).
- Skill di codice: `coding-standard`.

## File da toccare
1. `src/preload/index.js` — aggiungere l'esposizione di `resourcesPath` (unica primitiva mancante).
2. `src/renderer/src/util/index.js` — righe 162-164: hub `isOsx/isWindows/isLinux`.
3. `src/renderer/src/bootstrap.js` — riga 7: `process.env.NODE_ENV`.
4. `src/renderer/src/store/project.js` — riga 98: `process.env.NODE_ENV`.
5. `src/renderer/src/prefComponents/sideBar/config.js` — riga 448: guard `process.env.NODE_ENV`.
6. `src/renderer/src/commands/utils.js` — righe 5,9,13-14: `process.resourcesPath`, `process.env.APPIMAGE`, `process.platform`.
7. `src/renderer/src/components/editorWithTabs/editor.vue` — riga 1113: `process.env.UNSPLASH_ACCESS_KEY`.
8. `src/renderer/src/node/paths.js` — righe 21,23: `process.env.MARKTEXT_RIPGREP_PATH`.

> `node/paths.js` è concettualmente legato a ripgrep (task3), ma qui usa SOLO `process.env`: si
> converte la sola lettura env, senza toccare la logica ripgrep.

## Decisioni di design (già prese — l'agente NON deve sceglierne altre)
- **platform**: sostituire `process.platform` con `window.electron.process.platform`.
- **env**: sostituire `process.env.<VAR>` con `window.electron.process.env.<VAR>`.
- **resourcesPath (mancante nel preload)**: aggiungere in `src/preload/index.js` un oggetto dedicato,
  esposto sia nel branch `contextIsolated` (con `contextBridge.exposeInMainWorld`) sia nel branch
  `else` (assegnazione a `window`), coerente con lo stile esistente:
  ```js
  const processExtraAPI = {
    resourcesPath: process.resourcesPath
  }
  ```
  esporlo come `window.marktextEnv` (nome nuovo, non collide). Nel renderer usare
  `window.marktextEnv.resourcesPath` al posto di `process.resourcesPath`.
- **NODE_ENV**: `window.electron.process.env.NODE_ENV`. Mantenere identica la semantica dei confronti
  (`=== 'development'`, `!== 'production'`, ecc.), cambiando solo la sorgente.
- In `commands/utils.js` riga ~13-14, `process.env.APPIMAGE` → `window.electron.process.env.APPIMAGE`.

## Sottoproblemi (blocchi logici, in quest'ordine)
1. `preload/index.js`: definire `processExtraAPI` ed esporre `window.marktextEnv` in entrambi i branch.
2. `util/index.js` 162-164: `isOsx/isWindows/isLinux` da `window.electron.process.platform`.
3. `bootstrap.js`, `store/project.js`, `prefComponents/sideBar/config.js`: `NODE_ENV` da `window.electron.process.env`.
4. `commands/utils.js`: `resourcesPath` da `window.marktextEnv`, `APPIMAGE`/`platform` da `window.electron.process`.
5. `editor.vue` 1113: `UNSPLASH_ACCESS_KEY` da `window.electron.process.env`.
6. `node/paths.js` 21,23: `MARKTEXT_RIPGREP_PATH` da `window.electron.process.env`.
7. Verifica statica: `grep -n "process\.(platform|env|resourcesPath)" src/renderer/src` → restano solo
   `window.electron.process.*`, `window.marktextEnv.*` e gli usi GIÀ safe (`window.electron.process...`),
   più eventuali `process.*` che NON sono nel renderer o sono nei file di altri task (fileSystem.js,
   node/ripgrep — quelli restano, li fa task3). Elencare nel worklog gli eventuali `process.*` residui
   e a quale task appartengono, senza toccarli.

## Fatti già verificati (dall'esplorazione 2026-07-07)
- Hub platform: `src/renderer/src/util/index.js:162-164` esporta isOsx/isWindows/isLinux (47 consumatori).
- `process.env` diretto: bootstrap.js:7, store/project.js:98, sideBar/config.js:448, commands/utils.js,
  editor.vue:1113, node/paths.js:21,23. `process.resourcesPath`/`APPIMAGE`/`platform`: commands/utils.js:5,9,13-14.
- GIÀ safe (NON toccare): `store/index.js:8-9` usa già `window.electron.process.*`.
- Preload branch attivo oggi = `else` (contextIsolation:false); il branch contextBridge esiste già ed
  entrerà in funzione al flip (task4). Esporre `window.marktextEnv` in ENTRAMBI i branch.
- `process.platform` diretto resta usato anche in `util/fileSystem.js` (task3) e nel preload stesso
  (lecito, il preload è Node): NON sono di questo task.
