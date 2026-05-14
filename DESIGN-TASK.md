# DESIGN-TASK — Riepilogo sessioni UI v2 (MarkText)

Design di riferimento: `DESIGN/marktext/project/Markdown Editor v2.html` + `editor-v2.jsx`

---

## OVERVIEW

Implementazione completa della UI v2 su fork MarkText (Electron + Vue3 + Pinia + Muya).
8 sessioni di fix (DESIGN-FIX-1 → DESIGN-FIX-8) + sessione finale bug fix. Stato: **DESIGN FIX CONCLUSO**, tutti i bug noti risolti.

---

## FIX E MODIFICHE FINALI

- [BUG] attualmente il + può essere draggato, non dovrebbe
- si puo mettere un dragger orizzontale abilitato da impostazioni per dare meno spazio volendo alla tab bar (spazio riservato alle tab), se il flag è attivo allora allo spegnimento bisognerà ricordare la posizione alla prossima accensione, mentre se è disattivato il comportamento da mantenere è quello attuale
- capire come gestire il flag wrap: se visualizzazione simil notepad++ allora wrap = true -> al termine della finestra le scritte vanno a capo; wrap = false -> non c'è un termine della riga, se il testo va oltre il bordo della finestra, apparira uno scroller in basso per scorrere la sezione di editor in orizzontale ; in visualizzazione markdown invece non ho ben chiaro come fare, perchè il testo è centrato con dei bordi, non tocca mai i bordi della finestra, quindi decidere se ignorare il flag wrap in quel capo, oppure applicare un altro comportamento piu coerente, a primo impatto non mi viene in mente
- cambiare icona impostazioni, e metterla in alto insieme a command palette e seleziona file. la tab bar deve ottimizzare piu spazio possibile, attualmente lo spazio va bene, ma siamo praticamente al limite
- capire dove si potrebbe mettere l'icona del cambio tema, in basso fa un po schifo, in alto non c'è spazio
- per risolvere i precedenti ultimi problemi si potrebbe implementare un menu hamburger in alto a destra per le icone fisse, ma non mi piace avere un secondo livello di menu. Capirfe come gestire
- purtroppo ancora a volte si bugga la tab creata che non viene creata alla fine, ma in mezzo dopo aver spostato una tab con il drag (non è stato individuato bene il caso cin cui succede, sicuramente non con tutti i drag)
magari succede quando sposto le tab davanti all'ultima tab e faccio un po di movimenti in quella zona, c'è qualcosa che sballa, è da capire.

## BUG IN SOSPESO / NOTE

- **NB1 — Tab drag nativo Windows**: trascinare tab fuori dalla tab bar per creare nuova finestra non implementato (alta complessità, richiede IPC main + BrowserWindow creation da drag event). Rimandato a TODO.md.
- **S1 — Muya cursor=null in sourceCode**: guard in `scrollToCursor` (fatto), ma verificare se `editor.vue:723` necessita guard aggiuntivo in `getSelection`.
- **S3 — Patch CodeMirror persistenza**: patch in `node_modules/codemirror/lib/codemirror.js` si perdono con `npm install`. Applicare `npx patch-package codemirror` e committare `patches/codemirror+5.65.20.patch`.
- **S4 — native-keymap**: alternativa a patch è `npx electron-rebuild -f -w native-keymap` (ricompila modulo nativo).
- **DevTools Autofill errors**: bug noto Chromium/Electron, non patchabile lato app.
- **Ln/Col WYSIWYG**: Muya non espone coordinate reali, si usa DOM-walk per Prg (paragrafo).
- **S5 — Architettura scroll sourceCode**: post-Bug6 fix lo scroll è gestito internamente da CodeMirror (`.CodeMirror-scroll`), NON da `.source-code` (overflow:hidden). Eventuali nuove feature che leggono/scrivono scrollTop devono usare API CM (`editor.getScrollInfo()`, `editor.scrollTo()`, `editor.on('scroll')`), MAI `sourceCodeContainer.value.scrollTop`.
- **S6 — Word-boundary undo**: implementato sia su CM (`change` event + `lastModTime=0`) che Muya (`inputCtrl.js` su `insertText` con regex + `insertParagraph`/`insertLineBreak`). Per estendere set caratteri di boundary modificare regex in entrambi i punti coerentemente.
- **S7 — `hasMultiRow` trigger borderline su inline + (RISOLTO)**:
  - **Sintomo 1 (era):** quando la tab clone non c'è (active in row 1) e l'unico elemento dopo l'ultima tab è il + inline, il flag `hasMultiRow` poteva scattare prematuro perché lo spazio del + veniva contato nel predict hysteresis.
  - **Sintomo 2 (era):** durante aggiunta/cancellazione tabs vicino al boundary, il + inline finiva visivamente in row 2 mentre `hasMultiRow=false`. Riguardava sempre l'ultima tab della prima riga.
  - **Fix (S7-fix in `tabs.vue`):**
    - `.v2-tab-new-li` → `position: absolute; top:50%; transform: translateY(-50%)` (fuori flex flow, mai wrap)
    - `.v2-tabs` → `position: relative` (anchor per assoluto)
    - `.v2-tabbar-scroll` → `overflow: visible` (no clip su + che sconfina nello slot invisibile topright-dynamic)
    - `updateTabRowsLayout()` → 3 righe: `plusEl.style.left = lastTab.offsetLeft + lastTab.offsetWidth + GAP` post-detection
    - Hysteresis return-to-single → tolto `PLUS_W` (inline + non più in flex flow, no contributo wrap)
    - Hover style transform combinato: `translateY(-50%) scale(1.05)`
  - **Razionale:** inline + ora sconfina liberamente nello slot 150px riservato a `v2-topright-dynamic` (invisibile in single-row: opacity 0, pointer-events:none). Multirow scatta solo quando tabs reali violano lo slot fisso. `PLUS_W` const ora unused (lasciato declared per eventuali future feature).
  - **File:** `marktext/src/renderer/src/components/editorWithTabs/tabs.vue` `updateTabRowsLayout()`.

