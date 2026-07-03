# UI v2 — Design System, Architettura, Note Tecniche Critiche

**Scopo:** documenta il redesign v2 dell'interfaccia MarkText — token `--v2-*`, tab bar pill multi-row, status bar, drag, `markRaw` su CodeMirror, CM events, scroll interno CM. Leggere PRIMA di toccare: tema, token CSS, CM wrapper, dragula, layout.

**Origine:** `DESIGN-TASK.md` (8 sessioni design-fix + storico completo).

**Quando leggerlo:** aggiungi feature visuale / modifica colori / cambi scroll CM / lavori su dragula / problema tema scuro/chiaro / layout v2 rotto.

---

## ⚠️ NOTE TECNICHE IMPORTANTI — Leggere PRIMA di Toccare

### Resize Tab Bar (BUG-1, 2026-06-10)

Prima di toccare `updateTabRowsLayout`, il topright o il layout flex della colonna editor, **leggere le invarianti in `tab-bar-layout.md`** (two-pass detection, lock defer-not-drop, loop min-content/`min-width:0`, costanti JS↔CSS, divieto topright in-flow).

### `markRaw` su CodeMirror — CRITICO

Vue3 `ref()` deep-proxifica il doc tree di CM → il loop `indexOf` di CM confronta raw vs proxy → ritorna -1 → crash su click/cursore.

**FIX OBBLIGATORIO:** `editor.value = markRaw(codeMirrorInstance)`.

Pattern obbligatorio per qualsiasi libreria con stato mutabile (CodeMirror, Three.js, Pixi, Monaco).

### `_applySourceCodeForFile` Timing

Chiamarlo PRIMA di `bus.emit('file-changed')` e con `nextTick` per garantire il mount di `sourceCode.vue` prima dell'evento.

### `justLoaded` Flag — Muya vs CodeMirror

Pensato per Muya che normalizza il markdown caricato. Il primo `LISTEN_FOR_CONTENT_CHANGE` post-load consuma il flag e sovrascrive `originalMarkdown`.

**CodeMirror NON normalizza** → consumare il flag rompe la baseline → Ctrl+Z back-to-saved fallisce.

**Regola:** in source disabilitare il flag subito in `handleFileChange` post-`setValue`.

### Magic Margin CodeMirror

`.CodeMirror-scroll { margin-bottom:-50px; padding-bottom:50px; overflow:scroll }` — pensato per CM con altezza FISSA + scroll interno.

Wrapparlo in una surface scroll esterna → CM appare 50px più corto → ultime righe non raggiungibili.

**Regola:** lasciar scrollare CM internamente (`.CodeMirror{height:100%}` + parent `overflow:hidden`).

### CM Events: `change` vs `inputRead`

- `inputRead` fires SOLO da kbd input (testo digitato), NON da command via `replaceSelection` (es. Enter).
- Per catchare TUTTO incl. Enter usare `change` con filtro `change.origin === '+input'`.
- `change.text` è array splittato su `\n`.

### CM History Merge

Changes con stesso origin entro `historyEventDelay` (default 1250ms) si fondono. Per forzare boundary (undo word-by-word) settare `cm.doc.history.lastModTime = 0` dopo char di boundary.

### contenteditable `inputType`

- Enter emette `insertParagraph` (block) o `insertLineBreak` (Shift+Enter), NON `insertText`.
- Gli hook su input devono gestire entrambi per detectare nuove righe come boundary.

### `-webkit-app-region: drag` (Electron Windows)

Marca zona drag finestra OS-native (Chromium gestisce doppio-click → maximize/restore). Eredita sui figli; gli interattivi devono override `no-drag`.

Su zone drag Chromium può sopprimere hover/mouseenter → elementi hover-expand vanno `no-drag`.

Dragula compatibile (`no-drag` su `.v2-tab` non blocca mousedown/mousemove).

### Dragula + Vue v-for

Il drop handler NON deve manipolare il DOM manualmente (`removeChild`/`insertBefore`) → corrompe i ref interni dragula.

Vue v-for con `:key` riconcilia da solo. Filtrare `gu-mirror` dal sibling prima di calcolare il next-tab-id.

### Vue vdom `.el` Staleness Post-Dragula

Dopo che dragula sposta i nodi, Vue tiene ref `.el` stale → la prossima inserzione (nuova tab) finisce in posizione errata.

**Fix:** `:key` include `tabsRenderKey` incrementato su `dragend` → Vue ricrea i `li.v2-tab` freschi.

### Ul Width Dinamica: Simulazione vs `offsetTop`

Per restringere `ul` al contenuto reale della riga 1 (liberare zona drag), usare simulazione iterativa accumulando `offsetWidth` (intrinseco), NON detection `offsetTop` (instabile).

Serve `ResizeObserver` su `.v2-tabbar` root (ul a width fissa non triggera).

### `recomputePinnedTab` Separato da `updateTabRowsLayout`

