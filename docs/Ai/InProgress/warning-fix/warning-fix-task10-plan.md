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

### Incremento 2 — drag su desktop + copia immagine
1. `tabs.vue:453` e `copyCutCtrl.js:140`: adattare le assunzioni su `file://` letterale al nuovo prefisso (il markdown salvato/incollato e il DownloadURL devono restare corretti: su disco il markdown deve continuare a contenere il path/URL atteso, NON `safe-file://` se non voluto — decidere se il nuovo scheme resta solo per il rendering interno e il salvataggio mantiene `file://`/path relativo).
2. **Test utente**: drag di una tab su desktop/Explorer crea il file; copia-incolla di un'immagine nel documento produce markdown corretto; nessuna regressione DnD (reorder/detach/migrazione tab ancora ok).

### Incremento 3 — CSP prod hardening
1. Generare/iniettare la CSP in base all'ambiente: in dev mantenere `unsafe-eval`/`ws:` (servono a Vite/HMR), in prod rimuoverli. Opzioni: index.html trasformato per ambiente da electron-vite, oppure header via `session.webRequest.onHeadersReceived` nel main. Verificare che il bundle prod non richieda `unsafe-eval`.
2. **Test utente**: dev con HMR funzionante; build prod senza warning CSP; app packaged funzionante (editor, preferenze, immagini).

### Verifica trasversale
- Dopo l'incremento 1: verificare `printToPDF` (se l'export PDF è esposto) — le immagini locali devono comparire nel PDF.

## Esecutore e skill
- Orchestratore coordina; ogni incremento delegato ad Agent-Code separatamente, previa OK utente e con test runtime tra uno e l'altro.
- Skill di codice: `coding-standard`. Se si compila/testa: `build`.