- **S9 — Drag finestra app-region + hover-expand (RISOLTO)**:
  - **Sintomo:** zona drag finestra (`-webkit-app-region: drag`) su `.v2-tabbar` poteva sopprimere `mouseenter` su `.v2-tabbar-scroll` quando cursore passava per gap/padding interno ul (zone drag inherit) → `tabsAreaHovered` non triggera → tab bar collassa nonostante mouse "in mezzo alle tabs".
  - **Fix:** `no-drag` esplicito su `.v2-tabs` ul (NON su scroll-area) → gap/padding interno restano cliccabili + hover events liberi. Scroll-area resta drag → spazio dopo ul ristretta = drag region.
  - **Regola:** elementi che fanno hover-expand o tracking mouse DEVONO essere `no-drag`. Drag region OK solo su zone "passive" (sfondo vuoto puro).

- **S10 — Ul width dinamica, ResizeObserver tabbar root necessario (RISOLTO)**:
  - **Sintomo:** dopo aver settato `ul.style.width = row1Width` inline, ridimensionare finestra non rilayoutava tabs → si compenetravano con topright.
  - **Causa:** ResizeObserver su `tabDropContainer` (ul) non triggera perché ul ha width fissa inline → size invariata.
  - **Fix:** aggiunto `tabbarResizeObs` su `.v2-tabbar` root → trigger `scheduleUpdate` su resize finestra → recalc `availableForContent` con nuovo `tabbar.clientWidth`.
  - **NB:** cleanup `disconnect()` in `onBeforeUnmount`.

- **S11 — Dragula drop handler + Vue v-for sync (RISOLTO)**:
  - **Sintomo storico 1:** nuova tab in posizione errata dopo reorder dragula. **Causa:** sibling `gu-mirror` non filtrato → `isLastTab=true` → moveItem no-op se from era last index → state desync. **Fix:** filter `!sibling.classList.contains('gu-mirror')` nel realSibling check.
  - **Sintomo storico 2:** drag tab → tab scompare, errori a catena (clone non aggiorna, editor non cambia). **Causa:** `removeChild(el)` manuale post-drop corrompe state interno dragula (refs invalidi) → drag successivi falliscono, Vue diff incoerente. **Fix:** NON toccare DOM. Vue v-for con `:key="file.id"` riconcilia naturalmente.
  - **Sintomo storico 3:** clone pinnedTab non aggiornato post-drag. **Causa:** ResizeObserver burst durante drag flippa `hasMultiRow` transient → `layoutLockUntil` attivo → `scheduleUpdate` post-drop skippato. **Fix:** estratto `recomputePinnedTab(items, multiRow)` helper DOM-based (no lock check), drop handler chiama esplicitamente `nextTick → rAF → recomputePinnedTab()`.

