# Editor Core — Architettura, Invarianti, Bug Risolti

**Scopo:** documenti il cuore dell'editor MarkText — due modalità (Muya WYSIWYG vs CodeMirror source), dirty flag, salvataggio, watcher file esterno, encoding/EOL. Leggere PRIMA di modificare: editor, salvataggio, selezione, ricarica file.

**Origine:** `EASY-TASK.md`, estratti del 2026-06-10.

**Quando leggerlo:** quando tocchi editor (Muya o source), dirty flag, salvataggio/autosave, watcher, recaricamento file esterno, selezione/highlighting, shortcut modo-dipendenti.

---

## ⚠️ Architettura e Invarianti Critiche (LEGGERE PRIMA DI MODIFICARE)

### Se la tua modifica tocca… → controllare PRIMA…

| Se tocchi… | Rischi / controllare PRIMA | Sezione |
|---|---|---|
| **Selezione / evidenziazione** | `cursorActivity` (`sourceCode.vue`) fa GIÀ N12 (dirty check) **e** arma il `commitTimer`: non duplicarli/interferire. Colori: `--cmSelectionColor` (CM), NON `--selectionColor` (Muya). | A, B, F |
| **Salvataggio / autosave / lightTouch** | Flusso `pre-save` flush (B8/B13), baseline `originalMarkdown`, `pendingSavedMarkdown`, lightTouch. NON aggiungere guardie a `handlePreSave`. Leggi `tab.markdown` solo dopo il flush. | B, C |
| **Chiusura tab / dialog "vuoi salvare"** | `mt::ask-for-close`→`ASK_FOR_CLOSE`/`ASK_FOR_SAVE_ALL`→`CLOSE_TABS`/`FORCE_CLOSE_TAB`; usano `pendingSavedMarkdown`, `getMarkdownForSave`, `_applySourceCodeForFile`. I path di close NON passano da `UPDATE_CURRENT_FILE` (edge B14). | B, C, D, B6, B14 |
| **Toggle modalità Muya↔source** | `_applySourceCodeForFile` PRIMA di `file-changed`; guard `handleFileChange` nei due componenti; `cmStatePerTab`; emit in `onBeforeUnmount` solo per view-switch stesso tab (B6); `currentMuyaTabId`. | A, B6 |
| **Apertura file / modalità per estensione** | `_applySourceCodeForFile` DECIDE GIÀ la modalità → non duplicare. `loadMarkdownFile` (main) per encoding/EOL/trim. `justLoaded` settle al load (B1). | A, B, 1, 2 |
| **Watcher / ricarica** | Avvio dal MAIN (`ipcMain.emit`, firma `(win,…)`); handler senza `mt::` NON dal renderer; `loadChange`+`forceReload`; dialog `file-changed-externally`; `pendingExternalChange` (tab background). | D, B2, B11, B14 |
| **Shortcut / keybinding** | Accelerator menu Electron PRECEDONO `extraKeys` CM → mode-aware via bus per i tasti in conflitto; `normalizeKeyMap`; `Ctrl+0`=switchToTenth. | H |
| **CSS / temi** | Token `v2-tokens.css`; `--cmSelectionColor` vs `--selectionColor`; override tema-specifici a specificità alta (railscasts/one-dark forzano `!important` da node_modules). | F, B4 |
| **Store Pinia (shape tab)** | Campi non ovvi: `originalMarkdown`, `justLoaded` (timestamp), `pendingExternalChange`, `trimTrailingNewline`. Non rompere i confronti dirty. | B |

---

## A. Due Modalità Editor: Muya (WYSIWYG) vs Source (CodeMirror)

Una tab è renderizzata da **uno** dei due editor in base a `preferences.sourceCode`:
Muya (`editorWithTabs/editor.vue`, engine `src/muya/`) per markdown; CodeMirror 5 (`sourceCode.vue`) per il resto.

