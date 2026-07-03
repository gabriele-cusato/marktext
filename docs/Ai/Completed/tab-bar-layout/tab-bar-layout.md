# Tab Bar & Layout — Invarianti, BUG-1/2/3, Task Aperti

**Scopo:** documenta la tab bar multi-row v2 con hover-expand, drag, pin tab, invarianti di wrap e layout. Leggere PRIMA di toccare: `tabs.vue`, layout colonna editor, topright, pagina ridimensionamento finestra.

**Origine:** `MEDIUM-TASK.md`, sezioni invarianti e bug fix tab bar (BUG-1 6 round, BUG-2 mac, BUG-3 mac + T-ME2 hint freccetta).

**Quando leggerlo:** resize finestra / tab bar non wrappa / drag tab / layout a più righe / finestra stretta / contenuuti clippati / topright buttons / pin tab.

---

## ⚠️ Invarianti Tab Bar / Layout (Imparate da BUG-1 — LEGGERE PRIMA di Toccare `tabs.vue` o Layout)

### 1. Layout Absolute Topright + Riserva Padding Dinamica

**Regola load-bearing:** NON convertire `.v2-topright` da `absolute` a in-flow; NON rimuovere la riserva `padding-right` dinamica.

Fix 1c provato e revertato: topright spinto fuori finestra, ultima tab tagliata. Il design absolute è load-bearing.

### 2. Loop Min-Content (Fix 1f, Root Cause Finale)

Qualsiasi elemento con larghezza FISSATA da JS (l'`ul` della tab bar) propaga min-content via `min-width:auto` dei flex-item antenati → la colonna smette di seguire la finestra e sborda (tab bar & status bar tagliate), e `clientWidth` misurato resta ≥ del proprio output → la detection non demota mai (feedback loop).

**Guardie attive:**
- `.editor-middle { min-width: 0 }` (`app.vue`) 
- clamp `tabbarClientW = Math.min(tabbarEl.clientWidth, document.documentElement.clientWidth)` (`tabs.vue`)

**Non rimuovere nessuna delle due.** Diagnosi rapida se "non si restringe più": confrontare `.v2-tabbar.clientWidth` vs `window.innerWidth` (devono coincidere).

### 3. Detection Two-Pass Stato-Indipendente (Fix 1e)

Il topright cambia width con lo stato (slot `.v2-topright-dynamic` 0↔158 via `.topright-expanded`) → MAI usare `topRightEl.offsetWidth` grezzo nel calcolo.

**Pattern:** `baseTopRight = offsetWidth − dynEl.offsetWidth`; pass 1 decide `multiRow` con `padSingle` (soglia unica nei due versi = niente isteresi); pass 2 ricalcola riga 1 con `padMulti`; il `paddingRight` committato è quello dello stato FINALE. Un run produce sempre lo stato corretto (no convergenza multi-frame).

### 4. Lock Defer-Not-Drop (Fix 1e)

Il gate `layoutLockUntil` NON deve perdere update (`return` secco = stato finale sbagliato congelato a fine resize). `lockRetryTimer` rischedula a lock scaduto. Cleanup in `onBeforeUnmount`. Il retry 170ms del watcher `hasMultiRow` è ridondante ma lasciato come cintura.

### 5. Costanti JS↔CSS in Sync (`updateTabRowsLayout`)

`158` = `.topright-expanded .v2-topright-dynamic` width · 
`26` = `.v2-tab-new-li` width · 
`10` = `.v2-topright right` · 
`12` = HOVER_BUFFER · 
`6` = padding ul · 
`3` = gap

**Se cambi il CSS, aggiorna il JS (e viceversa).**

### 6. Slot Dinamico Collassato in Single-Row

Slot dinamico collassato in single-row è il design corrente (`width:0`, `158px` solo `.topright-expanded`): non riservare i 158px a finestra stretta è voluto (era il fix 1b, oggi parte integrante del design + gestito dal two-pass). Width fissa nello stato espanso = invariante B14c (no shift riga 1 quando il clone appare/sparisce).

### 7. `minWidth` Finestra

(`config.js`: `isOsx ? 780 : 820`): col costruttore + `useContentSize:true` + `frame:false` NON è affidabile → serve `win.setMinimumSize(...)` esplicito post-`new BrowserWindow` (`windows/editor.js:~80`).

Formula: `5×tab(88) + 4×gap + ul-pad + topright + buffer [+78 mac]`.

### 8. Check "+" Inline

Il check "+" inline (fix 1d) usa `while (row1Count > 1)` → garantisce ≥1 tab in riga 1. Il "+" è absolute (fuori flex flow), left calcolato da JS, esiste solo in single-row (in multi-row è nel topright).

### 9. macOS Single-Row Tab Shift (BUG-3)

`.v2-tabbar.is-osx:not(.has-multirow)`: tab alzate (`transform: translateY(-5px)` sulla `ul.v2-tabs`) + più sottili (`height:25px`) per allinearle al semaforo.

`transform` scelto APPOSTA = non altera `offsetWidth`/`offsetTop` → wrap intatto; agendo sulla `ul` muove anche il "+" (absolute relativo alla ul).

**NON toccare `trafficLightPosition`** (allinea già il multi-row). Gated `is-osx` + `:not(.has-multirow)` → Win/Linux e multi-row invariati.

Tarabili: `translateY(-5px)`, `height:25px`.

### 10. Hint Freccetta Multi-Row (T-ME2)

`.v2-multirow-hint`: l'arrow ha `opacity:0` di BASE ed è load-bearing (anti-flash: tolta l'animazione su hover non deve riapparire mentre il wrapper sfuma).

