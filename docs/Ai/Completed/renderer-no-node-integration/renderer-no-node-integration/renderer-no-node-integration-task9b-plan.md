# renderer-no-node-integration — task9b — plan: coda del flip (lib terze parti Node nel renderer)

**Prerequisito:** leggere `_HANDOFF.md` e `renderer-no-node-integration.md` (plan madre). Questo è il
seguito del **task9 (flip)**: dopo aver messo `nodeIntegration:false`+`contextIsolation:true`, il
bundle renderer è esploso perché alcune **dipendenze npm di terze parti** usano Node-globals
(`process`, `path`, moduli Node). Il grep-gate del task9 controllava solo il NOSTRO sorgente, non le
lib esterne → gap scoperto a runtime (dev).

## Stato già applicato in questo working tree (NON ricommittare/riscrivere, verificare e basta)
Task9 core + primi fix del flip, già nel working tree (NON committati):
- `src/main/config.js`: entrambe le `webPreferences` (editor + preferences) →
  `contextIsolation:true`, `nodeIntegration:false`, `sandbox:false`; `preload` path → `../preload/index.cjs`.
- `electron.vite.config.mjs`: rimosso plugin `renderer({nodeIntegration:true})` + import; `preload`
  `entryFileNames` → `[name].cjs` (era `.js`; con `type:module` un `.js` CJS è trattato come ESM →
  "require is not defined").
- `src/muya/lib/parser/render/snabbdom.js`: `require('snabbdom-to-html')` → `import toHTMLFn from ...`.
- `src/muya/lib/utils/turndownService.js`: `require('joplin-turndown-plugin-gfm')` →
  `import * as turndownPluginGfm from ...` (namespace: la dep non espone `default`).

## Problema da risolvere (task9b) — 3 lib terze parti che usano Node nel renderer
| Lib | Siti renderer | Usa | Sintomo |
|-----|---------------|-----|---------|
| `@hfelix/electron-localshortcut` | 2 | `process.platform` (in `src/utils.js`) | **fatale** `process is not defined` |
| `fuzzaldrin` | 5 | `require('path').sep` (solo `.sep`) | warning `Module "path" externalized` |
| `electron-log` | 5 | Node/electron (import bare) | rompe sotto flip (usare entry `/renderer`) |

Principio (deciso con utente): i fix sono **shim JS browser / entry corrette**, NON reintroducono Node
reale (nessun fs/child_process) → la sicurezza guadagnata dal flip **regge**. `path`/`process.platform`
qui sono pura logica di stringhe/valori, non accesso al sistema.

---

## FIX 1 — electron-log → entry renderer
`electron-log` 5.4.4. Il main **già** fa `log.initialize()` (`src/main/index.js:26`) → l'entry
`electron-log/renderer` funziona e trasporta i log al main via IPC (preload).

Cambiare l'import in **tutti e 5** i file renderer da `'electron-log'` a `'electron-log/renderer'`:
- `src/renderer/src/store/commandCenter.js:2`
- `src/renderer/src/prefComponents/spellchecker/index.vue:85`
- `src/renderer/src/prefComponents/keybindings/index.vue:105`
- `src/renderer/src/components/editorWithTabs/editor.vue:87`
- `src/renderer/src/components/commandPalette/index.vue:97`

Da: `import log from 'electron-log'` → A: `import log from 'electron-log/renderer'`.
**NON** toccare gli import `electron-log` nel MAIN (`src/main/**`): lì è corretto così.
API `log.info/error/...` invariata → nessun'altra modifica ai siti d'uso.

## FIX 2 — electron-localshortcut `process.platform` → Vite `define`
La lib legge solo `process.platform` (stringa). Sostituirlo col letterale a build via `define` nella
sezione **renderer** di `electron.vite.config.mjs`:
```js
renderer: {
  // ...esistente...
  define: {
    'process.platform': JSON.stringify(process.platform)
  },
  // ...
}
```
Nota: hardcoda la piattaforma di BUILD nel bundle renderer. Corretto per build per-target (si fa
`build:win` su Windows → `'win32'`). Il main gestisce la piattaforma reale; questa UI keybindings ne ha
bisogno solo per display/normalizzazione acceleratori. NON aggiungere un `process` globale: solo il
`define` del singolo valore. Se a runtime emergesse un altro `process.X` da qualche lib, aggiungere il
relativo `define` (non un polyfill globale) e annotarlo.

