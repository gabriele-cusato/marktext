# DESIGN-TASK — UI v2 (MarkText): cosa è stato fatto + note tecniche

Design di riferimento: `DESIGN/marktext/project/Markdown Editor v2.html` + `editor-v2.jsx`.
8 sessioni (DESIGN-FIX-1→8) + bug fix finali + sessioni drag/tab. Stato: **CONCLUSO**, bug noti risolti.

---

## ⚠️ NOTE TECNICHE IMPORTANTI (le sfumature che fanno rompere tutto — leggere prima di toccare)

- **`markRaw` su CodeMirror**: Vue3 `ref()` deep-proxifica il doc tree di CM → il loop `indexOf` di CM
  confronta raw vs proxy → ritorna -1 → crash su click/cursore. FIX: `editor.value = markRaw(codeMirrorInstance)`.
  Pattern obbligatorio per qualsiasi libreria con stato mutabile (CodeMirror, Three.js, Pixi, Monaco).
- **`_applySourceCodeForFile` timing**: chiamarlo PRIMA di `bus.emit('file-changed')` e con `nextTick` per
  garantire il mount di `sourceCode.vue` prima dell'evento.
- **`justLoaded` flag**: pensato per Muya che normalizza il markdown caricato. Il primo `LISTEN_FOR_CONTENT_CHANGE`
  post-load consuma il flag e sovrascrive `originalMarkdown`. **CodeMirror NON normalizza** → consumare il flag
  rompe la baseline → Ctrl+Z back-to-saved fallisce. Regola: in source disabilitare il flag subito in
  `handleFileChange` post-`setValue`.
- **Magic margin CodeMirror** (`.CodeMirror-scroll { margin-bottom:-50px; padding-bottom:50px; overflow:scroll }`):
  pensato per CM con altezza FISSA + scroll interno. Wrapparlo in una surface scroll esterna fa apparire `.CodeMirror`
  50px più corto → ultime righe non raggiungibili. Regola: lasciar scrollare CM internamente
  (`.CodeMirror{height:100%}` + parent `overflow:hidden`). Vedi S5.
- **CM events `change` vs `inputRead`**: `inputRead` fires SOLO da kbd input (testo digitato), NON da command via
  `replaceSelection` (es. `newlineAndIndent` per Enter). Per catchare TUTTO incl. Enter usare `change` con filtro
  `change.origin === '+input'`; `change.text` è array splittato su `\n`.
- **CM history merge**: changes con stesso origin entro `historyEventDelay` (default 1250ms) si fondono. Per forzare
  boundary (undo word-by-word) settare `cm.doc.history.lastModTime = 0` dopo char di boundary.
- **contenteditable `inputType`**: Enter emette `insertParagraph` (block) o `insertLineBreak` (Shift+Enter), NON
  `insertText`. Gli hook su input devono gestire entrambi per detectare nuove righe come boundary.
- **`-webkit-app-region: drag`** (Electron Windows): marca zona drag finestra OS-native (Chromium gestisce doppio-click
  →maximize/restore). Eredita sui figli; gli interattivi devono override `no-drag`. Su zone drag Chromium può
  sopprimere hover/mouseenter → elementi hover-expand/tracking vanno `no-drag`. Dragula compatibile (`no-drag` su
  `.v2-tab` non blocca mousedown/mousemove).
- **Dragula + Vue v-for**: il drop handler NON deve manipolare il DOM manualmente (`removeChild`/`insertBefore`) →
  corrompe i ref interni dragula. Vue v-for con `:key` riconcilia da solo. Filtrare `gu-mirror` dal sibling prima di
  calcolare il next-tab-id.
- **Vue vdom `.el` staleness post-dragula**: dopo che dragula sposta i nodi, Vue tiene ref `.el` stale → la prossima
  inserzione (nuova tab) finisce in posizione errata. Fix: `:key` include `tabsRenderKey` incrementato su `dragend`
  → Vue ricrea i `li.v2-tab` freschi.
