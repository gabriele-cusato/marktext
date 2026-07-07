# HANDOFF — renderer-no-node-integration (+ coda electron-upgrade) — 2026-07-07

Ripresa rapida a sessione pulita. Leggere QUESTO file per primo, poi i plan/worklog dei singoli task.

## TL;DR stato
- **electron-upgrade**: CONCLUSA, testata, **committata+pushata**. Riassunto in `Completed/electron-upgrade/`.
- **renderer-no-node-integration**: **task1→task8 IMPLEMENTATI** (codice scritto), **NON testati**, **NON committati**.
- **task9 (flip nodeIntegration:false) NON fatto** — edit pronti qui sotto (§Task9).
- Base sicura per rollback = commit electron-upgrade già pushato. Le modifiche renderer 1-8 sono solo nel
  working tree (non committate): per annullare tutto basta scartare le modifiche non committate.

## Cosa fa la feature
Togliere ogni uso diretto di Node dal processo **renderer**, spostandolo in **main + preload/IPC**, poi
`nodeIntegration:false` + `contextIsolation:true`. Vantaggi: sicurezza (renderer sandboxed), sparizione
warning `crypto.fips`(DEP0093)/`fs.F_OK`(DEP0176) alla radice (rimuovendo il plugin Vite), via `@electron/remote`.

## Task fatti (1-8) — sintesi 1 riga + worklog
Cartella: `docs/Ai/InProgress/renderer-no-node-integration/`. Ogni task ha `-taskN-plan.md` e `-taskN-worklog.md`.
- **task1**: `process.*` → `window.electron.process.*` + `window.marktextEnv.resourcesPath` (hub `util/index.js`).
- **task2**: `@electron/remote` meccanico → IPC (window controls, clipboard, app-menu popup, stato finestra iniziale).
- **task3**: context menu sidebar/tabs ricostruiti nel main; `@electron/remote` **eliminato dal renderer** + init remote lato main rimossa.
- **task4**: letture file export/temi (`pdf.js`, `exportSettings`) via `window.fileUtils.readFile/readdir`.
- **task5**: `fileSystem.js` (upload immagini) — hash→Web Crypto, tmpdir/base64→preload/web, picgo `exec`→main IPC.
- **task6**: ricerca file (`node/` ripgrep) → main IPC; `font-list` → main IPC; moduli `node/fileSearcher.js`+`node/ripgrepSearcher.js` ELIMINATI.
- **task7**: `global.marktext` → `window.marktext` (renderer + muya).
- **task8**: builtin Node in muya (`path`,`zlib`) e common (`envPaths` path, `keybinding` process.platform) rimossi/cross-env.

## Nuovi canali IPC introdotti (renderer→main)
- `mt::window-toggle-full-screen`, `mt::window-state` (invoke) — `windowManager.js`
- `mt::popup-app-menu`, `mt::popup-context-menu` (invoke) — `menu/index.js`
- `mt::picgo-upload` (invoke), `mt::search-files` (invoke), `mt::get-system-fonts` (invoke) — `dataCenter/index.js`
Handler main-side raggruppati (pragmatico) in `dataCenter/index.js` per picgo/search/fonts.