- **S8 — Lock layoutLockUntil ridotto 500→150ms (RISOLTO)**:
  - **Sintomo:** dopo flip `hasMultiRow`, resize finestra causava leggero delay visibile (fino a 500ms) prima che `hasMultiRow` flippasse di nuovo, perché `layoutLockUntil = Date.now() + 500` bloccava `updateTabRowsLayout()`.
  - **Causa storica:** lock progettato per evitare flicker durante transition CSS `padding-right` (0.5s) della tabbar.
  - **Perché non serve più:** post DESIGN-FIX-8 (B14e) `v2-topright-dynamic` ha width FISSA 150px → `topRightEl.offsetWidth` costante → `padding-right` tabbar valore stabile → transition CSS mai attivata.
  - **Fix:** `layoutLockUntil = Date.now() + 150` + setTimeout reconciliation 170ms (era 520ms). 150ms sotto soglia percezione umana, mantiene debounce contro burst ResizeObserver (drag-resize finestra) e protezione parziale per future regressioni dimensionali.
  - **File:** `marktext/src/renderer/src/components/editorWithTabs/tabs.vue` `watch(hasMultiRow)`.

---

## ARCHITETTURA DEL PROGETTO

```
marktext/src/
  main/                     # main process Electron (Node)
    app/index.js            # handler IPC app-open-files-by-id
    config.js               # LINE_ENDING_REG, autoHideMenuBar
    windows/editor.js       # IPC minimize/maximize window
    filesystem/markdown.js  # loadMarkdownFile, getLineEnding, CR support
    menu/actions/file.js    # openFile dialog
    contextMenu/editor/     # context menu nativo (disabilitato per v2)
  renderer/src/
    assets/styles/
      v2-tokens.css         # CREATO: variabili --v2-*, keyframes, light/dark theme
    pages/app.vue           # layout principale, TitleBar nascosta
    components/
      editorWithTabs/
        tabs.vue            # tab bar v2 (pill style, topright, multirow, clone, +)
        editor.vue          # Muya editor wrapper (guard sourceCode, Prg counter, scrollToCursor)
        sourceCode.vue      # CodeMirror editor notepad++ (markRaw, refresh, ResizeObserver)
        index.vue           # switcher Muya/CodeMirror
      statusBar/index.vue   # CREATO: status bar (Prg/Ln, EOL, encoding, Wrap, zoom)
      commandPalette/index.vue  # restyling v2, overlay transparent
      search/index.vue      # Find&Replace floating→docked, fade animazioni
      settingsModal/index.vue   # CREATO: modal impostazioni v2
      contextMenu/
        EditorContextMenu.vue   # CREATO: context menu editor Vue
        TabContextMenu.vue      # CREATO: context menu tab Vue
      rename/index.vue      # fix RENAME uppercase
    store/
      editor.js             # UPDATE_CURRENT_FILE, _applySourceCodeForFile, justLoaded, bollino
      help.js               # getBlankFileState (originalMarkdown Untitled)
      layout.js             # showTabBar
    prefComponents/common/bool/index.vue  # iOS toggle switch
  common/encoding.js        # rinomina cp1252 → "ANSI"
  muya/lib/
    ui/quickInsert/index.css    # restyling v2
    contentState/
      index.js              # debounce history 800ms
      inputCtrl.js          # word-boundary checkpoint Ctrl+Z
static/locales/en.json      # chiavi i18n statusBar.*, theme.*
node_modules/
  codemirror/lib/codemirror.js         # PATCHATO: guard mapFromLineView, catch posFromMouse
  codemirror/src/measurement/position_measurement.js  # stessa patch
  native-keymap/index.js    # PATCHATO: try/catch doppio in _init()
electron.vite.config.mjs    # Cache-Control: no-store per dev
```

---

## COSA È STATO FATTO (per categoria)

### 1. Foundation UI v2
- Creati token CSS `--v2-*` (colori, shadow, timing, font) con light/dark theme
- Google Fonts (Inter + JetBrains Mono) aggiunti in `index.html` + CSP aggiornata
- TitleBar nativa nascosta, `autoHideMenuBar: true` in `config.js`
- Alt key → toggle menu nativo via `webContents.on('before-input-event')` in `windows/editor.js`