`_applySourceCodeForFile(file)` (`store/editor.js`) decide dall'estensione (`.md/.markdown/.mdown/.mkd/.mkdn/.mdwn`
o senza estensione → Muya; altro → source). **Va chiamato PRIMA di `bus.emit('file-changed')`** ad ogni
cambio tab (altrimenti l'editor sbagliato riceve l'evento, B6). Già in `UPDATE_CURRENT_FILE`, `FORCE_CLOSE_TAB`,
`CLOSE_TABS`. (NB: ora usa l'helper `isMarkdownPath` di `util/index.js` — fonte di verità unica.)

**Differenza chiave (radice di molti bug):**
- **Muya**: `on('change')` (`editor.vue`) chiama `LISTEN_FOR_CONTENT_CHANGE` **sincrono** → `tab.markdown` sempre aggiornato.
- **CodeMirror**: commit allo store **debounced 1s** (`commitTimer`, `sourceCode.vue`). Per ~1s `tab.markdown`
  è **stale** → radice di B8/B13. Leggere `tab.markdown` "subito dopo aver digitato" in source DEVE forzare prima il flush (sez. C).

**Comunicazione store↔editor** via mitt `bus` (sincrono): `bus.emit('file-changed', {...})` carica
contenuto/cursore/history. `editor.vue handleFileChange` esce se `sourceCode.value`; `sourceCode.vue
handleFileChange` esce se `!sourceCode.value` (smontaggio, B6).

- **`cmStatePerTab`** (Map a livello modulo, `sourceCode.vue`): cache `{content,history}` per tab visitate
  (ripristina undo tornando sulla tab). Pulire (`delete`) alla chiusura. `forceReload` la bypassa.
- **`currentMuyaTabId`** (`editor.vue`): id del tab in Muya; il listener usa `currentMuyaTabId.value || 'muya'`,
  NON `'muya'` fisso (B6).

---

## B. Sistema Bollino Non-Salvato (Dirty Flag)

Bollino = `tab.isSaved === false`. Verità = confronto **contenuto editor vs `tab.originalMarkdown`** (ultima
versione salvata/caricata; `null` per Untitled mai salvati).

Campi tab (`store/help.js`): `markdown` (corrente), `originalMarkdown` (baseline), `isSaved`,
`justLoaded` (**timestamp**, non bool, B1; finestra `LOAD_SETTLE_MS=400ms` in cui i change aggiornano
`originalMarkdown` SENZA marcare dirty — Muya fa ≥2 pass di normalizzazione all'init), `pendingExternalChange`
(B14), `trimTrailingNewline` (0=nessuna,1=singola,3=invariato).

**Imposta `isSaved`:** `LISTEN_FOR_CONTENT_CHANGE` (centrale; durante settle non marca dirty) · N12 in
`cursorActivity` (check immediato post-Ctrl+Z, confronta **normalizzando ENTRAMBI i lati**, B12) ·
`mt::tab-saved`/`mt::set-pathname` (baseline + `isSaved=true`, B9).

**Normalizzazioni (NON confonderle):** `normalizeMarkdown(md,trim)` (`sourceCode.vue`) = solo newline finali,
idempotente, usata in N12. `normalizeBlock(text)` (`store/editor.js`) = semantica forte (collassa blank line/spazi/trim),
decide "semanticamente uguale" (lightTouch, B9).

---

## C. Salvataggio (FILE_SAVE, lightTouch, pre-save flush)

`FILE_SAVE`/`FILE_SAVE_AS` (`store/editor.js`): 1) `bus.emit('pre-save')` **prima** di leggere `tab.markdown` (B8);
2) leggono `tab.markdown`; 3) `getMarkdownForSave(markdown, originalMarkdown, lightTouch)`; 4) `pendingSavedMarkdown.set(id,...)`
+ `mt::response-file-save`; 5) `mt::tab-saved` aggiorna baseline/`isSaved`.

**`pre-save` flush (B8+B13):** `sourceCode.vue handlePreSave` ascolta `pre-save`, cancella `commitTimer`, chiama
`LISTEN_FOR_CONTENT_CHANGE` sincrono → `tab.markdown` fresco. **INVARIANTE: handlePreSave senza guardie** (un Ctrl+S
è sempre esplicito, B13). Muya non ascolta `pre-save` (commit sincrono).

**lightTouch (default ON):** se semanticamente uguale all'originale (`normalizeBlock`) restituisce `originalMarkdown`
(preserva formattazione); altrimenti `mergeWithOriginal`. Per questo `mt::tab-saved`, se `tab.markdown ≠ savedMarkdown`
ma `normalizeBlock` coincide, imposta `originalMarkdown = tab.markdown` → confronti apples-to-apples (B9).

---

## D. Watch + Ricarica File Esterni (chokidar)

