# warning-fix — task10 — plan: Electron security warnings (webSecurity, CSP) — strategia B (custom protocol)

## Obiettivo
Eliminare i 3 security warning in console dev (Disabled webSecurity, allowRunningInsecureContent, Insecure CSP) **alzando** la sicurezza (mai sopprimere), senza rompere le funzionalità che oggi dipendono da `webSecurity:false`. Strategia scelta dall'utente (2026-07-06): **B — custom protocol** per le risorse locali, così si può portare `webSecurity:true` sicuro anche in produzione.

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task10-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 7) e regola "mai sopprimere" (DECISIONS.md 2026-07-05).
- File coinvolti (leggerli prima di toccarli): `src/main/config.js`, `src/main/app/index.js` (registrazione scheme prima di app ready), `src/renderer/index.html`, `src/muya/lib/utils/getImageInfo.js` (`correctImageSrc`), `src/muya/lib/utils/index.js` (~260-283), `src/renderer/src/components/editorWithTabs/tabs.vue` (~453, drag tab→Explorer), `src/muya/lib/contentState/copyCutCtrl.js` (~140, copia immagine).
- **Feature DnD conclusa da NON rompere**: leggere `docs/Ai/Completed/drag-html5-dnd/drag-html5-dnd.md` (invarianti #2 rifiuto passivo dragover, #3 logica su dragend, #4 revoca blob). Questo task NON tocca la logica dragstart/dragover/dragend/dropEffect delle tab: tocca SOLO il prefisso `file://` del payload di copia esterna e della copia immagine.
- **Fonte API Electron da verificare (non a memoria)**: firma esatta di `protocol.registerSchemesAsPrivileged` e `protocol.handle` (Electron 39) va confermata sulla doc Electron prima di implementare. Anche `net.fetch`/lettura file nel handler.
- Target di verifica: `npm run dev` senza i 3 warning; `npm run build` + app **packaged** con immagini locali, export, preferenze funzionanti. NOTA: su questo PC il build è bloccato dai Criteri di gruppo → build/test vanno fatti sul PC principale.
- Version control: consentito solo `git status`/`git diff` all'orchestratore; Agent-Code NON usa git/ss/svn. Vietati commit/push.
- Se un prerequisito manca o è ambiguo, fermarsi senza toccare codice e segnalarlo nel worklog.

## Fatti verificati (Agent-Explorer, 2026-07-06)
- `src/main/config.js:22` (editor) e `:51` (preferences): `webSecurity:false` incondizionato, nessun branch dev/prod (config.js importa solo `path`).
- `allowRunningInsecureContent`: mai impostato esplicitamente (0 occorrenze in `src/`); è derivato — Electron lo forza a true con `webSecurity:false`. Si risolve alzando webSecurity.
- Immagini locali: `src/muya/lib/utils/getImageInfo.js` (`correctImageSrc`) e `src/muya/lib/utils/index.js:260-283` producono `file:///...` per l'`src` dell'`<img>` renderizzato inline nell'editor. È la dipendenza principale da webSecurity:false — vale sia in dev (pagina servita da `http://localhost` Vite → blocca `file://`) sia in prod (Chromium restringe `file:`→`file:` cross-directory).
- Export PDF: `src/main/menu/actions/file.js:81` `win.webContents.printToPDF` usa lo STESSO webContents della finestra editor → dipende dal rendering immagini. (Se nel fork l'export PDF non è esposto/usato, resta comunque da non regredire.)
- Nessuna infrastruttura custom-protocol esistente (`registerFileProtocol|registerSchemesAsPrivileged|protocol.(register|handle)` = 0 in `src/`). Tutto passa da `file://` grezzo.
- CSP: `src/renderer/index.html:9-18`, meta statica applicata anche in build. `img-src` include GIÀ `file:` → la CSP NON blocca le immagini (lo fa webSecurity a livello Chromium): i due meccanismi sono indipendenti. `unsafe-eval`/`ws:` servono solo a Vite/HMR in dev.
- Export HTML (`styledHtml`): scrive un file .html su disco con `<img src="file://...">` grezzo; il caricamento dipende dal browser che aprirà quel file, NON da webSecurity di MarkText → NON impattato da questo task.
- Drag/copia che assumono `file://` letterale: `tabs.vue:453` (drag tab→Explorer, DownloadURL) e `copyCutCtrl.js:140` (`replace('file://','')`).

## Regole e invarianti rilevanti
- **Mai sopprimere** i warning: l'obiettivo è alzare la sicurezza in prod, non zittire (DECISIONS.md 2026-07-05).
- Toccare `config.js` per ENTRAMBE le finestre (editor E preferences) in modo coerente.
- **Non rompere gli invarianti DnD** (vedi drag-html5-dnd.md): non alterare la logica dragover/dragend/dropEffect; qui si cambia solo il prefisso dell'URL locale nel payload/copia.
- Rischio rottura ALTO (immagini locali, drag/copia, PDF): ogni incremento va testato a runtime PRIMA di passare al successivo.
- Windows: il handler del protocollo deve mappare correttamente l'URL → path filesystem (lettera di unità, spazi, encoding percentuale, UNC). Punto delicato: gestire e testare path con spazi e caratteri non-ASCII.
- Non introdurre sintassi hardcoded per linguaggio; riusare i punti esistenti (`correctImageSrc`, `utils/index.js`) come unica sorgente di verità della risoluzione path.

## Incrementi (ognuno testato a runtime prima del successivo)

### Incremento 1 — scheme custom + immagini inline + webSecurity:true
1. In `src/main/app/index.js` (prima di app ready) registrare lo scheme privilegiato (es. `safe-file`) con `protocol.registerSchemesAsPrivileged` (privileges: standard, secure, supportFetchAPI, stream; bypassCSP:false). Verificare la firma esatta sulla doc Electron 39.
2. Registrare il handler con `protocol.handle('safe-file', ...)` (dopo app ready) che: decodifica l'URL → path locale, valida (esiste, è file), serve il contenuto (via `net.fetch('file://'+path)` o lettura stream). Gestire Windows (drive letter, spazi, encoding).
3. **SOLO in `getImageInfo` (`src/muya/lib/utils/index.js:259-306`)** — unico chokepoint di
   rendering (confermato: `renderLeafBlock.js:144` e `renderInlines/image.js:36` instradano ogni
   `src` da qui): emettere `safe-file://` per i path locali, ai DUE punti di ritorno pertinenti:
   - ramo path assoluto/relativo locale (riga ~282): `'file://' + path.resolve(...)` →
     `'safe-file://' + path.resolve(...)`;
   - ramo `isUrl` (righe ~273-276): se `src` inizia con `file://`, riscrivere il prefisso in
     `safe-file://` (così i `<img src="file://...">` GIÀ salvati vengono aggiornati a render);
     lasciare invariati http/https (e data:/blob:, che non passano da questi rami).
   **NON toccare `correctImageSrc` (`getImageInfo.js:22`)**: il suo output finisce in `block.text`
   (`imageCtrl.js:114,159`) = markdown PERSISTITO su disco → cambiarlo corromperebbe i file salvati.
   Su disco l'`src` resta `file://`; la conversione a `safe-file://` avviene solo a render.
4. In `src/renderer/index.html` CSP: aggiungere il nuovo scheme a `img-src` (accanto a `file:` che si può poi rimuovere se non più usato).
5. `config.js`: `webSecurity:true` su editor e preferences.
6. **Test utente**: immagine locale embeddata (`![](C:/...)`) si vede inline nell'editor in **dev** E in **app packaged**; nessun warning webSecurity/allowRunningInsecureContent in dev.

### Incremento 2 — copia immagine + idempotenza render (scope CORRETTO dopo verifica 2026-07-07)
Decisione presa dopo verifica dei call-site (il punto 1 originale su `tabs.vue` era errato):
- **`tabs.vue:453` NON si tocca**: quel `file://` è l'URL del file DOCUMENTO reale passato all'OLE
  di Windows/Explorer (DownloadURL/CF_HDROP) per copiare il .md sul desktop. Lo scheme `safe-file`
  è interno all'app (solo rendering immagini) e Explorer non lo risolve → cambiarlo romperebbe il
  drag→desktop. Il salvataggio/markdown su disco resta `file://`/path (nessun `safe-file://`).
- **`copyCutCtrl.js:140`**: il fallback legge l'`src` RENDERIZZATO (ora `safe-file://`) e
  `.replace('file://','')` lo spezzerebbe in `safe-/...`. Strippare anche `safe-file://` (prima di
  `file://`), così la copia immagine produce un path pulito come prima.
- **`getImageInfo` (`utils/index.js:261`) idempotente**: `printService.js:24` (export PDF,
  renderStatic) ri-processa l'`src` già renderizzato (`safe-file://`) con `getImageInfo`; oggi
  `safe-file://` non è riconosciuto come URL → cade nel ramo path e produce un `src` corrotto.
  Fix: nel calcolo di `isUrl` riconoscere anche `^safe-file://` (oltre a `^file://`), così un input
  `safe-file://` viene restituito invariato (pass-through) e la funzione è idempotente. Chiude anche
  la "verifica trasversale printToPDF" rimasta aperta dall'inc.1.
- **`imageSelector/index.js:56` NON si tocca**: legge `token.attrs.src` (markdown grezzo = `file://`),
  non l'`src` renderizzato → non impattato.

**Test utente**: (1) copia-incolla di un'immagine nel documento → markdown/path corretto (nessun
`safe-file`/`safe-`); (2) export PDF con immagini locali → immagini presenti nel PDF; (3) drag di una
tab su desktop/Explorer crea ancora il file (.md salvato e untitled); (4) nessuna regressione DnD
(reorder/detach/migrazione tab).

### Incremento 3 — CSP prod hardening (approccio DECISO dopo indagine 2026-07-07)
**Decisione**: opzione A — CSP `<meta>` in `index.html` trasformata per-ambiente da un plugin Vite
`transformIndexHtml` in `electron.vite.config.mjs`. Scartata l'opzione header via
`session.webRequest.onHeadersReceived`: in prod la pagina si carica da `file://` (`base.js:81`) e
webRequest non intercetta affidabilmente lo schema `file:` → la CSP non verrebbe applicata.
Verificato: nessun `eval`/`new Function` nel codice del progetto (`src/`) e Vue è precompilato (SFC)
→ `unsafe-eval` non dovrebbe servire in prod (conferma finale = test app packaged).

Meccanica:
- In `src/renderer/index.html` la `<meta>` CSP usa token placeholder: `__CSP_WS__` (in `default-src`
  e `connect-src`) e `__CSP_UNSAFE_EVAL__` (in `script-src`).
- Plugin in `electron.vite.config.mjs` (renderer.plugins) con hook `config(_, { command })` per
  memorizzare `isServe = command === 'serve'` e `transformIndexHtml(html)` che sostituisce:
  `__CSP_UNSAFE_EVAL__` → `'unsafe-eval'` (dev) / `''` (prod); `__CSP_WS__` → `ws: wss:` (dev) / `''` (prod).
- CSP risultante prod: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'
  'unsafe-inline' https://fonts.googleapis.com; img-src * data: file: blob: safe-file:; font-src
  'self' data: https://fonts.gstatic.com; connect-src 'self' http: https:;`. Mantenuti `'unsafe-inline'`
  (script/style), `http:`/`https:` in connect-src (fetch immagini remote + font Google): rimossi solo
  `'unsafe-eval'` e `ws:`/`wss:` in prod.

**Test utente**: (1) `dev` con HMR ancora funzionante (unsafe-eval/ws presenti in dev); (2) app
**packaged** senza warning CSP in console e pienamente funzionante (editor, preferenze, immagini
locali, codemirror/syntax highlight, formule KaTeX, font Google) — se qualcosa si rompe in prod per
mancanza di `unsafe-eval`, segnalarlo: si rivaluta il trade-off.

### Verifica trasversale
- Dopo l'incremento 1: verificare `printToPDF` (se l'export PDF è esposto) — le immagini locali devono comparire nel PDF.

## Esecutore e skill
- Orchestratore coordina; ogni incremento delegato ad Agent-Code separatamente, previa OK utente e con test runtime tra uno e l'altro.
- Skill di codice: `coding-standard`. Se si compila/testa: `build`.
