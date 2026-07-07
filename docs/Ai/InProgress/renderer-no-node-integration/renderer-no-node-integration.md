# renderer-no-node-integration — plan: togliere nodeIntegration dal renderer

> **RIPRESA 2026-07-07 → leggere prima `_HANDOFF.md`** (in questa cartella): stato reale (task1-8 fatti,
> task9=flip da fare con edit pronti), scoperte importanti, cosa testare, come riprendere. Questo plan
> madre resta come contesto/scopo; la decomposizione reale è in `-task1..8-plan.md` + `_HANDOFF.md`.

## Scopo

Eliminare l'uso diretto di Node (built-in, `process`, `Buffer`, `@electron/remote`) dal processo
**renderer**, spostandolo nel **main** ed esponendolo via **preload + IPC**. Poi disattivare
`nodeIntegration` (e abilitare `contextIsolation`) nel renderer.

Nasce come strada "pulita" scelta durante la feature `electron-upgrade` (vedi DECISIONS 2026-07-07
"Modus operandi soluzioni"). È una **feature dedicata**, NON parte dell'upgrade Electron.

## Perché (valore triplo)

1. **Sicurezza**: renderer sandboxed (`nodeIntegration:false` + `contextIsolation:true`) è la
   postura corretta per Electron. Oggi il renderer ha accesso pieno a Node (rischio se si apre
   contenuto non fidato).
2. **Elimina `vite-plugin-electron-renderer`**: non serve più fare da shim ai built-in Node →
   **spariscono i warning** `crypto.fips` (DEP0093) e `fs.F_OK` (DEP0176), che nascono proprio
   dall'enumerazione dei built-in fatta da quel plugin (`.vite-electron-renderer/*.mjs`).
3. **Elimina `@electron/remote`**: dipendenza scoraggiata da Electron per motivi di sicurezza.

## Fondazione già esistente

Esiste già un bridge preload parziale: `window.fileUtils.*`, `window.path.*` (usati p.es. in
`commands/utils.js`). Si estende quello, non si parte da zero. Verificare cosa espone oggi il
preload (`src/preload/index.js`) prima di aggiungere.

## Inventario dell'uso Node nel renderer (esplorazione 2026-07-07)

### A. Built-in Node importati
| Modulo | File | Uso |
|--------|------|-----|
| `child_process` (spawn) | `renderer/src/node/ripgrepSearcher.js`, `renderer/src/node/fileSearcher.js` | lancia **ripgrep** (ricerca file) |
| `child_process` (exec/execFile) | `renderer/src/util/fileSystem.js` | lancia **picgo** (upload immagini) |
| `fs` | `renderer/src/components/exportSettings/index.vue`, `renderer/src/util/pdf.js` | export/PDF |
| `fs` (statSync, constants) | `renderer/src/util/fileSystem.js` | stat/access file |
| `crypto` | `renderer/src/util/fileSystem.js` | hashing |
| `os` (tmpdir) | `renderer/src/util/fileSystem.js` | path temporanei |
| `Buffer` | `renderer/src/node/ripgrepSearcher.js`, `renderer/src/util/fileSystem.js` | encoding, base64 upload |

### B. `@electron/remote` (6 file)
`getCurrentWindow`, `Menu`/`MenuItem`, `clipboard`:
- `renderer/src/contextMenu/sideBar/index.js`
- `renderer/src/contextMenu/tabs/index.js`
- `renderer/src/commands/index.js`
- `renderer/src/components/titleBar/index.vue`
- `renderer/src/util/clipboard.js` (clipboard)
- `renderer/src/prefComponents/common/titlebar.vue`

### C. `process.*` (sparso)
`process.platform` (rilevamento OS in `renderer/src/util/index.js` → `isOsx/isWindows/isLinux`,
usato da mezzo progetto), `process.env` (NODE_ENV, APPIMAGE, PATH, HOME, UNSPLASH_ACCESS_KEY),
`process.resourcesPath` (`commands/utils.js`). Da esporre come costanti/getter via preload.

## Approccio (bozza, da dettagliare in task)

1. **Mappare il preload attuale** (`src/preload/index.js`): cosa espone già, con che shape.
2. **Esporre le primitive Node via preload/IPC**, a gruppi omogenei:
   - filesystem (stat/access/read per export/pdf) → API in main + IPC, oppure estendere `window.fileUtils`.
   - hashing (`crypto`) → helper in main.
   - `os.tmpdir`, `process.platform/env/resourcesPath` → costanti esposte una volta dal preload.
   - `Buffer` → spostare la logica che lo usa nel main (encoding/base64), o esporre helper mirati.
3. **Ricerca file (ripgrep) e upload (picgo)**: sono `child_process` → **spostare l'intero lancio
   nel main** (il renderer non deve spawnare processi). Il renderer chiede via IPC, il main esegue
   e risponde/streamma. È il pezzo più grosso (ricerca ha streaming di risultati).
4. **`@electron/remote`** → sostituire con IPC dedicati: window controls (min/max/close/getBounds),
   context menu (costruire il menu nel main via `Menu.buildFromTemplate` + IPC), clipboard (già
   esposto in preload — `src/preload/index.js` importa `clipboard`; instradare `util/clipboard.js`
   lì invece che su remote).
5. **Flip finale**: `electron.vite.config.mjs` → rimuovere il plugin `renderer(...)`; window config
   (`src/main/config.js`) → `nodeIntegration:false`, `contextIsolation:true`. Verificare che
   niente nel renderer usi più Node diretto (grep di controllo).

## Rischi / aree di retest (nessun test automatico le copre)

- **Ricerca file** (ripgrep): funzionale + streaming risultati.
- **Upload immagini** (picgo/github): il percorso `child_process` + base64.
- **Export / PDF**: `fs`/`Buffer`.
- **Controlli finestra** (min/max/close, titlebar custom) e **context menu** (sidebar, tabs).
- **Clipboard** (copia/incolla, guessClipboardFilePath).
- `contextIsolation:true` rompe ogni accesso implicito a Node dal renderer → il grep di controllo
  del passo 5 è il gate.

## Note di metodo

- Feature grande e **sensibile alla sicurezza** → procedere a task incrementali, ognuno con gate
  (riepilogo + OK utente + istruzioni su file) prima di Agent-Code (DECISIONS 2026-07-03).
- Build/test SOLO su PC principale (Group Policy blocca qui).
- Ordine consigliato: prima i gruppi a basso rischio (process/os/crypto/fs helper), poi
  `@electron/remote`, poi il pezzo grosso (ripgrep/picgo in main), infine il flip nodeIntegration.
- NON iniziare finché l'upgrade Electron non è a un punto stabile (evitare due grandi cantieri
  aperti insieme sugli stessi file).