**Avvio watch dal MAIN:** `EditorWindow._doOpenTab` → `ipcMain.emit('watcher-watch-file', browserWindow, pathname)`.
Gli handler watcher in `windowManager.js` (`watcher-watch-file/dir`, `-unwatch-`, **senza** prefisso `mt::`) sono
chiamati SOLO dal main → firma `(win, filePath)`. **NON** chiamarli dal renderer, **NON** cambiarne la firma (2 crash, B2).
Unwatch alla chiusura: dal main via `removeFromOpenedFiles` (renderer manda solo `mt::window-tab-closed`).
Per `type==='file'` il watcher NON filtra per estensione (B2); il filtro markdown-only vale solo per le directory.

**Catena modifica esterna:** `watcher.js change()` → `loadMarkdownFile` → `mt::update-file {type:'change',change}`
→ `LISTEN_FOR_FILE_CHANGE`. Ramo change/add: autoSave+salvato→`loadChange` silenzioso; **tab attiva**→`bus.emit('file-changed-externally')`
(dialog); **tab background**→`tab.pendingExternalChange=change` (no dialog, B14; consumato in `UPDATE_CURRENT_FILE` al `nextTick`);
`unlink`→`pushTabNotification`.

**`loadChange`**: rimpiazza lo stato col disco; `isSaved=true`+`justLoaded=Date.now()` (B11); ricarica l'editor solo
se currentFile, con **`forceReload:true`**. **`forceReload`** (`sourceCode.vue`): `id===tabId.value && forceReload` →
`setValue`+`refresh`+`clearHistory` (altrimenti l'early-return same-tab salterebbe il reload, B11; ⚠️ **`setValue` NON resetta l'undo CM5** — verificato su `codemirror.js:6238`, aggiunge un change annullabile → serve `clearHistory()` esplicito dopo il reload).

**Dialog reload** (`fileChangedDialog.vue`, box v2, NON `el-dialog`, in `editorWithTabs/index.vue`): bus
`file-changed-externally`, non-modale, click-fuori/ESC/Annulla=annulla. `onClosed`: confermato→`loadChange`;
annullato→`markDivergedFromDisk(change)` = baseline al nuovo disco + `isSaved=false` (bollino persiste senza toccare
contenuto/history, Opzione A, B12). **Reload manuale** (context menu tab): `mt::request-file-reload` → `Watcher.reloadFile` → stesso path.

---

## E. IPC Patterns

- Canali **`mt::`** → dal renderer (`ipcRenderer.send`) → main usa `BrowserWindow.fromWebContents(e.sender)`.
- Canali **senza** prefisso (watcher-*) → dal main (`ipcMain.emit(channel, browserWindow, …)`) → 1° arg già il `BrowserWindow`.
- Prima di cambiare una firma: grep ENTRAMBI (`ipcMain.emit('canale'` e `ipcRenderer.send('canale'`).

---

## F. Colori Selezione

- **`--selectionColor`** (per tema, `assets/themes/*.theme.css`) → **Muya**. Non toccarla per la source.
- **`--cmSelectionColor`** (default `rgba(56,139,253,0.6)`, `codeMirror/index.css`) → **CodeMirror**.
  Override railscasts/one-dark a specificità alta (node_modules forza `#272935 !important`).

---

## G. Zoom Testo

Solo testo (non title/tab bar). Riusa la preferenza `zoom` (significato cambiato). Task 6 dettagli in section "Funzionalità Task 1–10".

---

## H. Shortcut: Mode-Aware + Conflitti

- **Case (Ctrl+U / Ctrl+Shift+U) = GLOBALE** in entrambe le viste → `format.underline`/`paragraph.horizontal-line` hanno perso questi accelerator.
- **Line-ops (Ctrl+D/L/I/J, Ctrl+Shift+↑/↓) = MODE-AWARE, solo source** → in markdown restano sulla funzione originale.
- Accelerator menu Electron **precedono** gli `extraKeys` CM → routing mode-aware via `bus`. `extraKeys` con `codeMirror.normalizeKeyMap({...})` (CM costruisce `Shift-Ctrl-Up`).
- `Ctrl+0`=`tabs.switchToTenth` (NON per reset zoom). Su Windows evitare `Ctrl+Alt` (=AltGr).

---

## Mappa File Chiave