### 2. Tab bar (tabs.vue — file più modificato)
- Redesign completo pill style, multirow con hover expand
- Topright zone: icone ⌘, apri file (SVG), minimizza/massimizza/chiudi (SVG VS Code style)
- IPC `mt::minimize-window`, `mt::maximize-window` aggiunti in `windowManager.js`
- Pulsante "+" inline in single-row; in multi-row si sposta nel topright con animazione
- Tab clone (pinnedTab) nel topright quando tab attiva è in riga 2+
- Classe `v2-tab-active-hidden` per nascondere sfondo tab attiva quando su riga 2+ collassata
- `updateTabRowsLayout()` riscritto state-aware con `layoutLockUntil` (lock 500ms post-flip)
- `markRaw` NON applicato qui (solo in sourceCode.vue per CodeMirror)
- Separatore visivo tra icone app e icone finestra
- Fix dragula: `realSibling` filtra `.v2-tab-new-li` senza data-id
- Hover scope: `tabsAreaHovered` su `.v2-tabbar-scroll`, `@mouseleave` su `.v2-tabbar` (non su scroll)

### 3. Status bar (statusBar/index.vue — file creato)
- Mostra: Prg/Ln, Col, saved dot, EOL dropdown (LF/CRLF/CR), encoding dropdown, Wrap, zoom%
- In markdown mode: label "Prg" (paragrafo); in sourceCode: label "Ln"
- `@mousedown.stop` sui dropdown per evitare race con handleClickOutside
- Supporto CR (Macintosh) aggiunto: `LINE_ENDING_REG` estesa, `getLineEnding`, `loadMarkdownFile`
- Encoding strutturato: 5 voci top-level (ANSI, UTF-8, UTF-8 BOM, UTF-16 BE/LE BOM) + sottomenu categorie
- cp1252 rinominato "ANSI" in `common/encoding.js`
- Cambio EOL/encoding ora marca file come modificato (`isSaved = false`)

### 4. Editor Muya (editor.vue)
- Guard `if (sourceCode.value) return` in `handleFileChange`, `setMarkdownToEditor`, `handleUndo`, `handleRedo`, `scrollToCursor` (doppio guard anche dentro nextTick)
- Calcolo Prg reale via DOM-walk + `:scope > [id]` sui blocchi Muya
- Evento `statusbar::cursor-change` emesso da `selectionChange`

### 5. Editor CodeMirror/notepad++ (sourceCode.vue)
- `markRaw(codeMirrorInstance)` — FIX CRITICO: evita Vue3 deep-reactive proxy su doc tree CodeMirror (causa root di tutti i crash click/cursore)
- `refresh()` sincrono dopo `setValue` + doppio rAF post-paint
- ResizeObserver su container per tiny line iniziale
- `isFirstLoad` flag per evitare bollino falso su primo caricamento file
- `lineNumberFormatter` rimosso (mostrava solo riga 1 e multipli di 10)
- CSS: `margin: 0` su `.CodeMirror` (allineamento sinistra), `padding-bottom: 0` su `.CodeMirror-lines` (gutter corretto)
- Guard null in `scrollToCords` rAF

### 6. Store editor (store/editor.js)
- `_applySourceCodeForFile` spostato PRIMA di `bus.emit('file-changed')` in `UPDATE_CURRENT_FILE`
- `nextTick` attorno a `bus.emit` per garantire mount di sourceCode.vue
- `justLoaded` flag per evitare bollino falso (prima normalizzazione Muya aggiorna `originalMarkdown`)
- `isUnchangedFromDisk`: `isSaved = true` quando Ctrl+Z torna all'originale
- `originalMarkdown` sincronizzato a `'\n'` per Untitled (Muya normalizza `''` → `'\n'`)
- Log diagnostico `[BUG3-A]` rimosso
- Handler `app-open-files-by-id` in `main/app/index.js`: usa `normalizeAndResolvePath` invece di `normalizeMarkdownPath` (che filtrava via estensioni non-.md)

### 7. Store help (store/help.js)
- `getBlankFileState`: aggiunto `originalMarkdown: markdown` per Untitled (markdown = `''` → Ctrl+Z funziona)

### 8. Muya history (muya/lib/contentState/)
- Debounce ridotto da 2000ms a 800ms in `index.js`
- Word-boundary checkpoint in `inputCtrl.js` riga ~337: `commitPending()` su spazio/punteggiatura (IME-safe)

### 9. Find & Replace (search/index.vue)
- Click fuori in floating mode → dock (non chiude)
- Pulsante X per chiudere da docked mode
- Ctrl+F quando già docked → chiude
- Posizionamento con `position: fixed` + `right` (elimina conflitto con transform)
- Transizione floating→docked via CSS `transition: top, right`
- `opacity` aggiunto a `.search-bar` transition per fade-out funzionante

