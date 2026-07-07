# warning-fix — task10 — worklog

## Avanzamento
- [x] Indagine: censimento funzionalità dipendenti da webSecurity false (Agent-Explorer, 2026-07-06)
- [x] Decisione strategia con l'utente: **B — custom protocol** (2026-07-06)
- [x] Incremento 1: scheme custom + handler + rewrite image src (correctImageSrc/utils) + webSecurity:true (entrambe le finestre) — stato: DA TESTARE
- [ ] Test inc.1: immagini locali inline in dev E packaged; niente warning webSecurity/allowRunningInsecureContent; printToPDF ok
- [ ] Incremento 2: adattare drag tab→Explorer (tabs.vue) e copia immagine (copyCutCtrl.js) al nuovo prefisso
- [ ] Test inc.2: drag su desktop + copia immagine ok; nessuna regressione DnD tab
- [ ] Incremento 3: CSP dinamica dev/prod (togliere unsafe-eval/ws in prod)
- [ ] Test inc.3: dev con HMR ok; build prod senza warning CSP; app packaged funzionante

## Indagine (Agent-Explorer, 2026-07-06)
Sintesi nel plan (sezione "Fatti verificati"). Punti chiave: webSecurity:false serve alle immagini locali inline (`file://` da correctImageSrc) sia in dev sia in prod; printToPDF dipende dallo stesso webContents; nessun custom protocol esistente; CSP `img-src` ha già `file:` (indipendente da webSecurity); `unsafe-eval` solo per Vite dev; export HTML NON impattato; drag/copia assumono `file://` letterale (tabs.vue:453, copyCutCtrl.js:140).

## Test

### Incremento 1 — DA TESTARE (Agent-Code non builda, Group Policy blocca su questa macchina)

File modificati:
- `src/main/app/index.js`: import `protocol, net` da `electron` e `pathToFileURL` da `node:url`;
  `protocol.registerSchemesAsPrivileged([{ scheme: 'safe-file', ... }])` a fine costruttore (prima
  che `init()` registri `app.on('ready', this.ready)`); `protocol.handle('safe-file', ...)` come
  prima istruzione del metodo `ready`, con gestione drive letter Windows e Response 404 su path non
  risolto (try/catch attorno alla risoluzione).
- `src/main/config.js`: `webSecurity: false` → `true` su `editorWinOptions` (riga 22) e
  `preferencesWinOptions` (riga 51).
- `src/renderer/index.html`: CSP `img-src` — aggiunto `safe-file:` (mantenuto `file:` per ora,
  rimozione prevista in inc.3 se non più usato).
- `src/muya/lib/utils/index.js` (`getImageInfo`): i due punti di ritorno locali riscrivono
  `file://` → `safe-file://` SOLO a render (ramo `isUrl` con `file://` letterale già salvato, e
  ramo path assoluto/relativo locale). `correctImageSrc` in `getImageInfo.js` NON toccata (il suo
  output è persistito su disco).

Cosa deve verificare l'utente sul PC principale:
- `npm run dev`: immagine locale embeddata `![](C:/percorso/img.png)` visibile inline nell'editor;
  nessun warning `webSecurity`/`allowRunningInsecureContent`/CSP relativo a immagini in console F12.
- Stesso test con `<img src="file://...">` HTML già presente/salvato nel documento (ramo `isUrl`
  di `getImageInfo`): deve renderizzare comunque tramite `safe-file://`.
- Path con spazi nel nome cartella/file (es. `C:\Users\Nome Utente\img with space.png`): verificare
  che il protocol handler risolva correttamente (decodeURIComponent + gestione drive letter).
- App **packaged** (`npm run build:win` poi eseguire l'installer/portable): stesso test immagine
  locale inline, sia in editor sia riaprendo un file `.md` con immagini locali.
- `printToPDF` se esposto nel menu/export: verificare che le immagini locali compaiano nel PDF
  generato (dipende dallo stesso webContents/rendering).
- Verificare che il contenuto salvato su disco (markdown) contenga ancora `file://` e NON
  `safe-file://` (la riscrittura è solo a render, mai persistita).

Assunzioni non verificabili da Agent-Code (nessun build possibile su questa macchina):
- Comportamento reale di `net.fetch(pathToFileURL(...))` con path Windows contenenti spazi/caratteri
  non-ASCII: implementato secondo le istruzioni del gate, ma non eseguito a runtime.
- `protocol.handle` è documentato per essere chiamato dopo `ready`; qui è la prima istruzione del
  metodo `ready` stesso, coerente con le istruzioni ricevute, ma non testato.

Confermato: nessun uso di git (nessun add/commit/stash) e nessuna build eseguita da Agent-Code.
