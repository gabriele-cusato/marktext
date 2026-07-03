# untitled-counter-globale — task1 — Plan

> Fix di **BUG-H5-UNTITLED** (`HARD-TASK.md`, handoff 2026-06-28 + aggiornamento 2026-07-04):
> il numero delle tab "Untitled-N" deve essere un **counter unico condiviso tra TUTTE le finestre**,
> bidirezionale (nuova tab in qualunque finestra = max globale + 1; la finestra originale tiene
> conto degli Untitled creati nelle altre).

## Obiettivo

Spostare l'assegnazione del numero N di "Untitled-N" nel **main process** (unico processo che vede
tutte le finestre), esposto al renderer via `ipcMain.handle` / `ipcRenderer.invoke`. Il renderer non
calcola più N da solo: lo chiede al main, con fallback locale se l'invoke fallisce.

## Prerequisiti bloccanti

Prima di toccare codice, verificare che esistano e siano leggibili; se uno manca o è ambiguo, FERMARSI senza modificare nulla e segnalarlo:
- Questo plan e il worklog `untitled-counter-globale-task1-worklog.md` (stessa cartella).
- I file da modificare elencati sotto (sezione "File da toccare").
- Skill di codice: caricare `coding-standard` prima di scrivere.
- Target di verifica: il progetto builda/parte con `npm run dev` da `C:\Projects\MarkText\marktext` (basta che il dev server parta senza errori di compilazione; il test funzionale lo fa l'utente).
- Version control: VIETATO usare git (commit, add, checkout, ecc.). Solo l'orchestratore usa `git status`/`git diff` in verifica, dopo.
- Nessun file sensibile/segreto coinvolto.

## Fatti già verificati (Agent-Explorer 2026-07-04 — anchor di riga validi a quella data, ri-grep prima di editare)

- **Sito del bug**: `src/renderer/src/store/help.js:90-119`, `getBlankFileState(tabs, ...)` — calcola `untitleId = Math.max(...tabs.map(...))` sulle SOLE tab locali (`f.pathname === ''` → `Number(f.filename.split('-')[1]) || 0`), poi `filename: 'Untitled-${++untitleId}'`. È l'UNICO sito che genera il suffisso `-N` in tutto `src/`.
- **Chiamante**: `NEW_UNTITLED_TAB` in `src/renderer/src/store/editor.js:1373-1392` chiama `getBlankFileState(this.tabs, ...)` a riga 1383, poi `bus.emit('file-loaded', ...)` a riga ~1388.
- **Chiamanti di `NEW_UNTITLED_TAB`** (vanno tutti verificati per compatibilità async): `editor.js:825,829,846,855,859,888,1405`; `src/renderer/src/components/recent/index.vue:22`; `src/renderer/src/components/editorWithTabs/tabs.vue:602`. L'evento bus `mt::new-untitled-tab` è intercettato in `editor.js:858-860`.
- **Il main non passa mai N**: menu File>New Tab → `src/main/menu/actions/file.js:648-653` → `win.webContents.send('mt::new-untitled-tab')`; `EditorWindow.openUntitledTab()` in `src/main/windows/editor.js:428-438`; chiamate in `src/main/app/index.js:507,511,822,961,965`. Solo inoltro, nessun calcolo.
- **Registro sessione main**: `src/main/app/index.js:36` — `this._sessionRegistry = Map<win.id, {winId, order, tabs}>`; popolato dagli handler `mt::session-save` (`app/index.js:876-887`) e `mt::session-save-and-close` (`app/index.js:891-910`). Ogni slice tab contiene `filename` e `pathname` (costruito in `COLLECT_SESSION`, `editor.js:865-883`). Aggiornamento PERIODICO (default 7s) → NON usabile da solo per assegnare N (stale), ma usabile per fare "bump" del counter.
- **Pattern `ipcMain.handle` già presente nel progetto**: `src/main/app/index.js:1067,1074,1079` (`mt::fs-trash-item`, keybinding), `src/main/spellchecker/index.js:79-101`. L'invoke dal renderer è quindi già uno stile consolidato.
- **Detach**: `_createDetachWindow` (`app/index.js:566-576`) stash `_detachTab`; la nuova finestra fa `mt::request-session-restore` e riceve la sola tab detachata (`app/index.js:913-939`), che porta già il suo `filename` originale (es. "Untitled-6") — vedi `DETACH_TAB` in `editor.js:990-1004`.
- **Restore al riavvio**: `src/main/filesystem/session.js` (`loadSessionTabs`/`hasSessionSync`); i filename Untitled sono nel `session.json`.
- **Node main è single-thread**: `++counter` sincrono dentro l'handler è atomico; NON mettere `await` tra lettura e incremento.

## Decisione di design (approvata dall'utente, vedi riepilogo in chat 2026-07-04)

Counter **monotono per sessione-app** nel main: non riusa mai un numero liberato finché l'app resta
aperta (chiudere Untitled-3 non libera il 3). Cambio di comportamento rispetto a oggi (max "vivo"
locale) accettato: è ciò che elimina le collisioni tra finestre.

## Implementazione — sottoproblemi in ordine

### 1. Main: counter globale + handler invoke (`src/main/app/index.js`)
- Aggiungere `this._untitledIdSeq = 0` nel costruttore di `App` (vicino a `_sessionRegistry`, riga ~36).
- Nuovo handler: `ipcMain.handle('mt::next-untitled-index', (event, localMax) => { this._untitledIdSeq = Math.max(this._untitledIdSeq, Number(localMax) || 0); return ++this._untitledIdSeq })`.
  - `localMax` = max locale calcolato dal renderer chiamante: protegge i casi in cui il counter main non ha ancora visto tab Untitled esistenti (restore, detach) senza logica dedicata per ognuno.
  - Registrarlo dove stanno gli altri `ipcMain.handle` (riga ~1067), stessa convenzione di naming `mt::`.
- **Bump passivo dal registro sessione**: negli handler `mt::session-save` (:876) e `mt::session-save-and-close` (:891), dopo l'aggiornamento dello slice, calcolare il max dei `Number(t.filename.split('-')[1])` sulle tab con `pathname === ''` e fare `this._untitledIdSeq = Math.max(this._untitledIdSeq, max)`. Copre detach, restore e qualunque drift, senza toccare i flussi esistenti.
- **Seed al boot con sessione esistente**: dove il main carica la sessione per il restore (percorso `loadSessionTabs` in `session.js` / suo chiamante in `app/index.js`), fare lo stesso bump sul risultato. Se il punto è scomodo, il bump passivo + `localMax` coprono comunque il caso — in tal caso annotare nel worklog che il seed esplicito è stato omesso e perché.

### 2. Renderer: chiedere N al main (`src/renderer/src/store/editor.js` + `help.js`)
- `getBlankFileState(tabs, encoding, lineEnding, markdown, forcedNumber = null)`: se `forcedNumber` è un numero valido, usarlo come N (saltare il calcolo dal max locale); altrimenti comportamento attuale invariato (è il fallback).
- Esportare da `help.js` (o calcolare inline in `editor.js`) un helper `getLocalUntitledMax(tabs)` che riusa la stessa regex/logica del max locale (stessa guard NaN di B-REV8) — NON duplicare la logica in due posti: estrarla e riusarla sia nel fallback sia per `localMax`.
- In `NEW_UNTITLED_TAB` (`editor.js:1373`): rendere l'azione `async`; prima di `getBlankFileState`, `const n = await ipcRenderer.invoke('mt::next-untitled-index', getLocalUntitledMax(this.tabs))` dentro un `try/catch`; su errore `n = null` (fallback locale). Passare `n` a `getBlankFileState`.
  - Usare lo stesso accessor ipcRenderer già usato nel file per gli altri invoke/send (verificare con grep come `editor.js` accede a ipcRenderer — preload bridge).
- **Verifica compatibilità async** su OGNI chiamante elencato nei fatti verificati: tutti quelli fire-and-forget vanno bene così; se un chiamante dipende dalla tab già presente in `this.tabs` subito dopo la chiamata (sincronia), aggiungere `await`/`.then` in quel chiamante. In particolare controllare `RESTORE_SESSION` fallback (`editor.js:888`) e il flusso `file-loaded` (`editor.js:~1388`, resta interno all'azione, quindi ok).

### 3. Verifica finale
- Grep di controllo: nessun altro sito genera `Untitled-N` (l'esplorazione dice che `help.js` è l'unico — riconfermare con `grep -rn "Untitled-" src/`).
- Avviare `npm run dev`: deve compilare e la finestra deve aprirsi. ⚠️ Modifica al MAIN process → nessun hot reload, serve avvio pulito.
- Aggiornare il worklog (sezione Avanzamento: `[x]` + tag `DA TESTARE` sui punti che richiedono runtime utente).

## Regole rilevanti

- NON toccare: logica di merge sessione (`session.js` writeSession), flussi drag/DnD, `_sessionRegistry` oltre al bump descritto, `getUniqueId` (`util/index.js:126` — è il contatore degli `id` interni, NON c'entra col naming).
- Muya non è coinvolto. Nessun file in `src/muya/`.
- Convenzioni CLAUDE.md: prima di cambiare la firma di `getBlankFileState`, grep TUTTI i chiamanti (`getBlankFileState(` in tutto src/) — il plan ne elenca i noti ma la verifica va rifatta.
- Canale nuovo `mt::next-untitled-index`: prima di aggiungerlo, grep che non esista già (`grep -rn "next-untitled" src/`).
- Commenti in italiano, forma all'infinito. Skill `coding-standard`.
- VIETATO git.

## File da toccare (SOLO questi)

1. `src/main/app/index.js` — counter + handler + bump
2. `src/renderer/src/store/editor.js` — NEW_UNTITLED_TAB async + invoke + localMax
3. `src/renderer/src/store/help.js` — param `forcedNumber` + helper max locale
4. (eventuale, solo se serve per il seed) `src/main/filesystem/session.js` — NON modificare la logica esistente, al massimo riusare export già presenti

## Test runtime (li fa l'utente, annotare nel worklog sezione Test)

1. Finestra 1: crea Untitled fino a `Untitled-3`. Detach di un **file salvato** → finestra 2 → nuova tab in finestra 2 = **`Untitled-4`** (non Untitled-1).
2. Finestra 1 fino a `Untitled-6`, detach di `Untitled-6` → finestra 2 → nuova tab in finestra 2 = **`Untitled-7`**; poi nuova tab in **finestra 1** = **`Untitled-8`** (bidirezionale).
3. Singola finestra, nessuna regressione: nuove tab numerate in crescita; riavvio app con sessione contenente `Untitled-5` → prima nuova tab dopo il restore = `Untitled-6` (no collisioni).
4. Comportamento monotono atteso: chiudere `Untitled-3` e crearne una nuova NON riusa il 3 (finché l'app resta aperta).
