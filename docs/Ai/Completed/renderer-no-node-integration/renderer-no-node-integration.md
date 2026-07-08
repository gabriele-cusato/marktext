# Renderer No Node Integration — Isolamento Node dal Renderer, Preload+IPC, Flip Security

**Scopo:** togliere ogni uso diretto di Node dal renderer (built-in, process, @electron/remote), spostandolo nel main e esponendolo via preload/IPC, poi flip `nodeIntegration:false` + `contextIsolation:true` per sandboxing. Elimina deprecazione @electron/remote e warning crypto.fips/fs.F_OK dal plugin Vite.

**Origine:** feature complementare electron-upgrade (DECISIONS 2026-07-07), composta da task1-8 (refactor) + task9 (flip config).

**Quando leggerlo:** prima di modificare renderer/process access, IPC handler, preload esposure, muya cross-env, o toccare electron config nodeIntegration.

**Stato:** ✅ **COMPLETATA**. Task 1-8 (refactor) + task9 (flip) + task9b (coda lib terze parti) applicati e verificati a runtime: e2e full 11/11 PASS sotto `nodeIntegration:false`+`contextIsolation:true`+`sandbox:false`, warning `crypto.fips`/`fs.F_OK` spariti, `@electron/remote` rimosso anche da package.json, packaged `build:win` OK.

---

## Task Implementati (1-8)

1. **Task 1 — process/env/resourcesPath**: refactor `window.electron.process.*` + `window.marktextEnv` hub in `util/index.js`
2. **Task 2 — Elimina @electron/remote V1**: window controls + clipboard + app-menu popup + stato finestra via IPC (`mt::window-*`, `mt::popup-*`)
3. **Task 3 — Context menu sidebat/tabs**: ricostruzione nel main via `Menu.buildFromTemplate`, `@electron/remote` rimosso dal renderer
4. **Task 4 — Letture file export/temi**: via `window.fileUtils.readFile/readdir` (preload)
5. **Task 5 — Upload immagini (fileSystem.js)**: Web Crypto hash, base64/tmpdir via preload, picgo `exec` → main IPC
6. **Task 6 — Ricerca file + font-list**: ripgrep e font-list migratti a main IPC, moduli `node/fileSearcher` e `node/ripgrepSearcher` **eliminati**
7. **Task 7 — global → window.marktext**: migrazione completa renderer + muya
8. **Task 8 — Cross-env builtin**: rimossi `path`/`zlib` da muya, `envPaths` path, `keybinding` process.platform via guard e fallback

---

## Modifiche File

| Cosa | File | Dettaglio |
|---|---|---|
| Processo/env hub | `src/renderer/src/util/index.js` | Nuove costanti `process.*`, `resourcesPath`, env access |
| Window controls | `src/main/app/index.js` | Handler `mt::window-{toggle-full-screen,state}` (invoke) |
| Context menu | `src/main/menu/index.js` | Handler `mt::popup-{app-menu,context-menu}` (invoke) |
| Ricerca/fonts | `src/main/dataCenter/index.js` | Handler `mt::picgo-upload`, `mt::search-files`, `mt::get-system-fonts` |
| Preload wrapper | `src/preload/index.js` | `fileUtils`, `path`, `marktextEnv`, `commandExists`, `i18nUtils` esposti; aggiunti `ipcRenderer.invoke` per IPC |
| Muya cross-env | `src/muya/lib/` | `path.resolve` → `window.path.resolve`; zlib deflate → `window.marktextEnv.deflateSync` |
| Common cross-env | `src/common/envPaths.js`, `keybinding.js` | Guard `typeof process`, fallback `navigator.userAgent` (condiviso main+renderer) |
| Store di editor | `src/renderer/src/store/editor.js` | Rimozione chiavi Node-dipendenti, async IPC dove necessario |
| Clipboard refactor | `src/renderer/src/util/clipboard.js` + `src/preload/index.js` | Sostituzione preload direct-module con IPC invoke (vedere feature separata clipboard-ipc-migration) |
| Bug fix lightTouch | `src/renderer/src/store/editor.js` | Fix mergeWithOriginal inline: `resuscitavva` cancellazioni con lightTouch enabled, mixin di rimozione contenuto assorbito dalla normalizzazione |

---

## Scoperte Importanti (NON riscoprire)

1. **Ricerca full-text ripgrep morta** — modulo `ripgrepSearcher.js` nessun caller attivo (codice residuo). Solo ricerca nome file (`FileSearcher` → IPC) è wired. **Decisione:** eliminati entrambi i moduli durante task6.

2. **`global` non esiste sotto `nodeIntegration:false`** — migrazione completa task7 a `window.marktext`. Muya legge `window.marktext` nel branch contextIsolation.

3. **Muya gira nel renderer e usa Node builtins** — path + zlib originali (plugin Vite faceva da shim). Ora: path via `window.path.resolve` + deflate via preload (`window.marktextEnv.deflateSync`, Node zlib nel preload lato main).

4. **`common/envPaths` e `common/keybinding` condivisi main+renderer** — NON usano `window.*`, usano guard cross-env (`typeof process`/`navigator.userAgent`). Importabili sia da main che da renderer (no circular: solo Node in main, browser nel renderer).

