# clipboard-ipc-migration — plan

## Perché
Electron deprecato (introdotta v40, **rimossa v44**) l'accesso al modulo `clipboard` dal **renderer
process**. Warning:
```
(electron) Accessing 'clipboard.read' from the renderer process is deprecated and will be removed.
Please use the 'contextBridge' API to access the clipboard API from the renderer.
```
Fatti verificati (fonte: breaking-changes.md Electron + `lib/renderer/api/clipboard.ts`):
- Progetto è su Electron **43** → deprecation attiva, **rottura garantita alla v44**. Non cosmetico.
- **Tutto** il modulo `clipboard` nel renderer è deprecato (read, has, writeText, ...), non solo `read`.
  Il warning fira **per-metodo alla chiamata**; vediamo solo `read` perché è quello che scatta nei
  nostri flussi.
- Il pattern attuale (preload importa `clipboard` da 'electron' + `contextBridge`) **NON sopprime** il
  warning: il preload è renderer process, il wrapper Electron non distingue mondo isolato.
- **Unico fix reale** finestra 40-43: spostare le chiamate native `clipboard.*` nel **MAIN process**
  (lì non è deprecato) e invocarle via IPC. Questo è anche future-proof verso la v44.

Deprecation **pre-esistente** (upgrade Electron 43), NON causata dal flip nodeIntegration → **commit
separato** dal commit del flip (task9/9b).

## Prerequisiti bloccanti

- File plan letto per intero. File worklog associato: `clipboard-ipc-migration-worklog.md` (stessa cartella) — segnare l'avanzamento dei 3 sottoproblemi lì.
- File sorgente richiesti e leggibili: `src/preload/index.js`, `src/renderer/src/util/clipboard.js`,
  `src/muya/lib/contentState/pasteCtrl.js`, e il file main scelto per gli handler (preferito
  `src/main/app/index.js`).
- Ri-grep OBBLIGATORIO (non fidarsi dei numeri di riga in questo plan, possono essere shiftati):
  - `window.electron.clipboard` in `src/renderer` e `src/muya` → confermare i 7 siti (4 writeText, 1 has, 2 read) e che nessun `read`/`has` resti sincrono senza `await` dopo il fix.
  - `mt::clipboard-write-text`, `mt::clipboard-read`, `mt::clipboard-has` in tutto `src/` → devono NON esistere già (no collisione firma; regole IPC in CLAUDE.md). Sono canali `invoke/handle` nuovi, chiamati solo dal renderer via preload → nessun `ipcMain.emit` da main.
  - `clipboard` negli import di `src/main/**` → NON toccarli (nel main clipboard non è deprecato).
- File/comportamenti vietati: NON toccare gli import `electron-log` in `src/main/**`; NON esporre metodi clipboard oltre ai 3 usati; NON aggiungere un secondo canale per gli stessi scopi.
- Target verifica: build/dev electron-vite BLOCCATI su questa macchina (Group Policy) → Agent-Code NON builda, applica solo le edit. La verifica runtime (warning sparito, copie/incolla, pasteImage) la fa l'utente sul PC principale seguendo la sezione "Dopo i 3 fix".
- Version control: Agent-Code NON usa git (git default = NO, DECISIONS 2026-07-01). Nessun commit.
- Se un prerequisito manca o è ambiguo, fermarsi senza modificare codice e annotare il blocco nel worklog.

## Siti coinvolti (grep verificato, 7 usi renderer)
`window.electron.clipboard.*`:
- `writeText` (fire-and-forget, testo semplice):
  - `src/renderer/src/components/contextMenu/TabContextMenu.vue:85`
  - `src/renderer/src/components/editorWithTabs/tabs.vue:742`
  - `src/renderer/src/store/editor.js:67`
  - `src/renderer/src/store/editor.js:300`
- `has` + `read` (oggi **sincroni**):
  - `src/renderer/src/util/clipboard.js:5` (`has('NSFilenamesPboardType')`)
  - `src/renderer/src/util/clipboard.js:12` (`read('NSFilenamesPboardType')`)
  - `src/renderer/src/util/clipboard.js:21` (`read('FileNameW')`)

Muya NON usa `window.electron.clipboard` (usa `event.clipboardData`/DOM) → non toccato, tranne 1 `await`
(vedi sotto).

## Ripple sync→async
IPC `invoke` è async → `has`/`read` diventano async.
- `util/clipboard.js`: `hasClipboardFiles`, `getClipboardFiles`, `guessClipboardFilePath` → async + await.
- `guessClipboardFilePath` è passato a muya come `options.clipboardFilePath` e chiamato in
  `src/muya/lib/contentState/pasteCtrl.js:132` dentro `pasteImage` che è **già `async`** →
  cambiare `const imagePath = this.muya.options.clipboardFilePath()` in
  `const imagePath = await this.muya.options.clipboardFilePath()`. Se il valore è sync, `await` su
  non-promise passa attraverso → nessuna regressione. Unica riga muya toccata.
