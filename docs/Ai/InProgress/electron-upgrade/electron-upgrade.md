# electron-upgrade — Aggiornamento Electron 39 (EOL) → 43 (latest)

## Scopo

Portare Electron dalla major **39** (EOL 2026-05-05, nessun fix di sicurezza) alla **43**
(latest, EOL ~2027-01-05). Motivo = sicurezza, non warning. È il "Giro 7" rimandato in
`docs/Ai/packages-update-fix.md` (§4 e §Giro 7), promosso a feature dedicata.

## STATO 2026-07-07 — salto diretto 39→43, dev funzionante

Per tempo (time-box), l'utente ha scelto di **saltare direttamente a Electron 43.0.0** in un colpo
(non un major alla volta). Stato raggiunto:
- `electron@43` installato; **binario scaricato a mano** (`node node_modules/electron/install.js`
  + `--use-system-ca`) perché da E42 il postinstall non lo scarica più (→ era `Error: Electron
  uninstall`). Vedi `electron-upgrade-istruzioni-pc-principale.md`.
- **N2 risolto**: native-keymap è N-API → escluso da `@electron/rebuild` (`--only ced,keytar` in
  tutti gli script `package.json`); il suo binario napi (buildato contro Node) carica su E43. Nessuna
  soppressione. Keymap reale caricato (niente più fallback en-US).
- `ced`/`keytar` ricompilati per l'ABI Electron 43.
- **`npm run dev` parte pulito**: nessun errore/eccezione; restano solo i 2 warning deprecati
  pre-esistenti (`crypto.fips`/`fs.F_OK`, da vite-plugin-electron-renderer → feature
  `renderer-no-node-integration`).