## FIX 3 — fuzzaldrin `path` → `path-browserify` (alias, solo renderer)
fuzzaldrin usa **solo** `require('path').sep`. Fornire una `path` browser pura-JS.

1. Installare `path-browserify` come **devDependency**:
   - Normale: `npm i -D path-browserify`.
   - Ambiente ristretto (Group Policy/ConstrainedLanguage, vedi CLAUDE.md): se `npm` è bloccato, usare
     `node` diretto sul bin, e se il download fallisce per certificato aziendale usare
     `NODE_OPTIONS=--use-system-ca` (vedi `Completed/electron-upgrade`). Verificare che sia finito in
     `package.json` + `node_modules/path-browserify`.
2. Alias nella sezione **renderer** di `electron.vite.config.mjs` (`resolve.alias`), AGGIUNGENDO a
   quelli esistenti (NON toccare gli alias di `main`/`preload`, che devono usare il `path` Node vero):
```js
resolve: {
  alias: {
    '@': resolve(__dirname, 'src/renderer/src'),
    common: resolve(__dirname, 'src/common'),
    muya: resolve(__dirname, 'src/muya'),
    main_renderer: resolve(__dirname, 'src/main'),
    path: 'path-browserify'      // <-- nuovo, SOLO renderer (per fuzzaldrin)
  },
  extensions: ['.mjs', '.js', '.json', '.vue']
},
```
Sicuro: il nostro codice renderer/muya NON importa più `path` bare (migrato a `window.path` nel
task8, grep-gate task9 lo conferma) → l'alias colpisce solo fuzzaldrin.

---

## Dopo i 3 fix — verifica (BLOCCANTE prima di dichiarare fatto)
1. Pulire `out/` (evita preload/bundle stale): `Remove-Item -Recurse -Force out` (o equivalente).
2. `node node_modules/electron-vite/bin/electron-vite.js dev` → l'editor **renderizza**, finestra
   interattiva, console F12 **senza** `process is not defined`, `require is not defined`, `Module "path"
   externalized`.
3. **Scoperta progressiva**: potrebbero emergere ALTRE lib terze parti con Node-globals man mano che i
   percorsi di codice si eseguono. Regola per l'agente: ad ogni nuovo errore runtime del tipo
   "X is not defined" / "Module Y externalized", identificare la lib (stack trace), capire cosa usa, e
   applicare lo stesso schema (entry corretta / `define` del valore / alias a shim browser puro-JS).
   **Fermarsi e segnalare** se una lib richiede Node REALE (fs/child_process): quello NON va nel
   renderer, va valutato con l'utente (spostare in main via IPC).
4. Quando dev è verde: `... build` poi `... preview` → verificare warning `crypto.fips`(DEP0093) e
   `fs.F_OK`(DEP0176) **spariti** (payoff feature), preload/IPC ok, clipboard warning sparito.
5. Ripetere **lista A** dell'`_HANDOFF.md` sotto la nuova config (window controls, tab context menu,
   quick open, export, plantuml, scorciatoie, immagini nuove, incolla-path). Font resta bloccato
   dall'ambiente (ConstrainedLanguage) → gap noto, non regressione.
6. Packaged vero (`build:win`) → **PC principale** (build bloccata sul PC secondario).

## Commit
- Il flip (task9 + task9b) va in un commit **isolato** dal commit followup-fix (già fatto, f86ae30).
- Commit SOLO dopo test verde + **OK esplicito** utente (git default = NO, DECISIONS 2026-07-01).

## Note future (fuori scope task9/9b, NON fare ora)
- **fuse.js al posto di fuzzaldrin**: fuzzaldrin è era-Atom, path-oriented, semi-abbandonato. Sostituirlo
  con un matcher browser-native (es. `fuse.js`) toglierebbe del tutto la legacy Node (niente alias
  `path`) e sarebbe la soluzione "alla radice". Refactor più grande (5 siti d'uso: codeMirror, muya
  prism/emojis/quickInsert) → valutare come miglioramento separato dopo il flip. `path-browserify` per
  ora è la scelta corretta e proporzionata.

## File toccati da task9b (riepilogo per l'agente)
- `electron.vite.config.mjs` (renderer: `define` + alias `path`).
- `package.json` (+ `path-browserify` devDep).
- 5 file renderer (import `electron-log` → `electron-log/renderer`), elencati sopra.
- NIENTE altro senza segnalarlo (scoperta progressiva a parte).