### 10. Settings Modal (settingsModal/index.vue)
- Overlay transparent (era `rgba(0,0,0,.32)`)
- Altezza fissa `78vh` (elimina scatto altezza tra sezioni)

### 11. Command Palette (commandPalette/index.vue)
- Overlay transparent (era `rgba(0,0,0,.15)`)

### 12. Patch node_modules
- `codemirror/lib/codemirror.js` + `src/measurement/position_measurement.js`: guard `mapFromLineView`, recovery `prepareMeasureForLine`, catch `posFromMouse` con errore marcato `cmStaleLineView`
- `native-keymap/index.js`: try/catch doppio in `_init()` + null-check in `getKeyMap`
- **ATTENZIONE**: patch `node_modules` non persistono dopo `npm install`. Usare `patch-package` (vedi DESIGN-FIX-8)

### 13. i18n (static/locales/en.json)
- Aggiunte 8 chiavi mancanti: `statusBar.toggleWrap`, `statusBar.resetZoom`, 6 chiavi `theme.*`
- Solo in `en.json` — altre lingue usano fallback

### 14. Rename fix
- `rename/index.vue`: `editorStore.rename(...)` → `editorStore.RENAME(...)` (convezione uppercase Pinia)

### 15. Bug fix sessione finale (post-DESIGN-FIX-8)

7 bug residui risolti in chiusura ciclo:

- **Bollino verde notepad++ non aggiornava in tempo reale** (`sourceCode.vue listenChange()`)
  - **Causa:** flip `isSaved=true` (back-to-saved) era immediato ma flip `isSaved=false` (modifica) passava solo da `LISTEN_FOR_CONTENT_CHANGE` con debounce 1s → bollino in ritardo.
  - **Fix:** check simmetrico immediato in `listenChange()` accanto al blocco N12: `if (newMarkdown !== originalMarkdown && isSaved) isSaved = false`.

- **Ctrl+Z non funzionava in notepad++** (`sourceCode.vue` + routing menu Electron)
  - **Causa:** menu accelerator Electron intercettava Ctrl+Z → IPC `mt::editor-edit-action` → `bus.emit('undo')` → `editor.vue handleUndo` con early-return su `sourceCode.value`. `sourceCode.vue` non ascoltava `bus.on('undo')` → keystroke perso.
  - **Fix:** aggiunti `handleUndo`/`handleRedo` in `sourceCode.vue` con `editor.value.execCommand('undo'/'redo')` + `bus.on/off('undo'/'redo')` in `onMounted`/`onBeforeUnmount`.

- **Bollino non scompariva dopo Ctrl+Z su stato iniziale** (`sourceCode.vue handleFileChange`)
  - **Causa:** flag `justLoaded=true` (store `editor.js:1095` su file con pathname). Primo `LISTEN_FOR_CONTENT_CHANGE` post-edit consumava flag e sovrascriveva `originalMarkdown` con contenuto adjusted post-edit (logica pensata per Muya che normalizza). CM non normalizza → baseline shifta → Ctrl+Z back-to-saved confrontava raw iniziale vs baseline post-edit → mai uguali → bollino restava.
  - **Fix:** in `handleFileChange()` post-`setValue` → `currentTab.value.justLoaded = false` (CM non normalizza, baseline raw è già corretto).

- **Ctrl+Z cancellava tutta la parola/riga in un colpo invece di word-by-word** (`sourceCode.vue` + Muya `inputCtrl.js`)
  - **Causa CM:** CodeMirror default merge changes con origin `+input` entro `historyEventDelay` (1250ms). Digitando rapido "p1 p2\np3" tutto entrava in 1 evento undo. Hook iniziale su `inputRead` non catturava Enter (gestito da command `newlineAndIndent` via `replaceSelection`, NON dal kbd input handler).
  - **Causa Muya:** `inputCtrl.js` controllava solo `event.inputType === 'insertText'`. Enter su contenteditable emette `'insertParagraph'`/`'insertLineBreak'` → no checkpoint su nuovo paragrafo.
  - **Fix CM:** hook `editor.on('change', ...)` con filter `change.origin === '+input'` e regex `/[\s.,;:!?]/` su `change.text.join('\n')` → `cm.doc.history.lastModTime = 0` forza prossimo input come nuovo evento history.
  - **Fix Muya:** in `inputCtrl.js` aggiunto branch `event.inputType === 'insertParagraph' || 'insertLineBreak'` → `this.history.commitPending()`.