**PENDENTE (gate reale prima di dichiarare l'upgrade OK):**
1. **Retest manuale funzionale** della superficie sensibile (sotto) — dev che parte NON prova le feature.
2. **Build produzione** `npm run build:win` + app pacchettizzata che si avvia.
3. **Commit** dedicato dell'upgrade.

Nota metodo: il salto unico rende impossibile bisecare quale major (41/42/43) causi un'eventuale
regressione. Le tabelle breaking-change per 41/42/43 (nei plan task) restano la **checklist di cosa
osservare** nel retest manuale. Se emerge una regressione, si isola col diff e, se serve, si scende
di un major per capire.

## RIPRENDI DA QUI — handoff 2026-07-07 ore 18:00 (per PC principale)

### 0. Modifiche di codice fatte oggi (NON committate su questo PC test)
Su questo PC (copia TEST con spazi nel path) sono stati modificati, **senza commit**:
- `package.json`: `electron@43.0.0` (via install) + tutti gli script `@electron/rebuild` con
  `--only ced,keytar` (rebuild-native, build:win/mac/linux).
- Doc: questo file, `electron-upgrade-istruzioni-pc-principale.md`, `native-deps-plan.md`,
  `task1-worklog`, `DECISIONS.md` (nota modus operandi), plan `renderer-no-node-integration`.
- `package-lock.json` allineato a electron@43.

**Per portarli sul PC principale**: committare+pushare da qui e fare pull sul principale, OPPURE
rifare a mano gli edit `package.json` sul principale. (Commit non fatto: serve OK esplicito, DECISIONS 2026-07-01.)

### 1. Tornare a questo punto (Electron 43 dev funzionante) sul PC principale
Seguire **`electron-upgrade-istruzioni-pc-principale.md`** (ambiente VS2022 Community + nvm 22.21.1;
`npm ci` con `--use-system-ca`; **scaricare binario** `node node_modules/electron/install.js`;
`@electron/rebuild -f --only ced,keytar`; verifica `npm run dev`).

### 2. Esito test manuale 2026-07-07 (su Electron 43)
- ✅ OK: drag tab, scorciatoie (Ctrl+K commenti), ricerca file, export, source mode, `npm run dev` pulito.
- ⚠️ Dialog **apri** → si apre in **Download** (breaking change E43: defaultPath default = Download).
  "Salva con nome" → Documenti (lì il codice passa già defaultPath). **Decisione UX in sospeso**:
  fixare (tracciare ultima cartella + passarla come defaultPath) o accettare.
- ⏭️ keychain (keytar/token GitHub uploader): non testato (utente non usa l'uploader) — testare se serve.
- 🐞 Warning noti/innocui: `crypto.fips` (DEP0093), `fs.F_OK` (DEP0176) da vite-plugin-electron-renderer
  → feature separata `renderer-no-node-integration`. NON sopprimere.

### 3. FIX DIAGNOSTICATI — da applicare (con gate/OK prima di scrivere codice)

**FIX #1 — immagini locali rotte (regressione E43, PRIORITÀ)**
Sintomo: `safe-file://...png net::ERR_UNEXPECTED` (renderer) + `net::ERR_FILE_NOT_FOUND` (main).
Causa: muya emette `safe-file://C:/...` (doppio slash); lo scheme è `standard:true` → Chromium di E43
parsa `C:` come **host** ("c", due punti persi) → il handler `app/index.js:~246` si aspetta
`pathname=/C:/...` (triple slash) → path errato → fetch fallisce. Chromium ha cambiato il parsing
tra E39 e E43.
Fix (lato handler, robusto, non tocca muya → rispetta invarianti task10) in `src/main/app/index.js`,
dentro `protocol.handle('safe-file', ...)`:
```js
let filePath = decodeURIComponent(url.pathname)
if (isWindows) {
  if (/^\/[a-zA-Z]:/.test(filePath)) filePath = filePath.slice(1)          // forma safe-file:///C:/...
  else if (/^[a-zA-Z]$/.test(url.host)) filePath = `${url.host}:${filePath}` // forma safe-file://C:/... (host="c")
}
return net.fetch(pathToFileURL(filePath).toString())
```
Test dopo il fix: aprire un doc con immagine locale (path con spazi/OneDrive) → deve renderizzare;
console F12 senza ERR_UNEXPECTED; niente ERR_FILE_NOT_FOUND nel main.

**FIX #2 — Element Plus `size="mini"` non valido (da update element-plus, non electron)**
"mini" rimosso in Element Plus 2.x (validi: ""/default/small/large). Sostituire `size="mini"` →
`size="small"`:
- `src/renderer/src/components/exportSettings/index.vue` (6 occorrenze) — è il dialog dell'errore
- `src/renderer/src/components/editorWithTabs/editor.vue` (2 occorrenze)
Test: aprire il dialog Export → nessun warning "Invalid prop size" in console.

### 4. Restano dopo i fix
- Decidere/fare il fix dialog-Download (punto 2).
- `npm run build:win` + avviare l'app pacchettizzata (i nativi caricano nel packaged?).
- Commit dedicato dell'upgrade (`update: electron 39 -> 43 + fix nativi/script/safe-file/element-plus`).
- Valutare script `postinstall` che scarica il binario Electron (E42+) per automatizzare.
- Feature `renderer-no-node-integration` (separata) per i warning crypto.fips/fs.F_OK.

## PREREQUISITO scoperto 2026-07-07: debito moduli nativi (bloccante)

Il primo tentativo di gradino 39→40 ha rivelato che l'upgrade è **bloccato dallo stato dei moduli
nativi di terze parti**, non solo dalle breaking changes di Electron. `native-keymap@3.3.9` (latest)
non compila contro la V8 di Electron 40. Inoltre `keytar` è upstream morto.

Decisione utente: spostare il codice verso **API native di Electron** (integrate, senza addon da
ricompilare) dove ha senso, senza perdere funzionalità e senza forzature — miglior compromesso
complessità/natività/funzionalità. Piano dettagliato: **`electron-upgrade-native-deps-plan.md`**.

Sintesi (dettaglio e verdetti nel file sopra):
- **keytar → safeStorage** (addon morto → API nativa Electron): SOSTITUIRE, su Electron 39.
- **native-keymap**: TENERE + fix al sorgente (API V8 con `EmbedderDataTypeTag`, `#if` su versione,
  PR upstream + patch-package). **Bloccante** per la compilazione su 40+.
- **ced → detector charset JS**: VALUTARE, non urgente (tradeoff qualità detection).
- **@vscode/ripgrep**: binario prebuilt, nessuna tassa → lasciare.

**Ordine rivisto**: i task nativi N1 (keytar) e N2 (native-keymap) vengono PRIMA dei gradini
Electron. Vedi "Ordine consigliato" nel plan nativi.

## Vincolo di metodo: UN major alla volta

Salto totale = 3 major (39→40→41→42→43). NON aggiornare in blocco: ogni major ha breaking
changes proprie (https://www.electronjs.org/docs/latest/breaking-changes) e va buildato+testato
prima di salire al successivo. Bundlare i major rende impossibile bisecare le regressioni.

Un task = un gradino = un commit dedicato e reversibile.

| Task | Salto | Note | Stato |
|------|-------|------|-------|
| **N1** | keytar → safeStorage | prerequisito nativo, su Electron 39 (`native-deps-plan`) | DA FARE |
| **N2** | native-keymap fix sorgente | **bloccante** compilazione 40+ (`native-deps-plan`) | DA FARE |
| task1 | 39 → 40 | Node interno **22 → 24**; **richiede N2** per compilare i nativi | BLOCCATO da N2 |
| task2 | 40 → 41 | breaking changes da leggere al raggiungimento | DA FARE |
| task3 | 41 → 42 | breaking changes da leggere al raggiungimento | DA FARE |
| task4 | 42 → 43 | breaking changes da leggere al raggiungimento; target finale | DA FARE |
| N3 | ced → detector JS | opzionale, non urgente (`native-deps-plan`) | VALUTARE |

I plan dei task 2-4 sono da dettagliare con le breaking changes specifiche **quando si raggiunge
quel gradino** (non verificabili in anticipo senza leggere il changelog di ogni major).

## Fatti verificati (2026-07-07)

- Latest Electron pubblicata: **43.0.0** (`npm view electron version`, confermato utente).
- Electron NON ha LTS: supporta solo le 3 major più recenti, major nuova ~ogni 8 settimane →
  ogni major vive ~6 mesi. 43 è la scelta corretta ora (EOL più lontano tra le supportate).
- Stato attuale progetto: `electron ^39.2.7`, `electron-builder ^26.4.0`, `electron-updater ^6.6.2`.
- Moduli nativi da ricompilare a ogni salto: **keytar ^7.9.0, ced ^2.0.0, native-keymap ^3.3.7,
  @vscode/ripgrep ^1.17.0**. Script: `npm run rebuild-native` (= `npx @electron/rebuild -f`).

## Ambiente build nativi (OBBLIGATORIO a ogni task)

Da `packages-update-fix.md` §"Ambiente build nativi". Su PC con VS2026+VS2022, node-gyp sceglie
VS2026 v145 (Spectre non installabili → errore MSB8040). Forzare VS2022 v143:

1. Aprire **"Developer PowerShell for VS 2022"** (o `Enter-VsDevShell` su VS2022, vedi doc).
2. `nvm use 22.21.1` (per task1; valutare Node 24 dal task in cui conviene — vedi sotto).
3. Verificare `$env:VCINSTALLDIR` → deve puntare a `...\2022\...\VC\`.
4. Chiudere app/dev server prima di toccare `node_modules` (EBUSY su `ced`).

Requisito una tantum in VS2022: componente **MSVC v143 x64/x86 con mitigazione Spectre**.

## Node interno 22 → 24 (attenzione al task1)

Electron 40 porta Node interno da 22 a 24. Il Node **di sviluppo** (nvm) resta 22.21.1 per il
build, ma le API Node usate nel **main process** girano sul Node 24 di Electron a runtime →
verificare che nulla di deprecato/rimosso in Node 24 sia usato in `src/main/` e `src/common/`.
Valutare il passaggio dell'ambiente dev a Node 24 (nvm) insieme, aggiornando CLAUDE.md
(prerequisiti build) se si cambia.

## Breaking changes 40→43 — sintesi impatto (analisi statica 2026-07-07)

Analisi del changelog ufficiale contro il codice. Dettaglio per gradino nei plan dei task.
**Nessun fix di codice è obbligatorio per arrivare a 43.** Punti da gestire:

| Punto | Major | Impatto | Dove | Tipo |
|-------|-------|---------|------|------|
| clipboard da renderer (`@electron/remote`) | 40 dep → **44 removed** | non blocca 43, blocca 44 | `renderer/src/util/clipboard.js` | codice (futuro) |
| download electron on-demand + SSL inspection | 42 | primo run può fallire su rete aziendale | ambiente (`--use-system-ca`) | ambiente |
| dialog `defaultPath` default = Downloads | 43 | UX: dialog senza defaultPath aprono su Downloads | `dataCenter/index.js:173,192` | UX opzionale |
| rounded corners frameless Linux | 43 | cosmetico, solo Linux | `config.js` frame:false | cosmetico |

**Verificato NON impattante** (dettaglio nei plan): nativeImage toBitmap/getBitmap/
createFromNamedImage, ia32/armv7l removed (win target = solo x64), notifiche UNNotification,
clearStorageData quotas, PDF WebContents, WCO title bar, OSR scale factor, cookie change cause,
chrome.scripting CSS, dSYM macOS.

> **L'analisi statica NON basta.** Il changelog copre solo le rotture note e documentate. A ogni
> gradino le verifiche runtime (sezione sotto) sono **obbligatorie** anche dove l'analisi non
> segnala nulla: Chromium/Node nuovi e i nativi ricompilati possono dare regressioni non elencate.

## Salto futuro 44 (fuori scope di questa feature, ma da pianificare)

- **clipboard rimosso dal renderer**: reinstradare `renderer/src/util/clipboard.js` sul clipboard
  esposto dal preload (`contextBridge`), esponendo gli helper mancanti (`NSFilenamesPboardType`
  su macOS, `FileNameW` su Windows). Richiede patch di codice → Agent-Code con gate.
- **ia32/armv7l rimossi**: nessun impatto (win target già solo x64).
- 44 EOL ~gennaio 2027: valutare quando la 43 esce di supporto.

## Aree da RETESTARE a ogni gradino (nessun test automatico le copre)

Copertura automatica reale: unit = solo utility main; e2e = solo smoke "app parte". Tutto il
resto è **test manuale obbligatorio**. Superficie sensibile ai bump Electron (vedi DECISIONS.md):

- **Drag&drop tab** (area storicamente rotta dai bump): reorder, detach, cross-window, taskbar
  spring-loading. Bug piattaforma **electron#42252** (drop stessa-finestra inaffidabile):
  se un Electron nuovo lo fixa, il percorso `drop` preferenziale torna attivo (flag
  anti-doppia-esecuzione già presente) → ritestare che non ci sia doppia esecuzione.
- **Dialog** (Element Plus + finestre native).
- **Export** HTML/PDF (printService).
- **Source mode** (CodeMirror 5).
- **Scorciatoie** (native-keymap), **keychain** (keytar), **ricerca file** (@vscode/ripgrep).
- **App pacchettizzata** che si avvia (`npm run build:win`), non solo dev.

## Vincolo ambiente (Group Policy)

Su questo PC (secondario) build e test Playwright sono bloccati da Group Policy — vedi memoria
`build-bloccato-su-pc-secondario` e CLAUDE.md §"Ambiente ristretto". **Build/rebuild nativo/test
si eseguono sul PC principale.** Qui si scrivono solo i doc e (se serve) le patch di codice, che
poi vengono buildate/testate altrove.

## Rollback (per ogni gradino)

Git versiona `package.json` + `package-lock.json`, NON `node_modules/`. Dopo un ripristino git:
```
git checkout -- package.json package-lock.json     # (o git revert del commit del gradino)
npm ci                                              # riallinea node_modules ESATTAMENTE al lockfile
npm run rebuild-native                              # SEMPRE (il giro tocca i nativi), in ambiente VS2022
```
Commit dedicato per gradino = revert isolato senza trascinare altro.

## Regola di workflow

Prima di ogni Agent-Code: riepilogo + OK esplicito utente + istruzioni su file (DECISIONS.md
2026-07-03). Ma gran parte di questa feature è comandi npm + test manuale dell'utente, non
scrittura di codice: Agent-Code serve solo se un breaking change richiede patch al codice.