5. **`common/i18n` e `common/filesystem` importano Node** ma usati SOLO da preload/main (i18nUtils wrapper nel preload). Non entrano nel bundle renderer anche se importati.

6. **`sandbox:false` VA AGGIUNTO al flip** — il preload usa `fs`/`os`/`command-exists` (Node). Con `nodeIntegration:true` Electron forza sandbox=false; togliendolo il default moderno è true → romperebbe il preload. È prerequisito del flip.

7. **Rimozione plugin Vite `renderer({nodeIntegration:true})`** elimina i warning crypto.fips/fs.F_OK — il payoff della feature (warning erano enumerazione builtins del plugin).

8. **Preload: doppio branch (contextBridge/else) simmetrico** — entrambi espongono le stesse 7 chiavi (electron, rgPath, fileUtils, path, commandExists, i18nUtils, marktextEnv). Flip parte branch contextBridge. `window.electron.ipcRenderer` funziona via @electron-toolkit/preload.

9. **`@electron/remote` dichiarato ma non più usato** — package.json ancora ha la dipendenza (cleanup futuro, opzionale, non bloccante).

10. **Task5 `parsePicgoOutput` regex ANSI** — escape `[...]` verificato nella copia nel main (byte-identico all'originale renderer).

11. **Bug lightTouch mergeWithOriginal** — risolto inline in `store/editor.js`: con lightTouch ON, `mergeWithOriginal` preservava i gap/tail solo-original anche quando contenevano righe **cancellate** (non solo blank), resuscitando il contenuto rimosso (es. immagine/paragrafo) → Ctrl+S non persisteva le cancellazioni. Fix: preservare il gap/tail original SOLO se puramente vuoto in entrambi i lati; se orig ha contenuto e regen no (= cancellazione), usare il rigenerato → la cancellazione è onorata.
12. **Bug bollino-untitled** — risolto inline in `store/editor.js` (`LISTEN_FOR_CONTENT_CHANGE`): tornando un untitled al vuoto (testo cancellato / Ctrl+Z / immagine tolta) il bollino "non salvato" non spariva, perché il confronto `markdown === originalMarkdown` era esatto ma il vuoto di Muya è `''` o `'\n'` (secondo `trimTrailingNewline`) e la baseline untitled poteva essere `''`/`'\n'`/`null`. Fix: baseline `null`→`''` per untitled + equivalenza "entrambi vuoti" (solo trailing-newline), senza toccare il confronto del contenuto reale.

---

## Task 9 (flip) + task9b — Fatto e verificato

- **Edit 1:** `src/main/config.js` editorWinOptions + preferencesWinOptions → `contextIsolation:true`, `nodeIntegration:false`, `sandbox:false` (aggiunto); preload path → `../preload/index.cjs`.
- **Edit 2:** `electron.vite.config.mjs` → rimosso `renderer({nodeIntegration:true})` plugin + import; preload `entryFileNames` → `.cjs` (con `type:module` un `.js` CJS è trattato come ESM).
- **Edit 3:** grep-gate finale su `src/renderer/**` + `src/muya/**` (zero residui Node). Nota: il gate iniziale escludeva erroneamente i `require()` statici di snabbdom/turndown in muya → convertiti a `import` (snabbdom-to-html, joplin-turndown-plugin-gfm namespace).

**task9b — coda del flip (lib terze parti con Node-globals emerse a runtime):**
- `electron-log` → entry `electron-log/renderer` nei 5 file renderer (main invariato).
- `@hfelix/electron-localshortcut` (`process.platform`) → Vite `define: { 'process.platform': ... }` sezione renderer.
- `fuzzaldrin` (`require('path').sep`) → `path-browserify` + alias `path` solo renderer. Nota futura: valutare `fuse.js` al posto di fuzzaldrin (toglie la legacy `path`).
- `native-keymap`: modulo nativo, va ricompilato (vedi CLAUDE.md "Build:win + rebuild moduli nativi su macchina con policy").

**Verifica:** e2e full 11/11 PASS, warning `crypto.fips`(DEP0093)/`fs.F_OK`(DEP0176) spariti in preview, packaged `build:win` OK. `@electron/remote` disinstallato da package.json/lockfile/node_modules.

---

## Mappa File (Rapida)

| Area | File principali |
|---|---|
| Processo/env | `src/renderer/src/util/index.js`, `src/preload/index.js` |
| IPC window/menu | `src/main/app/index.js`, `src/main/menu/index.js` |
| IPC picgo/search/fonts | `src/main/dataCenter/index.js` |
| Preload | `src/preload/index.js` |
| Muya cross-env | `src/muya/lib/` (path, deflate) |
| Common cross-env | `src/common/envPaths.js`, `src/common/keybinding.js` |
| Store | `src/renderer/src/store/editor.js` |
| Config security | `src/main/config.js`, `electron.vite.config.mjs` |

---

## Cross-Link

- **electron-upgrade** (`Completed/electron-upgrade/`): feature complementare, upgrade 39→43 al quale questo si appoggia
- **clipboard-ipc-migration** (`Completed/clipboard-ipc-migration/`): clipboard deprecato, fix separato, parte dell'ecosistema IPC
- **refactor-followup-fix** (`Completed/refactor-followup-fix/`): fix Element Plus + Quick Open crash emersi al test questa feature
