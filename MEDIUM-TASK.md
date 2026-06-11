# MEDIUM-TASK — Storico sezione "Medio" + bug tab bar resize (BUG-1/BUG-2)

> **Scopo.** Registro di cosa è stato fatto/pianificato per i task *Medio* di `TODO.md` + il medio-facile T-ME,
> e lo storico COMPLETO del bug resize tab bar (BUG-1, 6 round di fix — le lezioni stanno nelle invarianti).
> Per le invarianti editor (Muya/source, dirty, save, watcher) → `EASY-TASK.md`. Per UI v2 / tab bar /
> `markRaw` / drag → `DESIGN-TASK.md`. Per ricerca / `isMarkdownPath` → `MEDIUM-EASY-TASK.md`.
> Regole obbligatorie (grep call-site, IPC, bus, keybinding, CSS) → `CLAUDE.md`.

## Stato task

| Task | Stato | Note |
|---|---|---|
| T-M1 — Mode CM per estensione | 🆕 pianificato (FOUNDATIONAL, fare per primo) | sblocca M2/M3/M4 |
| T-M2 — Commenti `Ctrl+/` (source) | 🆕 pianificato | richiede T-M1 |
| T-M3 — Fold/unfold (source) | 🆕 pianificato | beneficia di T-M1 |
| T-M4 — Indentazione automatica | 🆕 pianificato, **chiedere conferma** | valore reale solo post T-M1 |
| T-M5 — .html/.htm → browser (`Ctrl+Shift+O`) | 🆕 pianificato | indipendente |
| T-M6 — Auto-switch source per file grandi | 🆕 pianificato | soglia da Preferences |
| T-M7 — Markdown solo per .md | ✅ già di fatto | `isMarkdownPath` |
| T-M8 — Trova in tutti i file aperti | ✅ già fatto (= T4B) | `MEDIUM-EASY-TASK.md` |
| T-M9 — Find & Replace potenziato | ✅ già fatto | case/word/regex presenti |
| T-M10 — Fix grafica impostazioni | ⏸️ bloccato | serve screenshot utente |
| T-ME — Controlli finestra macOS | ✅ implementato | **verifica visiva su Mac pendente** |
| BUG-1 — Resize tab bar (clipping/re-wrap) | ✅ **RISOLTO e verificato (2026-06-10)** | fix 1d+1e+1f, vedi storico |
| BUG-2 — (mac) semaforo non centrato | ✅ fix applicato | `trafficLightPosition`, **tarare su Mac** |
| BUG-3 — (mac) tab single-row più basse del semaforo | ✅ fix applicato (2026-06-12) | shift up + tab più sottili, gated `.is-osx:not(.has-multirow)`, vedi §dedicata |
| T-ME2 — Hint freccetta "espandibile" multi-row | ✅ implementato (2026-06-12) | chevron blink ~2s poi svanisce, vedi §dedicata |

## Decisioni utente (LOCKED — non richiedere)

- **T-M1**: sì, ma riusando l'infrastruttura CM già presente (no implementazione manuale linguaggi).
- **T-M6**: soglia **configurabile da Preferences**, no costante hardcoded.
- **T-M5**: shortcut dedicata (no voce menu da sola); i non-.md restano editabili in source.
- **T-ME**: codice dietro `isOsx`, zero regressioni Win/Linux, verifica reale rimandata (sviluppo su Windows).
- **T-M10**: rimandato a sessione dedicata con screenshot.

---

## ⚠️ Invarianti tab bar / layout (imparate da BUG-1 — LEGGERE PRIMA di toccare `tabs.vue` o il layout)

1. **NON convertire `.v2-topright` da `absolute` a in-flow; NON rimuovere la riserva `padding-right` dinamica**
   (fix 1c provato e revertato: topright spinto fuori finestra, ultima tab tagliata). Il design absolute è load-bearing.
2. **Loop min-content (fix 1f, root cause finale):** qualsiasi elemento con larghezza FISSATA da JS (l'`ul` della
   tab bar) propaga min-content via `min-width:auto` dei flex-item antenati → la colonna smette di seguire la
   finestra e sborda (tab bar E status bar tagliate), e `clientWidth` misurato resta ≥ del proprio output → la
   detection non demota mai (feedback loop). Guardie attive: `.editor-middle { min-width: 0 }` (`app.vue`) +
   clamp `tabbarClientW = Math.min(tabbarEl.clientWidth, document.documentElement.clientWidth)` (`tabs.vue`).
   **Non rimuovere nessuna delle due.** Diagnosi rapida se "non si restringe più": confrontare
   `.v2-tabbar.clientWidth` vs `window.innerWidth` (devono coincidere).
