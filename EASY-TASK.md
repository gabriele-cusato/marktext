# MarkText — Storico implementazioni, bug e fix

> **Scopo di questo file.** Registro storico di tutto ciò che è stato implementato, dei bug
> affrontati e dei fix applicati. Serve a chi (umano o agente) lavorerà in futuro per:
> 1. capire l'infrastruttura attuale **prima** di modificare codice;
> 2. non rompere funzionalità esistenti né reintrodurre bug già risolti;
> 3. sapere quali invarianti/decisioni sono volute e perché.
>
> **Leggere SEMPRE la sezione "Architettura e invarianti critiche" prima di toccare**
> editor, salvataggio, dirty flag (bollino), watcher/ricarica o selezione.
> Per le regole IPC generali vedi anche `CLAUDE.md` (root progetto).

---

## 🚦 Prima di iniziare QUALSIASI modifica

1. **Leggi la checklist generale in `CLAUDE.md`** (root progetto): regole obbligatorie su grep dei
   call-site prima di cambiare firme/comportamenti, IPC, eventi bus, CSS, store Pinia, Muya, keybinding.
   Questo file NON la ripete: la integra con l'area editor.
2. **Copertura di questo documento.** È **editor-centrico**: copre a fondo testo/Muya/CodeMirror,
   salvataggio, dirty flag (bollino), watcher/ricarica, selezione, shortcut, tab. **NON** documenta:
   `search`/find&replace, componente `settings`/preferenze UI, `sideBar`/`project`, sistema menu,
   build/packaging/registry. Per quelle aree leggi il codice — qui non trovi avvisi specifici.
3. **Consulta la tabella "Se la tua modifica tocca…" qui sotto** (inizio sezione Architettura) per sapere
   quali invarianti rischi di rompere.
4. **Modalità doppia sempre presente:** ricorda che ogni feature sull'editor va pensata sia per Muya
   (WYSIWYG) sia per CodeMirror (source). Verifica in entrambe.

---

## Stato sintetico

| # / Bug | Argomento | Stato |
|---|---|---|
| 1 | Conversione EOL (CRLF/LF/CR, preserva quello del file) | ✅ |
| 2 | Conversione/rilevamento encoding (`ced` + `iconv-lite`) | ✅ |
| 3 | UPPERCASE / lowercase (globale Muya+source) | ✅ |
| 4 | Operazioni riga (sposta/duplica/elimina, source-only) | ✅ |
| 5 | Copia percorso file dal context menu tab | ✅ |
| 6 | Zoom testo Ctrl+rotella (solo testo, non UI) | ✅ |
| 7 | Word Wrap toggling (solo source) | ✅ |
| 8 | Selezione visibile in source mode (temi scuri) | ✅ |
| 9 | Ricarica file modificato esternamente | ✅ |
| 10 | Pulizia console.log di debug | ✅ |
| B1 | Bollino su tab non modificate all'apertura | ✅ |
| B2 | Prompt ricarica file esterno non compariva | ✅ |
| B3 | File ANSI con accenti → mojibake (encoding) | ✅ |
| B4 | Selezione temi scuri poco visibile (+ B4-bis source) | ✅ |
| B5 | Zoom Ctrl+Plus / Ctrl+- non funzionanti | ✅ |
| B6 | Ctrl+Z cross-tab + contaminazione source/history su close | ✅ |
| B7 | Spazio vuoto a destra nelle tab con filename corto | ✅ |
| B8 | Bollino riappare ~1s dopo Ctrl+S (debounce stale) | ✅ |
| B9 | Bollino riappare al click cursore dopo save (lightTouch/N12) | ✅ |
| B10 | Ctrl+Shift+↑/↓ non estende selezione in Muya | ✅ |
| B11 | Reload esterno: contenuto non aggiorna + dialog v2 | ✅ |
| B12 | Reload UX: stile v2 + Annulla→bollino + N12 + context menu | ✅ |
| B13 | Ctrl+S in source salva contenuto stale (handlePreSave) | ✅ |
| B14 | Dialog reload appariva per tab in background | ✅ |

> Tutti i fix sopra sono testati (verifiche utente, ultimo giro 2026-05-30).
> I log diagnostici temporanei (`[UNDO-DBG]`, `[DOT-DBG]`, `[WATCH-DBG]`, `[ENC-DBG]`) sono stati
> **tutti rimossi**. I `console.log` in `watcher.js` gated da `MARKTEXT_DEBUG_VERBOSE >= 3` sono
> volontari → NON rimuovere.

---

# ⚠️ Architettura e invarianti critiche (LEGGERE PRIMA DI MODIFICARE)

## Se la tua modifica tocca… → attenzione a… (indice rischi)

Mappa tra modifiche tipiche (incluse voci di `TODO.md`) e le invarianti che rischiano di romperle.
La colonna "Sez." rimanda ai paragrafi qui sotto.