**Offset orizzontale** `85px = (DYN_SLOT_W 158 + HOVER_BUFFER 12)/2` → **SYNC col JS** (`updateTabRowsLayout`).

**Delay `0.5s` SOLO in entrata** (= attesa collasso bar) — NON metterlo in uscita.

`pointer-events:none` obbligatorio (non interferire con hover-expand/drag).

---

## Storico BUG-1: Resize Tab Bar (6 Round, 2026-06-09/10, ✅ RISOLTO)

**Sintomo:** tabs non re-wrappavano, controlli destri clippati, comportamento non-deterministico.

| Round | Cosa | Esito |
|---|---|---|
| 1b | collasso slot dinamico `width:158→0` in single-row | insufficiente da solo; oggi parte del design (invariante 6) |
| 1c | `.v2-topright` in-flow + rimozione riserva padding-right | ❌ ROTTO e revertato — MAI ripetere (invariante 1) |
| minWidth | `config.js` `minWidth: isOsx?780:820` + `win.setMinimumSize` (gotcha Electron, invariante 7) | ✅ riduce la zona-bug |
| 1d | causa A: il calcolo wrap ignorava il "+" inline (absolute) → overlap col topright in una fascia di ~23px senza mai wrappare | ✅ check "+" post-loop, demote ultima tab (`tabs.vue`) |
| 1e | causa B: detection stato-dipendente (topright 173↔331) → isteresi + 1° frame post-flip con padding stale + lock che PERDEVA gli update (return secco) → non-determinismo timing-dependent | ✅ two-pass `padSingle`/`padMulti` + `baseTopRight` normalizzata + lock defer-not-drop (`tabs.vue`) |
| 1f | causa C (root finale, da log runtime): loop min-content — `.editor-middle` senza `min-width:0` non scendeva sotto `ulW+padding` → finestra sbordata su tutta l'altezza e `clientWidth` mai sotto il proprio output → mai demozione. Lento=sempre KO, veloce=quasi ok (demozione poteva avvenire prima che il pavimento superasse la finestra) | ✅ `.editor-middle{min-width:0}` (`app.vue`) + clamp viewport (`tabs.vue`) (invariante 2) |

**Metodo diagnostico che ha chiuso 1f:** log `[TB2]` con dump `{cw, trW, dynW, base, padS, padM, multi, row1, ulW}` ad ogni run → confronto `cw:887` vs `window.innerWidth:820` = smoking gun. **Riusare lo stesso pattern in futuro.**

---

## BUG-2: (mac) Traffic Lights Non Centrati

Y fissa OS vs centro tab più basso. Fix: `config.js` `...(isOsx ? { trafficLightPosition: { x: 18, y: 12 } } : {})` mantenendo `hiddenInset` (compatibili, verificato doc Electron).

`y=12` centra bottoni ~16px in bar 40px; allineato alla prima riga anche in multi-row. **Da tarare visivamente su Mac** (main → restart dev). Win/Linux: config byte-identica.

---

## BUG-3 + T-ME2: Mac Single-Row + Hint Freccetta (2026-06-12, ✅ Verificati)