L'assegnazione pinnedTab può essere skippata se `layoutLockUntil` attivo (es. ResizeObserver burst durante drag).

Helper DOM-based chiamabile fuori dal lock (dal drop handler) → clone sempre aggiornato.

### Patch Vite Cache

Dopo patch a node_modules cancellare `node_modules/.vite/deps/`. In dev `Cache-Control: no-store` in `electron.vite.config.mjs`.

### Doppio rAF

Per misurazioni DOM affidabili: `nextTick → rAF → rAF → measure` (single rAF gira prima del paint).

---

## NB / Nodi Noti

- **NB1 — Tab drag detach** (trascinare tab fuori per nuova finestra): NON implementato (vedi TODO.md). **SUPERATO dalla feature `drag-html5-dnd`** — vedi Completed/drag-html5-dnd/drag-html5-dnd.md per il drag nativo implementato.
- **S1 — Muya cursor=null in sourceCode**: guard in `scrollToCursor` fatto; verificare `editor.vue` `getSelection` se serve guard extra.
- **S3 — Patch CodeMirror persistenza**: le patch in `node_modules/codemirror/lib/codemirror.js` si perdono con `npm install` → `npx patch-package codemirror` + committare `patches/codemirror+5.65.20.patch`.
- **S4 — native-keymap**: alternativa alla patch = `npx electron-rebuild -f -w native-keymap`.
- **S5 — Scroll sourceCode**: post-Bug6 lo scroll è gestito INTERNAMENTE da CM (`.CodeMirror-scroll`), NON da `.source-code` (overflow:hidden). Nuove feature su scrollTop devono usare API CM (`getScrollInfo()`,`scrollTo()`,`on('scroll')`), MAI `sourceCodeContainer.value.scrollTop`.
- **S6 — Word-boundary undo**: implementato su CM (`change` + `lastModTime=0`) e Muya (`inputCtrl.js` su `insertText` con regex + `insertParagraph`/`insertLineBreak`).
- **Ln/Col WYSIWYG**: Muya non espone coordinate reali → DOM-walk per Prg (paragrafo).
- **DevTools Autofill errors**: bug noto Chromium/Electron, non patchabile.

---

## Architettura v2 (Mappa File)

```
src/main/
  config.js                     # LINE_ENDING_REG, autoHideMenuBar
  windows/editor.js             # IPC min/max window
  app/index.js                  # app-open-files-by-id
  filesystem/markdown.js        # loadMarkdownFile, getLineEnding, CR

src/renderer/src/
  assets/styles/v2-tokens.css   # variabili --v2-*, keyframes, light/dark
  pages/app.vue                 # layout, TitleBar nascosta
  components/editorWithTabs/
    tabs.vue                    # tab bar v2 (file più modificato)
    editor.vue / sourceCode.vue / index.vue   # Muya / CodeMirror / switcher
  components/statusBar/index.vue            # status bar
  components/commandPalette/index.vue       # quickbar
  components/search/index.vue               # find&replace floating→docked
  components/settingsModal/index.vue        # modal impostazioni
  components/contextMenu/{Editor,Tab}ContextMenu.vue   # context menu Vue
  store/{editor,help,layout}.js
  prefComponents/common/bool/index.vue      # iOS toggle
  common/encoding.js            # cp1252 → "ANSI"
  muya/lib/contentState/{index,inputCtrl}.js   # debounce history 800ms, word-boundary

node_modules/codemirror/...     # PATCHATO
node_modules/native-keymap/...  # PATCHATO

electron.vite.config.mjs        # Cache-Control no-store (dev)
static/locales/en.json          # chiavi statusBar.*, theme.*
```

---

## Cosa È Stato Fatto (Per Categoria)

### 1. Foundation

- Token `--v2-*` light/dark
- Google Fonts (Inter+JetBrains Mono) in `index.html`+CSP
- TitleBar nativa nascosta, `autoHideMenuBar:true` (`config.js`)
- Alt→toggle menu via `before-input-event` (`windows/editor.js`)

### 2. Tab Bar (`tabs.vue`)

- Pill multirow con hover-expand
- Topright (⌘, apri, min/max/close SVG) + IPC `mt::minimize/maximize-window`
- "+" inline (single-row) / topright (multirow)
- Clone pinnedTab quando attiva è in riga 2+
- `updateTabRowsLayout` state-aware + `layoutLockUntil` (500ms)
- Dragula `realSibling` filtra `.v2-tab-new-li`
- Hover scope su `.v2-tabbar-scroll`

### 3. Status Bar (Creato)

- Prg/Ln (label "Prg"=paragrafo in markdown, "Ln" in source)
- Col, saved dot
- EOL dropdown (LF/CRLF/CR)
- Encoding dropdown (5 top-level + sottomenu)
- Wrap, zoom%
- `@mousedown.stop` sui dropdown
- CR (Macintosh) aggiunto
- cp1252→"ANSI"
- Cambio EOL/encoding marca `isSaved=false`