- **Ul width dinamica: simulazione vs offsetTop**: per restringere `ul` al contenuto reale della riga 1 (liberare zona
  drag), usare simulazione iterativa accumulando `offsetWidth` (intrinseco, `flex-shrink:0`+min/max-width), NON detection
  `offsetTop` (instabile, dipende da ul width precedente → loop). Serve `ResizeObserver` su `.v2-tabbar` root (ul a width fissa non triggera).
- **`recomputePinnedTab` separato da `updateTabRowsLayout`**: l'assegnazione pinnedTab può essere skippata se
  `layoutLockUntil` attivo (es. ResizeObserver burst durante drag). Helper DOM-based chiamabile fuori dal lock (dal drop handler) → clone sempre aggiornato.
- **Patch Vite cache**: dopo patch a node_modules cancellare `node_modules/.vite/deps/`. In dev `Cache-Control: no-store` in `electron.vite.config.mjs`.
- **Doppio rAF**: per misurazioni DOM affidabili `nextTick → rAF → rAF → measure` (single rAF gira prima del paint).

## NB / nodi noti
- **NB1 — Tab drag detach** (trascinare tab fuori per nuova finestra): NON implementato (vedi TODO.md).
- **S1 — Muya cursor=null in sourceCode**: guard in `scrollToCursor` fatto; verificare `editor.vue` `getSelection` se serve guard extra.
- **S3 — Patch CodeMirror persistenza**: le patch in `node_modules/codemirror/lib/codemirror.js` si perdono con
  `npm install` → `npx patch-package codemirror` + committare `patches/codemirror+5.65.20.patch`.
- **S4 — native-keymap**: alternativa alla patch = `npx electron-rebuild -f -w native-keymap`.
- **S5 — Scroll sourceCode**: post-Bug6 lo scroll è gestito INTERNAMENTE da CM (`.CodeMirror-scroll`), NON da
  `.source-code` (overflow:hidden). Nuove feature su scrollTop devono usare API CM (`getScrollInfo()`,`scrollTo()`,`on('scroll')`), MAI `sourceCodeContainer.value.scrollTop`.
- **S6 — Word-boundary undo**: implementato su CM (`change` + `lastModTime=0`) e Muya (`inputCtrl.js` su
  `insertText` con regex + `insertParagraph`/`insertLineBreak`). Per estendere i char boundary modificare la regex in entrambi i punti.
- **Ln/Col WYSIWYG**: Muya non espone coordinate reali → DOM-walk per Prg (paragrafo).
- **DevTools Autofill errors**: bug noto Chromium/Electron, non patchabile.

---

## Architettura (mappa file v2)
```
src/main/                       # main (Node)
  config.js                     # LINE_ENDING_REG, autoHideMenuBar
  windows/editor.js             # IPC min/max window, Alt→menu (before-input-event)
  app/index.js                  # app-open-files-by-id (normalizeAndResolvePath)
  filesystem/markdown.js        # loadMarkdownFile, getLineEnding, CR
src/renderer/src/
  assets/styles/v2-tokens.css   # variabili --v2-*, keyframes, light/dark
  pages/app.vue                 # layout, TitleBar nascosta
  components/editorWithTabs/
    tabs.vue                    # tab bar v2 (file più modificato)
    editor.vue / sourceCode.vue / index.vue   # Muya / CodeMirror / switcher
  components/statusBar/index.vue            # status bar (creato)
  components/commandPalette/index.vue       # restyling + quickbar
  components/search/index.vue               # find&replace floating→docked
  components/settingsModal/index.vue        # modal impostazioni (creato)
  components/contextMenu/{Editor,Tab}ContextMenu.vue   # context menu Vue (creati)
  store/{editor,help,layout}.js
  prefComponents/common/bool/index.vue      # iOS toggle
  common/encoding.js            # cp1252 → "ANSI"
  muya/lib/contentState/{index,inputCtrl}.js   # debounce history 800ms, word-boundary
node_modules/codemirror/...     # PATCHATO (vedi S3)
node_modules/native-keymap/...  # PATCHATO (vedi S4)
electron.vite.config.mjs        # Cache-Control no-store (dev)
static/locales/en.json          # chiavi statusBar.*, theme.*
```