| Area | File |
|---|---|
| Store editor (dirty, save, reload, tab) | `src/renderer/src/store/editor.js` |
| Default stato tab | `src/renderer/src/store/help.js` |
| Source editor (CodeMirror) | `src/renderer/src/components/editorWithTabs/sourceCode.vue` |
| WYSIWYG editor (Muya wrapper) | `src/renderer/src/components/editorWithTabs/editor.vue` |
| Layout tab + container | `src/renderer/src/components/editorWithTabs/index.vue` |
| Dialog reload esterno | `src/renderer/src/components/editorWithTabs/fileChangedDialog.vue` |
| Context menu tab | `src/renderer/src/components/contextMenu/TabContextMenu.vue` (+ `icons.js`) |
| CSS selezione CM | `src/renderer/src/codeMirror/index.css` + `assets/themes/codemirror/one-dark.css` |
| Token design system v2 | `src/renderer/src/assets/styles/v2-tokens.css` |
| Watcher file | `src/main/filesystem/watcher.js` |
| IPC main/window | `src/main/app/windowManager.js`, `src/main/windows/editor.js` |
| Encoding/EOL | `src/main/filesystem/encoding.js`, `markdown.js` |
| Locales | `static/locales/*.json` (base = `en.json`; **non esiste `it.json`**) |

---

## Funzionalità Task 1–10 (Stato: Tutti ✅ Verificati)

1. **EOL (CRLF/LF/CR)**: `loadMarkdownFile` (`markdown.js`) rileva l'EOL reale e lo preserva; `preferredEol` solo fallback. Non forza l'EOL dell'OS.
2. **Encoding**: `ced`+`iconv-lite` (`encoding.js`,`markdown.js`): BOM→deterministico; solo-ASCII→`utf8`; byte>0x7F→euristica `ced`. Scrittura `iconv.encode(...,{addBOM})`. (Finding minore: regex `replace(/-_/g,'')` dovrebbe essere `/[-_]/g`.) Vedi B3.
3. **Case**: `Ctrl+Shift+U`=MAIUSCOLO, `Ctrl+U`=minuscolo, **globale**. No Title Case. Source: `cm.replaceSelections(...,'around')`. Muya: `ContentState.changeSelectionCase` (single-block).
4. **Operazioni riga (source-only)**: sposta `Ctrl+Shift+↑/↓` (swapLineUp/Down); duplica `Ctrl+D` (riga o selezione, edge `to.ch===0`); elimina `Ctrl+L`. Muya: line-move Alt+frecce disabilitato; `Ctrl+Alt+D`/`Ctrl+Shift+D` OK.
5. **Copia path**: `TabContextMenu.vue` → `clipboard.writeText(pathname)`.
6. **Zoom testo**: listener `wheel {passive:false}` su `.container` (`index.vue`); `ctrlKey`→`preventDefault()`+aggiorna fattore. Muya: `fontSize` di `.editor-wrapper`; CM: `font-size` su `.CodeMirror`+`cm.refresh()`.
7. **Word wrap**: off in Muya; source `lineWrapping` da `preferences.wordWrap`.
8. **Selezione source**: vedi B4/B4-bis.
9. **Ricarica esterna**: watcher + dialog (sez. D). Bug B2/B11/B12/B14.
10. **Pulizia log**: rimossi i prefissi temporanei; tenuti i gated `MARKTEXT_DEBUG_VERBOSE`.

---

## Storico Bug B1–B14 (Tutti ✅ Risolti, Testati 2026-05-30)

Log diagnostici temporanei (`[UNDO-DBG]`, `[DOT-DBG]`, `[WATCH-DBG]`, `[ENC-DBG]`) **rimossi**.
I `console.log` in `watcher.js` gated da `MARKTEXT_DEBUG_VERBOSE>=3` sono volontari → NON rimuovere.

