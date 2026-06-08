# MEDIUM-TASK — Piano implementativo (sezione "Medio" + ultimo "Medio-facile")

> **Scopo.** Tutto il necessario per implementare, **a sessione pulita**, i task della sezione *Medio* di
> `TODO.md` + l'ultimo *Medio-facile* (controlli finestra macOS), senza introdurre bug / breaking changes.
> Leggere PRIMA: `CLAUDE.md` (regole grep call-site / IPC / bus / keybinding), `EASY-TASK.md` (invarianti editor),
> `MEDIUM-EASY-TASK.md` (ricerca, `isMarkdownPath`), `DESIGN-TASK.md` (UI v2, `markRaw`, scroll CM).
>
> **Stato del codice verificato in questa sessione** (anchor riga reali, possono shiftare → ri-grep prima di editare).

---

## 0. Decisioni utente (LOCKED — non richiedere di nuovo)

1. **Mode CodeMirror per estensione**: SÌ, va fatto, ma riusando l'infrastruttura CM **già presente**
   (no implementazione manuale dei linguaggi). → vedi **T-M1**.
2. **Auto-switch file grandi**: soglia **configurabile da Preferences** (no costante hardcoded). → **T-M6**.
3. **Apertura .html/.htm nel browser**: tramite **shortcut dedicata** (no voce menu da sola). I file non-.md
   restano editabili in source come ora. → **T-M5**.
4. **Controlli finestra macOS**: **pianificato con caveat** — codice dietro `isOsx`, zero regressioni su Win/Linux,
   verifica reale rimandata (sviluppo su Windows, non testabile qui). → **T-ME**.
5. **Find & Replace potenziato**: **GIÀ FATTO** (case/whole-word/regex presenti). Nessun intervento. Checkbox TODO aggiornato.
6. **Fix grafica impostazioni**: **RIMANDATO** a sessione dedicata con screenshot. → **T-M10** (solo nota).

---

## 1. Stato reale dei task (verificato nel codice)

| Task TODO (sez. Medio) | Stato reale | Dove |
|---|---|---|
| Fix grafica impostazioni | ⏸️ rimandato (modal v2 già solido) | `components/settingsModal/index.vue` |
| Find & Replace potenziato | ✅ già fatto (case/word/regex) | `components/search/index.vue:73-94` |
| Trova in tutti i file aperti | ✅ già fatto (= T4B) | sidebar search, vedi `MEDIUM-EASY-TASK.md` |
| Markdown solo per .md | ✅ già di fatto (instradamento per estensione) | `util/index.js:172 isMarkdownPath`, `store/editor.js:721` |
| Apertura browser .html/.htm | 🆕 nuovo | T-M5 |
| Commenti con shortcut | 🆕 nuovo (dipende da T-M1) | T-M2 |
| Indentazione automatica | 🆕 nuovo, **valore reale solo dopo T-M1** | T-M4 |
| Fold/unfold blocchi | 🆕 nuovo (dipende da T-M1) | T-M3 |
| Auto-switch CodeMirror file grandi | 🆕 nuovo | T-M6 |
| **(Medio-facile)** Controlli finestra macOS | 🆕 nuovo, renderer-only | T-ME |

**Scoperta architetturale chiave:** l'editor source (CodeMirror) imposta **sempre** `mode:'markdown'`
(`sourceCode.vue:718` → `setMode(codeMirrorInstance, 'markdown')`), anche per `.js/.py/.html/.txt`. Quindi oggi:
niente syntax highlight per file di codice, e commento/fold/indent non sanno la sintassi del linguaggio.
**T-M1 sblocca tutto questo** ed è prerequisito di T-M2/T-M3/T-M4.

---

## 1-bis. Prontezza per sessione pulita (TRIAGE — leggere per primo)

