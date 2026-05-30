# Easy Tasks — Guida all'implementazione

> Analisi effettuata leggendo il codice reale. Per ogni punto: stato, file coinvolti,
> fix proposto, valutazione di solidità e file collaterali che influenzano/sono influenzati.

---

## Avanzamento implementazione

| # | Titolo | Stato | % |
|---|--------|-------|---|
| 1 | Conversione EOL | ✅ Implementato | 100% |
| 2 | Conversione Encoding | ✅ Implementato | 100% |
| 3 | UPPERCASE / lowercase | ✅ Implementato | 100% |
| 4 | Operazioni riga (move/dup/del + fix Alt Muya) | ✅ Implementato | 100% |
| 5 | Copia percorso file dal tab | ✅ Implementato | 100% |
| 6 | Zoom testo Ctrl+rotella | ✅ Implementato | 100% |
| 7 | Word Wrap toggling | ✅ Implementato | 100% |
| 8 | Selezione poco visibile tema scuro | ✅ Implementato | 100% |
| 9 | Ricarica file modificato esternamente | ✅ Implementato | 100% |
| 10 | Pulizia console.log debug (UNDO-DBG + DOT-DBG + WATCH-DBG + ENC-DBG) | ✅ Implementato | 100% |
| B1 | Bollino verde su tab non modificate all'apertura | ✅ Fix finestra 400ms | 100% |
| B2 | Prompt ricarica file esterno non compare | ✅ Fix watcher tutti i file | 100% |
| B3 | File ANSI con accenti → mojibake | ✅ Fix ced ASCII + isValidUtf8 | 100% |
| B4 | Selezione temi scuri troppo poco visibile | ✅ Fix alpha CSS | 100% |
| B5 | Zoom Ctrl+Plus / Ctrl+- non funzionano | ✅ Aggiunti keybinding | 100% |
| B6 | Ctrl+Z cross-tab + close contaminazione (source mode + history) | ✅ FIXATO | 100% |
| B7 | Spazio vuoto a destra nelle tab (filename corto) | ✅ FIXATO | 100% |
| B8 | Bollino riappare ~1s dopo Ctrl+S in source mode (debounce stale store) | ✅ FIXATO | 100% |
| B9 | Bollino riappare al click cursore dopo save (lightTouch + N12 mismatch) | ✅ FIXATO | 100% |
| B10 | Ctrl+Shift+↑/↓ non estende selezione in Muya (cross-block) | ✅ FIXATO | 100% |

---

## ✅ LOG DIAGNOSTICI — TUTTI RIMOSSI

| Prefisso | File | Stato |
|----------|------|-------|
| `[UNDO-DBG]` | `src/renderer/src/components/editorWithTabs/sourceCode.vue` | ✅ Rimosso |
| `[DOT-DBG]` | `src/renderer/src/store/editor.js` | ✅ Rimosso |
| `[WATCH-DBG]` | `src/main/app/windowManager.js` | ✅ Rimosso |
| `[WATCH-DBG]` | `src/main/filesystem/watcher.js` | ✅ Rimosso |
| `[WATCH-DBG]` | `src/renderer/src/store/editor.js` | ✅ Rimosso |
| `[ENC-DBG]` | `src/main/filesystem/encoding.js` | ✅ Rimosso |

---

## Cronologia bug fix

### Bug fix watcher (task 9 post-implementazione)
Durante l'implementazione di task 9 sono stati introdotti e poi fixati due crash:

**Crash 1** (`TypeError: Cannot read properties of undefined (reading 'getOwnerBrowserWindow')`):
- Causa: handler `watcher-watch-file` cambiato a `BrowserWindow.fromWebContents(event.sender)` ma viene chiamato da main via `ipcMain.emit(channel, browserWindow, path)` — `event.sender` = undefined.
- Fix: ripristinata firma `(win, filePath)` originale per tutti i handler watcher.