| Bug | Causa | Fix | File |
|---|---|---|---|
| **B1** bollino all'apertura | Muya ≥2 pass init; `justLoaded` one-shot bool | `justLoaded`→timestamp + `LOAD_SETTLE_MS=400ms` | `store/editor.js` |
| **B2** prompt reload non compariva | `watcher.js` filtrava markdown-only | `type==='file'`→no filtro estensione. Handler watcher tornati a firma `(win,filePath)` (rimossi `ipcRenderer.send` ridondanti) | `watcher.js` |
| **B3** ANSI→mojibake | `ced` su ASCII→`utf8`→byte 1252 letti UTF-8 | `isValidUtf8()`; se byte>0x7F e UTF-8 invalido→`windows-1252` (BOM ha precedenza) | `encoding.js` |
| **B4** selezione temi scuri | alpha basso | alzato alpha `--selectionColor`. **B4-bis:** railscasts forza `#272935 !important` → variabile dedicata `--cmSelectionColor` + override railscasts/one-dark | `codeMirror/index.css`, `themes/codemirror/one-dark.css` |
| **B5** Ctrl+Plus/- zoom | accelerator vuoti | aggiunti `Ctrl+Plus`/`Ctrl+-`→`window.zoomIn/zoomOut` | `keybindingsWindows/Linux.js` |
| **B6** Ctrl+Z cross-tab + contaminazione su close | (1) `CLOSE_TABS` non chiamava `_applySourceCodeForFile`; (2) `sourceCode.vue` processava eventi con `sourceCode=false`; (3) Muya `id:'muya'` fisso | (1) `_applySourceCodeForFile` in CLOSE_TABS; (2) guard `if(!sourceCode.value)return`; (3) emit in `onBeforeUnmount` solo stesso tab + `cmStatePerTab.delete`; (4) `currentMuyaTabId` | `store/editor.js`, `sourceCode.vue`, `editor.vue` |
| **B7** spazio a destra tab corte | `.v2-tab-name` senza `flex-grow` | `flex-grow:1` (`min-width:0` preserva ellipsis) | `tabs.vue` |
| **B8** bollino riappare ~1s dopo Ctrl+S | `tab.markdown` debounced 1s | `pre-save` flush (`handlePreSave` committa sincrono) | `store/editor.js`, `sourceCode.vue` |
| **B9** bollino al click cursore dopo save | lightTouch: `savedMarkdown ≠ tab.markdown` → baseline divergente | se `normalizeBlock` coincide → `isSaved=true` + `originalMarkdown=tab.markdown`; N12 normalizza trailing | `store/editor.js`, `sourceCode.vue` |
| **B10** Ctrl+Shift+↑/↓ non estende in Muya | `arrowHandler` early-exit su `shiftKey` senza preventDefault | handler esplicito ctrl+shift+Arrow: trova blocco prec/succ + `dispatchSelectionChange` | `muya/lib/contentState/arrowCtrl.js` |
| **B11** reload: contenuto non aggiorna + UX | (A) `handleFileChange` early-return saltava `setValue`; (B) `loadChange` senza `justLoaded` | dialog `file-changed-externally` (no dirty in detection); `loadChange`→`isSaved=true`+`justLoaded`+`forceReload`; ramo `forceReload`→`setValue`+`refresh` | `fileChangedDialog.vue`, `index.vue`, `store/editor.js`, `sourceCode.vue` |
| **B12** reload UX follow-up | — | N12 normalizza entrambi i lati; Annulla→`markDivergedFromDisk` (Opzione A); dialog v2 (no `el-dialog`); context menu "Reload" | `store/editor.js`, `fileChangedDialog.vue`, `TabContextMenu.vue`, `watcher.js`, `windowManager.js` |
| **B13** Ctrl+S salva stale | `handlePreSave` aveva guardia `!isFirstLoad` (mai falso per tab mai cambiata) → flush mai eseguito | rimossa la guardia | `sourceCode.vue` |
| **B14** dialog reload per tab background | mostrava sempre il dialog | dialog solo se `currentFile`; altrimenti `pendingExternalChange`, consumato in `UPDATE_CURRENT_FILE` (nextTick). | `store/editor.js` |

---

## Riferimenti Shortcut

| Tasto | Markdown (Muya) | Source (CodeMirror) |
|---|---|---|
| `Ctrl+Shift+U` / `Ctrl+U` | MAIUSCOLO / minuscolo (globale) | idem |
| `Ctrl+D` | `format.strike` | duplica riga/blocco |
| `Ctrl+L` | `format.hyperlink` | elimina riga |
| `Ctrl+I` / `Ctrl+J` | emphasis / toggle-sidebar | — (split/join, in TODO) |
| `Ctrl+Shift+↑/↓` | estende selezione cross-block (B10) | sposta riga |
| `Alt+↑/↓` | line-move disabilitato | (libero) |
| `Ctrl+Alt+D` / `Ctrl+Shift+D` | duplica / elimina paragrafo | — |
| `Ctrl+0` | `tabs.switchToTenth` (NON reset zoom) | idem |