3. **Detection two-pass stato-indipendente (fix 1e):** il topright cambia width con lo stato (slot
   `.v2-topright-dynamic` 0↔158 via `.topright-expanded`) → MAI usare `topRightEl.offsetWidth` grezzo nel calcolo.
   Pattern: `baseTopRight = offsetWidth − dynEl.offsetWidth`; pass 1 decide `multiRow` con `padSingle`
   (soglia unica nei due versi = niente isteresi); pass 2 ricalcola riga 1 con `padMulti`; il `paddingRight`
   committato è quello dello stato FINALE. Un run produce sempre lo stato corretto (no convergenza multi-frame).
4. **Lock defer-not-drop (fix 1e):** il gate `layoutLockUntil` NON deve perdere update (`return` secco =
   stato finale sbagliato congelato a fine resize). `lockRetryTimer` rischedula a lock scaduto. Cleanup in
   `onBeforeUnmount`. Il retry 170ms del watcher `hasMultiRow` è ridondante ma lasciato come cintura.
5. **Costanti JS↔CSS da tenere in sync** (`updateTabRowsLayout`): `158` = `.topright-expanded .v2-topright-dynamic`
   width · `26` = `.v2-tab-new-li` width · `10` = `.v2-topright right` · `12` = HOVER_BUFFER · `6` = padding ul ·
   `3` = gap. Se cambi il CSS, aggiorna il JS (e viceversa).
6. **Slot dinamico collassato in single-row è il design corrente** (`width:0`, `158px` solo `.topright-expanded`):
   non riservare i 158px a finestra stretta è voluto (era il fix 1b, oggi parte integrante del design + gestito
   dal two-pass). Width fissa nello stato espanso = invariante B14c (no shift riga 1 quando il clone appare/sparisce).
7. **`minWidth` finestra** (`config.js`: `isOsx ? 780 : 820`): col costruttore + `useContentSize:true` + `frame:false`
   NON è affidabile → serve `win.setMinimumSize(...)` esplicito post-`new BrowserWindow` (`windows/editor.js:~80`).
   `config.js` è main → restart `npm run dev`. Formula: `5×tab(88) + 4×gap + ul-pad + topright + buffer [+78 mac]`.
8. Il check "+" inline (fix 1d) usa `while (row1Count > 1)` → garantisce ≥1 tab in riga 1. Il "+" è absolute
   (fuori flex flow), left calcolato da JS, esiste solo in single-row (in multi-row è nel topright).
9. **macOS single-row tab shift (BUG-3)** (`.v2-tabbar.is-osx:not(.has-multirow)`): tab alzate
   (`transform: translateY(-5px)` sulla `ul.v2-tabs`) + più sottili (`height:25px`) per allinearle al
   semaforo. `transform` scelto APPOSTA = non altera `offsetWidth`/`offsetTop` → wrap intatto; agendo
   sulla `ul` muove anche il "+" (absolute relativo alla ul). **NON toccare `trafficLightPosition`**
   (allinea già il multi-row). Gated `is-osx` + `:not(.has-multirow)` → Win/Linux e multi-row invariati.