- `writeText`: fire-and-forget, i chiamanti non usano il ritorno → nessun await necessario.

## Implementazione

### 1. MAIN — nuovi handler IPC (clipboard NON deprecato nel main)
Registrare in un file main che già ospita handler `ipcMain.handle('mt::...')`. Candidati (grep):
`src/main/app/index.js` (bucket generale, **preferito** per un servizio di sistema come clipboard),
`src/main/dataCenter/index.js`, `src/main/app/windowManager.js`, `src/main/menu/index.js`,
`src/main/keyboard/index.js`, `src/main/spellchecker/index.js`. Scegliere il più coerente col pattern.
Import `clipboard` da 'electron'. Registrare:
```js
ipcMain.handle('mt::clipboard-write-text', (_e, text) => clipboard.writeText(text))
ipcMain.handle('mt::clipboard-read', (_e, format) => clipboard.read(format))
ipcMain.handle('mt::clipboard-has', (_e, format) => clipboard.has(format))
```
Verificare prima con grep che questi 3 nomi canale non esistano già. Registrarli una sola volta
all'avvio, coerente con gli altri handler `mt::`.

### 2. PRELOAD (`src/preload/index.js`)
Oggi `customElectronAPI` espone l'oggetto `clipboard` grezzo di Electron (`import { clipboard } ...`) →
è proprio quello che fa scattare il warning. Sostituirlo con un wrapper che va via IPC:
```js
import { contextBridge, shell, webUtils, ipcRenderer } from 'electron' // togliere clipboard dall'import
...
const clipboardAPI = {
  writeText: (text) => ipcRenderer.invoke('mt::clipboard-write-text', text),
  read: (format) => ipcRenderer.invoke('mt::clipboard-read', format),
  has: (format) => ipcRenderer.invoke('mt::clipboard-has', format)
}
const customElectronAPI = {
  shell,
  clipboard: clipboardAPI,   // <-- wrapper IPC, non più il modulo Electron
  webUtils
}
```
Mantiene la shape `window.electron.clipboard.{writeText,read,has}` → i chiamanti non cambiano nome, solo
diventano async dove serve. NON esporre altri metodi clipboard (solo i 3 usati). Verificare che
`ipcRenderer` sia disponibile nell'import da 'electron' nel preload.

### 3. RENDERER — adeguare gli async
`src/renderer/src/util/clipboard.js`:
```js
const hasClipboardFiles = async () => {
  return window.electron.clipboard.has('NSFilenamesPboardType')
}
const getClipboardFiles = async () => {
  if (!(await hasClipboardFiles())) return []
  return plist.parse(await window.electron.clipboard.read('NSFilenamesPboardType'))
}
export const guessClipboardFilePath = async () => {
  if (isLinux) return ''
  if (isOsx) {
    const result = await getClipboardFiles()
    return Array.isArray(result) && result.length ? result[0] : ''
  } else if (isWindows) {
    const rawFilePath = await window.electron.clipboard.read('FileNameW')
    const filePath = rawFilePath.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    return filePath && typeof filePath === 'string' ? filePath : ''
  } else {
    return ''
  }
}
```
`src/muya/lib/contentState/pasteCtrl.js:132`: aggiungere `await` (vedi Ripple).

`writeText` (4 siti): nessuna modifica al codice chiamante necessaria — la chiamata resta
`window.electron.clipboard.writeText(x)`, ora ritorna una promise ignorata (fire-and-forget). OK così.

## Verifica (BLOCCANTE, su PC principale — build bloccata sul secondario)
1. `dev` → console F12 **senza** più `Accessing 'clipboard.read' ... deprecated`.
2. Copiare path tab (menu contestuale tab + scorciatoia) → clipboard riceve il testo.
3. Copiare un'immagine da file system e incollarla nel documento (flusso `pasteImage`) → il path viene
   indovinato correttamente (Windows: `FileNameW`), immagine inserita.
4. `editor.js` copie (githubSlug `#...`, deletionUrl) → funzionano.
5. `build` + `preview` → nessun nuovo warning; clipboard ok.

## Commit
Separato dal commit flip (task9/9b). Solo dopo test verde + **OK esplicito** (git default = NO).

## Fuori scope (separato)
- **DEP0180** `fs.Stats constructor is deprecated`: dep-side (main), verosimilmente **chokidar** (usato
  in `src/main/filesystem/watcher.js`), visibile solo in dev/preview col watcher. Nessun `new fs.Stats`
  nel nostro codice. Fix = identificare la dep con `electron --trace-deprecation` e aggiornarla se esiste
  versione corretta. Task separato, non in questo plan.