## Scoperte importanti (NON riscoprire)
1. **Ricerca full-text ripgrep (`ripgrepSearcher.js`, `--json` match/range) era CODICE MORTO** (nessun chiamante). Solo la ricerca per NOME file (`FileSearcher`, `rg --files`) è wired a Quick Open → migrata; i due moduli node/ eliminati.
2. **`global` non esiste sotto `nodeIntegration:false`** → migrato tutto a `window.marktext` (task7). muya legge `window.marktext` (gira nel renderer).
3. **muya gira NEL renderer** e usava `path`+`zlib` reali (bridge del plugin Vite). Ora: `window.path.resolve` + deflate via preload (`window.marktextEnv.deflateSync`, Node zlib nel preload). `pako` NON è dipendenza.
4. **`common/envPaths` e `common/keybinding` sono CONDIVISI main+renderer** → fix cross-env (niente `window.*`): `joinPath` manuale; `isOsx` con guard `typeof process`/`navigator.userAgent`.
5. **`common/i18n` e `common/filesystem` importano Node** ma li usa SOLO il preload/main → OK, non entrano nel bundle renderer.
6. **`sandbox:false` VA AGGIUNTO al flip**: il preload usa `fs-extra`/`fs`/`os`/`command-exists` (Node). Con `nodeIntegration:true` Electron forza sandbox=false; togliendolo, il default recente è `true` → romperebbe il preload. (Assunzione da confermare con doc Electron.)
7. **Rimuovere il plugin `renderer({nodeIntegration:true})` da Vite** è ciò che elimina i warning crypto.fips/fs.F_OK (payoff della feature).
8. Preload: i due branch (contextBridge / else) espongono le STESSE 7 chiavi (electron, rgPath, fileUtils, path, commandExists, i18nUtils, marktextEnv). Al flip parte il branch contextBridge (già a posto). `window.electron.ipcRenderer` funziona sotto contextIsolation (via `@electron-toolkit/preload`).
9. **`@electron/remote` ancora dichiarato in package.json** ma non più usato in `src/` (rimozione dipendenza = cleanup opzionale futuro, non necessaria).
10. **task5 `parsePicgoOutput`**: la regex ANSI (`[...]`) ha dato problemi di escaping nella copia nel main — VERIFICARE che nel main sia byte-identica all'originale.

## === TASK9 (DA FARE): flip — edit pronti ===
Obiettivo: `nodeIntegration:false` + `contextIsolation:true` + `sandbox:false` sulle 2 finestre, rimuovere
il plugin Vite renderer, poi grep-gate finale. NON committare senza OK utente.

### Edit 1 — `src/main/config.js`
In **editorWinOptions.webPreferences** (righe 15-24) e **preferencesWinOptions.webPreferences** (righe 46-53),
sostituire in ENTRAMBE:
```
    contextIsolation: false,
    ...
    nodeIntegration: true,
```
con:
```
    contextIsolation: true,
    ...
    nodeIntegration: false,
    sandbox: false,
```
(lasciare `spellcheck: true`, `webSecurity: true`, `preload: ...` invariati). `sandbox: false` è nuovo, aggiungerlo a entrambe.

### Edit 2 — `electron.vite.config.mjs`
Nell'array `renderer.plugins` (righe ~99-106) RIMUOVERE completamente:
```js
renderer({
  nodeIntegration: true
}),
```
e rimuovere l'`import renderer from 'vite-plugin-electron-renderer'` (riga ~4) se non più usato.

### Edit 3 — grep-gate finale (bloccante prima di dichiarare fatto)
Su `src/renderer/**` e `src/muya/**` (escludendo `src/muya/lib/assets/libs/**` vendored e i `require()` statici snabbdom/turndown), verificare ZERO:
`\bglobal\.` (non i18n.global) · `\bprocess\.` (non `window.electron.process`) · `\bBuffer\b` · `require(` · `__dirname`/`__filename` · `import .* from '(fs|path|os|crypto|child_process|zlib|util|stream|events|buffer|node:.*)'` · `from '@electron/remote'` · `from '@/node/fileSearcher'`/`ripgrepSearcher`.
Se qualcosa emerge → risolvere PRIMA del build.

## Come riprendere domani (sessione pulita)
1. Aprire questo file + `renderer-no-node-integration.md` (plan madre).
2. Applicare TASK9 (edit 1-3 sopra) — è l'unico task di codice rimasto. Delegare ad Agent-Code con un plan
   `-task9-plan.md` (crearlo dagli edit qui sopra) o applicarli come modifica minima con OK utente.
3. Ambiente build = PC principale, VS2022 Community + nvm 22.21.1 + `--use-system-ca` (vedi `Completed/electron-upgrade`). `npm run dev` per il test dev, poi `npm run build:win` per il packaged.
4. Testare (lista sotto). Se verde → commit dedicato feature (richiede OK esplicito utente, git default = NO in DECISIONS 2026-07-01) → Agent-Summary in `Completed/`.