10. **Hint freccetta multi-row (T-ME2)** (`.v2-multirow-hint`): l'arrow ha `opacity:0` di BASE ed è
   load-bearing (anti-flash: tolta l'animazione su hover non deve riapparire mentre il wrapper sfuma).
   Offset orizzontale `85px = (DYN_SLOT_W 158 + HOVER_BUFFER 12)/2` da tenere in **sync col JS**
   (invariante 5). Delay `0.5s` SOLO in entrata (= attesa collasso bar) — NON metterlo in uscita.
   `pointer-events:none` obbligatorio (non interferire con hover-expand/drag).

---

## Piano implementativo task aperti (compresso — anchor possono shiftare, ri-grep)

### T-M1 — Mode CM per estensione (fare per primo)
Oggi `sourceCode.vue:718` forza `setMode(cm,'markdown')` per TUTTO. Infrastruttura già pronta in
`codeMirror/index.js`: `mode/meta` (riga 8, `findModeByFileName`), `loadmode` (19, `autoLoadMode`), `modeURL` (86,
**già provato funzionante** per i code-fence Muya in dev e prod). Fix: helper `setModeForFile(cm, filename)` accanto a
`setMode` (186): `info = findModeByFileName` → `cm.setOption('mode', info.mime)` + `autoLoadMode(cm, info.mode)`;
fallback `'markdown'` (untitled/sconosciute). Chiamarlo: (a) al posto della riga 718; (b) in `handleFileChange`
(riga 149 — l'evento NON porta pathname → `editorStore.tabs.find(t => t.id === id)?.pathname`). L'istanza CM è
RIUSATA tra tab (`<source-code>` senza `:key`) → riapplicare ad ogni caricamento, non solo al mount.
Test pre-volo: code-fence ```js in un .md evidenzia? → modeURL ok. Import nuovi → pulire `node_modules/.vite/deps/`.

### T-M2 — Commenti `Ctrl+/` (post T-M1)
`codeMirror/index.js`: `import 'codemirror/addon/comment/comment'`. `sourceCode.vue` `extraKeys` (~656, dentro
`normalizeKeyMap`): `'Ctrl-/': 'toggleComment'`. `Ctrl+/` verificato LIBERO su 3 OS (non a menu → arriva a CM,
mode-aware gratis: in Muya nessun effetto). Sintassi commento dal mode (T-M1): `//`, `#`, `<!-- -->`.

### T-M3 — Fold/unfold (post T-M1)
Import addon: `fold/foldcode`, `fold/foldgutter` (+css), `brace-fold`, `comment-fold`, `markdown-fold`,
`xml-fold` (richiesto da markdown-fold), `indent-fold`. Config CM (~644): `foldGutter:true`,
`foldOptions:{rangeFinder: CodeMirror.fold.auto}`, `gutters:['CodeMirror-linenumbers','CodeMirror-foldgutter']` —
⚠️ SENZA `CodeMirror-linenumbers` nell'array i numeri riga SPARISCONO. ⚠️ `Ctrl+Q` (default fold CM) è OCCUPATO
(`file.quit`) → solo click sul gutter. Verificare colore frecce sui temi scuri (`.CodeMirror-foldgutter`).

### T-M4 — Indentazione automatica (post T-M1, chiedere conferma)
`indentAuto` = comando CM built-in. NO shortcut nuova (scarsità su Win, evitare `Ctrl+Alt+*`=AltGr): voce menu
(`templates/edit.js`) o context-menu → bus → handler guardato in `sourceCode.vue` (pattern `handleFormatInSource`,
~355) → `editor.value.execCommand('indentAuto')`.

### T-M5 — .html/.htm nel browser (`Ctrl+Shift+O`)
Clonare 1:1 la catena `edit.find-in-folder`: `menu/actions/edit.js` `openInBrowser(win)→edit(win,'openInBrowser')`
→ `mt::editor-edit-action` → `listenForMain.js EDITOR_EDIT_ACTION`: branch `openInBrowser` PRIMA del fallback
`bus.emit` → se `currentFile.pathname` finisce in .html/.htm → `ipcRenderer.send('mt::open-file-in-browser', pathname)`
(else no-op). Main (`menu/actions/file.js`, `shell` già importato ~480): `ipcMain.on` → guard estensione →
`shell.openExternal(pathToFileURL(pathname).href)` (NON `openPath`: aprirebbe l'app associata, non il browser).
Wiring: grep `EDIT_FIND_IN_FOLDER` e mirrorare (constants, descriptions, templates, actions, keybindings×3).
⚠️ `Ctrl+Shift+B` OCCUPATO (`view.toggle-tabbar`); `Ctrl+Shift+O` verificato libero su 3 OS. Guardia
solo-nell'azione (niente enable/disable voce menu). Testare path con spazi.

### T-M6 — Auto-switch source per file grandi
Preferenza `maxFileSizeForWysiwyg` (MB, default 2) — ⚠️ NON riusare `maxFileSize` (schema.json:360, è del searcher).
**3 punti tutti necessari**: `schema.json` + `static/preference.json` (duplica i default) + `store/preferences.js`
state ESPLICITO (altrimenti `undefined` nel renderer) + campo UI in `prefComponents/editor/`.
`fileSize: buffer.length` nel rawDocument di `loadMarkdownFile` (buffer già letto, NO fs.stat; additivo — il
watcher è caller, non rompere). Propagazione: `store/help.js` `defaultFileState` + `createDocumentState`.
Decisione SOLO in `_applySourceCodeForFile`: `wantSource = !isMarkdownPath(...) || (fileSize > soglia)`.
Toggle manuale Ctrl+E resta libero (scelta utente). Untitled → `fileSize 0` → invariato.

### T-ME — Controlli finestra macOS (FATTO, verifica su Mac pendente)
`tabs.vue`: 3 bottoni win + separatore dentro `<template v-if="!isOsx">`; `.v2-tabbar.is-osx { padding-left:78px }`
(semaforo nativo); `leftPad` sottratto nel calcolo layout. Config main già pronta (`hiddenInset`, logica Windows
gated `if (!isOsx)`). Listener IPC `mt::window-maximize/unmaximize` lasciati (innocui, simmetria on/off).

---

## Storico BUG-1/BUG-2 (causa → fix → file)

**BUG-1 — resize tab bar: tabs non re-wrappavano, controlli destri clippati, comportamento non-deterministico.**
Risolto in 6 round (2026-06-09/10), 3 cause INDIPENDENTI e cooperanti:

| Round | Cosa | Esito |
|---|---|---|
| 1b | collasso slot dinamico `width:158→0` in single-row | insufficiente da solo; oggi parte del design (invariante 6) |
| 1c | `.v2-topright` in-flow + rimozione riserva padding-right | ❌ ROTTO e revertato — MAI ripetere (invariante 1) |
| minWidth | `config.js` `minWidth: isOsx?780:820` + `win.setMinimumSize` (gotcha Electron, invariante 7) | ✅ riduce la zona-bug |
| 1d | causa A: il calcolo wrap ignorava il "+" inline (absolute) → overlap col topright in una fascia di ~23px senza mai wrappare | ✅ check "+" post-loop, demote ultima tab (`tabs.vue`) |
| 1e | causa B: detection stato-dipendente (topright 173↔331) → isteresi + 1° frame post-flip con padding stale + lock che PERDEVA gli update (return secco) → non-determinismo timing-dependent | ✅ two-pass `padSingle`/`padMulti` + `baseTopRight` normalizzata + lock defer-not-drop (`tabs.vue`) |
| 1f | causa C (root finale, da log runtime): loop min-content — `.editor-middle` senza `min-width:0` non scendeva sotto `ulW+padding` → finestra sbordata su tutta l'altezza e `clientWidth` mai sotto il proprio output → mai demozione. Lento=sempre KO, veloce=quasi ok (demozione poteva avvenire prima che il pavimento superasse la finestra) | ✅ `.editor-middle{min-width:0}` (`app.vue`) + clamp viewport (`tabs.vue`) (invariante 2) |

Metodo diagnostico che ha chiuso 1f: log `[TB2]` con dump `{cw, trW, dynW, base, padS, padM, multi, row1, ulW}`
ad ogni run → confronto `cw:887` vs `window.innerWidth:820` = smoking gun. Riusare lo stesso pattern in futuro.

**BUG-2 — (mac) traffic lights non centrati con tab bar single-row.** Y fissa OS vs centro tab più basso.
Fix: `config.js` `...(isOsx ? { trafficLightPosition: { x: 18, y: 12 } } : {})` mantenendo `hiddenInset`
(compatibili, verificato doc Electron). `y=12` centra bottoni ~16px in bar 40px; allineato alla prima riga anche
in multi-row. **Da tarare visivamente su Mac** (main → restart dev). Win/Linux: config byte-identica.

---

## Tab bar — rifiniture mac single-row (BUG-3) + hint multi-row (T-ME2) (2026-06-12)

> CSS/template puri in `tabs.vue`, additivi, gated per stato/OS. Nessun JS layout toccato
> (detection wrap intatta). HMR-only (no restart). Lezioni → §Invarianti 9-10.

**BUG-3 — (mac) tab single-row non allineate col semaforo.** In single-row la `ul.v2-tabs`
(`align-items:center`, `min-height:40px`) centra la riga → centro tab ~24-25px, **più in basso** del
semaforo nativo. Quest'ultimo (`trafficLightPosition y=12`) era tarato sulla PRIMA riga MULTI-row,
dove la `ul` overflowa e la riga 1 sta in alto (~19px) → in multi-row erano già allineate, in
single-row no. Fix CSS-only gated `.v2-tabbar.is-osx:not(.has-multirow)` (decisione utente: shift
SOLO sulle tab, ⌘/📂 restano fermi — lieve asimmetria a destra accettata):
- `ul.v2-tabs { transform: translateY(-5px) }` — alza riga + "+" insieme; `transform` = leva visiva,
  NON altera `offsetWidth`/`offsetTop` → detection wrap intatta.
- `.v2-tab { height: 25px }` (da 28) — leggermente più sottili.
**`trafficLightPosition` NON toccato** (romperebbe l'allineamento multi-row). Win/Linux: `is-osx`
assente → zero impatto. Tarabili: `translateY(-5px)`, `height:25px`, `top` del semaforo invariato.

**T-ME2 — Hint freccetta "espandibile" multi-row.** Chevron giù che invita a espandere la tab bar
quando ci sono righe nascoste. Elemento `.v2-multirow-hint` (+ svg `.v2-multirow-hint-arrow`) dentro
`.v2-tabbar-scroll`. Visibilità 100% via CSS dalle classi `has-multirow`/`tabs-hovered`:
- Visibile SOLO in `.v2-tabbar.has-multirow:not(.tabs-hovered)` (multi-row collassato).
- **Due layer anti-conflitto**: wrapper = fade (`transition` opacity); arrow = blink + svanimento
  (`animation`). Arrow `opacity:0` di BASE → tolta l'animazione (hover/fine) resta invisibile →
  niente flash (era il bug: senza base 0, l'arrow tornava a opacity 1 mentre il wrapper sfumava).
- **Sequenza**: bar collassa (`max-height 0.5s`) → delay `0.5s` (su wrapper `transition-delay` in
  ENTRATA + su `animation-delay`, sincronizzati → appare solo a bar collassata, non durante il
  collasso) → blink ~2s (keyframe opacity, 2 dip) → fade-out a 0 (`animation-fill-mode: forwards` →
  resta invisibile). Riparte a ogni ri-collasso. In uscita (espansione) nessun delay → sparisce subito.
- **Centraggio orizzontale**: dentro lo scroll (= solo tabs) + offset `translateX(calc(-50% + 85px))`
  per includere la zona clone/"+" (`.v2-topright-dynamic`) ed ESCLUDERE ⌘/📂 (+ controlli finestra su
  Win). `85 = (DYN_SLOT_W 158 + HOVER_BUFFER 12)/2`, esatto e cross-OS (baseTopRight/leftPad/clientWidth
  si annullano nel calcolo). ⚠️ Sync JS↔CSS con `updateTabRowsLayout` (invariante 5).
- Colore `var(--v2-accent)` (= accent della tab clone). `pointer-events:none` → non tocca hover/drag.
  `.v2-tabbar-scroll { position:relative }` aggiunto come anchor (non tocca il "+", ancorato alla `ul`).
Tarabili: durata `2.6s` (~0.6s fade finale = salto keyframe 77%→100%), `top: calc(var(--v2-tab-h) − 9px)`,
delay `0.5s` (×2), offset `85px`.

---

## Anchor file (ri-grep prima di editare)

| Cosa | File:riga |
|---|---|
| `updateTabRowsLayout` (two-pass, clamp, check "+") | `components/editorWithTabs/tabs.vue:~375-500` |
| `lockRetryTimer` / `layoutLockUntil` | `tabs.vue:~200, ~378` |
| `.editor-middle { min-width: 0 }` | `pages/app.vue` (style) |
| slot dinamico 0↔158 / `.topright-expanded` | `tabs.vue` (style, ~956/1011) |
| `minWidth` + `trafficLightPosition` | `src/main/config.js`; enforcement `windows/editor.js:~80` |
| `setMode(...,'markdown')` hardcoded (→T-M1) | `sourceCode.vue:718`; `handleFileChange` 149; `extraKeys` 656 |
| `modeURL` / `setMode` / import addon | `codeMirror/index.js:8,19,86,186` |
| `_applySourceCodeForFile` / `isMarkdownPath` | `store/editor.js:721-728`; `util/index.js:172` |
| `loadMarkdownFile` (per `fileSize`) | `src/main/filesystem/markdown.js:91,145-159` |
| pref: schema / default / store esplicito | `preferences/schema.json:185-194`; `static/preference.json:32-33`; `store/preferences.js:6,39-40` |
| `EDITOR_EDIT_ACTION` (template per T-M5) | `store/listenForMain.js:9`; `menu/actions/edit.js:99` |
| `defaultFileState` / `createDocumentState` | `store/help.js:9,148` |
| keybindings (conflitti: Ctrl+Shift+B occupato) | `src/main/keyboard/keybindingsWindows.js:102` (+Linux/Darwin) |
| shift tab mac single-row (BUG-3) | `tabs.vue` style `.v2-tabbar.is-osx:not(.has-multirow) .v2-tabs/.v2-tab` |
| hint freccetta multi-row (T-ME2) | `tabs.vue` template in `.v2-tabbar-scroll`; style `.v2-multirow-hint*` + `@keyframes v2-multirow-hint-blink` |

## Fonti (T-M1, CM5 dynamic mode loading)
- Demo ufficiale lazy-load: https://github.com/codemirror/codemirror5/blob/master/demo/loadmode.html
- `autoLoadMode`/`modeURL`: https://discuss.codemirror.net/t/autoloadmode/2651
- Manuale CM5 (mode/meta, loadmode, comment, fold): https://codemirror.net/5/doc/manual.html