> Classifica ogni task in: **✅ pronto** (implementabile subito dal doc) · **🔵 test runtime** (residuo verificabile
> SOLO girando l'app, non leggendo) · **🟡 scelta utente** (serve una tua decisione prima) · **🍎 non testabile qui**
> (macOS, sviluppo su Windows) · **⏸️ bloccato** (manca input utente). Un task può avere più tag.

| Task | Prontezza | Cosa resta fuori dal doc (runtime / scelta) |
|---|---|---|
| **T-M1** mode per estensione | ✅ + 🔵 | runtime: `modeURL` carica i mode in **build di produzione**? (in dev/in-app già provato via code-fence) |
| **T-M2** commenti `Ctrl+/` | ✅ | — (keybinding già verificato su 3 OS) |
| **T-M3** fold/unfold | ✅ + 🔵 | runtime: colore frecce foldgutter sui **temi scuri** (ritocco CSS visivo) |
| **T-M4** indentazione | ✅ + 🟡 | scelta: vale la pena? Utile **solo dopo T-M1**; in markdown puro ~inutile |
| **T-M5** html→browser | ✅ | — (keybinding `Ctrl+Shift+O` verificato libero su 3 OS) |
| **T-M6** auto-switch file grandi | ✅ + 🔵 | runtime: il sync pref main→renderer prende il nuovo campo? (campo esplicito lo rende sicuro) |
| **T-M7** markdown solo .md | ✅ | solo verifica/regression (già di fatto) |
| **T-M8** trova in tutti i file | ✅ | solo verifica/regression (già fatto = T4B) |
| **T-M9** find & replace | ✅ | già fatto, nessun intervento |
| **T-M10** fix grafica impostazioni | ⏸️ | **bloccato**: serve screenshot del problema specifico |
| **T-ME** controlli finestra macOS | ✅ + 🍎 | codice pronto (renderer-only), ma il semaforo nativo **non testabile su Windows** |

**In sintesi per la prossima sessione:** parti da **T-M1** (sblocca M2/M3/M4) → poi M2, M3, M5, M6 a piacere. **T-M4**
chiedi conferma utente prima. **T-ME** implementabile ma verifica visiva rimandata a un Mac. **T-M10** non toccare
finché l'utente non fornisce screenshot. I tag 🔵 sono **test da fare girando l'app**, non informazioni mancanti.

---

## 2. Invarianti globali da rispettare (cross-cutting — leggere prima di toccare)

- **Una sola fonte di verità Muya↔source**: `isMarkdownPath(pathname)` (`util/index.js:172`) usata da
  `_applySourceCodeForFile` (`store/editor.js:721-728`). Qualsiasi nuova condizione di modalità (es. file grandi)
  va aggiunta **SOLO lì**. NON duplicare la logica.
- **`bus.on` ⇒ `bus.off` simmetrico** in `onBeforeUnmount` (vedi `sourceCode.vue:681-697` vs `843-847`). Listener
  orfani = doppia esecuzione dopo remount.
- **Keybinding**: gli accelerator del menu Electron **precedono** gli `extraKeys` CM. Per i tasti **già a menu** serve
  routing mode-aware via `bus`. Per tasti **liberi** (non a menu, es. `Ctrl+/`) si può bindare direttamente in
  `extraKeys` (fire solo in source → automaticamente mode-aware). **PRIMA di assegnare**: grep la combo in
  `keyboard/keybindingsWindows.js`, `keybindingsLinux.js`, `keybindingsDarwin.js`.
- **Cambio firma funzione / handler IPC**: grep TUTTI i call-site (`ipcMain.emit('canale'` **e**
  `ipcRenderer.send('canale'`). `loadMarkdownFile` è chiamata anche dal watcher (`watcher.js`) → modifiche additive,
  mai breaking. Vedi `CLAUDE.md` § IPC.
- **Muya è compilato nel bundle** → dopo modifiche a `src/muya/` serve **restart** `npm run dev` (l'HMR non basta).
  Modifiche a `codeMirror/index.js` (nuovi import addon): l'HMR renderer di solito le prende, ma in caso di stranezze
  **full reload / restart dev**.
- **Patch Vite cache**: se si toccano import da `node_modules` e i moduli non si aggiornano, cancellare
  `node_modules/.vite/deps/` (vedi `DESIGN-TASK.md` § Patch Vite cache).
- **Dynamic mode loading CM funziona già in-app**: `setMode` (`codeMirror/index.js:186`) usa
  `requireMode`+`autoLoadMode`+`modeURL` (riga 86) ed è usato per l'highlight dei code-fence in Muya. Quindi il
  caricamento dinamico dei mode via `modeURL` è **già provato funzionante** in dev e prod → T-M1 lo riusa.
- **Shape tab Pinia**: i campi del tab nascono dal `rawDocument` (main) propagato via `mt::open-new-tab`. Aggiungere
  un campo (es. `fileSize`) è additivo ma va propagato in `store/help.js` (default tab) + `store/editor.js` (handler
  open-new-tab). Grep `getBlankFileState` / costruzione fileState prima di aggiungere.

---

## 3. Task — dettaglio implementativo

### Ordine consigliato (dipendenze)
1. **T-M1** (mode per estensione) — *foundational*, sblocca M2/M3/M4.
2. **T-M2** (commenti) → **T-M3** (fold) → **T-M4** (indent). Indipendenti tra loro ma tutti post-M1.
3. **T-M5** (html→browser), **T-M6** (file grandi), **T-ME** (macOS) — indipendenti, in qualsiasi ordine.
4. **T-M7/T-M8/T-M9** — solo verifica/regression. **T-M10** — rimandato.

---

### T-M1 — Mode CodeMirror per estensione (FOUNDATIONAL)

**Obiettivo.** In source mode, evidenziare la sintassi del linguaggio reale del file (.js→javascript, .py→python,
.html→htmlmixed, .css, .json, …) e far funzionare commento/fold/indent per-linguaggio. I `.md` restano in mode
`markdown` (comportamento attuale invariato). Untitled/senza estensione → `markdown`.

**Complessità.** Media (la più importante). ~30-50 righe, ma tocca punti delicati (init + cambio tab).

**Infrastruttura già presente (riusare, NON reinventare):**
- `codeMirror/index.js:8` → `import 'codemirror/mode/meta'` (fornisce `CodeMirror.findModeByFileName/Extension/MIME`).
- `codeMirror/index.js:19` → `loadmode(codeMirror)` (fornisce `CodeMirror.autoLoadMode` / `requireMode`).
- `codeMirror/index.js:86` → `codeMirror.modeURL = '../../../../node_modules/codemirror/mode/%N/%N.js'` (già impostato).
- `codeMirror/index.js:186` → `setMode(doc, name)` esistente (per NOME linguaggio, usato dai code-fence).

**Pattern ufficiale CM5** (confermato dal demo, vedi *Fonti*):
```js
// info = { name, mode, mime, ext, ... } oppure null
const info = CodeMirror.findModeByFileName(filename)
if (info) {
  cm.setOption('mode', info.mime)   // imposta lo spec
  CodeMirror.autoLoadMode(cm, info.mode)  // lazy-load dello script del mode
}
```

**Dove agire — VERIFICATO questa sessione (niente da indovinare):**
- **Pathname del tab**: `sourceCode.vue:62` espone già `const { currentFile: currentTab } = storeToRefs(editorStore)`
  → pathname = `currentTab.value?.pathname`. In `handleFileChange({ id, ... })` (riga 149) l'evento **non** porta il
  pathname → usare `editorStore.tabs.find(t => t.id === id)?.pathname` (match per id, robusto). Untitled → pathname
  `''`/null → fallback `markdown`.
- **Istanza CM riusata**: `index.vue:13-18` ha `<source-code v-if="sourceCode" ...>` **senza `:key`** → l'istanza CM
  è riusata tra tab source (confermato anche da `cmStatePerTab`). Quindi il mode va **riapplicato ad ogni
  caricamento**, non solo al mount.

1. (consigliato) Aggiungere in `codeMirror/index.js` un helper accanto a `setMode` (riga 186):
   ```js
   export const setModeForFile = (cm, filename) => {
     const info = filename ? codeMirror.findModeByFileName(filename) : null
     if (info) {
       cm.setOption('mode', info.mime)
       codeMirror.autoLoadMode(cm, info.mode)   // lazy-load via modeURL (già impostato, riga 86)
     } else {
       cm.setOption('mode', 'markdown')         // untitled / estensione sconosciuta
     }
   }
   ```
2. `sourceCode.vue`: importare `setModeForFile`; sostituire `setMode(codeMirrorInstance, 'markdown')` (**riga 718**)
   con `setModeForFile(codeMirrorInstance, currentTab.value?.pathname)`.
3. `sourceCode.vue handleFileChange` (**riga 149**): dopo aver caricato il contenuto del nuovo file, chiamare
   `setModeForFile(editor.value, editorStore.tabs.find(t => t.id === id)?.pathname)`.

**Rischi / verifiche obbligatorie:**
- ⚠️ `modeURL` con path `../../../../node_modules/...` è relativo all'URL base del renderer. È **già usato e
  funzionante** per i code-fence Muya → **verifica empirica**: aprire un `.md` con un code-fence ```js e controllare
  che l'highlight compaia. Se sì, T-M1 funzionerà identico. Se NO (prod build), i mode non si caricano → fallback
  bundlando i mode più comuni (`import 'codemirror/mode/javascript/javascript'` ecc.) — ma **non** dovrebbe servire.
- ⚠️ `markdown` mode è già caricato (serve a Muya); `findModeByFileName('x.md')` → `mode:'markdown'` già presente,
  nessun fetch. OK.
- ⚠️ Non rompere il caricamento iniziale: `applyModeForFile` deve gestire `cm` con valore già impostato; `setOption`
  a runtime è sicuro.
- ⚠️ I temi CM (`railscasts`/`one-dark`) restano invariati: il mode è ortogonale al tema.
- Dopo nuovi `import` in `codeMirror/index.js`: eventuale `node_modules/.vite/deps/` da pulire + restart dev.

**Test:** aprire `.md` (markdown highlight + invariato), `.js`/`.py`/`.html`/`.json`/`.css` (highlight corretto),
file senza estensione e Untitled (markdown), poi T-M2/M3/M4 sopra questi.

---

### T-M2 — Commenti con shortcut (`Ctrl+/`) — source only

**Obiettivo.** Toggle commento su riga/selezione in source mode, sintassi corretta per linguaggio (`//`, `#`,
`<!-- -->`, …). In Muya `Ctrl+/` resta senza effetto (mode-aware automatico).

**Complessità.** Bassa (~10-15 righe) **dato T-M1**. Senza T-M1 il commento sarebbe sempre `<!-- -->`.

**Dipendenza:** richiede **T-M1** (il mode del linguaggio determina la sintassi commento che l'addon usa).

**Dove agire:**
1. `codeMirror/index.js`: aggiungere `import 'codemirror/addon/comment/comment'` (registra `cm.toggleComment` e il
   comando `'toggleComment'`).
2. `sourceCode.vue` → `codeMirrorConfig.extraKeys` (**riga 656**, dentro `codeMirror.normalizeKeyMap({...})`):
   aggiungere `'Ctrl-/': 'toggleComment'` (NON rimuovere i binding `Alt-Up`/`Alt-Down` esistenti).

**Rischi / verifiche:**
- ✅ `Ctrl+/` **verificato LIBERO** su Win/Linux/Darwin (non a menu) → safe come `extraKeys`.
- ⚠️ `setIgnoreMenuShortcuts(true)` (`windows/editor.js:241`): il binding `Alt-Up`/`Alt-Down` in `extraKeys` già
  funziona in source (Task 4) → `Ctrl-/` non a menu arriverà a CM. Verificare empiricamente.
- ⚠️ Per markdown mode il commento è `<!-- -->` (block). L'addon lo gestisce se il mode espone i comment token.
  Markdown CM usa `<!-- -->`. Verificare sul `.md`.
- L'addon agisce solo sull'istanza CM → Muya intatto.

**Test:** in `.js` `Ctrl+/` → `//`; in `.py` → `#`; in `.md` → `<!-- -->`; con selezione multi-riga → commenta/
decommenta il blocco. In Muya: `Ctrl+/` nessun effetto, nessun crash.

---

### T-M3 — Fold / unfold blocchi — source only

**Obiettivo.** Gutter di folding in source mode: per markdown piega per heading; per linguaggi C-like per parentesi;
per indent-based (python/yaml) per indentazione. Click sul gutter per piegare/espandere.

**Complessità.** Bassa-media (~15-20 righe) **dato T-M1**.

**Dipendenza:** beneficia di **T-M1** (il rangeFinder giusto dipende dal mode).

**Dove agire:**
1. `codeMirror/index.js`: aggiungere gli import addon fold:
   ```js
   import 'codemirror/addon/fold/foldcode'
   import 'codemirror/addon/fold/foldgutter'
   import 'codemirror/addon/fold/foldgutter.css'
   import 'codemirror/addon/fold/brace-fold'
   import 'codemirror/addon/fold/comment-fold'
   import 'codemirror/addon/fold/markdown-fold'
   import 'codemirror/addon/fold/xml-fold'    // richiesto da markdown-fold (blocchi HTML) e html mode
   import 'codemirror/addon/fold/indent-fold' // fallback python/yaml/indent
   ```
2. `sourceCode.vue` → `codeMirrorConfig` (**riga 644**): aggiungere
   ```js
   foldGutter: true,
   gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
   foldOptions: { rangeFinder: CodeMirror.fold.auto },
   ```

**Rischi / verifiche (IMPORTANTE):**
- ⚠️ **`gutters` DEVE includere `'CodeMirror-linenumbers'`** oltre a `'CodeMirror-foldgutter'`. `lineNumbers:true` è già
  attivo (`sourceCode.vue:646`): se imposti `gutters` SENZA `CodeMirror-linenumbers`, **i numeri riga spariscono**.
- ⚠️ CSS gutter: c'è già `.source-code .CodeMirror-gutters` (`sourceCode.vue:~900`). Verificare che il foldgutter
  (frecce) sia visibile sui temi scuri (eventuale override colore `.CodeMirror-foldgutter`/`.CodeMirror-foldmarker`).
- ⚠️ `CodeMirror.fold.auto` sceglie il folder in base al mode → senza T-M1 (mode sempre markdown) funzionerebbe solo
  il fold per heading. Con T-M1 funziona per linguaggio.
- ⚠️ Nessun nuovo keybinding necessario (fold via click sul gutter). Se si vuole una shortcut, attenzione: `Ctrl+Q`
  (default CM fold) è **occupato** (`file.quit`). Lasciare solo il gutter, o usare voce menu dedicata.
- Lo scroll è gestito internamente da CM (`DESIGN-TASK.md` S5) → il foldgutter non interferisce.

**Test:** in `.md` piega un heading (nasconde la sezione); in `.js`/`.json` piega un blocco `{...}`; in `.py` piega per
indentazione; toggle ripetuto; verifica numeri riga ancora presenti; temi chiaro/scuro.

---

### T-M4 — Indentazione automatica — source only

**Obiettivo.** Comando per re-indentare la riga/selezione secondo le regole del mode (`indentAuto`).

**Complessità.** Bassa, ma **valore reale solo con T-M1** (in markdown l'auto-indent è quasi nullo). Se T-M1 non
viene fatto, **deprioritizzare** (poco utile).

**Dipendenza:** **T-M1** (le regole di indent vengono dal mode del linguaggio).

**Dove agire:**
- `indentAuto` è **comando CM built-in** (nessun addon). Esporlo come comando applicato a riga/selezione.
- **Problema keybinding (scarsità su Windows):** evitare `Ctrl+Alt+*` (=AltGr su Win). Combo "reformat" tipiche
  (`Ctrl+Alt+L`) sono occupate/hostili. Opzioni, in ordine di preferenza:
  1. **Nessuna nuova shortcut** → esporre come voce "Reindent" nel menu (`templates/edit.js`) o context-menu editor,
     che emette un evento bus → `sourceCode.vue` chiama `cm.execCommand('indentAuto')` su selezione/riga.
  2. Shortcut libera verificata (grep su 3 file keybindings). Candidata da verificare: nessuna ovvia libera +
     mnemonica → preferire l'opzione 1.
- Implementazione handler in `sourceCode.vue`: un `handleReindent()` registrato su `bus.on('reindent', …)` con
  relativo `bus.off`, che fa `if (!sourceCode.value || !editor.value) return; editor.value.execCommand('indentAuto')`.
  (Stesso pattern guardato di `handleFormatInSource`, `sourceCode.vue:355`.)

**Rischi / verifiche:**
- ⚠️ `indentAuto` su markdown mode fa poco → confermare con l'utente se vale la pena prima di spendere tempo, oppure
  implementarlo solo dopo T-M1 e testarlo su `.js`/`.py`.
- ⚠️ Se si aggiunge una voce menu, mirrorare il wiring esistente (id comando in `keybindings*.js` anche se vuoto,
  voce in `templates/edit.js`, azione in `actions/edit.js`). Vedi T-M5 per il pattern completo di un nuovo comando.

**Test (post T-M1):** in `.js`/`.py` selezionare codice mal indentato → reindent corregge; in `.md` nessun danno.

---

### T-M5 — Apertura .html/.htm nel browser esterno (shortcut)

**Obiettivo.** Shortcut che apre il file **corrente** nel browser di sistema, **attiva solo** se il file è `.html`/
`.htm`. I file non-.md restano editabili in source come ora (questa è un'azione aggiuntiva, non cambia la modalità).

**Complessità.** Bassa-media (~25-40 righe sparse: keybinding + menu + 1 IPC andata/ritorno).

**Architettura — VERIFICATA (riusa il canale `mt::editor-edit-action`, niente canale nuovo menu→renderer):**
La catena `edit.find-in-folder` è il template 1:1 (verificato):
`menu/actions/edit.js` `findInFolder(win) → edit(win,'findInFolder')`; `edit()` fa
`win.webContents.send('mt::editor-edit-action', type)` (edit.js:99) → renderer `listenForMain.js EDITOR_EDIT_ACTION(type)`
(riga 9) che ha **già** `const editorStore = useEditorStore()` (riga 11) → `editorStore.currentFile.pathname` accessibile.

1. **main** `menu/actions/edit.js`: aggiungere `openInBrowser(win) => edit(win, 'openInBrowser')` (clone di
   `findInFolder`) + `commandManager.add(COMMANDS.EDIT_OPEN_IN_BROWSER, openInBrowser)`.
2. **renderer** `listenForMain.js EDITOR_EDIT_ACTION` (riga 9-46): aggiungere un branch PRIMA del fallback
   `bus.emit(type, type)`:
   ```js
   if (type === 'openInBrowser') {
     const file = editorStore.currentFile
     const ext = (file?.pathname || '').toLowerCase()
     if (file?.pathname && (ext.endsWith('.html') || ext.endsWith('.htm'))) {
       window.electron.ipcRenderer.send('mt::open-file-in-browser', file.pathname)
     } // else: no-op (eventuale notifica)
     return
   }
   ```
3. **main** `menu/actions/file.js` (dove `shell` è già importato, riga ~480): aggiungere
   ```js
   import { pathToFileURL } from 'url'
   ipcMain.on('mt::open-file-in-browser', (e, pathname) => {
     const ext = path.extname(pathname || '').toLowerCase()
     if (ext === '.html' || ext === '.htm') shell.openExternal(pathToFileURL(pathname).href)
   })
   ```
   `shell.openExternal` con URL `file://` apre il **browser** predefinito; `shell.openPath` no (aprirebbe l'app
   associata) → usare `openExternal`.

**Wiring comando/menu/keybinding — mirrorare il simbolo `EDIT_FIND_IN_FOLDER`:** grep `EDIT_FIND_IN_FOLDER` /
`find-in-folder` in tutto `src/main/` e replicare i punti per `EDIT_OPEN_IN_BROWSER` / `open-in-browser`
(`commands/constants.js`, `commands` descriptions, `menu/templates/edit.js`, `menu/actions/edit.js`, `keybindings*.js`).

**Keybinding — verifica conflitti (FATTA per Windows):**
- `Ctrl+Shift+B` = **OCCUPATO** (`view.toggle-tabbar`, `keybindingsWindows.js:102`). NON usare.
- ✅ **`Ctrl+Shift+O`** verificato LIBERO su Win/Linux/Darwin (Darwin: accelerator `Cmd+Shift+O`; `open-in-browser` non
  esiste in nessuna mappa). Id comando proposto: `edit.open-in-browser` (per riusare l'helper `edit()`; in alternativa
  `file.open-in-browser` se lo si mette nel menu File).

**Rischi / verifiche:**
- ⚠️ La voce menu/accelerator è globale: la guardia "solo .html/.htm" sta **nell'azione** (renderer + main), non nello
  stato del menu (evita la complessità di abilitare/disabilitare la voce per tab). No-op sicuro se non HTML.
- ⚠️ Untitled / file non salvato → nessun `pathname` su disco → no-op (eventuale notifica "salva prima").
- ⚠️ Grep `ipcMain.on('mt::open-in-browser'` / `ipcRenderer.send('mt::open-file-in-browser'` per assicurarsi che i
  nomi canale non esistano già. Prefisso `mt::` perché chiamati dal renderer (vedi `CLAUDE.md` § IPC).
- ⚠️ `pathToFileURL` con path Windows (backslash, lettera drive) → gestito correttamente da `url` nativo. Testare un
  path con spazi.

**Test:** aprire un `.html`, premere la shortcut → si apre nel browser; su un `.md`/`.txt` → no-op (no crash);
Untitled → no-op/notifica.

---

### T-M6 — Auto-switch a source per file grandi (soglia configurabile)

**Obiettivo.** I file markdown **molto grandi** si aprono direttamente in source (CodeMirror) per evitare il lag del
parsing Muya. Soglia **configurabile da Preferences**.

**Complessità.** Media (~40-60 righe: schema pref + default + UI pref + propagazione `fileSize` + 1 condizione).

**Flusso dati (additivo, non breaking) — file VERIFICATI questa sessione:**
1. **Preferenza** (es. `maxFileSizeForWysiwyg`, in MB, default `2`). ⚠️ NON riusare `maxFileSize` (`schema.json:360`):
   è del **searcher** (scopo diverso). Tre punti, tutti necessari:
   - `src/main/preferences/schema.json`: aggiungere la chiave `"type":"number","default":2` (modello: `autoGuessEncoding`
     righe 185-189, `trimTrailingNewline` 190-194).
   - `static/preference.json`: aggiungere la stessa chiave col default (questo file **duplica** i default —
     `autoGuessEncoding`/`trimTrailingNewline` sono alle righe 32-33).
   - ⚠️ `src/renderer/src/store/preferences.js`: lo `state` (riga 6) elenca i campi **esplicitamente** (NON è un mirror
     generico: vedi `autoGuessEncoding: true` riga 39, `trimTrailingNewline: 2` riga 40). **Aggiungere il campo qui col
     default**, altrimenti `preferencesStore.maxFileSizeForWysiwyg` è `undefined` nel renderer.
   - UI: un campo numerico in `src/renderer/src/prefComponents/editor/` (sezione Editor) — mirrorare un campo esistente.
2. **Calcolo size in main** (`filesystem/markdown.js:loadMarkdownFile`): il `buffer` è **già letto** (riga 91) →
   aggiungere al `rawDocument` di ritorno (riga 145-159) `fileSize: buffer.length` (byte). *(NO `fs.stat`: ridondante.)*
3. **Propagazione al tab** (renderer): `mt::open-new-tab` → `store/editor.js:1143`
   `createDocumentState(Object.assign(markdownDocument, options))` costruisce il tab dal `rawDocument`. Quindi:
   - `store/help.js`: aggiungere `fileSize: 0` a `defaultFileState` (riga 9, base per tutti i builder).
   - `store/help.js createDocumentState` (riga 148): aggiungere `fileSize = 0` alla destrutturazione + includerlo
     nell'`Object.assign` di ritorno. (Untitled via `getBlankFileState` resta a `0`.)
4. **Decisione modalità** — **SOLO** in `_applySourceCodeForFile` (`store/editor.js:721-728`), che oggi fa:
   ```js
   const wantSource = !isMarkdownPath(file.pathname)
   ```
   estendere a:
   ```js
   const thresholdBytes = (preferencesStore.maxFileSizeForWysiwyg ?? 2) * 1024 * 1024
   const tooBig = !!file.fileSize && file.fileSize > thresholdBytes
   const wantSource = !isMarkdownPath(file.pathname) || tooBig
   ```
   (Verificare il nome esatto della prop nel `preferencesStore` renderer dopo averla aggiunta allo schema.)

**Rischi / verifiche:**
- ⚠️ La condizione va aggiunta **solo** in `_applySourceCodeForFile` (fonte unica). NON in `loadMarkdownFile` (il main
  non decide la modalità) né altrove.
- ⚠️ `_applySourceCodeForFile` viene chiamata su `UPDATE_CURRENT_FILE`, `FORCE_CLOSE_TAB`, `CLOSE_TABS`, post Save As →
  `file.fileSize` deve essere presente sul tab in tutti questi rami (è sul fileState → ok).
- ⚠️ Toggle manuale `Ctrl+E`: l'utente può comunque forzare Muya su un file grande (sua scelta) → accettabile. Non
  bloccare il toggle (resta come T5 di `MEDIUM-EASY-TASK`).
- ⚠️ Untitled / file senza `fileSize` → `tooBig=false` → comportamento attuale.
- ⚠️ Cambio della preferenza a runtime non riapre i tab già aperti (atteso): vale per i nuovi `_applySourceCodeForFile`.
- ⚠️ `loadMarkdownFile` è chiamata anche dal **watcher** (reload esterno) e da `windows/editor.js:297` → l'aggiunta di
  `fileSize` è additiva, nessun caller si rompe. Grep i caller per conferma.

**Test:** creare/aprire un `.md` > soglia → si apre in source; uno < soglia → Muya; cambiare la soglia nelle pref e
riaprire; verificare bollino/dirty invariato (il file è solo letto).

---

### T-M7 — "Markdown solo per .md" (VERIFICA — già di fatto)

**Stato.** Già implementato dall'instradamento per estensione: `isMarkdownPath` (`util/index.js:172`) →
`ext === '' || MARKDOWN_EXTENSIONS.includes(ext)` → Muya; tutto il resto → source (`_applySourceCodeForFile:725`).

**Decisione di contorno (già presa):** i file **senza estensione** restano in **Muya** (come ora). Se in futuro si
vuole "solo `.md` → Muya, senza-estensione → source", modificare **solo** `isMarkdownPath`.

**Azione richiesta:** solo verifica/regression (aprire `.txt`/`.json`/senza-estensione e confermare la modalità).
Eventualmente spuntare il checkbox in `TODO.md` (vedi nota in fondo).

---

### T-M8 — "Trova in tutti i file aperti" (VERIFICA — già fatto = T4B)

**Stato.** Implementato come T4B (`MEDIUM-EASY-TASK.md`): `Ctrl+Shift+F` cerca in tutte le tab, risultati in sidebar.
Solo verifica/regression. Eventualmente spuntare il checkbox in `TODO.md`.

---

### T-M9 — "Find & Replace potenziato" (GIÀ FATTO)

**Stato.** Il pannello floating (`components/search/index.vue:73-94`) ha già i toggle **case-sensitive**,
**whole-word**, **regex** (`isCaseSensitive`/`isWholeWord`/`isRegexp`), passati alla logica di ricerca
CodeMirror (`sourceCode.vue:385 buildSearchQuery`) e Muya. **Checkbox TODO aggiornato in questa sessione.**

**Azione richiesta:** nessuna. (Eventuale futuro: toggle "wrap-around"/"direction" — non richiesti, scartati.)

---

### T-M10 — "Fix grafica impostazioni" (RIMANDATO)

**Stato.** Il modal v2 (`components/settingsModal/index.vue`) è già strutturato/animato bene. Il problema è "da
definire" e sta verosimilmente **dentro** i prefComponents interni (`prefComponents/general|editor|theme|markdown|
spellchecker|keybindings|image/`), non nel wrapper.

**Azione richiesta:** **rimandato** a sessione dedicata con **screenshot** dei problemi specifici. Non pianificare fix
alla cieca. Quando si farà: agire negli `:deep(...)` di `settingsModal/index.vue:457-483` (override) e/o nei singoli
prefComponents; CSS-only se possibile.

---

### T-ME — Controlli finestra nativi su macOS (renderer-only, CON CAVEAT)

**Obiettivo.** Su **macOS**: rimuovere i pulsanti custom min/max/close (a destra della tab bar) e lasciare spazio a
**sinistra** per il "semaforo" nativo (traffic lights). Su **Windows/Linux**: tutto invariato.

**Complessità.** Bassa (renderer-only) — ma **non testabile su Windows** (caveat utente accettato).

**Buona notizia (verificata):** la config finestra è **già pronta** per macOS:
- `config.js:6-27 editorWinOptions`: `frame:false` + `titleBarStyle:'hiddenInset'` (i traffic lights inset compaiono
  su macOS).
- `windows/editor.js:67-106`: tutta la logica Windows-specifica (titlebar `default`, `setMenuBarVisibility`, Alt-toggle)
  è dentro `if (!isOsx)` → su macOS **non viene eseguita** → la config resta `hiddenInset`. **Quindi il main process è
  già a posto** (verificare solo che nessun ramo forzi `frame` su macOS — non risulta).

**Dove agire — `components/editorWithTabs/tabs.vue` (renderer):**
1. Importare `isOsx` da `@/util` (esiste, `util/index.js:162`). *(Verificare che non sia già importato.)*
2. Pulsanti custom min/max/close: stanno nella zona `.v2-topright` (handler `handleMinimize` riga 306,
   `handleMaximize` 310, + close). Avvolgerli con **`v-if="!isOsx"`** → su macOS spariscono (li gestisce il semaforo
   nativo). *(Tenere eventuali pulsanti ⌘/open-file: il task chiede di rimuovere SOLO min/max/close.)*
3. Spazio per il semaforo: quando `isOsx`, riservare **padding/margin-left** sulla tab bar (`.v2-tabbar` o sull'`ul`
   dei tab) ~**70-80px** così il primo tab non finisce sotto i traffic lights (top-left). Applicare via classe
   condizionale (`:class="{ 'is-osx': isOsx }"`) + CSS dedicato, NON modificando i valori Windows/Linux.

**Rischi / verifiche (zero regressioni Win/Linux):**
- ⚠️ Tutte le modifiche dietro `isOsx`/`v-if="!isOsx"`: con `isOsx=false` il DOM/CSS resta **identico** a oggi.
- ⚠️ Drag finestra: `.v2-tabbar` ha `-webkit-app-region: drag` (`tabs.vue:678`); i traffic lights sono nativi (fuori
  dal DOM) → il padding-left riservato NON deve diventare zona interattiva che copre i semafori. Su macOS la zona dei
  traffic lights è gestita dall'OS; basta non disegnarci tab sopra.
- ⚠️ Listener IPC `mt::minimize/maximize-window` (`tabs.vue:306-310`, `478-479`): se i pulsanti spariscono su macOS,
  i listener `mt::window-maximize/unmaximize` restano innocui (nessun bottone che li usa) → lasciarli, non rimuovere
  (evita asimmetrie `on`/`removeListener`).
- ⚠️ **NON testabile su Windows** → marcare il task come "implementato, verifica su Mac pendente". Possibile test
  parziale: forzare `isOsx=true` temporaneamente in dev su Windows per vedere il layout (pulsanti nascosti + padding),
  **MA** i traffic lights non compariranno (è Windows) → verifica visiva solo del layout tab, non del semaforo.

**Test (su Mac, futuro):** i 3 pulsanti custom assenti; semaforo nativo top-left visibile e cliccabile; primo tab non
sovrapposto; drag finestra dalla tab bar ok. Su Windows/Linux: pixel-identico a prima.

---

## 4. Checklist verifica PRE-codice (da `CLAUDE.md`, applicare ad ogni task)

- [ ] **Grep call-site** prima di cambiare firma/handler (`ipcMain.emit('x'` **e** `ipcRenderer.send('x'`).
- [ ] **Grep keybinding** sulle 3 mappe (`keybindingsWindows/Linux/Darwin.js`) prima di assegnare una combo.
- [ ] **`bus.on` ⇒ `bus.off`** simmetrico in `onBeforeUnmount`.
- [ ] **Nuovo canale/costante/evento**: grep che non esista già con altro nome; che l'effetto non sia già gestito.
- [ ] **Shape store Pinia**: grep `storeToRefs`/accessi diretti prima di aggiungere un campo tab.
- [ ] **CSS**: grep classe/variabile in tutti i `.css/.vue/.js` (temi multipli) prima di cambiarne i valori.
- [ ] **Muya** toccato? → restart `npm run dev`. **Import addon CM**? → eventuale pulizia `node_modules/.vite/deps/`.
- [ ] **Modifica additiva** a `rawDocument`/`loadMarkdownFile`: verificare TUTTI i caller (incl. `watcher.js`).

---

## 5. Anchor file (verificati questa sessione — ri-grep prima di editare)

| Cosa | File:riga |
|---|---|
| `isMarkdownPath`, `MARKDOWN_EXTENSIONS`, `isOsx` | `src/renderer/src/util/index.js:172, 169, 162` |
| `_applySourceCodeForFile` (decisione modalità) | `src/renderer/src/store/editor.js:721-728` |
| handler `mt::open-new-tab` (costruzione fileState) | `src/renderer/src/store/editor.js:~797` |
| CM config (`extraKeys`, `lineNumbers`, gutters) | `src/renderer/src/components/editorWithTabs/sourceCode.vue:644-673` |
| `setMode(...,'markdown')` hardcoded (→ T-M1) | `sourceCode.vue:718` |
| `handleFileChange` (riapplicare mode su cambio tab) | `sourceCode.vue:149` |
| `handleFormatInSource` (pattern handler source-only) | `sourceCode.vue:355` |
| import CM + `modeURL` + `setMode` + addon | `src/renderer/src/codeMirror/index.js:2-19, 86, 186` |
| `loadMarkdownFile` (buffer = size) | `src/main/filesystem/markdown.js:82, 91, 145-159` |
| `openTabs` + `preferences.getAll()` | `src/main/windows/editor.js:287, 294, 297` |
| config finestra (`hiddenInset`, `if(!isOsx)`) | `src/main/config.js:6-27`; `src/main/windows/editor.js:67-106` |
| `shell.openExternal` (riuso) | `src/main/menu/actions/file.js:480` |
| keybindings Windows (conflitti) | `src/main/keyboard/keybindingsWindows.js` (Ctrl+Shift+B occupato:102) |
| pulsanti finestra custom + drag region | `src/renderer/src/components/editorWithTabs/tabs.vue:306-310, 678` |
| F&R toggle case/word/regex (già fatto) | `src/renderer/src/components/search/index.vue:73-94` |
| modal impostazioni (rimandato) | `src/renderer/src/components/settingsModal/index.vue` |
| `currentTab`/pathname in source | `sourceCode.vue:62` (`storeToRefs(editorStore).currentFile`) |
| `<source-code>` senza `:key` (istanza riusata) | `editorWithTabs/index.vue:13-18` |
| `EDITOR_EDIT_ACTION` + `editorStore` | `store/listenForMain.js:9, 11`; `edit()`→send `store`/`actions/edit.js:99` |
| rawDocument→tab (`createDocumentState`) | `store/editor.js:1143`; builder `store/help.js:148` |
| `defaultFileState` / `getBlankFileState` | `store/help.js:9, 78` |
| pref renderer (campi ESPLICITI) | `store/preferences.js:6, 39-40` |
| pref main schema + default pacchettizzato | `src/main/preferences/schema.json:185-194`; `static/preference.json:32-33` |
| pref `maxFileSize` esistente (searcher, NON riusare) | `schema.json:360` |

---

## 6. Fonti (CodeMirror 5 — dynamic mode loading, per T-M1)

- Demo ufficiale lazy-load mode da filename: https://github.com/codemirror/codemirror5/blob/master/demo/loadmode.html
  (pattern `findModeByExtension`/`findModeByFileName` → `setOption('mode', info.mime)` → `autoLoadMode(cm, info.mode)`).
- Discussione `autoLoadMode`/`modeURL`: https://discuss.codemirror.net/t/autoloadmode/2651
- Manuale CM5 (addon `mode/meta`, `mode/loadmode`, `addon/comment/comment`, `addon/fold/*`): https://codemirror.net/5/doc/manual.html

> NB: il caricamento dinamico via `modeURL` è **già usato e funzionante** in questo progetto per l'highlight dei
> code-fence in Muya (`codeMirror/index.js:186 setMode`) → T-M1 riusa lo stesso meccanismo, basso rischio.

---

## 7. Bug noti UI tab bar (scoperti dopo T-ME — DA FIXARE)

> File unico coinvolto: `src/renderer/src/components/editorWithTabs/tabs.vue`. Ancore ri-verificate questa sessione.
> **Stato: bug confermati, fix PROPOSTI ma NON applicati** (layout fragile con molte fix storiche B1–B14/S7/N4/P-DF8;
> Bug 2 non testabile su Windows). Applicare dopo conferma utente + test (Bug 1 su Win con sidebar aperta; Bug 2 su Mac).

### BUG-1 — Restringendo la finestra in orizzontale, ⌘/📂 e poi le tab vengono CLIPPATE invece di riflusso (Win + Mac)

**Sintomo.** Sotto una certa larghezza, le icone ⌘ (command palette) e 📂 (apri file) non restano agganciate al bordo
destro: vengono tagliate. Restringendo ancora, anche le tab vengono tagliate invece di andare a capo nelle righe
successive. La "soglia" coincide con la larghezza massima della sezione destra (⌘ + 📂 + slot clone/+ riga 2+).

**Causa (diagnosi).** La larghezza reale della tab bar = **finestra − sidebar** (non il `minWidth:550` della finestra,
`config.js:7`). La sezione destra `.v2-topright` (`tabs.vue:915`, `position:absolute; right:10px; z-index:20`) ha
larghezza **quasi-fissa e grande** perché `.v2-topright-dynamic` (`tabs.vue:932`) riserva **`width:158px;
flex-shrink:0` SEMPRE**, anche quando invisibile in single-row (`opacity:0`, ma occupa layout). Totale topright ≈
**230px (mac)** / **340px (win, con i 3 bottoni finestra)**. La tab bar prenota `padding-right = topRightWidth+22`
(`tabs.vue:390-391`) per non far finire le tab sotto il topright assoluto. Quando la tab bar (per sidebar aperta o
finestra stretta) scende **sotto ~larghezza topright**, lo spazio contenuto va a ~0/negativo: il topright assoluto
(z-index 20) **copre** le tab e il suo bordo sinistro viene **clippato** da `.v2-tabbar { overflow:hidden }`
(`tabs.vue:674`); le tab non riflussono perché `availableForContent` (`tabs.vue:397`) è ~0. Su mac il `padding-left:78px`
(T-ME) peggiora di 78px (atteso, ma somma alla soglia).

**✅ FIX 1b APPLICATO** (verificato incrociando i fix storici — vedi sotto). Collassare lo slot dinamico quando NON serve: la `width:158px`
serve solo in multi-row (dove appare il clone). In single-row il clone non esiste → riservare 158px è inutile e gonfia
il topright. Legare la width allo stato `.topright-expanded` (che esiste già, usato per `opacity`):
```css
.v2-topright-dynamic { width: 0; }                              /* era 158px fisso */
.v2-topright.topright-expanded .v2-topright-dynamic { width: 158px; }  /* solo multi-row */
```
Effetto: single-row topright ≈ **72px (mac)** / ~170px (win) → soglia di clipping abbassata di molto → ⌘/📂 restano
visibili e le tab hanno spazio per riflusso a finestre/sidebar molto più strette.

**Cosa potrebbe andare storto (perché NON applicato a colpo sicuro):**
- La `width:158px` fissa fu introdotta da **B14c** (`tabs.vue:926-931`) per tenere il topright a larghezza COSTANTE →
  `padding-right` costante → niente shift di row 1 quando il clone appare/sparisce. Il collasso **mantiene** la
  costanza *dentro* lo stato multi-row (width sempre 158 lì), ma introduce un cambio di width alla **transizione
  single↔multi-row** → possibile micro-shift/flicker della prima riga in quel momento (già stato di transizione
  animata, quindi probabilmente accettabile). **Da verificare empiricamente su Windows** con sidebar aperta + resize.
- `availableForContent` usa `topRightEl.offsetWidth` runtime (`tabs.vue:389`) → si adatta da solo alla nuova width via
  i ResizeObserver già presenti (`tabs.vue:502-505`). Nessuna costante JS da toccare.

**Verifica incrociata fix storici (perché 1b è sicuro):**
- *DESIGN-TASK bug-126*: i 158px nacquero perché il clone (~151px) sforava 150px → tagliato. 1b **tiene 158px in
  `.topright-expanded`** (multi-row, dove il clone esiste) → clone non si taglia.
- *B14c* (`tabs.vue:926-931`): width fissa = topright costante = `padding-right` costante = no shift row 1 quando il
  clone appare/sparisce. 1b **mantiene 158px costante DENTRO multi-row** → invariante preservata. In single-row
  `recomputePinnedTab` lascia `pinnedTab=null` → con `width:0` non c'è nulla da clippare.
- La width **non** è in `transition` (solo `opacity`) → cambio 0↔158 istantaneo (non animato) → un solo fire
  ResizeObserver, coperto da `layoutLockUntil` (150ms, `tabs.vue:650`) → flicker minimo.
- *DESIGN bug-123*: il ResizeObserver su `.v2-tabbar` root ricalcola `padding-right` da `topRightEl.offsetWidth`
  runtime (`tabs.vue:389`) → si adatta da solo alla nuova larghezza, nessuna costante JS da toccare.
- **Rischio residuo:** micro-shift alla transizione single↔multi-row (già momento di reflow). Basso. Testare su
  Windows con sidebar aperta + finestra stretta.

**Alternative scartate:**
- *Alzare `minWidth` finestra* (`config.js:7`): NON risolve — la sidebar continua a rubare larghezza alla tab bar a
  parità di finestra. Scartata.
- *Refactor topright da `absolute` a flex item in-flow*: risolverebbe alla radice ma tocca il cuore del layout
  multi-row/hover-expand (alto rischio regressione). Scartata salvo necessità.

### BUG-2 — (mac) Controlli finestra non centrati verticalmente con la tab bar a riga singola

**Sintomo.** Con **una sola riga** di tab la title bar è più bassa: i traffic lights nativi restano in alto a sinistra
mentre le tab appaiono più in basso (non in linea). Con **più righe** la barra si espande e le tab tornano allineate
ai controlli.

**Causa (diagnosi).** I traffic lights nativi (`titleBarStyle:'hiddenInset'`, `config.js:22`) hanno **y fissa**
decisa dall'OS. L'altezza single-row della tab bar (`--v2-tab-h`, var CSS globale) posiziona il centro verticale delle
tab **più in basso** del centro dei semafori → disallineamento. In multi-row/hover-expand la barra cresce e l'occhio
percepisce l'allineamento sulla prima riga.

**✅ FIX 2a APPLICATO** (`config.js`, `editorWinOptions`). **`titleBarStyle:'hiddenInset'` MANTENUTO** (path Windows
invariato) + `trafficLightPosition` aggiunto **solo su mac** (gated `isOsx`). Verificato da doc Electron che hiddenInset
+ trafficLightPosition funzionano insieme (non serve passare a `'hidden'`, che avrebbe richiesto di tarare anche `x`):
```js
titleBarStyle: 'hiddenInset',
...(isOsx ? { trafficLightPosition: { x: 18, y: 12 } } : {}),
```
Calcolo default: bar single-row `--v2-tab-h:40px` → centro tab a 20px; bottoni ~16px → `y=(40-16)/2≈12` li centra;
`x=18` = inset dentro lo spazio riservato (`padding-left:78` di T-ME). Il valore `y` è **fisso**: in multi-row la
prima riga resta in cima (centro 20px) → i semafori restano allineati alla prima riga in entrambi gli stati.

**Cosa resta da fare / rischi:** `x`/`y` sono **da tarare visivamente sul Mac** (altezza reale bottoni varia per
versione macOS). Modifica al **main process** → **non testabile su Windows** e richiede **restart `npm run dev`**
(no HMR sul main). Su Windows/Linux: `isOsx=false` → nessuna chiave aggiunta → config byte-identica a prima.

**Alternativa (NON usata) — Fix 2b renderer:** `min-height` su `.v2-tabbar.is-osx` + centratura prima riga. Scartata:
`trafficLightPosition` è lo strumento nativo dedicato, più pulito e senza toccare l'altezza della tab bar.

> **Raccomandazione.** BUG-1 → **Fix 1b applicato**, testare su Windows (sidebar aperta + finestra stretta; rischio
> solo micro-flicker single↔multi-row). BUG-2 → **Fix 2a applicato**, tarare `x/y` su Mac dopo `npm run dev` (Windows
> non coinvolto).