- **Scroll incompleto in sourceCode (prime righe non raggiungibili)** + **nuova riga sotto footer** — risolti insieme con re-architecture scroll.
  - **Causa Bug 3:** `.source-code { height: calc(100vh - var(--titleBarHeight)) }` eccedeva di tabBar+statusBar rispetto al container parent flex → range scrollTop sballato.
  - **Causa Bug 6:** wrappare CodeMirror (con magic margin `.CodeMirror-scroll { margin-bottom:-50px; padding-bottom:50px }` progettato per CM con altezza fissa + scroll interno) in surface scroll esterna `.source-code` overflow:auto faceva apparire `.CodeMirror` 50px più corto del contenuto reale al parent → ultime righe (specialmente nuova riga post-Invio) restavano fuori range scrollTop e finivano sotto il footer.
  - **Fix:** invertita architettura scroll → CM gestisce scroll internamente come da design originale.
    - CSS: `.source-code { height: 100%; overflow: hidden }` + `.source-code .CodeMirror { height: 100% !important }` (riempie source-code, non auto)
    - Rimosso `viewportMargin: Infinity` da config CM (non serve con scroll interno, guadagno performance)
    - Listener scroll spostato da `.source-code` → `editor.on('scroll', handleScroll)` post-init
    - `scrollToCords(y)` usa `editor.value.scrollTo(null, y)` invece di `container.scrollTop = y`
    - `handleScroll` legge da `editor.getScrollInfo().top` invece di `container.scrollTop`
    - setTimeout 150ms post-mount preserva scroll via API CM (`getScrollInfo().top` + `scrollTo`)
    - Cleanup: rimosso `removeEventListener('scroll')` da `onBeforeUnmount` (CM scroller smontato da CM stesso)

### 16. Drag finestra Windows-style + ottimizzazioni tab bar (sessione post-bug-fix-finale)

Aggiunto drag finestra OS-native dalla tab bar + serie restringimenti/fix UX.

- **Drag finestra Windows-style (`tabs.vue` CSS)**
  - `.v2-tabbar` → `-webkit-app-region: drag` + `app-region: drag` → tab bar = zona drag finestra (Chromium gestisce auto: drag + doppio-click toggle maximize/restore).
  - `no-drag` esplicito su: `.v2-tab`, `.v2-tab-new-li`, `.v2-topright-clone`, `.v2-tr-plus`, `.v2-tr-btn`, `.v2-tabs` ul → click/dragula/hover events liberi.
  - `.v2-tabbar-scroll` → eredita drag da tabbar → spazio dentro scroll-area dopo ul ristretta = drag region.
  - Dragula tab reorder coesiste: `no-drag` su `.v2-tab` non blocca mousedown/mousemove, solo cattura window-drag.

- **Bug fix: nuova tab in posizione errata dopo reorder dragula (`tabs.vue` drop handler)**
  - **Causa:** filter sibling escludeva solo `.v2-tab-new-li`, NON `gu-mirror`. Quando dragula passava `sibling=gu-mirror` al drop handler, `realSibling.classList.contains('gu-mirror')` triggera `isLastTab=true` → `toId=null` → `moveItem(tabs, fromIndex, tabs.length-1)`. Se `fromIndex === tabs.length-1`, splice no-op → state non aggiornato → desync con DOM mosso da dragula → push successivi (nuova tab) appaiono in posizione sbagliata.
  - **Fix:** aggiunto `&& !sibling.classList.contains('gu-mirror')` al filter realSibling.
  - **NB:** evitato pattern `removeChild(el)` per "revert dragula DOM mutation" — Vue v-for con :key="file.id" riconcilia naturalmente da `tabs` aggiornato. `removeChild` corrompe state interno dragula → drag successivi falliscono, Vue diff incoerente, clone/editor non aggiornano.