| Se tocchi… | Rischi / cosa controllare PRIMA | Sez. |
|---|---|---|
| **Selezione / evidenziazione** (es. "evidenzia occorrenze", selezione a colonna) | `cursorActivity` (`sourceCode.vue`) fa GIÀ N12 (dirty check) **e** arma il `commitTimer`: un nuovo listener su selection/cursor non deve duplicarli o interferire. Per i colori usa `--cmSelectionColor` (CM) — NON `--selectionColor` (Muya). | A, B, F |
| **Salvataggio / autosave / lightTouch** | Flusso `pre-save` flush (B8/B13), baseline `originalMarkdown`, `pendingSavedMarkdown`, lightTouch (`getMarkdownForSave`/`normalizeBlock`). NON aggiungere guardie a `handlePreSave`. Leggi `tab.markdown` solo dopo il flush. | B, C |
| **Chiusura tab / "rimuovi dialog vuoi salvare"** | Flusso close: `mt::ask-for-close` → `ASK_FOR_CLOSE`/`ASK_FOR_SAVE_ALL` → `CLOSE_TABS`/`FORCE_CLOSE_TAB`, ognuno usa `pendingSavedMarkdown`, `getMarkdownForSave`, `_applySourceCodeForFile`. I path di close NON passano da `UPDATE_CURRENT_FILE` (edge B14). Unwatch watcher gestito dal main. | B, C, D, B6, B14 |
| **Cambio/Toggle modalità Muya↔source** | `_applySourceCodeForFile` PRIMA di `file-changed`; guard `handleFileChange` nei due componenti; `cmStatePerTab`; emit in `onBeforeUnmount` solo per view-switch stesso tab (B6); `currentMuyaTabId`. | A, B6 |
| **Apertura file / modalità per estensione** (es. ".md only", auto-switch file grandi) | `_applySourceCodeForFile` DECIDE GIÀ la modalità per estensione → non duplicare. `loadMarkdownFile` (main) per encoding/EOL/trim. `justLoaded` settle window al load (B1). | A, B, 1, 2 |
| **Watcher / ricarica / file watching** | Avvio watch dal MAIN (`ipcMain.emit`, firma `(win,…)`); handler watcher senza `mt::` NON dal renderer; `loadChange`+`forceReload`; dialog `file-changed-externally`; `pendingExternalChange` per tab background. | D, B2, B11, B14 |
| **Shortcut / keybinding / comandi** | Accelerator menu Electron precedono `extraKeys` CM → mode-aware via bus per i tasti in conflitto; `normalizeKeyMap`; tasti già occupati (tabella shortcut); `Ctrl+0`=switchToTenth. | H, Task 3/4 |
| **Find & Replace / search** (NON documentato qui) | Subsystem `components/search` non coperto: leggi il codice. Probabile interazione con selezione/cursorActivity (vedi sopra) e con la doppia modalità. | — |
| **CSS / temi / stile UI** | Token in `v2-tokens.css`; selezione `--cmSelectionColor` vs `--selectionColor`; override tema-specifici a specificità alta (railscasts/one-dark forzano `!important` da node_modules). | F, B4 |
| **Store Pinia (shape tab)** | Campi non ovvi sul tab: `originalMarkdown`, `justLoaded` (timestamp), `pendingExternalChange`, `trimTrailingNewline`. Aggiungerne/leggerli senza rompere i confronti dirty. | B |

## A. Due modalità editor: Muya (WYSIWYG) vs source (CodeMirror)

Una tab è renderizzata da **uno** dei due editor, in base a `preferences.sourceCode`:
- **Markdown / WYSIWYG → Muya** (`components/editorWithTabs/editor.vue`, engine in `src/muya/`).
- **Source / testo grezzo → CodeMirror 5** (`components/editorWithTabs/sourceCode.vue`).

`_applySourceCodeForFile(file)` (in `store/editor.js`) decide la modalità dall'estensione:
`.md/.markdown/.mdown/.mkd` o senza estensione → Muya; tutto il resto (`.js`, `.txt`, …) → source.
**Va chiamato PRIMA di `bus.emit('file-changed')`** ad ogni cambio tab — altrimenti l'editor sbagliato
riceve l'evento (vedi B6). È già chiamato in `UPDATE_CURRENT_FILE`, `FORCE_CLOSE_TAB`, `CLOSE_TABS`.

**Differenza chiave (causa di molti bug):**
- **Muya**: il listener `on('change')` (`editor.vue`) chiama `LISTEN_FOR_CONTENT_CHANGE` **in modo
  sincrono** ad ogni modifica → lo store (`tab.markdown`) è sempre aggiornato.
- **CodeMirror**: il commit allo store è **debounced 1s** (`commitTimer` in `listenChange`/`cursorActivity`,
  `sourceCode.vue`). Quindi per ~1s dopo una digitazione `tab.markdown` può essere **stale**. Questo
  buco di 1s è la radice di B8 e B13. Qualsiasi lettura di `tab.markdown` "subito dopo aver digitato"
  in source mode DEVE prima forzare il flush (vedi sez. C).