---

## Cosa è stato fatto (per categoria)

1. **Foundation:** token `--v2-*` light/dark; Google Fonts (Inter+JetBrains Mono) in `index.html`+CSP; TitleBar nativa nascosta, `autoHideMenuBar:true` (`config.js`); Alt→toggle menu via `before-input-event` (`windows/editor.js`).
2. **Tab bar (`tabs.vue`):** pill multirow con hover-expand; topright (⌘, apri, min/max/close SVG) + IPC `mt::minimize/maximize-window`; "+" inline (single-row) / topright (multirow); clone pinnedTab quando attiva è in riga 2+; `updateTabRowsLayout` state-aware + `layoutLockUntil` (500ms); dragula `realSibling` filtra `.v2-tab-new-li`; hover scope su `.v2-tabbar-scroll`.
3. **Status bar (creato):** Prg/Ln (label "Prg"=paragrafo in markdown, "Ln" in source), Col, saved dot, EOL dropdown (LF/CRLF/CR), encoding dropdown (5 top-level + sottomenu), Wrap, zoom%; `@mousedown.stop` sui dropdown; CR (Macintosh) aggiunto (`LINE_ENDING_REG`, `getLineEnding`); cp1252→"ANSI"; cambio EOL/encoding marca `isSaved=false`.
4. **Muya (`editor.vue`):** guard `if(sourceCode.value)return` in `handleFileChange`/`setMarkdownToEditor`/`handleUndo`/`handleRedo`/`scrollToCursor` (doppio anche in nextTick); Prg via DOM-walk (`:scope > [id]`); evento `statusbar::cursor-change`.
5. **CodeMirror (`sourceCode.vue`):** `markRaw` (FIX critico, vedi note); `refresh()` sync + doppio rAF; ResizeObserver (tiny line); `isFirstLoad`; `lineNumberFormatter` rimosso; CSS `margin:0` + `padding-bottom:0`; guard null in `scrollToCords`.
6. **Store editor:** `_applySourceCodeForFile` PRIMA di `file-changed` + `nextTick`; `justLoaded`; `isUnchangedFromDisk` (Ctrl+Z→`isSaved=true`); `originalMarkdown='\n'` per Untitled; `app-open-files-by-id` usa `normalizeAndResolvePath` (non filtra estensioni non-.md).
7. **Store help:** `getBlankFileState` aggiunge `originalMarkdown: markdown` per Untitled (Ctrl+Z funziona).
8. **Muya history:** debounce 2000→800ms (`index.js`); word-boundary checkpoint `commitPending()` su spazio/punteggiatura (`inputCtrl.js`, IME-safe).
9. **Find&Replace (`search/index.vue`):** click-fuori in floating→dock (non chiude); X per chiudere; Ctrl+F se docked→chiude; `position:fixed`+`right`; transizione `top,right`+`opacity`.
10. **Settings modal (creato):** overlay transparent; altezza fissa `78vh`.
11. **Command palette:** overlay transparent.
12. **Patch node_modules:** `codemirror.js`+`position_measurement.js` (guard `mapFromLineView`, recovery `prepareMeasureForLine`, catch `posFromMouse` con `cmStaleLineView`); `native-keymap/index.js` (try/catch doppio in `_init`). **Non persistono dopo `npm install`** → patch-package (S3).
13. **i18n:** 8 chiavi in `en.json` (`statusBar.*`, `theme.*`); altre lingue usano fallback.
14. **Rename:** `editorStore.RENAME(...)` (convenzione uppercase Pinia).

---

## Bug fix (causa → fix)