### BUG-3 — (mac) Tab Single-Row Non Allineate al Semaforo

In single-row la `ul.v2-tabs` (`align-items:center`, `min-height:40px`) centra la riga → centro tab ~24-25px, **più in basso** del semaforo nativo.

`trafficLightPosition y=12` era tarato sulla PRIMA riga MULTI-row, dove la `ul` overflowa → fix CSS-only gated `.v2-tabbar.is-osx:not(.has-multirow)`:

- `ul.v2-tabs { transform: translateY(-5px) }` — alza riga + "+" insieme
- `.v2-tab { height: 25px }` (da 28) — leggermente più sottili

**`trafficLightPosition` NON toccato** (romperebbe l'allineamento multi-row). Win/Linux: zero impatto. Tarabili: `translateY(-5px)`, `height:25px`.

### T-ME2 — Hint Freccetta "Espandibile" Multi-Row

Chevron giù che invita a espandere la tab bar quando ci sono righe nascoste. Elemento `.v2-multirow-hint` (+ svg `.v2-multirow-hint-arrow`) dentro `.v2-tabbar-scroll`.

**Visibilità:** SOLO in `.v2-tabbar.has-multirow:not(.tabs-hovered)` (multi-row collassato).

**Due layer anti-conflitto:**
- wrapper = fade (`transition` opacity)
- arrow = blink + svanimento (`animation`)

Arrow `opacity:0` di BASE → tolta l'animazione resta invisibile → niente flash.

**Sequenza:**
- bar collassa (`max-height 0.5s`)
- delay `0.5s` (su wrapper `transition-delay` ENTRATA + su `animation-delay`)
- blink ~2s (keyframe opacity, 2 dip)
- fade-out a 0 (`animation-fill-mode: forwards` → resta invisibile)

Riparte a ogni ri-collasso. In uscita nessun delay → sparisce subito.

**Centraggio orizzontale:** dentro lo scroll + offset `translateX(calc(-50% + 85px))` per includere la zona clone/"+" (ESCLUDERE ⌘/📂).

`85 = (DYN_SLOT_W 158 + HOVER_BUFFER 12)/2` — **Sync JS↔CSS con `updateTabRowsLayout`** (invariante 5).

Tarabili: durata `2.6s`, `top: calc(var(--v2-tab-h) − 9px)`, delay `0.5s` (×2), offset `85px`.

---

## Piano Task Aperti

### T-M1 — Mode CM per Estensione (FONDAZIONALE, Fare per Primo)

Sblocca M2/M3/M4. Oggi `sourceCode.vue:718` forza `setMode(cm,'markdown')` per TUTTO. Infrastruttura già pronta in `codeMirror/index.js`: `mode/meta` (riga 8, `findModeByFileName`), `loadmode` (19, `autoLoadMode`), `modeURL` (86, **già provato funzionante**).

**Fix:** helper `setModeForFile(cm, filename)` accanto a `setMode` (186): `info = findModeByFileName` → `cm.setOption('mode', info.mime)` + `autoLoadMode(cm, info.mode)`; fallback `'markdown'`. Chiamarlo: (a) al posto della riga 718; (b) in `handleFileChange` (riga 149 — l'evento NON porta pathname → `editorStore.tabs.find(t => t.id === id)?.pathname`).

L'istanza CM è RIUSATA tra tab (`<source-code>` senza `:key`) → riapplicare ad ogni caricamento.

### T-M2 — Commenti `Ctrl+/` (Post T-M1)

`codeMirror/index.js`: `import 'codemirror/addon/comment/comment'`. `sourceCode.vue` `extraKeys` (~656): `'Ctrl-/': 'toggleComment'`. Verificato LIBERO su 3 OS.

### T-M3 — Fold/Unfold (Post T-M1)

Import addon: `fold/foldcode`, `fold/foldgutter` (+css), `brace-fold`, `comment-fold`, `markdown-fold`, `xml-fold`, `indent-fold`.

Config CM (~644): `foldGutter:true`, `foldOptions:{rangeFinder: CodeMirror.fold.auto}`, `gutters:['CodeMirror-linenumbers','CodeMirror-foldgutter']` — ⚠️ **SENZA `CodeMirror-linenumbers` nell'array i numeri riga SPARISCONO.** ⚠️ `Ctrl+Q` è OCCUPATO (`file.quit`) → solo click sul gutter.

### T-M4 — Indentazione Automatica (Post T-M1, Chiedere Conferma)

`indentAuto` = comando CM built-in. NO shortcut nuova: voce menu (`templates/edit.js`) o context-menu → bus → handler guardato in `sourceCode.vue`.

### T-M5 — .html/.htm nel Browser (`Ctrl+Shift+O`)

Clonare 1:1 la catena `edit.find-in-folder`: menu/actions → `mt::editor-edit-action` → branch `openInBrowser` PRIMA del fallback → se `.html`/`.htm` → `ipcRenderer.send('mt::open-file-in-browser', pathname)` (else no-op).

Main: `ipcMain.on` → guard estensione → `shell.openExternal(pathToFileURL(pathname).href)`.

Wiring: grep `EDIT_FIND_IN_FOLDER` e mirrorare. ⚠️ `Ctrl+Shift+B` OCCUPATO; `Ctrl+Shift+O` verificato libero.

### T-M6 — Auto-Switch Source per File Grandi

Preferenza `maxFileSizeForWysiwyg` (MB, default 2) — ⚠️ NON riusare `maxFileSize` (schema.json:360, è del searcher).

**3 punti tutti necessari:** schema.json + static/preference.json + store/preferences.js state ESPLICITO + campo UI prefComponents/editor/.

`fileSize: buffer.length` nel rawDocument di `loadMarkdownFile`. Propagazione: store/help.js `defaultFileState`. Decisione SOLO in `_applySourceCodeForFile`: `wantSource = !isMarkdownPath(...) || (fileSize > soglia)`.

### T-ME — Controlli Finestra macOS (✅ IMPLEMENTATO)

`tabs.vue`: 3 bottoni win + separatore dentro `<template v-if="!isOsx">`; `.v2-tabbar.is-osx { padding-left:78px }` (semaforo nativo); `leftPad` sottratto nel calcolo layout.

**Verifica su Mac pendente** (sviluppo su Windows).

### T-ME2 — Hint Freccetta Multi-Row (✅ IMPLEMENTATO 2026-06-12)

Vedi sezione BUG-3 + T-ME2 sopra.

---

## Anchor File (Ri-grep Prima di Editare)

| Cosa | File:riga |
|---|---|
| `updateTabRowsLayout` (two-pass, clamp, check "+") | `components/editorWithTabs/tabs.vue:~375-500` |
| `lockRetryTimer` / `layoutLockUntil` | `tabs.vue:~200, ~378` |
| `.editor-middle { min-width: 0 }` | `pages/app.vue` (style) |
| slot dinamico 0↔158 / `.topright-expanded` | `tabs.vue` (style, ~956/1011) |
| `minWidth` + `trafficLightPosition` | `src/main/config.js`; enforcement `windows/editor.js:~80` |
| `setMode(...,'markdown')` hardcoded (→T-M1) | `sourceCode.vue:718`; `handleFileChange` 149 |
| `modeURL` / `setMode` / import addon | `codeMirror/index.js:8,19,86,186` |
| `_applySourceCodeForFile` / `isMarkdownPath` | `store/editor.js:721-728`; `util/index.js:172` |
| `loadMarkdownFile` (per `fileSize`) | `src/main/filesystem/markdown.js:91,145-159` |
| pref: schema / default / store esplicito | `preferences/schema.json:185-194`; `static/preference.json:32-33`; `store/preferences.js:6,39-40` |
| `EDITOR_EDIT_ACTION` (template per T-M5) | `store/listenForMain.js:9`; `menu/actions/edit.js:99` |
| `defaultFileState` / `createDocumentState` | `store/help.js:9,148` |
| keybindings (conflitti) | `src/main/keyboard/keybindingsWindows.js` (+Linux/Darwin) |
| shift tab mac single-row (BUG-3) | `tabs.vue` style `.v2-tabbar.is-osx:not(.has-multirow) .v2-tabs/.v2-tab` |
| hint freccetta multi-row (T-ME2) | `tabs.vue` template in `.v2-tabbar-scroll`; style `.v2-multirow-hint*` |

---

## Fonti (T-M1, CM5 Dynamic Mode Loading)

- Demo ufficiale lazy-load: https://github.com/codemirror/codemirror5/blob/master/demo/loadmode.html
- `autoLoadMode`/`modeURL`: https://discuss.codemirror.net/t/autoloadmode/2651
- Manuale CM5: https://codemirror.net/5/doc/manual.html
