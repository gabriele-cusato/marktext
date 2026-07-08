# Clipboard IPC Migration — Deprecazione Electron 40→44, Spostamento nel Main

**Scopo:** spostare accesso `clipboard` dal renderer (deprecato v40, rimosso v44) nel main process via IPC. Il modulo Electron `clipboard` non è deprecato nel main, rimane là. Warning scompaiono eliminando il direct-module access dal renderer.

**Origine:** deprecation pre-esistente (Electron 43), non causata dal flip nodeIntegration. Fix separato dal flip (task9), committato indipendentemente.

**Quando leggerlo:** prima di toccare clipboard (read/has/writeText), preload bridge verso clipboard, deprecation warning Electron.

**Stato:** ✅ 3 sottoproblemi implementati (main handler + preload wrapper + renderer async). ⚠️ Testato su PC secondario (Group Policy blocca build), **verifica runtime da fare su PC principale** (dev + build:win).

---

## Problema

Electron v40 deprecò `clipboard.*` dal renderer (warning per-metodo). V44 lo rimuove completamente. Codebase su v43 → deprecation attiva, rottura garantita v44.

- **Root cause:** modulo `clipboard` importato direttamente in preload (che gira nel renderer process sotto contextIsolation).
- **Unica soluzione:** spostare `.read()/.has()/.writeText()` nel main (lì non deprecato) e invocarli via IPC.
- **Prerequisito per il flip nodeIntegration:false** (vedere feature renderer-no-node-integration).

---

## Modifiche

### 1. Main Handler (src/main/app/index.js)

Nuovi handler `ipcMain.handle`:
```javascript
ipcMain.handle('mt::clipboard-write-text', (_e, text) => clipboard.writeText(text))
ipcMain.handle('mt::clipboard-read', (_e, format) => clipboard.read(format))
ipcMain.handle('mt::clipboard-has', (_e, format) => clipboard.has(format))
```
Import `clipboard` da 'electron' nel main (NON deprecato).

### 2. Preload Wrapper (src/preload/index.js)

- Rimosso `clipboard` dall'import 'electron'
- Aggiunto `ipcRenderer` all'import
- Nuova `clipboardAPI`:
```javascript
const clipboardAPI = {
  writeText: (text) => ipcRenderer.invoke('mt::clipboard-write-text', text),
  read: (format) => ipcRenderer.invoke('mt::clipboard-read', format),
  has: (format) => ipcRenderer.invoke('mt::clipboard-has', format)
}
```
- Esposta come `customElectronAPI.clipboard` (shape `window.electron.clipboard.*` invariata)

### 3. Renderer + Muya (async ripple)

- **`src/renderer/src/util/clipboard.js`** → funzioni rese `async`:
  - `hasClipboardFiles()`: `await has('NSFilenamesPboardType')`
  - `getClipboardFiles()`: `await read('NSFilenamesPboardType')`
  - `guessClipboardFilePath()`: `await read(...)` per macOS/Windows
- **`src/muya/lib/contentState/pasteCtrl.js:132`** → aggiunto `await` alla chiamata `this.muya.options.clipboardFilePath()`
- **writeText (4 siti):** nessuna modifica (fire-and-forget, ritorno ignorato)

---

## Scoperte Importanti

1. **IPC `invoke` è async** — `has()` e `read()` diventano Promise. `await` su non-promise è safe (passa attraverso).

2. **writeText fire-and-forget** — i 4 siti che usano writeText NON attendono il ritorno (copia tab path, etc.). Ripple async trasparente.

3. **`pasteCtrl.js` già async** — pasteImage() è funzione async → `await clipboardFilePath()` si integra naturale.

4. **Warning deprecato specifico per metodo** — il warning scatta solo se il renderer chiama i metodi clipboard (non sull'import stesso nel preload). Con IPC il renderer non chiama più direttamente.

5. **Shape `window.electron.clipboard.*` preservata** — i 3 metodi mantengono lo stesso nome → i chiamanti NON cambiano nome, solo diventano async dove serve.

6. **Nessun test automatico** — feature tocca clipboard (niente e2e dedicato). Verifica manuale: copia/incolla, pasteImage, editor.js copie (githubSlug, deletionUrl).

---

## Verifica Runtime (PC Principale Necessario)

1. `npm run dev` → console F12: **senza** `Accessing 'clipboard.read' ... deprecated`
2. Copiare path tab (menu contestuale + scorciatoia) → clipboard riceve testo
3. Incollare immagine da file system → path indovinato, immagine inserita
4. editor.js copie (githubSlug, deletionUrl) ok
5. `npm run build:win` + preview → nessun nuovo warning; clipboard funziona

---

## Stato

- **Implementazione:** ✅ completa
- **Build/dev:** ⚠️ skipped (Group Policy blocca electron-vite su questa macchina)
- **Commit:** ⏳ in attesa verifica utente PC principale

---

## Cross-Link

- **renderer-no-node-integration** (`Completed/renderer-no-node-integration/`): flip nodeIntegration, cui questo fix è prerequisito
- **electron-upgrade** (`Completed/electron-upgrade/`): base deprecation Electron (v40 introduced, rimozione v44 planned)