| Bug | Causa | Fix |
|---|---|---|
| Bollino notepad++ non realtime | flip `isSaved=false` passava solo da `LISTEN_FOR_CONTENT_CHANGE` (debounce 1s) | check simmetrico immediato in `listenChange()` accanto a N12 |
| Ctrl+Z non funziona in notepad++ | menu Electron→`bus.emit('undo')`→`editor.vue handleUndo` con early-return su source; `sourceCode.vue` non ascoltava | `handleUndo`/`handleRedo` in `sourceCode.vue` (`execCommand`) + `bus.on/off` |
| Bollino non spariva dopo Ctrl+Z su stato iniziale | `justLoaded` consumato da LFC sovrascriveva `originalMarkdown` (logica Muya); CM non normalizza | `justLoaded=false` in `handleFileChange` post-`setValue` |
| Ctrl+Z cancellava parola/riga in un colpo | CM merge `+input` entro 1250ms; `inputRead` non cattura Enter. Muya controllava solo `insertText` | CM: hook `change` filtro `+input` + regex `/[\s.,;:!?]/` → `lastModTime=0`. Muya: branch `insertParagraph`/`insertLineBreak`→`commitPending()` |
| Scroll incompleto + nuova riga sotto footer | `.source-code` height eccedeva; magic margin CM wrappato in scroll esterno → CM 50px più corto | re-architecture scroll: CM scroll interno (`.source-code{height:100%;overflow:hidden}`, `.CodeMirror{height:100%!important}`); rimosso `viewportMargin:Infinity`; listener/scroll via API CM (`on('scroll')`, `scrollTo`, `getScrollInfo`) |
| Nuova tab in posizione errata dopo drag | (a) sibling `gu-mirror` → toId errato; (b) Vue `.el` stale post-dragula | (a) filtro `!sibling.classList.contains('gu-mirror')`; (b) `tabsRenderKey` su `:key`, incrementato in `dragend` (NO `removeChild`) |
| Clone pinnedTab non aggiornato post-drag | `layoutLockUntil` attivo durante il drop | `recomputePinnedTab()` helper DOM-based chiamato dal drop handler (bypassa il lock) |
| Tabs riga 1 si compenetrano con topright al resize | ul a width fissa inline → ResizeObserver su ul non triggera | `ResizeObserver` su `.v2-tabbar` root |
| "+" interseca i tab quando cambia `isSaved` | `watch(tabs,{deep:false})` non vede variazioni interne; la pill cresce | watch dedicato su `tabs.map(t=>\`${t.isSaved}|${t.filename}\`)` → `scheduleUpdate()` |
| View mode non cambia chiudendo tab notepad++ | `FORCE_CLOSE_TAB` non chiamava `_applySourceCodeForFile` sul nuovo tab | aggiunta la chiamata (coerente con `UPDATE_CURRENT_FILE`) |
| `.v2-topright-dynamic` clone tagliato | contenuto ~151px > width 150px | width 158px |

---

## Sessione UI corrente (extra)
- **Command palette quickbar:** barra in cima con Preferences (⚙, `show-settings-modal`) e Theme (◐, toggle `dark/light` via `SET_SINGLE_PREFERENCE` senza chiudere); separator `.v2-cmd-qdiv`.
- **Status bar Wrap disabilitato in markdown:** `.v2-chip-disabled` + tooltip; rimossi i pulsanti Impostazioni/Tema dalla status bar (spostati nella palette).
- **Settings modal freccia indietro→palette:** `.v2-settings-back` (visibile solo se `activeSection==='menu'`) → `show-command-palette` + chiude modal.
- **Drag finestra Windows-style** (`tabs.vue` CSS): `.v2-tabbar` `-webkit-app-region:drag`; `no-drag` su `.v2-tab`, `.v2-tab-new-li`, clone, plus, btn, ul. Ul width dinamica = contenuto riga 1 (simulazione `offsetWidth`); restringimenti stile pill (`padding`, `gap`, `.v2-tab-name` `min-width:0`).