## === COSA TESTARE ===
Strategia consigliata: **prima testare task1-8 SENZA il flip** (funzionano già con la config attuale
`nodeIntegration:true`), così un'eventuale regressione si isola da quella del flip. Poi applicare task9 e
**ritestare tutto** sotto `nodeIntegration:false`.

> **NOTA RITEST DOPO TASK9 (obbligatorio, non saltare):** testare i task1-8 ora con la config attuale
> NON sostituisce il ritest dopo il flip. Il test di adesso valida solo che il refactor non abbia rotto
> il comportamento (IPC/context menu/ricerca/window.marktext girano identici sotto `nodeIntegration:true`).
> NON può cogliere i problemi che emergono SOLO sotto `nodeIntegration:false` + `contextIsolation:true` +
> `sandbox:false`: chiave preload mancante nel branch contextBridge, `sandbox` non messo a false, un residuo
> Node nel renderer sfuggito al grep-gate. Perciò dopo il task9 la **lista A va rieseguita per intero** (=lista B)
> sotto la nuova config, in dev E nell'app packaged (`build:win`). Verde ora ≠ verde dopo il flip.

### A. Task 1-8 (config attuale, `npm run dev`)
- **Avvio pulito** (task1): app parte, console senza nuovi errori da process/env.
- **Window controls** (task2): minimizza; massimizza (toggle); fullscreen (toggle); **close chiede di salvare** (graceful, non forza); icona max riflette lo stato all'avvio; hamburger titlebar apre l'application menu; chiusura finestra **Preferenze**.
- **Clipboard** (task2): incollare un percorso file copiato (guessClipboardFilePath) — Win/mac.
- **Context menu sidebar** (task3): tasto destro su file/cartella → new file, new directory, copy, cut, **paste (abilitato solo se qualcosa è in cache)**, rename, delete, show in folder. Verificare che ogni voce faccia l'azione giusta.
- **Context menu tab** (task3): tasto destro su tab → close this/others/saved/all, rename, copy path, show in folder. **rename/copyPath/showInFolder abilitati solo se il tab ha un pathname** (tab salvato).
- **Export/temi** (task4): aprire dialog Export → la lista dei temi custom si popola; esportare con un tema custom (legge il CSS del tema da disco).
- **Ricerca file / Quick Open** (task6): Ctrl/Cmd+P, digitare una query → compaiono i file (per nome), cap ~30. Testare con progetto/cartella aperta.
- **Font picker** (task6): Preferences → impostazioni font → l'elenco dei font di sistema si carica.
- **Upload immagini** (task5): l'utente NON lo usa → priorità bassa, ma verificare che incollare/spostare un'immagine locale non crashi (moveImageToFolder: hash Web Crypto + writeFile). Se si usa github/picgo: verificarne l'upload.
- **PlantUML** (task8): se usato, un diagramma PlantUML renderizza (deflate via preload).
- **Scorciatoie** (task8 common/keybinding): le scorciatoie funzionano (normalizzazione acceleratori).

### B. Dopo TASK9 (flip, ri-testare tutto A) + specifico:
- **Ripetere TUTTA la lista A** sotto `nodeIntegration:false` + `contextIsolation:true` + `sandbox:false`.
- **Warning spariti**: console dev SENZA `crypto.fips`(DEP0093) e `fs.F_OK`(DEP0176).
- **App packaged**: `npm run build:win` + avvio → i preload/IPC funzionano nel bundle (non solo dev).
- Se qualcosa non parte: sospettare (1) chiave preload mancante nel branch contextBridge, (2) `sandbox` non messo a false, (3) un residuo Node nel renderer non colto dal grep-gate.

## Note residue (fuori scope feature, tracciate altrove)
- **electron-upgrade FIX #3 candidato**: due `Not allowed to load local resource: file:///...` in console per immagini con path spazi+parentesi (CrossDevice/OneDrive). Immagini si vedono comunque (fallback safe-file). Da valutare separatamente. Dettaglio in `Completed/electron-upgrade` e fix1-worklog.
- Dialog "apri"→Download (E43 UX), N1 keytar→safeStorage, N3 ced, script postinstall: decisioni aperte in `Completed/electron-upgrade`.