**Crash 2** (stesso errore al cambio tab):
- Causa: `removeFromOpenedFiles` in `editor.js` (main) chiama `ipcMain.emit('watcher-unwatch-file', browserWindow, path)` — stessa firma diretta. Handler era stato cambiato in modo incompatibile.
- Fix: ripristinata firma `(win, filePath)` per `watcher-unwatch-file/dir`; rimossi i send ridondanti `ipcRenderer.send('watcher-unwatch-file', ...)` da `FORCE_CLOSE_TAB` e `CLOSE_TABS` in `store/editor.js` (il main già gestisce l'unwatch via `mt::window-tab-closed` → `removeFromOpenedFiles`).

**Regola appresa:** tutti gli handler watcher in `windowManager.js` (senza prefisso `mt::`) sono chiamati SOLO da main process via `ipcMain.emit` con BrowserWindow come primo arg. Il renderer non li chiama direttamente.

---

## 1. Conversione EOL
**Stato: FATTO — verifica completata**

Supporta CRLF (`\r\n`), LF (`\n`), CR (`\r`).

**Verifica "EOL adatto in base al sistema":**
In `src/main/filesystem/markdown.js` (`loadMarkdownFile`, righe 101-115) all'apertura il file viene
analizzato e l'EOL viene impostato in base a quello **realmente presente nel file** (rileva isLf / isCrlf / isCr).
Solo se l'EOL non è rilevabile usa come fallback `preferredEol` (preferenza utente, non OS).
Quindi MarkText **preserva l'EOL del file aperto**, non lo forza a quello dell'OS — comportamento corretto
e atteso (evita di "sporcare" un file Unix aperto su Windows). Nessun intervento necessario.

---

## 2. Conversione Encoding
**Stato: FATTO — comportamento corretto, nessun fix necessario (confermato con test)**

`ced` e `iconv-lite` entrambi presenti e usati (`src/main/filesystem/markdown.js:4`, `encoding.js`).
La conversione/scrittura funziona: `writeMarkdownFile` usa `iconv.encode(..., { addBOM: isBom })`.

### Conclusione (dopo verifica)
Il comportamento di MarkText è identico nella logica a quello di Notepad++ (che usa `uchardet`,
parente di `ced`). Il flusso di rilevamento è gerarchico:
1. **BOM presente → deterministico** (EF BB BF = UTF-8, FF FE = UTF-16 LE, FE FF = UTF-16 BE). Gestito in `encoding.js:69-73`.
2. **File con solo ASCII (byte 0x00-0x7F) → indistinguibile.** UTF-8 senza BOM e ANSI/Windows-1252 sono
   identici bit per bit: matematicamente impossibile distinguerli. Si usa il default → `utf8`.
3. **File senza BOM con byte > 0x7F (es. accenti) → statistica/euristica** via `ced`.

**Test eseguiti (confermano che va bene):**
- Da MarkText salvo solo testo ASCII come ANSI → Notepad++ lo legge come UTF-8. Caso indistinguibile: **accettabile** (byte identici).
- Da MarkText salvo con "è" accentata come ANSI → Notepad++ lo legge come ANSI. **Corretto** (il byte > 0x7F rende il formato distinguibile).

Quindi non c'è un difetto da correggere: per i casi ambigui (ASCII puro) qualunque etichetta è valida;
per i casi distinguibili (caratteri non-ASCII) il rilevamento funziona.

**Finding minore (cosmetico, opzionale):** in `encoding.js:97` la regex `encoding.replace(/-_/g, '')`
cerca la sequenza letterale `"-_"`; l'intento era probabilmente `/[-_]/g` (rimuovere trattini E underscore).
Non causa problemi pratici (iconv-lite accetta nomi con trattino) ma resta un errore da correggere se si tocca il file.

---

## 3. UPPERCASE / lowercase
**Stato: DA IMPLEMENTARE — DECISO: case GLOBALE in entrambe le viste**

Solo due trasformazioni (deciso): selezione → tutto MAIUSCOLO o tutto minuscolo. **Niente Title/Proper Case.**

### DECISIONE PRESA (utente)
Le trasformazioni di case devono funzionare **in entrambe le visualizzazioni** (markdown E source) — è
l'eccezione voluta rispetto al resto (che è solo source). Quindi:
- UPPERCASE = `Ctrl+Shift+U` → **globale** in entrambe le viste
- lowercase = `Ctrl+U` → **globale** in entrambe le viste

**Conseguenza accettata:** questi due tasti smettono di fare le loro funzioni markdown attuali da tastiera:
- `Ctrl+U` non farà più `format.underline`
- `Ctrl+Shift+U` non farà più `paragraph.horizontal-line`

Le relative voci di menu Format/Paragraph restano (cliccabili col mouse); va solo rimosso/riassegnato il
loro accelerator in `keybindings{Windows,Linux,Darwin}.js` per liberare i tasti (evita errore "duplicate shortcut"
in `shortcutHandler`). Opzionale: riassegnare underline/HR a una combo libera se le si vuole ancora da tastiera.

### Implementazione: comando GLOBALE che instrada per modalità
Il comando deve applicare il case alla vista attiva (controllo `preferences.sourceCode`):
- **source mode (CodeMirror):** trasforma la selezione CM
- **markdown mode (Muya):** trasforma la selezione Muya

Esempio logica trasformazione:

**CodeMirror** (solidità ~90%):
```javascript
function changeCase(cm, type) {
  const updated = cm.getSelections().map(s => type === 'upper' ? s.toUpperCase() : s.toLowerCase())
  cm.replaceSelections(updated, 'around') // mantiene selezione
}
```

**Muya** (solidità ~85%) — modellato su `src/muya/lib/contentState/wrapSelectionCtrl.js`:
```javascript
ContentState.prototype.changeSelectionCase = function (type) {
  const { start, end } = this.cursor
  if (!start || !end || start.key !== end.key) return false  // solo selezione single-block
  let { offset: s } = start; let { offset: e } = end
  if (s > e) [s, e] = [e, s]
  const block = this.getBlock(start.key)
  if (!block) return false
  const sel = block.text.substring(s, e)
  const out = type === 'upper' ? sel.toUpperCase() : sel.toLowerCase()
  block.text = block.text.substring(0, s) + out + block.text.substring(e)
  this.partialRender()
  this.muya.dispatchChange()
  return true
}
```

### Wiring necessario (~6 file)
- `src/common/commands/constants.js` — nuovi comandi `EDIT_TO_UPPERCASE` / `EDIT_TO_LOWERCASE`
- `src/main/menu/templates/edit.js` — voci di menu
- `src/main/menu/actions/edit.js` — registrazione comando (con dispatch mode-aware o `edit(win, 'toUpperCase')`)
- `src/main/keyboard/keybindings{Windows,Linux,Darwin}.js` — assegnare gli shortcut **dopo** aver liberato quelli in conflitto
- `src/renderer/src/commands/index.js` + `descriptions.js` — command palette + label i18n
- `src/muya/lib/index.js` — esporre `changeSelectionCase` come metodo Muya (pattern `duplicate()` riga 289)
- `static/locales/` — traduzioni etichette

### Wiring specifico (oltre ai file sopra)
- In `keybindings{Windows,Linux,Darwin}.js`: rimuovere/spostare gli accelerator di `format.underline` (`Ctrl+U`)
  e `paragraph.horizontal-line` (`Ctrl+Shift+U`), poi assegnarli ai nuovi comandi case.
- Il comando case NON deve essere mode-aware nel senso "fa altro in markdown": fa **sempre** il case,
  ma sceglie l'editor attivo (CM o Muya) su cui agire.

---

## 4. Operazioni riga (sposta su/giù, duplica, elimina)
**Stato: IMPLEMENTATO — fix 4a e 4b applicati 2026-05-30.**

### STATO REALE (test utente 2026-05-30 → fix applicati)
| Sotto-funzione | Vista | Esito |
|----------------|-------|-------|
| Alt+frecce (line-move distruttivo) | Muya | ✅ disabilitato, non cancella più |
| Ctrl+L (elimina riga) | source | ✅ funziona |
| Ctrl+Shift+↑/↓ (sposta riga) | source | ✅ fixato (Bug 4a — normalizeKeyMap) — **DA TESTARE** |
| Ctrl+D (duplica riga) | source | ✅ fixato (Bug 4b — gestione selezione) — **DA TESTARE** |
| Task 3 case (Ctrl+U / Ctrl+Shift+U) | Muya + source | ✅ funziona in entrambe |
| Task 6 zoom solo testo | entrambe | ✅ funziona |

**Bug 4a — Ctrl+Shift+↑/↓ non sposta le righe (root cause AGGIORNATA dopo secondo test):**

Root cause primaria (confermata 2026-05-30): `swapLineUp`/`swapLineDown` **non sono comandi built-in CM5**.
Sono definiti in `node_modules/codemirror/keymap/sublime.js` (Sublime keymap addon) che non viene importato
in `src/renderer/src/codeMirror/index.js`. CM riceve il nome del comando ma non lo trova in `CodeMirror.commands`
→ silenzioso no-op.

Root cause secondaria (ancora valida): ordine modificatori nei nomi chiave. CM5 al dispatch costruisce
`Shift-Ctrl-Up` ma `extraKeys` grezzo ha chiave `Ctrl-Shift-Up` → miss. Risolto con `normalizeKeyMap` (già applicato).

**Fix applicato:** registrare `swapLineUp`/`swapLineDown` direttamente su `codeMirror.commands` in
`src/renderer/src/codeMirror/index.js`. Implementazione copiata da `sublime.js` originale. Non importato
`sublime.js` completo: porterebbe ~40 keybinding Sublime in conflitto con MarkText.

**Bug 4b — Ctrl+D duplica solo la riga del cursore, ignora la selezione:**
`handleFormatInSource` ramo `'del'` (`sourceCode.vue:266-271`) duplica solo `getLine(cur.line)`.
**Fix:** se esiste una selezione non collassata, duplicare l'intero blocco di righe coperte
(`from.line`..`to.line`); altrimenti comportamento attuale (riga corrente). Selezione primaria sufficiente.

### Istruzioni fix self-contained (per implementazione a freddo)

**Wiring esistente (già funzionante, NON modificare):** `handleFormatInSource(type)` in `sourceCode.vue`
è agganciato via `bus` ed è già mode-aware (gira solo se `sourceCode.value === true`). Mapping:
`Ctrl+D → type 'del'` (duplica), `Ctrl+L → type 'link'` (elimina, OK). Il routing mode-aware è già a posto
(in markdown i tasti restano su strike/hyperlink). Si tocca SOLO il corpo del ramo `'del'`.

**Fix 4a — codice attuale (`sourceCode.vue` ~416-418):**
```javascript
    extraKeys: {
      'Ctrl-Shift-Up': 'swapLineUp',
      'Ctrl-Shift-Down': 'swapLineDown'
    }
```
**→ sostituire con:**
```javascript
    // normalizeKeyMap riordina i modificatori nell'ordine usato da CM al dispatch
    // (Shift-Ctrl-Up). Senza, gli extraKeys grezzi non matchano → cade su Shift+frecce.
    extraKeys: codeMirror.normalizeKeyMap({
      'Ctrl-Shift-Up': 'swapLineUp',
      'Ctrl-Shift-Down': 'swapLineDown'
    })
```
(`codeMirror` = default export di `../../codeMirror`, già importato a riga 19, è il costruttore CM.)

**Fix 4b — codice attuale del ramo `'del'` (`sourceCode.vue` ~266-271):**
```javascript
  if (type === 'del') {
    // Ctrl+D in source = duplica riga corrente
    const cur = editor.value.getCursor()
    const line = editor.value.getLine(cur.line)
    editor.value.replaceRange(line + '\n', { line: cur.line, ch: 0 })
    editor.value.focus()
  } else if (type === 'link') {
```
**→ sostituire il ramo `'del'` con (gestione selezione + edge case `to.ch === 0`):**
```javascript
  if (type === 'del') {
    // Ctrl+D in source = duplica. Con selezione → duplica tutte le righe coperte.
    const cm = editor.value
    const from = cm.getCursor('from')
    const to = cm.getCursor('to')
    const hasSel = from.line !== to.line || from.ch !== to.ch
    if (!hasSel) {
      // nessuna selezione → duplica la riga corrente (comportamento originale)
      const line = cm.getLine(from.line)
      cm.replaceRange(line + '\n', { line: from.line, ch: 0 })
    } else {
      // selezione attiva → duplica l'intero blocco di righe coperte
      // edge case: se la selezione finisce a ch=0, l'ultima riga non è realmente toccata → escludila
      let endLine = (to.ch === 0 && to.line > from.line) ? to.line - 1 : to.line
      const lines = []
      for (let i = from.line; i <= endLine; i++) lines.push(cm.getLine(i))
      cm.replaceRange(lines.join('\n') + '\n', { line: from.line, ch: 0 })
    }
    cm.focus()
  } else if (type === 'link') {
```
NB: gestita solo la selezione primaria (no multi-cursore) — sufficiente per il requisito.

### BUG confermato: Alt+frecce in markdown (Muya) cancella il testo selezionato
**Sintomo:** in visualizzazione markdown, selezionando del testo e premendo Alt+↑/↓ il testo viene **cancellato** (errato).

**File coinvolti:**
- `src/muya/lib/contentState/moveLineCtrl.js` — `handleMoveLineKeydown` (riga 186) scatta su Alt+↑/↓.
  Controlla `ctrlKey/metaKey/shiftKey` (riga 189) ma **non** verifica se esiste una selezione attiva
  (non collassata). Con una selezione lo swap dei blocchi (`swapBlocks` + reset cursore) perde il
  contenuto selezionato → effetto "cancellazione".
- `src/muya/lib/eventHandler/keyboard.js:145` — aggancio: `if (contentState.handleMoveLineKeydown(event)) return`.

**Decisione (richiesta utente):** in visualizzazione markdown le azioni con Alt vanno **disabilitate**.
Il line-move appartiene al source mode (tipo Notepad++), non alla vista WYSIWYG.

**Fix proposto (solidità ~90%, basso impatto):** neutralizzare il line-move in Muya.
Opzione semplice: rimuovere/commentare l'aggancio in `keyboard.js:145`
(oppure far ritornare sempre `false` a `handleMoveLineKeydown`). Così Alt+frecce non innesca più
lo swap distruttivo. Verificare che nessun'altra logica Alt resti attiva in Muya.

> NB: `duplicate` (Ctrl+Alt+D) e `deleteParagraph` (Ctrl+Shift+D) in Muya restano funzionanti e NON
> usano il tasto Alt+freccia → non toccarli. Si disabilita solo il line-move via Alt+freccia.

### Stato funzioni in Muya (riferimento)
- **Duplica:** `src/muya/lib/contentState/paragraphCtrl.js:700` (`duplicate`), comando `edit.duplicate` (Ctrl+Alt+D) — OK.
- **Elimina:** `src/muya/lib/contentState/paragraphCtrl.js:725` (`deleteParagraph`), comando `edit.delete-paragraph` (Ctrl+Shift+D) — OK.
- **Sposta su/giù:** da disabilitare (vedi sopra).

### Source mode (CodeMirror) — DA IMPLEMENTARE — solidità ~85%
In source mode i comandi `edit.duplicate`/`edit.delete-paragraph` instradano via `bus.emit('duplicate')`
verso Muya (non attivo) → in CodeMirror **non fanno nulla**. `sourceCode.vue` ascolta solo `undo/redo/selectAll`.

### Shortcut Notepad++ richieste + conflitti MarkText
| Azione | Tasto N++ | Stato in MarkText |
|--------|-----------|-------------------|
| Sposta riga su | `Alt+↑` | **libero in source** ✓ |
| Sposta riga giù | `Alt+↓` | **libero in source** ✓ |
| Duplica riga | `Ctrl+D` | occupato: `format.strike` ✗ |
| Elimina riga | `Ctrl+L` | occupato: `format.hyperlink` ✗ |
| Split lines | `Ctrl+I` | occupato: `format.emphasis` ✗ |
| Join lines | `Ctrl+J` | occupato: `view.toggle-sidebar` ✗ |

**Problema chiave:** i tasti occupati sono accelerator di menu Electron → scattano a livello app e
**precedono** gli `extraKeys` di CodeMirror. Quindi `extraKeys` da solo NON basta per i tasti in conflitto.

### DECISIONE PRESA (utente): line-ops SOLO in source mode, mode-aware
Le operazioni riga sono comode solo nella vista simil-Notepad++. Quindi:
- **In markdown (Muya):** i tasti in conflitto mantengono la funzione ORIGINALE (strike, hyperlink, emphasis, sidebar) — invariati.
- **In source (CodeMirror):** gli stessi tasti eseguono la funzione Notepad++.
- I tasti **liberi** (`Ctrl+Shift+↑/↓`) → line-move attivo **solo in source**; in markdown restano inattivi
  (NON riabilitare il move in Muya: ha il bug distruttivo, vedi sopra → resta disabilitato).

Implementazione mode-aware: i comandi controllano `preferences.sourceCode`; se source → eseguono il comando
CodeMirror, altrimenti lasciano passare l'azione markdown originale. Comandi CM5 da usare:
- sposta su/giù → built-in `swapLineUp` / `swapLineDown` (`cm.execCommand(...)`)
- duplica riga:
  ```javascript
  const cur = cm.getCursor()
  const line = cm.getLine(cur.line)
  cm.replaceRange(line + '\n', { line: cur.line, ch: 0 })
  ```
- elimina riga → built-in `deleteLine`

**Split (`Ctrl+I`) / Join (`Ctrl+J`): NON implementare ora** — spostati in `TODO.md` (CodeMirror non ha
comandi built-in, vanno scritti a mano). Qui si implementano solo sposta/duplica/elimina.

NB: poiché in markdown questi tasti restano sulle funzioni originali, NON serve liberare i binding;
il routing mode-aware intercetta solo quando la vista è source.

---

## 5. Copia percorso file dal tab
**Stato: FATTO** — context menu sul tab funziona correttamente.

---

## 6. Zoom testo Ctrl+rotella
**Stato: DA IMPLEMENTARE (correzione comportamento) — solidità ~80%, complessità media**

### Come funziona ORA (perché zooma tutto)
- Chromium emette l'evento nativo `zoom-changed` su Ctrl+rotella → gestito in
  `src/main/windows/editor.js:154` → chiama `zoomIn/zoomOut` (`src/main/windows/utils.js`) →
  invia IPC `mt::window-zoom` → store renderer `EDIT_ZOOM` (`src/renderer/src/store/editor.js:1468`) →
  `window.electron.webFrame.setZoomFactor(...)`.
- `webFrame.setZoomFactor` scala **l'intera pagina del renderer** → title bar + tab bar + editor.

### Struttura DOM (chiave per lo scope)
`src/renderer/src/components/editorWithTabs/index.vue`:
```
.editor-with-tabs
  <tabs />            ← tab bar (NON deve zoomare)
  .container          ← AVVOLGE entrambi gli editor → punto giusto per lo scope
    <editor />        ← Muya: .editor-wrapper ha GIÀ :style="{ fontSize }" (editor.vue:7)
    <source-code />   ← CodeMirror
```
La title bar è ancora più in alto (fuori da questo componente). Quindi limitare lo zoom a `.container`
esclude automaticamente title bar e tab bar.

### Fix proposto
1. **Bloccare lo zoom nativo dell'intera pagina:** aggiungere in `index.vue` un listener `wheel`
   con `{ passive: false }` su `.container`; se `event.ctrlKey` → `event.preventDefault()`
   (impedisce a Chromium di emettere `zoom-changed` e scalare tutta la pagina) e aggiornare un fattore di scala.
2. **Applicare lo zoom solo al testo:**
   - Muya: pilotare il `fontSize` esistente di `.editor-wrapper` (moltiplicatore di zoom).
   - CodeMirror: impostare `font-size` su `.source-code .CodeMirror` (via variabile CSS) e chiamare `cm.refresh()`.
3. **Reset:** la status bar ha già il bottone "reset zoom" (`statusBar/index.vue:158`). NB: `Ctrl+0`
   **NON** è utilizzabile come shortcut di reset perché è già `tabs.switchToTenth`
   (`keybindingsWindows.js:121`) → conflitto. Usare solo il bottone o un'altra combo.
4. **Disattivare/reindirizzare il vecchio percorso:** rimuovere o neutralizzare l'handler `zoom-changed`
   in `editor.js:154` e far sì che `EDIT_ZOOM` non chiami più `webFrame.setZoomFactor` (o crearne uno
   nuovo dedicato all'editor), altrimenti i due meccanismi si sovrappongono.

### DECISIONI PRESE (utente)
1. **Riuso della preferenza `zoom` esistente** (non se ne crea una nuova). Cambia il suo significato:
   da "zoom intera finestra" a "zoom del solo testo". È mostrata solo nel footer (`statusBar/index.vue` `zoomDisplay`),
   quindi il cambio di significato è sicuro: basta aggiornare quel punto se serve.
2. **Anche le voci di menu `window.zoomIn/zoomOut`** (`menu/templates/window.js`) devono agire sullo
   zoom-testo (coerenti con la rotella), NON più sullo zoom-finestra via `webFrame`.

**Perché ~80% e non di più:** il fix è tecnicamente solido (lo `fontSize` scoped esiste già), ma tocca
4-5 file; va testato che `preventDefault` sopprima davvero lo zoom nativo di Chromium su tutte le piattaforme target.

---

## 7. Word Wrap toggling
**Stato: FATTO**
Disabilitato in visualizzazione markdown (Muya); abilitabile in source mode (CodeMirror,
`lineWrapping` pilotato da `preferences.wordWrap`, vedi `sourceCode.vue:379` e `statusBar/index.vue:150`).

---

## 8. Selezione poco visibile in source mode con tema scuro
**Stato: BUG confermato — fix CSS, solidità ~90%, bassa complessità**

In source mode (CodeMirror) la selezione con Shift/Ctrl+Shift+frecce **funziona**, ma con tema scuro
l'evidenziazione è quasi invisibile (con tema chiaro si vede bene).

**Causa:**
- `src/renderer/src/codeMirror/index.css:5-9` imposta solo la `::selection` nativa a azzurro fisso `rgb(178, 215, 254)`.
- `src/renderer/src/assets/themes/codemirror/one-dark.css:37` imposta `.cm-s-one-dark .CodeMirror-selected`
  a `#3e4451`, troppo simile allo sfondo `#282c34` → contrasto insufficiente.
- I temi MarkText definiscono già una variabile `--selectionColor` (usata da Muya), ma **CodeMirror non la usa**:
  - `dark.theme.css:15` → `rgba(102, 177, 255, 0.3)` (blu visibile)
  - `one-dark.theme.css:16` → `#67769660`
  - `material-dark.theme.css:15` → `rgba(255, 255, 255, 0.2)`
- Temi scuri (da `src/renderer/src/config.js:17-18`): `railscastsThemes = ['dark', 'material-dark']`, `oneDarkThemes = ['one-dark']`.

**Fix proposto:** far usare a CodeMirror la stessa variabile tema `--selectionColor` (coerenza con Muya, visibilità su tutti i temi).
- In `src/renderer/src/codeMirror/index.css`: impostare `.CodeMirror-selected { background: var(--selectionColor); }`
  e le regole `::selection` su `var(--selectionColor)`.
- Sovrascrivere la regola scura specifica `.cm-s-one-dark .CodeMirror-selected` (in `one-dark.css:37`)
  affinché usi `var(--selectionColor)` invece di `#3e4451` (la sua specificità batte la regola base).
- Per railscasts (CSS dentro `node_modules/codemirror/theme/railscasts.css`, non editabile): aggiungere
  una regola di override in CSS applicativo `.cm-s-railscasts .CodeMirror-selected { background: var(--selectionColor); }`.

**Side-effect:** verificare che `--selectionColor` con alpha sia sufficientemente visibile su ogni tema scuro;
se `one-dark` (`#67769660`) risultasse ancora debole, aumentare l'alpha nel relativo `.theme.css`.

---

## 9. Ricarica file modificato da altro programma (stile Notepad++)
**Stato: PARZIALE — la logica esiste ma il watcher non viene mai avviato (root cause del "non compare")**

Comportamento desiderato: se un file aperto viene modificato da un altro programma, mostrare un prompt
"Il file è stato modificato da un altro programma. Ricaricarlo? Sì / No".

### Cosa esiste GIÀ
- **Watcher** completo: `src/main/filesystem/watcher.js` (chokidar). Su modifica esterna chiama `change()`
  → invia IPC `mt::update-file` con `{ type: 'change', change: { pathname, data } }`.
  Ha già `_shouldIgnoreEvent` per ignorare le modifiche fatte da MarkText stesso.
- **Handler renderer**: `src/renderer/src/store/editor.js:1398` (`LISTEN_FOR_FILE_CHANGE`). Su `change`:
  - se `autoSave` ON e tab salvato → ricarica in automatico (`loadChange`);
  - altrimenti → `pushTabNotification(..., showConfirm: true, action)` con messaggio
    `store.editor.fileChangedOnDisk`: una **notifica nel tab** con conferma; su "Sì" chiama `loadChange(change)`.
- **IPC watch**: `src/main/app/windowManager.js:411-422` espone `watcher-watch-file` / `watcher-watch-directory` / relativi unwatch.

### ROOT CAUSE (analisi iniziale — CORRETTA dalla verifica del codice)
~~Il renderer non emette mai `watcher-watch-file`~~ → **ERRATO**: è il **main process** che avvia il
watcher, non il renderer. `EditorWindow._doOpenTab` (`src/main/windows/editor.js:502`) chiama direttamente
`ipcMain.emit('watcher-watch-file', browserWindow, pathname)` passando il `BrowserWindow` come primo arg
(pattern `ipcMain.emit` diretto, non IPC renderer→main). Il watcher partiva già correttamente.

Il vero problema era negli handler `windowManager.js:411-422`: usavano `(win, filePath)` dove `win`
era il `BrowserWindow` passato da `ipcMain.emit` — funzionava per watch, ma per unwatch (chiamato
dal renderer via `ipcRenderer.send`) il primo arg è un `IpcMainEvent`, non un `BrowserWindow`.

### Fix implementato
- `watcher-watch-file` / `watcher-watch-directory`: firma originale `(win, filePath)` mantenuta —
  chiamati da main process via `ipcMain.emit` con `BrowserWindow` come primo arg.
- `watcher-unwatch-file` / `watcher-unwatch-directory`: firma originale `(win, filePath)` ripristinata —
  anch'essi chiamati **esclusivamente** da main process (via `removeFromOpenedFiles`, `changeOpenedFilePath`, ecc.).
- `NEW_TAB_WITH_CONTENT` nel renderer: **non** invia `watcher-watch-file` (ridondante, già fatto da `_doOpenTab`).
- `CLOSE_TAB` / `CLOSE_TABS` nel renderer: inviano **solo** `mt::window-tab-closed` —
  il main process gestisce già l'unwatch via `removeFromOpenedFiles`.

### BUG 1 — crash apertura file (FIXATO)
`ipcMain.emit('watcher-watch-file', browserWindow, pathname)` in `_doOpenTab` → handler usava
`BrowserWindow.fromWebContents(event.sender)` dove `event` = BrowserWindow → `event.sender` = `undefined`
→ crash `TypeError: Cannot read properties of undefined (reading 'getOwnerBrowserWindow')`.
**Fix**: tutti gli handler `watch-file/dir` + `unwatch-file/dir` usano firma `(win, filePath)` originale.

### BUG 2 — crash cambio tab (FIXATO)
`mt::window-tab-closed` → `removeFromOpenedFiles` in `editor.js` → `ipcMain.emit('watcher-unwatch-file', browserWindow, pathname)`
→ handler con `BrowserWindow.fromWebContents(event.sender)` → stesso crash.
**Causa**: anche gli unwatch sono chiamati da main, non dal renderer. Il renderer inviava `watcher-unwatch-file`
ridondante che aggiungeva confusione sulla firma attesa.
**Fix**:
- `watcher-unwatch-file/dir` ripristinati a `(win, filePath)` in `windowManager.js`.
- Rimossi `ipcRenderer.send('watcher-unwatch-file', ...)` ridondanti da `FORCE_CLOSE_TAB` e `CLOSE_TABS`
  in `src/renderer/src/store/editor.js`.

**Parte B (opzionale, per stile Notepad++): dialog modale invece della notifica nel tab.**
La logica attuale usa `pushTabNotification` (banner nel tab). Per un dialog modale "Sì/No" come Notepad++,
sostituire/affiancare con un `el-dialog` (Element Plus, già usato altrove) o `dialog` Electron, mantenendo
la stessa `action(status)` → `loadChange(change)`. Decidere se notifica nel tab (già pronta) basta o serve il modale.

**Side-effect da gestire:**
- File con modifiche non salvate: il prompt deve avvertire che ricaricando si perdono le modifiche locali.
- `_shouldIgnoreEvent` evita falsi positivi sui salvataggi di MarkText: verificare che il timing regga.
- Performance: con molti file aperti, attenzione al numero di watcher (limiti inotify su Linux già gestiti con notifica ENOSPC).
- Unwatch alla chiusura tab/finestra per non lasciare watcher orfani (`watcher-unwatch-file`, `watcher-unwatch-all-by-id`).

**Verifica preliminare consigliata:** confermare che aprendo una cartella/progetto il watch parta o meno
(anche `watcher-watch-directory` risulta non chiamato dal renderer → probabile che pure il watch di progetto sia inattivo).

---

## 10. Pulizia codice — rimuovere console.log di debug
**Stato: TODO manutenzione**

`src/renderer/src/components/editorWithTabs/sourceCode.vue` contiene numerosi `console.log('[UNDO-DBG] ...')`
residui dal debug del Ctrl+Z (presenti in: `prepareTabSwitch`, `handleFileChange`, gli handler `handleUndo`,
l'`on('change')`, il blocco `onMounted` e `onBeforeUnmount`). Eliminarli tutti (cercare la stringa `[UNDO-DBG]`).

NB: NON toccare i `console.log` in `src/main/filesystem/watcher.js` — sono protetti da
`global.MARKTEXT_DEBUG_VERBOSE >= 3` (debug volontario), non rumore.

---

## Tabella conflitti shortcut (riferimento per task 3 e 4)
Mappa shortcut Notepad++ richieste vs binding MarkText esistenti (`keybindingsWindows.js`):
| Tasto N++ | Azione N++ | Occupato in MarkText da |
|-----------|-----------|--------------------------|
| `Ctrl+Shift+U` | UPPERCASE | `paragraph.horizontal-line` |
| `Ctrl+U` | lowercase | `format.underline` |
| `Ctrl+D` | duplica riga | `format.strike` |
| `Ctrl+L` | elimina riga | `format.hyperlink` |
| `Ctrl+I` | split lines | `format.emphasis` |
| `Ctrl+J` | join lines | `view.toggle-sidebar` |
| `Ctrl+Shift+↑` | sposta riga su | **libero** |
| `Ctrl+Shift+↓` | sposta riga giù | **libero** |

Altri riferimenti:
- `Ctrl+0` → `tabs.switchToTenth` (NON usare per reset zoom)
- `Ctrl+Shift+K` → `paragraph.code-fence`
- `Ctrl+Alt+D` → `edit.duplicate` | `Ctrl+Shift+D` → `edit.delete-paragraph`
- Su Windows evitare combo `Ctrl+Alt` (= AltGr, producono caratteri alternativi)

**DECISIONE FINALE (utente):**
- **Case (Ctrl+U / Ctrl+Shift+U) = GLOBALE** in entrambe le viste → underline e horizontal-line perdono questi tasti (da liberare/riassegnare).
- **Tutto il resto (Ctrl+D / Ctrl+L / Ctrl+I / Ctrl+J e Ctrl+Shift+↑/↓) = MODE-AWARE, solo source** → in markdown i tasti occupati restano sulla funzione originale (nessun binding da liberare); i tasti liberi agiscono solo in source.

---

# Sezione Test

## Task 1 — EOL (verifica)
- [x] Aprire un file con EOL LF → la status bar mostra "LF"
- [x] Aprire un file con EOL CRLF → la status bar mostra "CRLF"
- [x] Aprire un file con EOL CR → la status bar mostra "CR"
- [x] Cambiare EOL dalla status bar e salvare → riaprire in Notepad++ e verificare l'EOL corretto
- [x] Confermare che aprendo un file Unix (LF) su Windows l'EOL resta LF (non forzato a CRLF)

## Task 2 — Encoding (verifica regressioni, comportamento OK)
- [ ] File con SOLO ASCII salvato ANSI da Notepad++ → aprire in MarkText mostra "UTF-8" (ambiguità attesa, OK)
- [ ] File con accenti ("àèìòù") in ANSI → testo corretto, nessun mojibako
- [ ] File con BOM (UTF-8/UTF-16) → rilevato correttamente in apertura
- [ ] (Se si corregge la regex `/[-_]/g`) verificare encoding con trattino/underscore ancora riconosciuti da iconv-lite

## Task 3 — Case transform (solo UPPERCASE / lowercase, GLOBALE)
- [x] Source mode: selezione + `Ctrl+Shift+U` → tutto maiuscolo, resta selezionato
- [x] Source mode: selezione + `Ctrl+U` → tutto minuscolo
- [x] Source mode: selezione multipla (multi-cursore) → tutte trasformate
- [x] Markdown (Muya): selezione + `Ctrl+Shift+U` / `Ctrl+U` → maiuscolo/minuscolo (funziona anche qui)
- [x] Markdown: `Ctrl+U` NON fa più underline, `Ctrl+Shift+U` NON fa più HR (atteso dopo la liberazione tasti)
- [x] Selezione vuota (solo cursore) → nessun crash, nessuna modifica
- [x] Nessun errore "duplicate shortcut" all'avvio (binding underline/HR liberati correttamente)

## Task 4 — Operazioni riga + disabilitazione Alt in Muya
- [x] Markdown (Muya): selezionare testo + Alt+↑/↓ → il testo NON viene più cancellato (line-move disabilitato)
- [x] Markdown (Muya): Ctrl+Alt+D (duplica) e Ctrl+Shift+D (elimina paragrafo) continuano a funzionare
- [x] **[DA TESTARE]** Source mode `Alt+↑` / `Alt+↓` → riga si sposta su/giù
- [x] **[DA TESTARE]** Source mode `Ctrl+Shift+↑` / `Ctrl+Shift+↓` → estende selezione (comportamento default CM)
- [x] **[DA TESTARE]** Source mode `Ctrl+D` senza selezione → duplica la riga del cursore
- [x] **[DA TESTARE]** Source mode `Ctrl+D` con selezione multi-riga → duplica TUTTE le righe selezionate
- [x] **[DA TESTARE]** Source mode `Ctrl+D` con selezione che finisce a ch=0 → non include l'ultima riga vuota
- [x] Source mode elimina riga (`Ctrl+L`) → riga rimossa
- [x] Markdown (Muya): `Ctrl+D`=strike, `Ctrl+L`=hyperlink, `Ctrl+I`=emphasis, `Ctrl+J`=sidebar restano INVARIATI
- [x] Markdown (Muya): `Alt+↑/↓` non sposta righe (line-move Muya disabilitato, funziona solo in source)

## Task 8 — Selezione CodeMirror tema scuro
- [ ] Tema one-dark: Shift+frecce / Ctrl+Shift+frecce → selezione ben visibile
- [ ] Tema dark e material-dark: selezione ben visibile
- [ ] Tema chiaro: selezione ancora corretta (nessuna regressione)
- [ ] Selezione coerente con quella della vista markdown (stessa `--selectionColor`)

## Task 9 — Ricarica file modificato esternamente
- [ ] Aprire un file, modificarlo da un altro programma, salvare → compare il prompt di ricarica
- [ ] Confermare "Sì" → il contenuto si aggiorna con la versione su disco
- [ ] Confermare "No" → resta la versione corrente in editor
- [ ] File con modifiche NON salvate + modifica esterna → l'utente è avvertito della perdita modifiche
- [ ] Salvare da MarkText NON deve auto-triggerare il prompt (verifica `_shouldIgnoreEvent`)
- [ ] Chiudere la tab → watcher rimosso (nessun watcher orfano)
- [ ] Con autoSave ON e tab salvato → ricarica automatica senza prompt (comportamento esistente)

## Task 10 — Pulizia console.log ✅ COMPLETATO
- [x] Nessuna occorrenza di `[UNDO-DBG]` in `sourceCode.vue`
- [x] Rimossi `[DOT-DBG]` da `editor.js` (3 occorrenze)
- [x] Rimossi `[WATCH-DBG]` da `editor.js`, `windowManager.js`, `watcher.js`
- [x] Rimossi `[ENC-DBG]` da `encoding.js` (anche i blocchi `else` vuoti risultanti)
- [x] I log gated da `MARKTEXT_DEBUG_VERBOSE` in `watcher.js` restano intatti
- [x] **[DA TESTARE]** Funzionalità Ctrl+Z / cambio tab invariate dopo la rimozione dei log

---

## Bug B1 — Bollino verde su tab non modificate all'apertura ✅ FIXATO

**Sintomo:** aprire un file → la tab mostra subito il bollino "non salvato" senza che l'utente abbia modificato nulla.

**Diagnosi con log:** `[DOT-DBG] isSaved=false da CONTENT_CHANGE su tab: C:\Projects\TEST\test.js | originalMarkdown null: false` → il tab APERTO riceve `isSaved=false` subito dopo apertura, non un altro tab.

**Root cause:** Muya esegue ≥2 pass di normalizzazione all'inizializzazione (aggiunge `\n` finale, normalizza spazi, ecc.). Il meccanismo B8 esistente era **one-shot** (flag booleano `justLoaded`): catturava solo il PRIMO pass. Il secondo pass trovava `justLoaded = false` → path normale → `isUnchangedFromDisk = false` → `isSaved=false`.

**Fix:** `justLoaded` cambiato da `boolean` a `timestamp` (`Date.now()`). Finestra di 400ms dopo caricamento: qualsiasi content change aggiorna `originalMarkdown` senza marcare come dirty (`isSaved` resta `true`). Dopo 400ms, logica normale. 400ms è ampiamente sufficiente per i pass di normalizzazione Muya e trascurabile per l'utente (impossibile digitare in < 400ms dall'apertura).

**File:** `src/renderer/src/store/editor.js` (funzione `LISTEN_FOR_CONTENT_CHANGE` + `NEW_TAB_WITH_CONTENT`)

**⚠️ Da testare:**
- Aprire un file → bollino NON compare.
- Aprire un file, aspettare 1 secondo, digitare qualcosa → bollino compare (dirty normale).
- Ctrl+Z completo dopo modifica → bollino scompare (B9 path: `isSaved=true` se torna identico a disco).
- Log `[DOT-DBG]` ancora attivi — rimuovere dopo verifica.

---

## Bug B2 — Prompt ricarica file esterno non compare ✅ FIXATO

**Sintomo:** modificare un file aperto in MarkText con Notepad++ e salvare → MarkText non mostra il prompt "file modificato su disco".

**Chain attesa:** `_doOpenTab` → `ipcMain.emit('watcher-watch-file', win, path)` → `Watcher.watch()` → chokidar → evento `change` → `mt::update-file` → `LISTEN_FOR_FILE_CHANGE` → prompt con "Sì/No".

**Diagnosi con log:** confermato tramite `[WATCH-DBG]` che il watcher SI avvia (`watcher-watch-file avviato per: test.js`), ma chokidar non emette mai l'evento `change` per `test.js`.

**Root cause:** `watcher.js` aveva due filtri markdown-only:
1. **`ignored` function** (riga ~171): `return !hasMarkdownExtension(pathname)` → chokidar ignorava il file prima ancora di watcharlo.
2. **`change` function** (riga ~73): `if (isMarkdown) { ... }` → anche se il change fosse arrivato, veniva ignorato.

Il design originale era pensato per watcher di *directory* (dove filtrare i non-markdown ha senso per non spammare eventi). Ma per file singoli (`type === 'file'`) bisogna watchare qualsiasi estensione, perché l'utente può aprire `.js`, `.txt`, `.json`, ecc.

**Fix applicato:**
- `ignored`: aggiunto `if (type === 'file') return false` → file singoli non filtrati per estensione.
- `change`: rimosso `if (isMarkdown)` → qualsiasi file di testo viene caricato e inviato via `mt::update-file`.

**File:** `src/main/filesystem/watcher.js`

**⚠️ Da testare:** il prompt funziona ora per file `.js`/`.txt`? Testare anche con file `.md` per non regressioni. Log diagnostici `[WATCH-DBG]` ancora attivi in `watcher.js` e `windowManager.js` — rimuovere dopo verifica.

---

## Bug B3 — File ANSI con accenti → mojibake + encoding errato (UTF-8) ✅ FIXATO

**Sintomo:** file salvato da Notepad++ come ANSI con carattere accentato (es. "è") → aperto in MarkText → testo corrotto (`?`) e status bar mostra UTF-8 invece di ANSI/windows-1252.

**Diagnosi con log (console processo main, NON DevTools):**
```
[ENC-DBG] ced loaded: true           ← ced carica correttamente su Windows
[ENC-DBG] ced raw result: ASCII       ← PROBLEMA: ced dice ASCII anche con byte > 0x7F
[ENC-DBG] ced raw result: ASCII-7-bit ← stessa cosa su file leggermente diverso
[ENC-DBG] final encoding: utf8        ← fallback a utf8 → mojibake
```

**Root cause:** `ced` (Compact Encoding Detection di Google) usa rilevamento statistico su un campione di byte. Per file molto piccoli (< ~100 byte, come file di test con "ciao\nciao2è") non ha abbastanza dati → si arrende e restituisce `ASCII` o `ASCII-7-bit`. La mappatura in `CED_ICONV_ENCODINGS` converte `ASCII` e `ASCII-7-bit` a `utf8`. Risultato: `iconv-lite` decodifica byte Windows-1252 come UTF-8 → caratteri corrotti.

**Fix applicato in `encoding.js`:**
1. Aggiunta funzione `isValidUtf8(buffer)` — scansiona il buffer e verifica che ogni sequenza di byte sia UTF-8 legale.
2. Dopo che ced restituisce un encoding mappato a `utf8`: se il buffer contiene byte > 0x7F (`hasNonAscii`) **e** `isValidUtf8` restituisce `false` → encoding cambiato a `windows-1252` (ANSI Western Europe, il caso più comune su Windows).

**Logica:** se ced non ha abbastanza byte per decidere (dice ASCII ma ci sono byte alti) → l'unica discriminante affidabile è la validità UTF-8. UTF-8 valido → utf8. UTF-8 non valido → windows-1252 (assunzione ragionevole su Windows).

**File:** `src/main/filesystem/encoding.js`

**⚠️ Da testare:**
- File ANSI con "è" (Windows-1252 0xE8) → MarkText mostra "è" correttamente, status bar mostra `windows-1252`.
- File UTF-8 senza BOM con accenti → ancora decodificato come UTF-8 (non regressione).
- File UTF-8 con BOM → BOM detection ha precedenza, non influenzato.
- Log `[ENC-DBG]` ancora attivi — rimuovere dopo verifica.

---

## Bug B4 — Selezione temi scuri poco visibile ✅ FIXATO

**Fix:** aumentato alpha `--selectionColor` nei temi scuri:
- `dark.theme.css`: `0.3` → `0.55`
- `one-dark.theme.css`: `60` (hex) → `bb`
- `material-dark.theme.css`: `0.2` → `0.45`

---

## Bug B5 — Zoom Ctrl+Plus / Ctrl+- non funzionano ✅ FIXATO

**Fix:** aggiunti acceleratori `Ctrl+Plus` e `Ctrl+-` per `window.zoomIn` e `window.zoomOut`
in `keybindingsWindows.js` e `keybindingsLinux.js` (erano vuoti `''`).

---

## Bug B6 — Ctrl+Z cross-tab + contaminazione source mode / history su close ✅ FIXATO

**Sintomi (correlati, stessa root cause):**
1. Premere Ctrl+Z in Untitled dopo aver chiuso una tab source mode → ripristina il testo della tab chiusa.
2. Chiudere una tab in source mode (file .js, ecc.) senza salvare → Untitled passa a source mode.
3. Bollino "non salvato" compare su Untitled dopo la chiusura.

**Root cause 1 — `CLOSE_TABS` senza `_applySourceCodeForFile`:**
`CLOSE_TABS` (path reale per "Discard" su unsaved close: `mt::save-and-close-tabs` → main dialog → `mt::force-close-tabs-by-id` → `CLOSE_TABS`) non chiamava `_applySourceCodeForFile` sul nuovo `currentFile`. Risultato: `sourceCode` restava `true` (dal file chiuso) → Untitled apriva in CodeMirror, `editor.vue` skippava il caricamento Muya, la history CM della tab chiusa finiva in Untitled.

**Root cause 2 — `sourceCode.vue` `handleFileChange` senza guard `sourceCode=false`:**
Con `sourceCode=false` già impostato ma Vue non ancora smontato (DOM update asincrono), il `bus.emit('file-changed', ...)` per la nuova tab arrivava a `sourceCode.vue` ancora montato. `handleFileChange` lo processava, cambiava `tabId` e salvava contenuto errato in `cmStatePerTab`, causando poi un emit spurio in `onBeforeUnmount`.

**Root cause 3 — Muya usava `id: 'muya'` fisso:**
`editor.vue` passava sempre `id: 'muya'` al listener `on('change')` di Muya. Il guard in `LISTEN_FOR_CONTENT_CHANGE` (`id !== 'muya' && currentId !== id`) veniva bypassato → la dirty logic girava su `this.currentFile` anche se era una tab diversa da quella Muya stava processando → bollino su Untitled.

**Fix 1** — `src/renderer/src/store/editor.js` (`CLOSE_TABS`, riga ~930):
Aggiunto `this._applySourceCodeForFile(this.currentFile)` prima di `bus.emit('file-changed', ...)`, identico a `FORCE_CLOSE_TAB` e `UPDATE_CURRENT_FILE`.

**Fix 2** — `src/renderer/src/components/editorWithTabs/sourceCode.vue` (`handleFileChange`, riga ~145):
Aggiunto `if (!sourceCode.value) return` all'inizio — impedisce di processare eventi quando `sourceCode=false` (componente in smontaggio).

**Fix 3** — `src/renderer/src/components/editorWithTabs/sourceCode.vue` (`onBeforeUnmount`, riga ~572):
`bus.emit('file-changed', ...)` emesso solo se `currentTab.value?.id === tabId.value` (view switch: stesso file, toggle source↔markdown). Per tab close/switch, l'emit è soppresso.
Aggiunto anche `cmStatePerTab.delete(tabId.value)` per tab chiuse (cleanup memoria).

**Fix 4** — `src/renderer/src/components/editorWithTabs/editor.vue` + `src/renderer/src/store/editor.js`:
- `editor.vue`: aggiunto `currentMuyaTabId = ref(null)`, aggiornato in `setMarkdownToEditor` e `handleFileChange`; il listener Muya `on('change')` usa `currentMuyaTabId.value || 'muya'` invece di `'muya'` fisso.
- `editor.js` (`LISTEN_FOR_CONTENT_CHANGE`): spostato `LOAD_SETTLE_MS = 400` all'inizio funzione; nel path "background tab" aggiunto check `justLoaded` per aggiornare `tab.originalMarkdown` durante la finestra di settle.

---

## Bug B8 — Bollino "non salvato" riappare ~1s dopo Ctrl+S in source mode ✅ FIXATO

**Sintomo:** Ctrl+S in source mode → bollino scompare → riappare dopo ~1s e non va più via.

**Root cause:** `FILE_SAVE` legge `this.currentFile.markdown` dal Pinia store, aggiornato da
`LISTEN_FOR_CONTENT_CHANGE` con debounce di 1s (commitTimer in `listenChange`). Se Ctrl+S viene
premuto entro 1s dall'ultimo keystroke, lo store ha contenuto stale M (non ancora aggiornato con M+X).
Il salvataggio avviene su M → `originalMarkdown = M`, `isSaved = true` → bollino scompare.
1s dopo, il commitTimer scatta con il contenuto CM reale (M+X) → `M+X ≠ originalMarkdown (M)` →
`isSaved = false` → bollino riappare.

**Fix:** `FILE_SAVE` e `FILE_SAVE_AS` emettono `bus.emit('pre-save')` prima di leggere `tab.markdown`.
`sourceCode.vue` ascolta `pre-save` con `handlePreSave`: cancella il commitTimer e chiama
`LISTEN_FOR_CONTENT_CHANGE` sincronamente con il contenuto CM corrente. mitt è sincrono →
quando `FILE_SAVE` legge `tab.markdown`, il valore è già quello reale.

**File:** `src/renderer/src/store/editor.js` (FILE_SAVE, FILE_SAVE_AS),
`src/renderer/src/components/editorWithTabs/sourceCode.vue` (handlePreSave)

---

## Bug B9 — Bollino riappare al click cursore in source mode (senza modifiche) ✅ FIXATO

**Sintomo:** in source mode, dopo aver salvato, cliccare su una riga diversa fa ricomparire il bollino
"non salvato" anche senza aver modificato nulla. A volte non si azzera più.

**Root cause:** check N12 in `cursorActivity` confronta `cm.getValue()` (raw, con trailing newlines)
con `currentTab.value.originalMarkdown` (già normalizzato da `adjustTrailingNewlines` in editor.js).
Quando `trimTrailingNewline=1` (singolo `\n` finale) o `=0` (nessun `\n` finale), il CM ha contenuto
grezzo (es. `"foo\n\n"`) ma `originalMarkdown` ha il valore normalizzato (`"foo\n"` o `"foo"`).
N12 vede divergenza anche senza modifiche → `isSaved=false` immediato.

**Fix (aggiornato dopo debug):** root cause reale = lightTouch (`default=true`). `getMarkdownForSave`
restituisce `mergeWithOriginal(tab.markdown, OLD)` = M (preserva formattazione originale). M ≠ tab.markdown
in contenuto interno (blank lines, spazi). `mt::tab-saved` impostava `originalMarkdown = M`. N12 e LFC
confrontavano `normalizeMarkdown(cm.getValue()) = tab.markdown` vs `M` → mismatch → `isSaved=false` →
autoSave → loop infinito.

**Fix reale:** in `mt::tab-saved` e `mt::set-pathname`, quando `tab.markdown ≠ savedMarkdown` ma
`normalizeBlock(tab.markdown) === normalizeBlock(savedMarkdown)` (lightTouch ha solo cambiato
formattazione, non contenuto semantico): `isSaved=true` e `originalMarkdown = tab.markdown`
(non savedMarkdown). N12 e LFC confrontano contro tab.markdown → sempre apples-to-apples.

Fix N12 con `normalizeMarkdown` mantenuto (risolve anche edge case trailing newlines).

**File:** `src/renderer/src/store/editor.js` (mt::tab-saved, mt::set-pathname),
`src/renderer/src/components/editorWithTabs/sourceCode.vue` (normalizeMarkdown + N12)

**✅ Testato e verificato (2026-05-30):**
- [x] Salvare file → cliccare su righe diverse → bollino NON ricompare
- [x] Digitare testo, Ctrl+S immediatamente (< 1s) → bollino NON riappare
- [x] Digitare testo, aspettare 2s, Ctrl+S → bollino scompare e non riappare
- [x] lightTouch ON (default): nessun loop autoSave

---

## Bug B10 — Ctrl+Shift+↑/↓ non estende la selezione in Muya ✅ FIXATO

**Sintomo:** in modalità Muya (WYSIWYG), `Shift+↑/↓` estende correttamente la selezione, ma
`Ctrl+Shift+↑/↓` non fa nulla (nessuna estensione cross-block).

**Comportamento atteso (standard Windows):** `Ctrl+Shift+↑` estende la selezione al blocco/paragrafo
precedente; `Ctrl+Shift+↓` al blocco/paragrafo successivo.

**Root cause:** `arrowHandler` in `arrowCtrl.js` esce early per qualsiasi `event.shiftKey` (incluso
`Ctrl+Shift`) senza `preventDefault`, lasciando al browser la gestione. Il browser gestisce `Shift+↑/↓`
natively ma `Ctrl+Shift+↑/↓` cerca di saltare al paragrafo precedente via API nativa, che non funziona
tra i blocchi separati di Muya.

**Fix:** aggiunto handler esplicito in `arrowHandler` PRIMA dell'early return per `shiftKey`:
- Intercetta `event.ctrlKey && event.shiftKey && (ArrowUp | ArrowDown)`
- Legge `anchor` e `focus` correnti da `selection.getCursorRange()`
- Trova il blocco precedente/successivo partendo dal focus corrente (`findPreBlockInLocation` / `findNextBlockInLocation`)
- Chiama `selection.setCursorRange({ anchor, focus: newFocus })` per aggiornare la selezione DOM
- Aggiorna `this.cursor` e chiama `this.muya.dispatchSelectionChange()`

**File:** `src/muya/lib/contentState/arrowCtrl.js`

**✅ Testato e verificato:**
- [x] Muya: cursore in un paragrafo, `Ctrl+Shift+↑` → selezione si estende al paragrafo precedente
- [x] Muya: cursore in un paragrafo, `Ctrl+Shift+↓` → selezione si estende al paragrafo successivo
- [x] Muya: da metà riga, `Ctrl+Shift+↑` → seleziona testo rimanente riga corrente + riga sopra
- [x] Muya: con selezione esistente via `Shift+←/→`, poi `Ctrl+Shift+↑/↓` → concatenazione funziona (fix shownFloat intercept)
- [x] Muya: a inizio documento, `Ctrl+Shift+↑` → nessun crash
- [x] Muya: a fine documento, `Ctrl+Shift+↓` → nessun crash
- [x] `Shift+↑/↓` normale continua a funzionare (no regressione)

---

## Bug B7 — Spazio vuoto a destra nelle tab con filename corto ✅ FIXATO

**Sintomo:** le tab con filename corto (es. "a.md", "test.js") mostrano spazio vuoto a destra della X. Le tab Untitled ("Untitled" ≈ 8 char) non mostrano il problema.

**Causa:** `.v2-tab` ha `min-width: 88px` ma `.v2-tab-name` non aveva `flex-grow`. Se il contenuto della tab (left-pad + nome + gap + X + right-pad) è inferiore a 88px, lo spazio eccedente restava vuoto a destra — `justify-content: flex-start` accumula lo spazio dopo l'ultimo elemento (la X). "Untitled" (≈91px) supera la soglia; filename corti no.

**Fix** — `src/renderer/src/components/editorWithTabs/tabs.vue` (riga ~823):
Aggiunto `flex-grow: 1` su `.v2-tab-name`. Il nome riempie lo spazio disponibile → X sempre al bordo destro del tab pill, nessuno spazio vuoto. Il `min-width: 0` preesistente garantisce che il nome possa anche ridursi (ellipsis) quando il tab è a `max-width: 172px`.

---

## Bug B6 — Test ✅ verificati

- [x] Chiudere tab source mode (file .js) senza salvare → Untitled resta in markdown mode
- [x] Bollino NON compare su Untitled dopo la chiusura
- [x] Ctrl+Z in Untitled NON ripristina testo della tab chiusa
- [x] Tab switch source→markdown sullo stesso file (view switch) ancora funzionante

## Bug B7 — Test ✅ verificati

- [x] Tab con filename corto ("a.md", "t.js") → X al bordo destro, nessuno spazio vuoto
- [x] Tab Untitled → invariata
- [x] Tab con filename lungo (max-width 172px) → ellipsis ancora funzionante

## Task 6 — Zoom solo testo
- [ ] Ctrl+rotella sull'editor → cambia SOLO la dimensione del testo
- [ ] La title bar NON cambia dimensione
- [ ] La tab bar NON cambia dimensione
- [ ] Funziona sia in markdown (Muya) sia in source mode (CodeMirror)
- [ ] Bottone "reset zoom" della status bar riporta lo zoom al 100%
- [ ] La status bar mostra la percentuale di zoom coerente
- [ ] Dopo lo zoom in source mode, il cursore/click su riga resta allineato (CodeMirror refresh ok)
- [ ] Verificare che lo zoom nativo di pagina sia davvero soppresso (nessun doppio scaling)