**Comunicazione store ↔ editor:** via mitt `bus` (sincrono).
- `bus.emit('file-changed', {...})` → carica contenuto/cursore/history nell'editor attivo.
- `editor.vue` `handleFileChange`: esce subito se `sourceCode.value` (la tab è source, Muya non c'entra).
- `sourceCode.vue` `handleFileChange`: esce subito se `!sourceCode.value` (componente in smontaggio, B6).

**`cmStatePerTab` (Map in `sourceCode.vue`)**: cache `{content, history}` per tab già visitate, così
tornando su una tab si ripristina contenuto + undo. Va pulita (`delete`) alla chiusura tab.
`forceReload` bypassa questa cache (vedi sez. D).

**`currentMuyaTabId` (`editor.vue`)**: id del tab attualmente in Muya. Il listener Muya usa
`currentMuyaTabId.value || 'muya'`, NON `'muya'` fisso, per non contaminare un'altra tab (B6).

## B. Sistema "bollino non salvato" (dirty flag)

Il bollino = `tab.isSaved === false`. La verità è il confronto **contenuto editor vs `tab.originalMarkdown`**
(la baseline = ultima versione salvata/caricata da disco; `null` per Untitled mai salvati).

Campi rilevanti sul tab (`store/help.js` `defaultFileState`):
- `markdown` — contenuto corrente (nello store).
- `originalMarkdown` — baseline per il confronto dirty.
- `isSaved` — flag bollino.
- `justLoaded` — **timestamp** (`Date.now()`), non booleano (B1). Finestra di assestamento (`LOAD_SETTLE_MS = 400ms`)
  dopo un load/reload: durante questa finestra i content-change aggiornano `originalMarkdown` SENZA
  marcare dirty (Muya fa ≥2 pass di normalizzazione all'init che altrimenti darebbero falso-dirty).
- `pendingExternalChange` — modifica esterna rimandata per tab in background (B14).
- `trimTrailingNewline` — politica newline finale (0 = nessuna, 1 = singola, 3 = invariato).

**Punti che impostano `isSaved`:**
- `LISTEN_FOR_CONTENT_CHANGE` (`store/editor.js`): logica centrale. Durante settle non marca dirty;
  altrimenti `isSaved=false` se `markdown !== originalMarkdown`, `true` se torna identico (B9).
- N12 in `cursorActivity` (`sourceCode.vue`): check immediato (no debounce) per feedback istantaneo dopo
  Ctrl+Z. Confronta **normalizzando ENTRAMBI i lati**: `normalizeMarkdown(cm.getValue()) ===
  normalizeMarkdown(originalMarkdown)` (B12 — `originalMarkdown` può essere grezzo dopo un load).
- `mt::tab-saved` / `mt::set-pathname`: dopo il salvataggio impostano baseline + `isSaved=true` (B9).

**Normalizzazione (NON confonderle):**
- `normalizeMarkdown(md, trim)` (`sourceCode.vue`): replica di `adjustTrailingNewlines` — normalizza solo
  i newline finali. Idempotente. Usata nei confronti N12.
- `normalizeBlock(text)` (`store/editor.js`): normalizzazione semantica forte (collassa blank line, spazi,
  trim). Usata per decidere se due versioni sono "semanticamente uguali" (lightTouch, B9).

## C. Salvataggio (FILE_SAVE, lightTouch, pre-save flush)

`FILE_SAVE` / `FILE_SAVE_AS` (`store/editor.js`):
1. emettono `bus.emit('pre-save')` **prima** di leggere `tab.markdown` (B8);
2. leggono `tab.markdown`;
3. `getMarkdownForSave(markdown, originalMarkdown, lightTouch)` decide cosa scrivere;
4. registrano `pendingSavedMarkdown.set(id, markdownToSave)` e inviano `mt::response-file-save`;
5. al ritorno, `mt::tab-saved` aggiorna baseline/`isSaved`.

**`pre-save` flush (B8 + B13):** `sourceCode.vue` `handlePreSave` ascolta `pre-save`, cancella il
`commitTimer` e chiama `LISTEN_FOR_CONTENT_CHANGE` **sincrono** col contenuto CM reale → `tab.markdown`
è fresco prima che `FILE_SAVE` lo legga. **INVARIANTE: handlePreSave NON deve avere guardie che lo
saltino** (es. `isFirstLoad`): un Ctrl+S è sempre esplicito (B13). Muya non ha questo problema (commit
sincrono) e infatti non ascolta `pre-save`.

**lightTouch (preferenza, default ON):** `getMarkdownForSave` — se il contenuto è semanticamente uguale
all'originale (`normalizeBlock` uguale) restituisce `originalMarkdown` (preserva formattazione originale);
altrimenti `mergeWithOriginal`. Conseguenza: ciò che si salva può differire in formattazione da
`tab.markdown`. Per questo `mt::tab-saved`, quando `tab.markdown ≠ savedMarkdown` ma `normalizeBlock`
coincide, imposta `originalMarkdown = tab.markdown` (non savedMarkdown) → confronti dirty apples-to-apples (B9).

## D. Watch + ricarica file esterni (chokidar)

**Avvio watch:** è il **main process** ad avviarlo. `EditorWindow._doOpenTab` (`main/windows/editor.js`)
chiama `ipcMain.emit('watcher-watch-file', browserWindow, pathname)`. Gli handler watcher in
`windowManager.js` (`watcher-watch-file/dir`, `watcher-unwatch-file/dir`, **senza** prefisso `mt::`) sono
chiamati SOLO dal main via `ipcMain.emit` con `BrowserWindow` come 1° arg → firma `(win, filePath)`.
**NON** chiamarli dal renderer e **NON** cambiarne la firma (causò 2 crash, vedi B2/Task 9). L'unwatch
alla chiusura è gestito dal main via `removeFromOpenedFiles` (il renderer manda solo `mt::window-tab-closed`).

**File singoli vs directory:** per `type === 'file'` il watcher NON filtra per estensione (B2) — l'utente
può aprire `.js/.txt/.json/...`. Il filtro markdown-only vale solo per i watch di directory.

**Catena su modifica esterna:**
`watcher.js change()` → legge il file con `loadMarkdownFile` → `win.webContents.send('mt::update-file',
{type:'change', change:{pathname, data}})` → `LISTEN_FOR_FILE_CHANGE` (`store/editor.js`).

`LISTEN_FOR_FILE_CHANGE` (ramo change/add):
- autoSave ON + tab salvato → `loadChange` silenzioso;
- **tab ATTIVA** (`currentFile.id === id`) → `bus.emit('file-changed-externally', {change, filename,
  hasUnsavedChanges})` → mostra il dialog;
- **tab in background** → memorizza `tab.pendingExternalChange = change`, niente dialog (B14). Il dialog
  esce quando si apre la tab (`UPDATE_CURRENT_FILE` consuma il pending nel `nextTick`).
- `unlink` → `pushTabNotification` (banner — la barra è ancora usata qui e per mixed line endings).

**`loadChange(change)`** (`store/editor.js`): rimpiazza lo stato del tab col contenuto disco. Imposta
`isSaved=true` + `justLoaded=Date.now()` (evita falso-dirty post-normalizzazione, B11). Ricarica
l'editor solo se la tab è la `currentFile`, emettendo `file-changed` con **`forceReload:true`**.

**`forceReload`** (`sourceCode.vue` `handleFileChange`): quando `id === tabId.value && forceReload`,
forza `setValue(newMarkdown)` + `refresh()` (altrimenti l'early-return per "stessa tab" salterebbe il
reload, B11). `setValue` resetta la history undo di CM del file ricaricato (atteso, come Notepad++).

**Dialog di reload** (`components/editorWithTabs/fileChangedDialog.vue`): box del **design system v2**
(NON `el-dialog`), montato in `editorWithTabs/index.vue`. Bus `file-changed-externally`. Non-modale
(backdrop trasparente), click-fuori/ESC/Annulla = annulla, solo "Ricarica" applica. In `onClosed`:
- confermato → `loadChange`;
- annullato → `markDivergedFromDisk(change)` = baseline al **nuovo disco** + `isSaved=false` → il bollino
  compare e persiste (l'editor diverge dal disco), senza toccare contenuto/history (Opzione A, B12).

**Reload manuale** (context menu tab "Reload"): `ipcRenderer.send('mt::request-file-reload', pathname)`
→ handler in `windowManager.js` → `Watcher.reloadFile(win, pathname)` rilegge da disco (stesse prefs del
watcher) e invia `mt::update-file` → rientra nel path sopra (dialog se modifiche non salvate).

## E. IPC patterns (vedi anche CLAUDE.md)

- Canali con prefisso **`mt::`** → chiamati dal renderer via `ipcRenderer.send` → nel main usare
  `BrowserWindow.fromWebContents(e.sender)`.
- Canali **senza** prefisso (watcher-*) → chiamati dal main via `ipcMain.emit(channel, browserWindow, …)`
  → 1° arg è già il `BrowserWindow`. Firma `(win, …)`.
- Prima di cambiare la firma di un handler, grep **entrambi** i pattern (`ipcMain.emit('canale'` e
  `ipcRenderer.send('canale'`). Una firma sola non può servire i due chiamanti.

## F. Colori selezione

- **`--selectionColor`** (per tema, in `assets/themes/*.theme.css`): usata da **Muya** (WYSIWYG). NON
  toccarla per cambiare la source.
- **`--cmSelectionColor`** (B4-bis): dedicata a **CodeMirror**, default `rgba(56,139,253,0.6)` in
  `codeMirror/index.css`. Disaccoppia la selezione source da Muya. Override per railscasts
  (`.CodeMirror.cm-s-railscasts div.CodeMirror-selected`, specificità alta perché node_modules forza
  `#272935 !important`) e one-dark.

## G. Zoom testo

Zoom **solo del testo** (non title/tab bar). Riusa la preferenza `zoom` esistente (significato cambiato).
Vedi Task 6 per il dettaglio dei file.

## H. Shortcut: mode-aware + conflitti

- **Case (Ctrl+U / Ctrl+Shift+U) = GLOBALE** in entrambe le viste → `format.underline` e
  `paragraph.horizontal-line` hanno perso questi accelerator (liberati nei `keybindings*.js`).
- **Line-ops (Ctrl+D / Ctrl+L / Ctrl+I / Ctrl+J, Ctrl+Shift+↑/↓) = MODE-AWARE, solo source** → in
  markdown i tasti restano sulla funzione originale (strike/hyperlink/emphasis/sidebar), nessun binding
  da liberare.
- Gli accelerator di menu Electron **precedono** gli `extraKeys` di CodeMirror → per i tasti in conflitto
  `extraKeys` da solo non basta; il routing mode-aware passa per il `bus`.
- `extraKeys` CM: usare `codeMirror.normalizeKeyMap({...})` (CM al dispatch costruisce `Shift-Ctrl-Up`,
  non `Ctrl-Shift-Up`).
- `Ctrl+0` è `tabs.switchToTenth` → NON usarlo per reset zoom.
- Su Windows evitare combo `Ctrl+Alt` (= AltGr).

## Mappa file chiave

| Area | File |
|---|---|
| Store editor (dirty, save, reload, tab) | `src/renderer/src/store/editor.js` |
| Default stato tab | `src/renderer/src/store/help.js` |
| Source editor (CodeMirror) | `src/renderer/src/components/editorWithTabs/sourceCode.vue` |
| WYSIWYG editor (Muya wrapper) | `src/renderer/src/components/editorWithTabs/editor.vue` |
| Layout tab + container | `src/renderer/src/components/editorWithTabs/index.vue` |
| Dialog reload esterno | `src/renderer/src/components/editorWithTabs/fileChangedDialog.vue` |
| Banner notifiche tab | `src/renderer/src/components/editorWithTabs/notifications.vue` |
| Context menu tab | `src/renderer/src/components/contextMenu/TabContextMenu.vue` (+ `icons.js`) |
| CSS selezione CM | `src/renderer/src/codeMirror/index.css` + `assets/themes/codemirror/one-dark.css` |
| Token design system v2 | `src/renderer/src/assets/styles/v2-tokens.css` |
| Watcher file | `src/main/filesystem/watcher.js` |
| IPC main/window | `src/main/app/windowManager.js`, `src/main/windows/editor.js` |
| Encoding/EOL | `src/main/filesystem/encoding.js`, `markdown.js` |
| Locales | `static/locales/*.json` (base/fallback = `en.json`; **non esiste `it.json`**) |

---

# Funzionalità implementate (Task 1–10) — stato finale

## 1. Conversione EOL ✅
Supporta CRLF (`\r\n`), LF (`\n`), CR (`\r`). `loadMarkdownFile` (`main/filesystem/markdown.js`) rileva
l'EOL realmente presente nel file e lo preserva; `preferredEol` solo come fallback se non rilevabile.
Comportamento voluto: non forza l'EOL dell'OS (non "sporca" un file Unix aperto su Windows).

## 2. Conversione/rilevamento encoding ✅
`ced` + `iconv-lite` (`main/filesystem/encoding.js`, `markdown.js`). Flusso gerarchico: BOM →
deterministico; solo-ASCII → indistinguibile, default `utf8`; byte > 0x7F → euristica `ced`.
Scrittura: `iconv.encode(..., {addBOM})`. Per il fix del falso-UTF-8 su ANSI vedi **B3**.
(Finding minore non bloccante: `encoding.js` regex `replace(/-_/g,'')` dovrebbe essere `/[-_]/g`.)

## 3. UPPERCASE / lowercase ✅
`Ctrl+Shift+U` = MAIUSCOLO, `Ctrl+U` = minuscolo. **Globale** in entrambe le viste (eccezione voluta).
Niente Title/Proper Case. Source: `cm.replaceSelections(map(toUpper/Lower), 'around')`. Muya:
`ContentState.prototype.changeSelectionCase` (single-block). Wiring: `common/commands/constants.js`,
`menu/templates/edit.js` + `menu/actions/edit.js`, `keybindings{Windows,Linux,Darwin}.js` (liberati
underline/HR), `renderer/commands/index.js`+`descriptions.js`, `muya/lib/index.js`, `static/locales/`.

## 4. Operazioni riga (sposta su/giù, duplica, elimina) ✅ — solo source
Mode-aware (`handleFormatInSource` in `sourceCode.vue`, gira solo se `sourceCode.value`):
- **Sposta riga** `Ctrl+Shift+↑/↓` → `swapLineUp`/`swapLineDown`. Bug 4a: questi NON sono built-in CM5
  → registrati su `codeMirror.commands` in `codeMirror/index.js` (copiati da sublime.js, senza importare
  l'addon che porterebbe ~40 binding in conflitto). `extraKeys` via `normalizeKeyMap`.
- **Duplica** `Ctrl+D` → duplica riga corrente o, con selezione, tutte le righe coperte (edge `to.ch===0`
  esclude l'ultima riga). Bug 4b risolto nel ramo `'del'`.
- **Elimina** `Ctrl+L` → `deleteLine`.
- **Muya**: line-move via Alt+frecce **disabilitato** (era distruttivo: cancellava la selezione —
  `moveLineCtrl.js` non controllava la selezione). `duplicate` (Ctrl+Alt+D) e `deleteParagraph`
  (Ctrl+Shift+D) in Muya restano OK.
- Split (`Ctrl+I`) / Join (`Ctrl+J`): **non** implementati (in `TODO.md`, CM5 non ha built-in).

## 5. Copia percorso file dal tab ✅
Context menu sul tab (`TabContextMenu.vue`) → `clipboard.writeText(pathname)`.

## 6. Zoom testo Ctrl+rotella ✅
Zoom limitato al testo. Listener `wheel {passive:false}` su `.container` (`editorWithTabs/index.vue`):
con `ctrlKey` → `preventDefault()` (sopprime lo zoom nativo Chromium di tutta la pagina) + aggiorna il
fattore. Muya: `fontSize` di `.editor-wrapper`. CodeMirror: `font-size` su `.CodeMirror` + `cm.refresh()`.
Reset via bottone status bar (`Ctrl+0` non usabile = switchToTenth). Voci menu `window.zoomIn/zoomOut`
e la preferenza `zoom` riusate col nuovo significato (solo testo). Vecchio percorso `webFrame.setZoomFactor`
neutralizzato. Vedi anche **B5** (Ctrl+Plus / Ctrl+-).

## 7. Word Wrap toggling ✅
Disabilitato in Muya; in source `lineWrapping` pilotato da `preferences.wordWrap`
(`sourceCode.vue`, `statusBar/index.vue`).

## 8. Selezione visibile in source mode ✅
Vedi **B4** (alpha temi scuri) e **B4-bis** (variabile dedicata `--cmSelectionColor`, blu saturo).

## 9. Ricarica file modificato esternamente ✅
Watcher + dialog. Tutta la meccanica è descritta nella sez. D (Architettura). Bug correlati: B2 (watcher
non partiva per non-md), B11 (contenuto non aggiornava + UX dialog), B12 (UX/Annulla), B14 (tab background).

## 10. Pulizia console.log di debug ✅
Rimossi tutti i prefissi diagnostici temporanei. Mantenuti i log gated `MARKTEXT_DEBUG_VERBOSE` in
`watcher.js`.

---

# Storico bug & fix (ordine numerico)

## B1 — Bollino su tab non modificate all'apertura ✅
**Sintomo:** aprendo un file la tab mostra subito il bollino senza modifiche.
**Root cause:** Muya fa ≥2 pass di normalizzazione all'init; il meccanismo `justLoaded` era one-shot
(booleano) e catturava solo il 1° pass.
**Fix:** `justLoaded` da booleano a **timestamp** + finestra `LOAD_SETTLE_MS=400ms`: durante la finestra i
content-change aggiornano `originalMarkdown` senza marcare dirty.
**File:** `store/editor.js` (`LISTEN_FOR_CONTENT_CHANGE`, `NEW_TAB_WITH_CONTENT`).

## B2 — Prompt ricarica file esterno non compariva ✅
**Sintomo:** modifica esterna a un file aperto → nessun prompt.
**Root cause:** `watcher.js` filtrava markdown-only (`ignored` + ramo `change`), così chokidar ignorava i
file non-`.md` aperti come tab singola.
**Fix:** per `type === 'file'` non filtrare per estensione (`ignored` → `return false`; rimosso
`if (isMarkdown)` nel `change`).
**File:** `main/filesystem/watcher.js`.
**Nota crash collaterali (Task 9):** gli handler watcher erano stati cambiati a
`BrowserWindow.fromWebContents(event.sender)` ma sono chiamati dal main via `ipcMain.emit` → `event.sender`
undefined → crash. Ripristinata firma `(win, filePath)`; rimossi `ipcRenderer.send('watcher-unwatch-file')`
ridondanti dal renderer (l'unwatch lo fa già il main via `removeFromOpenedFiles`).

## B3 — File ANSI con accenti → mojibake (encoding errato UTF-8) ✅
**Sintomo:** file ANSI con "è" → testo corrotto + status bar mostra UTF-8.
**Root cause:** `ced` su file piccoli/ASCII restituisce `ASCII`/`ASCII-7-bit` → mappati a `utf8` → byte
Windows-1252 decodificati come UTF-8.
**Fix:** `isValidUtf8(buffer)` in `encoding.js`; dopo ced→utf8, se ci sono byte > 0x7F **e** UTF-8 non
valido → `windows-1252`. BOM ha sempre precedenza.
**File:** `main/filesystem/encoding.js`.

## B4 — Selezione temi scuri poco visibile ✅
**Fix base:** alzato alpha `--selectionColor` (`dark` 0.3→0.55, `one-dark` 60→bb, `material-dark` 0.2→0.45).

### B4-bis — Selezione SOURCE MODE molto più evidente
**Root cause residua:** railscasts (temi `dark`/`material-dark`) forza
`div.CodeMirror-selected {#272935 !important}` da node_modules → quasi invisibile.
**Fix:** variabile dedicata **`--cmSelectionColor`** (default `rgba(56,139,253,0.6)`), disaccoppiata da
Muya. Override a specificità alta per railscasts + one-dark.
**File:** `codeMirror/index.css`, `assets/themes/codemirror/one-dark.css`.

## B5 — Zoom Ctrl+Plus / Ctrl+- non funzionanti ✅
**Fix:** aggiunti accelerator `Ctrl+Plus` / `Ctrl+-` per `window.zoomIn`/`zoomOut` in
`keybindingsWindows.js` e `keybindingsLinux.js` (erano vuoti).

## B6 — Ctrl+Z cross-tab + contaminazione source/history su close ✅
**Sintomi:** chiudendo una tab source senza salvare → Untitled passa a source, Ctrl+Z ripristina testo
della tab chiusa, bollino su Untitled.
**Root cause (3):** (1) `CLOSE_TABS` non chiamava `_applySourceCodeForFile` sul nuovo currentFile;
(2) `sourceCode.vue handleFileChange` processava eventi anche con `sourceCode=false` (smontaggio);
(3) Muya usava `id:'muya'` fisso bypassando il guard cross-tab.
**Fix:** (1) `_applySourceCodeForFile` in `CLOSE_TABS`; (2) guard `if (!sourceCode.value) return`;
(3) emit `file-changed` in `onBeforeUnmount` solo se stesso tab + `cmStatePerTab.delete`;
(4) `currentMuyaTabId` invece di `'muya'` fisso + check `justLoaded` su background tab.
**File:** `store/editor.js`, `sourceCode.vue`, `editor.vue`.

## B7 — Spazio vuoto a destra nelle tab con filename corto ✅
**Root cause:** `.v2-tab` ha `min-width:88px` ma `.v2-tab-name` non aveva `flex-grow` → spazio vuoto dopo
la X per nomi corti.
**Fix:** `flex-grow:1` su `.v2-tab-name` (`tabs.vue`). `min-width:0` preesistente preserva l'ellipsis.

## B8 — Bollino riappare ~1s dopo Ctrl+S in source ✅
**Root cause:** `FILE_SAVE` legge `tab.markdown` ma in source è debounced 1s; Ctrl+S entro 1s salva
contenuto stale, poi il commitTimer riscatta e rimarca dirty.
**Fix:** `pre-save` flush — `FILE_SAVE`/`FILE_SAVE_AS` emettono `bus.emit('pre-save')`; `handlePreSave`
(`sourceCode.vue`) cancella il commitTimer e committa sincrono il contenuto CM reale.
**File:** `store/editor.js`, `sourceCode.vue`. **Vedi anche B13** (la guardia di handlePreSave rompeva
questo fix nel caso "una sola tab mai cambiata").

## B9 — Bollino riappare al click cursore dopo save ✅
**Root cause:** con lightTouch ON, `savedMarkdown` (mergeWithOriginal) ≠ `tab.markdown` in formattazione;
`originalMarkdown` veniva impostato a `savedMarkdown` → N12/LFC confrontavano valori diversi → falso-dirty,
con autoSave anche loop.
**Fix:** in `mt::tab-saved`/`mt::set-pathname`, se `normalizeBlock(tab.markdown)===normalizeBlock(savedMarkdown)`
→ `isSaved=true` e `originalMarkdown = tab.markdown`. N12 normalizza i trailing newline.
**File:** `store/editor.js`, `sourceCode.vue`.

## B10 — Ctrl+Shift+↑/↓ non estende selezione in Muya ✅
**Root cause:** `arrowHandler` (`arrowCtrl.js`) usciva early per ogni `shiftKey` senza preventDefault →
il browser non sa saltare tra i blocchi separati di Muya.
**Fix:** handler esplicito per `ctrl+shift+ArrowUp/Down` prima dell'early-return: trova blocco prec/succ
(`findPreBlockInLocation`/`findNextBlockInLocation`), aggiorna selezione DOM + `dispatchSelectionChange`.
**File:** `src/muya/lib/contentState/arrowCtrl.js`.

## B11 — Reload esterno: contenuto non aggiorna + UX dialog ✅
**Sintomi:** barra blu in fondo; OK non aggiornava il contenuto (source); bollino verde dopo OK.
**Root cause A (source):** `handleFileChange` early-return su `id===tabId.value` saltava `setValue`.
**Root cause B:** `loadChange` non impostava `justLoaded` → normalizzazione post-reload marcava dirty;
inoltre la detection marcava `isSaved=false` prima della scelta utente.
**Fix:** nuovo `fileChangedDialog.vue` (floating box centrale al posto della barra); `LISTEN_FOR_FILE_CHANGE`
emette `file-changed-externally` (no più dirty in detection); `loadChange` → `isSaved=true` + `justLoaded` +
`forceReload:true`; `handleFileChange` ramo `forceReload` → `setValue`+`refresh`. Locale keys in `en.json`.
**File:** `fileChangedDialog.vue` (nuovo), `editorWithTabs/index.vue`, `store/editor.js`, `sourceCode.vue`,
`static/locales/en.json`. (Nota: in questa fase il dialog usava ancora `el-dialog`, sostituito in B12.)

## B12 — Reload UX follow-up (4 interventi) ✅
1. **N12 false-dirty** dopo edit→cursore→save→cursore: normalizzare entrambi i lati (vedi sez. B).
2. **Annulla → bollino (Opzione A):** action `markDivergedFromDisk(change)` = baseline al nuovo disco +
   `isSaved=false`; il bollino persiste senza toccare contenuto/history. Chiamata da `onClosed` se non confermato.
3. **Stile dialog v2:** rimpiazzato `el-dialog` con box `--v2-surface` (#27272a) / `--v2-shadow-lg` /
   `--v2-text`, backdrop trasparente, fade `v2dropIn`/`v2fadeIn`, ESC/click-fuori = Annulla.
4. **Context menu "Reload":** voce in `TabContextMenu.vue` (icona `refresh`, disabilitata su Untitled) →
   `mt::request-file-reload` → `Watcher.reloadFile` (rilegge da disco) → path esistente.
**File:** `store/editor.js`, `fileChangedDialog.vue`, `TabContextMenu.vue`, `contextMenu/icons.js`,
`main/filesystem/watcher.js`, `main/app/windowManager.js`, `static/locales/en.json`.

## B13 — Ctrl+S in source salva contenuto stale ✅
**Sintomo:** salvo ma su disco resta il vecchio; bollino riappare; al 2° salvataggio appare; intermittente.
**Root cause:** `handlePreSave` aveva la guardia `&& !isFirstLoad.value`. `isFirstLoad` resta `true` per
una tab aperta e mai cambiata (azzerato solo in `prepareTabSwitch`, saltato al primo load) → il flush non
avveniva mai e il commitTimer veniva cancellato → `FILE_SAVE` leggeva `tab.markdown` stale.
**Fix:** rimossa la guardia `!isFirstLoad.value` da `handlePreSave` (un Ctrl+S è sempre esplicito; se non
ci sono modifiche reali il commit è no-op). Muya non è interessato (commit sincrono).
**File:** `sourceCode.vue` (`handlePreSave`).

## B14 — Dialog reload appariva per tab in background ✅
**Sintomo:** modifica esterna a una tab non attiva → dialog comunque; "Ricarica" non applicava (loadChange
ricarica l'editor solo per la currentFile).
**Fix:** `LISTEN_FOR_FILE_CHANGE` mostra il dialog solo se la tab è la `currentFile`; altrimenti memorizza
`tab.pendingExternalChange`. `UPDATE_CURRENT_FILE`, allo switch, consuma il pending (nel `nextTick`, dopo
`file-changed`) ed emette il dialog → ora la tab è attiva e il reload si applica.
**File:** `store/editor.js` (`LISTEN_FOR_FILE_CHANGE`, `UPDATE_CURRENT_FILE`).
**Edge:** i percorsi di chiusura tab non passano da `UPDATE_CURRENT_FILE` → se chiudendo si atterra su una
tab con pending, il dialog esce al successivo switch esplicito (edge minore noto).

---

# Riferimenti shortcut

| Tasto | Markdown (Muya) | Source (CodeMirror) |
|---|---|---|
| `Ctrl+Shift+U` | MAIUSCOLO (era `paragraph.horizontal-line`) | MAIUSCOLO |
| `Ctrl+U` | minuscolo (era `format.underline`) | minuscolo |
| `Ctrl+D` | `format.strike` (invariato) | duplica riga/blocco |
| `Ctrl+L` | `format.hyperlink` (invariato) | elimina riga |
| `Ctrl+I` | `format.emphasis` (invariato) | — (split, in TODO) |
| `Ctrl+J` | `view.toggle-sidebar` (invariato) | — (join, in TODO) |
| `Ctrl+Shift+↑/↓` | estende selezione cross-block (B10) | sposta riga |
| `Alt+↑/↓` | line-move disabilitato (era distruttivo) | (libero) |
| `Ctrl+Alt+D` / `Ctrl+Shift+D` | duplica / elimina paragrafo | — |
| `Ctrl+0` | `tabs.switchToTenth` (NON usare per reset zoom) | idem |

---

# Funzionalità ancora aperte
Vedi `TODO.md` nella root del progetto (es. selezione a colonna, find&replace potenziato, split/join,
toggle Muya↔source, multi-cursore, session restore, ecc.).