### 4. Muya (`editor.vue`)

- Guard `if(sourceCode.value)return` in `handleFileChange`/`setMarkdownToEditor`/`handleUndo`/`handleRedo`/`scrollToCursor`
- Prg via DOM-walk (`:scope > [id]`)
- Evento `statusbar::cursor-change`

### 5. CodeMirror (`sourceCode.vue`)

- `markRaw` (FIX critico)
- `refresh()` sync + doppio rAF
- ResizeObserver (tiny line)
- `isFirstLoad`
- `lineNumberFormatter` rimosso
- CSS `margin:0` + `padding-bottom:0`
- Guard null in `scrollToCords`

### 6. Store Editor

- `_applySourceCodeForFile` PRIMA di `file-changed` + `nextTick`
- `justLoaded`
- `isUnchangedFromDisk` (Ctrl+Z→`isSaved=true`)
- `originalMarkdown='\n'` per Untitled
- `app-open-files-by-id` usa `normalizeAndResolvePath`

### 7. Store Help

- `getBlankFileState` aggiunge `originalMarkdown: markdown` per Untitled

### 8. Muya History

- Debounce 2000→800ms
- Word-boundary checkpoint su spazio/punteggiatura

### 9. Find&Replace (`search/index.vue`)

- Click-fuori in floating→dock
- X per chiudere
- Ctrl+F se docked→chiude
- `position:fixed`+`right`
- Transizione `top,right`+`opacity`

### 10. Settings Modal (Creato)

- Overlay transparent
- Altezza fissa `78vh`

### 11. Command Palette

- Overlay transparent

### 12. Patch node_modules

- `codemirror.js`+`position_measurement.js` (guard `mapFromLineView`, recovery `prepareMeasureForLine`, catch `posFromMouse`)
- `native-keymap/index.js` (try/catch doppio in `_init`)
- **Non persistono** → patch-package (S3)

### 13. i18n

- 8 chiavi in `en.json` (`statusBar.*`, `theme.*`)
- Fallback lingue

### 14. Rename Pinia

- `editorStore.RENAME(...)` (uppercase)

---

## Bug Fix UI (Causa → Fix)

| Bug | Causa | Fix |
|---|---|---|
| Bollino notepad++ non realtime | flip passava solo da LFC (debounce 1s) | check simmetrico immediato in `listenChange()` accanto a N12 |
| Ctrl+Z non funziona notepad++ | menu Electron→bus.emit, source early-return; CM non ascoltava | `handleUndo`/`handleRedo` in `sourceCode.vue` |
| Bollino non spariva post Ctrl+Z | `justLoaded` consumato sovrascriveva `originalMarkdown` | `justLoaded=false` in `handleFileChange` post-`setValue` |
| Ctrl+Z cancellava parola/riga | CM merge `+input` entro 1250ms; `inputRead` non cattura Enter | CM: hook `change` filtro + regex; Muya: `insertParagraph`/`insertLineBreak`→`commitPending()` |
| Scroll incompleto + nuova riga sotto footer | `.source-code` height eccedeva; magic margin CM | re-architecture scroll: CM scroll interno; listener via API CM |
| Nuova tab in posizione errata dopo drag | sibling `gu-mirror` e Vue `.el` stale | filtro gu-mirror; `tabsRenderKey` su `:key` |
| Clone pinnedTab non aggiornato post-drag | `layoutLockUntil` attivo durante drop | `recomputePinnedTab()` helper DOM-based dal drop handler |
| Tabs riga 1 compenetrano topright al resize | ul a width fissa inline | `ResizeObserver` su `.v2-tabbar` root |
| "+" interseca tab quando cambia `isSaved` | `watch(tabs,{deep:false})` non vede variazioni interne | watch dedicato su `tabs.map(t=>\`...\`)` |
| View mode non cambia chiudendo tab notepad++ | `FORCE_CLOSE_TAB` non chiamava `_applySourceCodeForFile` | aggiunta la chiamata |
| `.v2-topright-dynamic` clone tagliato | contenuto 151px > width 150px | width 158px |

---

## Sessioni UI Corrente (Extra)

### Command Palette Quickbar

- Barra in cima con Preferences (⚙) e Theme (◐)
- Separator `.v2-cmd-qdiv`

### Status Bar Wrap Disabilitato in Markdown

- `.v2-chip-disabled` + tooltip

### Settings Modal

- Freccia indietro→palette
- `.v2-settings-back` (visibile se `activeSection==='menu'`)

### Drag Finestra Windows-Style (`tabs.vue` CSS)

- `.v2-tabbar` `-webkit-app-region:drag`
- `no-drag` su `.v2-tab`, `.v2-tab-new-li`, clone, plus, btn, ul
- Ul width dinamica = contenuto riga 1 (simulazione `offsetWidth`)
