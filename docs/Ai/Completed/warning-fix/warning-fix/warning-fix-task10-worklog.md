# warning-fix — task10 — worklog

## Avanzamento
- [x] Indagine: censimento funzionalità dipendenti da webSecurity false (Agent-Explorer, 2026-07-06)
- [x] Decisione strategia con l'utente: **B — custom protocol** (2026-07-06)
- [x] Incremento 1: scheme custom + handler + rewrite image src (correctImageSrc/utils) + webSecurity:true (entrambe le finestre) — TESTATO OK
- [x] Test inc.1: immagini locali inline in dev E packaged; niente warning webSecurity/allowRunningInsecureContent; printToPDF ok
- [x] Incremento 2: idempotenza getImageInfo (`safe-file://` riconosciuto come URL) + adattare copia
  immagine (copyCutCtrl.js) al nuovo prefisso — TESTATO OK (scope corretto: `tabs.vue` NON
  toccato, vedi nota sotto)
- [x] Test inc.2: copia immagine, export PDF, drag tab→desktop, regressione DnD tab
- [x] Incremento 3: CSP dinamica dev/prod (togliere unsafe-eval/ws in prod) — TESTATO OK
- [x] Test inc.3: dev con HMR ok; build prod senza warning CSP; app packaged funzionante

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

### Incremento 2 — DA TESTARE (Agent-Code non builda, Group Policy blocca su questa macchina)

Nota su scope: la verifica dei call-site (2026-07-07) ha corretto lo scope originale del plan —
`tabs.vue:453` NON va toccato (è l'URL del file DOCUMENTO reale per l'OLE Explorer, non risolvibile
con lo scheme `safe-file`); `imageSelector/index.js:56` legge markdown grezzo (`file://`), non
impattato; `correctImageSrc` in `getImageInfo.js` resta invariato (scrive nel markdown persistito).

File modificati:
- `src/muya/lib/utils/index.js` (`getImageInfo`, riga ~261): il calcolo di `isUrl` riconosce ora
  anche `^safe-file://` oltre a `^file://` (regex `/^(?:safe-file|file):\/\/.+/`). Un input già
  `safe-file://` cade nel ramo `isUrl` e viene restituito invariato → funzione idempotente. Serve a
  `printService.js:24` (export PDF, `renderStatic`) che ri-processa l'`src` già renderizzato;
  `printService.js` NON è stato toccato (si sistema da solo con l'idempotenza).
- `src/muya/lib/contentState/copyCutCtrl.js` (riga ~140): il fallback nel blocco di copia immagine
  ora strippa `safe-file://` PRIMA di `file://` (`.replace('safe-file://','').replace('file://','')`
  poi rimozione query `msec`). Necessario perché il fallback legge `image.getAttribute('src')` =
  l'`src` renderizzato (`safe-file://...`), che con il solo `.replace('file://','')` produrrebbe un
  prefisso spezzato `safe-/...`.

Cosa deve verificare l'utente sul PC principale:
- Copia-incolla di un'immagine locale nel documento (copia dall'editor, incolla in altro documento
  o applicazione che accetti markdown/HTML): il path risultante deve essere pulito, senza prefisso
  `safe-file://` né residuo `safe-` spezzato.
- Export PDF (`printToPDF`/`renderStatic` se esposto nel menu) con immagini locali nel documento:
  le immagini devono comparire correttamente nel PDF generato (verifica idempotenza `getImageInfo`).
- Drag di una tab su desktop/Explorer: deve continuare a creare il file (.md salvato e untitled),
  come prima di questo incremento (nessuna modifica a `tabs.vue`, ma da confermare che l'assenza di
  intervento non abbia effetti collaterali indiretti).
- Nessuna regressione nel drag&drop delle tab (reorder, detach, migrazione tra finestre): questo
  incremento non tocca quella logica, verifica di conferma.

Assunzioni non verificabili da Agent-Code (nessun build possibile su questa macchina):
- Comportamento reale a runtime di `printService.js` con l'idempotenza applicata (nessun export PDF
  eseguito).
- Comportamento reale della copia immagine end-to-end (copia/incolla in app esterna) non eseguito.

Confermato: nessun uso di git (nessun add/commit/stash), nessuna build eseguita da Agent-Code,
nessuna modifica a `tabs.vue`, `imageSelector/index.js`, `correctImageSrc` (in `getImageInfo.js`) né
`printService.js`.

### Incremento 3 — DA TESTARE (Agent-Code non builda, Group Policy blocca su questa macchina)

Approccio applicato: opzione A (CSP `<meta>` trasformata per ambiente da plugin Vite
`transformIndexHtml`), come deciso nel plan — scartata l'opzione header via `onHeadersReceived`
perché in prod la pagina è servita da `file://` e non verrebbe intercettata.