- **Ul width dinamica = row 1 content (`tabs.vue updateTabRowsLayout`)**
  - **Problema:** spazio "vuoto" dentro ul dopo last tab della prima riga, dentro `no-drag` ul → fastidioso per drag finestra. Causa: `.v2-tabbar-scroll { flex:1 }` → scroll fillata tabbar; ul block default → width = parent (es. 930px). Tabs contenuto < 930px → spazio finale dentro ul.
  - **Fix CSS:** `.v2-tabs { padding: 5px 0 5px 6px }` (padding-right 0).
  - **Fix JS:** in `updateTabRowsLayout()` calcola `row1Width = sum(row1Items.offsetWidth) + (n-1)*GAP + 6` e setta `ul.style.width = row1Width + 'px'` (idempotent via check `if (ul.style.width !== newUlWidth)`). Ul si restringe → spazio liberato dentro scroll-area (drag region eredita da tabbar) = drag finestra subito dopo last tab.
  - **Detection multirow:** sostituita logica `visualMultiRow` (basata su `offsetTop`) + hysteresis con **simulazione iterativa**: accumula `offsetWidth` finché entra in `availableForContent = tabbar.clientWidth - dynamicPaddingRight - ulPadding`. Vantaggio: `offsetWidth` tab è intrinseco (min-width:88 max:172 flex-shrink:0) → stabile, non dipende da ul width settata in iterazioni precedenti → no loop downgrade row 1 a 1 tab.
  - `ulPadding` costante 12 → 6 (riflette padding-left only).

- **Bug fix: clone pinnedTab non aggiornato post-drag (`tabs.vue` drop handler)**
  - **Sintomo:** drag tab attiva da row 1 a row 2+ → clone non appare. Drag attiva da row 2+ a row 1 → clone non scompare. A catena: editor non cambia view, errori successivi.
  - **Causa:** drag dragula triggera ResizeObserver burst (mirror in ul) → `updateTabRowsLayout` può flippare `hasMultiRow` transient → `watch(hasMultiRow)` setta `layoutLockUntil = Date.now() + 150` → `scheduleUpdate` post-drop (via `watch(tabs)`) entra durante lock attivo → `updateTabRowsLayout` return early → pinnedTab logic skippata.
  - **Fix:** estratto `recomputePinnedTab(items, multiRow)` helper DOM-based (no lock check). Drop handler chiama esplicitamente `nextTick → rAF → recomputePinnedTab()` → bypassa lock → garantisce clone aggiornato post-drag. `updateTabRowsLayout` ora usa stesso helper invece di logica inline duplicata.

- **ResizeObserver tabbar root (`tabs.vue onMounted`)**
  - Aggiunto `tabbarResizeObs` su `.v2-tabbar` root → `scheduleUpdate` su resize finestra.
  - **Razionale:** dopo aver settato `ul.style.width = row1Width`, ul ha width fissa inline → ResizeObserver su ul non triggera su resize finestra (ul size invariata) → tabs non rilayoutavano → tabs in row 1 si compenetravano con topright.
  - Cleanup `tabbarResizeObs.disconnect()` in `onBeforeUnmount`.

- **Width `.v2-topright-dynamic` 150→158px**
  - **Causa:** contenuto reale ~151px (clone 110 + margin-right 6 + plus 26 + sep 9) eccedeva width wrapper 150px → bordo sinistro clone tagliato da `overflow: hidden`.
  - **Fix:** width 158px → ~7px buffer a sinistra clone (allineato flex-end) → bordo dashed integro.

- **Restringimento stile interno tab (`tabs.vue` CSS)**
  - `.v2-tab` padding `0 10px 0 12px` → `0 4px 0 10px` (right -6px, left -2px).
  - `.v2-tab` `gap: 5px` → `8px` (più aria tra nome e X).
  - `.v2-tab-name`: rimosso `flex: 1`, aggiunto `min-width: 0` → span = larghezza testo intrinseca → X immediatamente dopo titolo. min-width tab 88px ancora garantisce dimensione minima.
  - `.v2-topright-clone`: `gap: 4px` → `8px` (coerenza con tab).

---

## NOTE TECNICHE IMPORTANTI

