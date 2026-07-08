# clipboard-ipc-migration — worklog

Riferimento: `clipboard-ipc-migration-plan.md` (stessa cartella). Segnare qui l'avanzamento.

## Avanzamento

- [x] **Sottoproblema 1 — MAIN**: 3 handler `ipcMain.handle('mt::clipboard-{write-text,read,has}')`
  registrati in un file main esistente (preferito `src/main/app/index.js`), import `clipboard` da
  'electron'. Grep collisione nomi canale eseguito e negato.
- [x] **Sottoproblema 2 — PRELOAD** (`src/preload/index.js`): rimosso `clipboard` dall'import 'electron',
  aggiunto `ipcRenderer`; `customElectronAPI.clipboard` = wrapper `clipboardAPI` (writeText/read/has via
  `ipcRenderer.invoke`). Shape `window.electron.clipboard.*` invariata.
- [x] **Sottoproblema 3 — RENDERER + MUYA**: `util/clipboard.js` reso async (await su read/has);
  `pasteCtrl.js` `await this.muya.options.clipboardFilePath()` (pasteImage già async). writeText (4 siti)
  invariati (fire-and-forget).
- [x] Grep finale: nessun `window.electron.clipboard` read/has sincrono senza await; preload non importa
  più `clipboard` da 'electron'; main electron-log intatto.

## Blocchi / note

Nessun blocco. Tutti e 3 i sottoproblemi completati. Build/dev non eseguiti (Group Policy blocca
electron-vite su questa macchina, come da vincolo). Stato: **DA TESTARE** sul PC principale
(vedi checklist "Verifica utente" sotto).

## Verifica utente (runtime, PC principale)

Vedi sezione "Dopo i 3 fix" del plan. Da spuntare dopo test:
- [ ] dev: console F12 senza `Accessing 'clipboard.read' ... deprecated`
- [ ] copia path tab (menu + scorciatoia) → clipboard riceve testo
- [ ] incolla immagine da file system → path indovinato, immagine inserita
- [ ] editor.js copie (githubSlug, deletionUrl) ok
- [ ] build + preview: nessun nuovo warning