File modificati:
- `src/renderer/index.html`: nella `<meta>` CSP i valori solo-dev sono stati sostituiti con i token
  `__CSP_WS__` (in `default-src` e `connect-src`) e `__CSP_UNSAFE_EVAL__` (in `script-src`).
  Invariati: `'unsafe-inline'` (script/style), `http:`/`https:` in connect-src, `img-src`,
  `style-src`, `font-src` (inclusi `safe-file:` e i domini Google Fonts).
- `electron.vite.config.mjs`: aggiunto il plugin locale `cspEnvPlugin` (definito prima di
  `export default defineConfig`), inserito in `renderer.plugins` (dopo `renderer(...)`). Hook
  `config(_, { command })` imposta `isServe = command === 'serve'`; hook `transformIndexHtml(html)`
  sostituisce (con `replaceAll`, perché `__CSP_WS__` compare due volte) i token con `'unsafe-eval'`/
  `ws: wss:` se `isServe`, altrimenti stringa vuota.

CSP risultante attesa:
- dev (`electron-vite dev`, `command==='serve'`): identica a prima (`ws: wss:` e `'unsafe-eval'`
  presenti).
- build prod (`command==='build'`): `default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src * data: file: blob:
  safe-file:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http: https:;`.

Cosa deve verificare l'utente sul PC principale:
- `npm run dev`: HMR ancora funzionante (nessuna regressione dovuta alla CSP), immagini locali
  ancora renderizzate, editor pienamente funzionante.
- App **packaged** (`npm run build:win` poi eseguire l'installer/portable) — verifica DECISIVA:
  nessun warning "Insecure Content-Security-Policy / unsafe-eval" in console; editor, preferenze,
  immagini locali, syntax highlight (codemirror), formule KaTeX e font Google (Inter/JetBrains Mono)
  tutti funzionanti. Se qualcosa si rompe in prod per mancanza di `unsafe-eval`, segnalarlo:
  si rivaluta il trade-off (nessun `eval`/`new Function` risultava nel codice del progetto durante
  l'indagine, ma la conferma finale è solo sul pacchettizzato).

Assunzioni non verificabili da Agent-Code (nessun build possibile su questa macchina):
- Comportamento reale a runtime del plugin `transformIndexHtml` e del valore `command` ricevuto
  dall'hook `config` in questo setup electron-vite: implementato secondo le istruzioni del gate
  (API Vite standard: `command` vale `'serve'` in dev e `'build'` in produzione), ma non eseguito.
- Che l'app packaged funzioni interamente senza `unsafe-eval`/`ws:`/`wss:` in CSP: non verificabile
  senza build/pacchettizzazione.

Confermato: nessun uso di git (nessun add/commit/stash) e nessuna build eseguita da Agent-Code per
questo incremento.

Con questo incremento si conclude il task10 (tutti e 3 gli incrementi implementati); resta da
eseguire il test utente finale su PC principale (dev + packaged) per ciascuno dei 3 incrementi.

## Esito test utente — 2026-07-07 — TASK10 CHIUSO

Testato dall'utente su PC principale. Metodo: `dev` (via `node .../electron-vite.js dev`),
`preview` (build prod + preview) e app **packaged** eseguita da `dist/win-unpacked/` (no install).
Build prod sbloccata con `--use-system-ca` (SSL inspection aziendale: CA nel Windows store, Node non
la usava di default → vedi CLAUDE.md "Ambiente ristretto").

- **inc.1 OK**: immagini locali visibili inline in dev e packaged; drag/embed immagini funzionanti.
  In dev il warning webSecurity/allowRunningInsecureContent è sparito.
- **inc.3 OK**: warning "Insecure CSP / unsafe-eval" sparito nel **preview** (build prod). In dev
  resta (atteso: unsafe-eval serve a Vite/HMR). App packaged pienamente funzionante.
- **inc.2 OK** (packaged): copia-incolla immagine → path pulito (nessun `safe-`/`safe-file`);
  drag tab→desktop crea il file; export PDF con immagini ok; nessuna regressione DnD tab.
- Nota: in app packaged la console F12 è disabilitata (atteso in prod) → il controllo "assenza
  warning" è stato fatto nel preview, dove i warning sono ancora visibili.

### Bug collaterale trovato durante il test e RISOLTO (fix separato dal task10)
Cancellando un'immagine appena selezionata compariva "Unexpected renderer process error" —
`TypeError: Cannot read properties of null (reading 'getBoundingClientRect')` in
`src/muya/lib/ui/transformer/index.js` (`update`/`render`). Causa: race pre-esistente in Muya (non
introdotta dal task10) — il `setTimeout(render)` differito partiva dopo che `muya-transformer`
aveva azzerato `this.reference` (immagine cancellata). I tempi diversi della build prod (+ carico
immagini async via `safe-file`) hanno reso visibile la race latente. Fix: guard `if (this.reference)`
nel callback differito + early-return in `update()`. Verificato dall'utente: il crash non si
ripresenta. È un fix **distinto** dal task10 → tenerlo come commit separato.