- **`markRaw` su CodeMirror**: Vue3 ref() deep-proxifica il doc tree di CodeMirror → CodeMirror's loop manuale `indexOf` confronta raw vs proxy → restituisce -1 → crash. FIX: `editor.value = markRaw(codeMirrorInstance)`. Pattern obbligatorio per qualsiasi libreria con state mutabile (CodeMirror, Three.js, Pixi.js, Monaco).
- **Patch Vite cache**: dopo patch a node_modules, cancellare `node_modules/.vite/deps/` per forzare re-bundle. In dev aggiunto `Cache-Control: no-store` in `electron.vite.config.mjs`.
- **Doppio rAF**: single rAF gira PRIMA del browser paint. Pattern affidabile per misurazioni DOM: `nextTick → rAF → rAF → measure`.
- **`_applySourceCodeForFile` timing**: deve essere chiamato PRIMA di `bus.emit('file-changed')` e con `nextTick` per garantire mount di sourceCode.vue prima dell'evento.
- **Magic margin CodeMirror** (`.CodeMirror-scroll { margin-bottom:-50px; padding-bottom:50px; overflow:scroll }`): design pensato per CM con altezza FISSA + scroll interno; nasconde scrollbar nativa via offset 50px. Wrapparlo in surface scroll esterna (parent overflow:auto + `.CodeMirror{height:auto}`) fa apparire `.CodeMirror` 50px più corto del contenuto reale → ultime righe non raggiungibili dal scroll outer. Regola: lasciare CM scrollare internamente (`.CodeMirror{height:100%}` + parent `overflow:hidden`) oppure neutralizzare magic margin con `scrollbarStyle: 'null'` + override CSS coerente (rischio rompere altri layout).
- **CodeMirror events `change` vs `inputRead`**: `inputRead` fires SOLO da kbd input handler (testo digitato), NON da command via `replaceSelection` (es. `newlineAndIndent` per Enter). Per catchare TUTTI gli input incl. Enter usare `change` event con filter `change.origin === '+input'`. `change.text` è array splittato su `\n` → `join('\n')` ricostruisce testo originale.
- **CodeMirror history merge**: changes con stesso origin entro `historyEventDelay` (default 1250ms) si fondono in 1 evento undo. Per forzare boundary (word-by-word undo) settare `cm.doc.history.lastModTime = 0` dopo char di boundary → prossimo input crea nuovo evento. Pattern: hook `change` event, regex su testo inserito.
- **contenteditable `inputType`**: Enter su contenteditable emette `inputType: 'insertParagraph'` (block-level) o `'insertLineBreak'` (Shift+Enter), NON `'insertText'`. Hook su input event devono gestire entrambi i tipi se vogliono detectare nuove righe come boundary.
- **`-webkit-app-region: drag` su Electron Windows**: marca elemento come zona drag finestra OS-native (Chromium gestisce doppio-click → toggle maximize/restore senza JS). Eredita su figli. Children interattivi devono override con `no-drag`. Su zone drag, Chromium può sopprimere alcuni mouse events (hover/mouseenter possono comportarsi differentemente) → elementi che fanno hover-expand o tracking devono essere `no-drag`. Dragula tab reorder compatibile: `no-drag` su `.v2-tab` non blocca mousedown/mousemove, blocca solo cattura window-drag OS.

- **Dragula + Vue v-for pattern**: drop handler NON deve manipolare DOM manualmente (`removeChild`, `insertBefore`) — corrompe refs interni dragula → drag successivi falliscono, Vue diff incoerente. Vue v-for con `:key` riconcilia DOM naturalmente da array reattivo post-mutation. Filtrare `gu-mirror` da sibling parameter prima di calcolare next-tab-id (mirror può essere passato come sibling in alcuni casi e portare a state update errato).

- **Ul width dinamica: simulazione vs offsetTop detection**: per restringere ul a content row 1 reale (liberare spazio drag finestra dentro scroll-area), set `ul.style.width = row1Width` inline. Detection multi-row via `offsetTop` di items INSTABILE perché dipende da ul width settata in iterazioni precedenti → può loop downgrade row 1 a 1 tab. Soluzione: simulazione iterativa accumulando `offsetWidth` (intrinseco, `flex-shrink:0` + min/max-width) finché entra in `availableForContent = tabbar.clientWidth - dynamicPaddingRight - ulPadding`. Idempotent → no ResizeObserver loop. Necessario ResizeObserver su tabbar root (non solo ul) per reagire a resize finestra (ul size fissa = non triggera).

- **`recomputePinnedTab` separato da `updateTabRowsLayout`**: pinnedTab assignment può essere skippato se `layoutLockUntil` attivo (es. da ResizeObserver burst durante drag dragula). Estrarre logica in helper DOM-based chiamabile fuori dal lock (es. da drop handler) garantisce clone sempre aggiornato post-eventi async. Pattern: `updateTabRowsLayout` gestisce layout (gated dal lock), `recomputePinnedTab` gestisce solo state pinned (no gate).

- **`justLoaded` flag (`store/editor.js`)**: pensato per Muya che normalizza markdown caricato (whitespace, newline). Primo `LISTEN_FOR_CONTENT_CHANGE` post-load consuma flag e sovrascrive `originalMarkdown` con contenuto normalizzato → baseline corretto per Muya. CodeMirror NON normalizza → consumare il flag rompe baseline → Ctrl+Z back-to-saved fallisce. Regola: in modalità sourceCode disabilitare flag immediatamente in `handleFileChange` post-`setValue`.
