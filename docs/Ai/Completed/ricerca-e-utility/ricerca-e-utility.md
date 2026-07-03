# Ricerca & Utility — Find/Replace, Sidebar, Toggle Modalità

**Scopo:** documenta la ricerca (Ctrl+F singola tab in source, Ctrl+Shift+F tutte le tab), sidebar v2 a destra sotto tab bar, toggle modalità Muya↔source (T5). Leggere PRIMA di toccare: sidebar, ricerca, evidenziazione, switch Muya↔source.

**Origine:** `MEDIUM-EASY-TASK.md`, task T1–T5 (highlight, context menu, sidebar, ricerca, toggle).

**Quando leggerlo:** ricerca e replace in singola tab o tutte le tab / highlight occorrenze / sidebar layout / toggle WYSIWYG↔source / evidenziazione match in Muya/source / selezione in sidebar.

---

## ⚠️ Invarianti Ricerca (PRIMA di Toccare Queste Aree)

### `sideBarMenuItem` — Non Rimuovere l'Oggetto

NON rimuovere l'oggetto MenuItem (4 call-site fanno `getMenuItemById(...).checked` → crash). Solo `visible:false`.

### Sidebar Dentro `editor-row` (Renderer)

Deve restare `height:100%` (NON `100vh`), senza `padding-top:40px`; sta a destra (renderizzata dopo `.container`), drag-bar `left:0`, resize invertito.

### Match Tab nella Ricerca

Usare `tabId` (le tab Untitled non hanno `pathname`).

### Jump Same-Tab Source

Solo `setSelection` (MAI `setValue`: aggiungerebbe un change annullabile spurio nello stack undo — ⚠️ NB: `setValue` **NON azzera l'undo CM5**, vedi BUG-CTRLZ in editor-advanced).

**Same-tab Muya:** nessun emit `file-changed` (un `importMarkdown` ricollasserebbe le blank line).

### Switch a Tab Muya

NON passare un cursore formato CodeMirror (`{line,ch}` senza `.key` → crash `findOutMostBlock` in `render()`). `setBlocks` ripristina il DOM esatto (blank line salve). Vedi `isMarkdownPath`.

### Highlight in Muya

Usare SOLO `editor.value.highlightSearch(value, opt, preserveCursor)` (`highlightOnly:true`). MAI `editor.value.search()` → dirotta il tasto Invio.

### `request-search-highlight` — Emesso da ENTRAMBI gli Editor

Deve essere emesso da ENTRAMBI quando ricaricano contenuto (mount source + `handleFileChange` di `editor.vue` e `sourceCode.vue`), altrimenti l'highlight si perde al cambio tab.

### `handleSidebarHighlight` — Mutuamente Esclusivo

Mutuamente esclusivo tra le due viste (`editor.vue` guarda `if (sourceCode.value) return`; `sourceCode.vue` guarda `if (!sourceCode.value) return`) → niente doppio highlight.

### `isMarkdownPath` — Fonte di Verità UNICA

`util/index.js` — fonte di verità UNICA per decidere Muya vs source (riusata da `_applySourceCodeForFile`). Se cambiano le estensioni markdown, modificare SOLO qui.

### `bus.on` ⇒ `bus.off` Simmetrico

Listener orfani = esecuzioni multiple dopo remount. Setup/teardown in `onBeforeUnmount`.

### HMR Muya

Muya è compilato nel bundle → dopo modifiche a `src/muya/` serve **restart** `npm run dev` (no hot reload).

### T2 Registry Windows — Test Post-Build

Verificabile SOLO dopo `npm run build:win` + install, non in dev.

---

## Stato Task (✅ Tutti Completati)

| Task | Stato | Sintesi Soluzione |
|---|---|---|
| T1 — Highlight occorrenze (solo source) | ✅ | Addon CM `match-highlighter`, `wordsOnly` |
| T2 — Context menu Windows "Open with MarkText" | ✅ (testabile post build) | `installer.nsh` HKCU `*\shell` |
| T3 — Stile UI professionale | ⏸️ RIMANDATO | Solo CSS, serve sessione dedicata |
| T4A — No-IDE + sidebar solo-ricerca a destra | ✅ | Menu `visible:false`, sidebar a destra in `editor-row` |
| T4B — `Ctrl+Shift+F` ricerca in TUTTE le tab | ✅ | Ricerca in-memory su `tab.markdown`, highlight Muya+source |
| T4 — `Ctrl+F` find singola tab in source | ✅ | `<editor-search>` montato sempre + handler CM |
| T5 — Toggle Muya↔source (status bar + `Ctrl+E`) | ✅ | Bottone status bar, riusa percorso menu via bus |

---

## Decisioni Utente (NON Richiedere di Nuovo)

- **Highlight occorrenze:** solo source (CodeMirror). Muya escluso.
- **Context menu Windows:** voce per **qualsiasi** file (`*`), HKCU (no admin).
- **No IDE:** niente apri-cartella / albero file / Split-Join. È un editor (stile Notepad++).
- **`Ctrl+Shift+F`:** cerca in tutte le tab aperte; risultati in sidebar solo-ricerca, **sotto** la tab bar. Click su risultato → switch tab + vai alla riga.
- **Toggle modalità:** riusare la shortcut `Ctrl+E` (`view.source-code-mode`), non crearne una nuova.
- **Jump preciso in Muya:** non supportato (cursore approssimato, offset non `{line,ch}`) → **accettato**.

---

## Soluzioni per Task

### T1 — Highlight Occorrenze (Source)

- `codeMirror/index.js`: import `addon/search/matchesonscrollbar` + `addon/search/match-highlighter` (col trattino).
- `sourceCode.vue` (config CM, ~514): `highlightSelectionMatches: { wordsOnly:true, minChars:2, showToken:false, style:'matchhighlight' }`.
  `wordsOnly:true` → evidenzia solo parole intere (doppio-click), non lettere interne.
- `codeMirror/index.css`: `.cm-matchhighlight` alpha basso (~0.18) → più tenue della selezione.

### T2 — Context Menu Windows (Registry)

- `build/windows/installer.nsh`: in `customInstall` scrivi HKCU `Software\Classes\*\shell\MarkText` (titolo, Icon, `command "%1"`); in `customUnInstall` cancella le due chiavi.
- **Verificabile solo dopo `npm run build:win` + install.**

### T4A — No-IDE + Sidebar Solo-Ricerca a Destra

- **Keybindings** (Win/Linux/Darwin): `file.open-folder`→`''`, `view.toggle-sidebar`→`''`. **Lasciato** `edit.find-in-folder` su `Ctrl+Shift+F`.
- **Menu** `visible:false` (NON rimuovere gli oggetti): Open Folder, Toggle Sidebar (4 call-site → crash se rimosso).
- **Sidebar ridotta:** `sideBar/help.js` → `sideBarIcons` solo `{id:'search'}`, `sideBarBottomIcons = []`. `store/layout.js` default `rightColumn:'search'`.
- **Sidebar a destra, sotto tab bar:** spostata dentro `editorWithTabs/index.vue` in `editor-row` (flex-row dopo `.container`). Border-left, drag-bar left, resize invertito, `height:100%`.
- **X di chiusura:** `sideBar/search.vue` header con X → `SET_LAYOUT {rightColumn:'', showSideBar:false}`.
- ⚠️ Vecchia regola `.side-bar { display:none !important }` rimossa; visibilità solo via `v-show="showSideBar"`.

### T4B — Ricerca in Tutte le Tab

- **Catena trigger** (riusata): `edit.find-in-folder` → actions/edit.js → `mt::editor-edit-action` → `EDITOR_EDIT_ACTION` → `SET_LAYOUT{search,showSideBar:true}` + `bus.emit('findInFolder')` → `sideBar/search.vue`.
- **`search.vue search()`:** itera `tabs.value`, cerca su `tab.markdown` (split per riga, case/word/regex), costruisce risultati `{filePath, tabId, matches:[{lineText, range}]}`. Live via `watch(keyword)` + content-watcher su `tabs.map(t=>t.markdown)`.
- **Highlight nell'editor:** `bus.emit('sidebar-highlight', {value, opt, preserveCursor})`.
  - Source: `sourceCode.vue handleSidebarHighlight` → highlight mark `.cm-search-match`.
  - Muya: `editor.vue handleSidebarHighlight` → `highlightSearch(value, opt, preserveCursor)`.
- **Trigger Ctrl+F / Ctrl+Shift+F** (`store/listenForMain.js`): usa `editorStore.currentSelection` (tracciata via `SET_SELECTION`).

### T4 — `Ctrl+F` Find Flottante (Source)

- `<editor-search>` spostato da `editor.vue` a `editorWithTabs/index.vue` (montato sempre).
- Handler Muya guardati con `if (sourceCode.value) return`.
- `sourceCode.vue`: handler su CM (`getSearchCursor`), case/word/regex, next/prev, replace singolo/all.
- Highlight: `.cm-search-match` (giallo tenue), `.cm-search-match-current` (ambra forte) + `scrollIntoView`, NO `setSelection` (evita doppio highlight).

### T5 — Toggle Muya↔source (Status Bar)

- `statusBar/index.vue`: bottone `v2-chip` accanto a "Wrap", label `Source`/`MD`, `v2-chip-on` se `sourceCode`.
- `toggleSourceMode` → `bus.emit('view:toggle-view-entry', 'sourceCode')` (listener in `store/preferences.js` → `TOGGLE_VIEW_MODE`).
- Computed `canToggleMode`: abilitato per untitled + estensioni markdown; disabilitato per le altre.

---

## Bug Risolti (Cronologia Compressa)

| Bug | Causa | Fix |
|---|---|---|
| T1 highlight su lettere interne | addon senza `wordsOnly` | `wordsOnly:true` |
| T5 perdita contenuto al toggle | `cmStatePerTab` ripristinava snapshot stale | se stale carica store + `clearHistory()` esplicito |
| T5 bottone non disabilitato | mancava guard estensione | computed `canToggleMode` + guard `toggleSourceMode` |
| Sidebar invisibile | `.side-bar{display:none !important}` v2 vinceva | regola rimossa |
| Sidebar a sinistra | `<side-bar>` prima di `.container` | spostata dopo; border-left, drag-bar left, resize invertito |
| Ctrl+Shift+F non cercava selezione | selezione non catturata | `currentSelection` + `SET_SELECTION` |
| Ctrl+Shift+F non chiudeva find | — | `findInFolder` emette `bus.emit('search-blur')` |
| **REGRESSIONE Invio rotto in Muya** | `search()` dirotta la selezione | rimosso quel path; `highlightSearch` highlightOnly |
| Highlight source spariva al cambio tab | remount cancella i mark | a fine setTimeout `bus.emit('request-search-highlight')` |
| **Round5 A** highlight Muya | search() spostava cursore | guard `highlightOnly`, nuovo `highlightSearch` |
| **Round5 B** Invio input sidebar | solo v-model | `@keydown.enter.prevent="onEnter"` |
| **Round5 C** live search non aggiornava | HMR stale + watcher → search non ripartiva | `@input` fallback + content-watcher |
| **Round6** click match Muya rimuove blank line | jump faceva `importMarkdown` + cursore CM crash | helper `isMarkdownPath` + jump **mode-aware** |
| **Round7** highlight perso al cambio tab | `request-search-highlight` solo source mount | emit in `editor.vue handleFileChange` + source switch |

---

## ⚠️ Tentativi Falliti (NON Ripetere)

- **Highlight Muya via `editor.value.search(value, opt)`**: mette in "modalità ricerca" e **dirotta l'Invio**. Usare invece `highlightSearch` (`highlightOnly:true`).
- **`@keyup`/`@input` da soli per live search**: inaffidabili → primario `watch(keyword)`, `@input` fallback.

---

## Mappa File Ricerca (Rapida)

- `sideBar/search.vue` — input, `search()` in-memory, `watch(keyword)`, content-watcher, emit `sidebar-highlight`, `handleRequestHighlight`, X/close.
- `sideBar/searchResultItem.vue` — risultati; `handleSearchResultClick` jump **mode-aware**.
- `sideBar/index.vue` — sidebar a destra. `sideBar/help.js` — solo icona search.
- `store/listenForMain.js` — `EDITOR_EDIT_ACTION`: trigger Ctrl+F / Ctrl+Shift+F.
- `store/editor.js` — `currentSelection`/`SET_SELECTION`; `_applySourceCodeForFile` usa `isMarkdownPath`.
- `editorWithTabs/index.vue` — `<editor-search>` sempre montato; `<side-bar>` in `editor-row`.
- `editorWithTabs/editor.vue` — handler Muya guardati; `handleSidebarHighlight`→`highlightSearch`; emit `request-search-highlight`.
- `editorWithTabs/sourceCode.vue` — find CM, `.cm-search-match`/`.cm-search-match-current`, `handleSidebarHighlight`, `request-search-highlight`.
- `muya/lib/contentState/searchCtrl.js` — guard `highlightOnly`. `muya/lib/index.js` — `highlightSearch`.
- `codeMirror/index.js` — import `searchcursor`, `matchesonscrollbar`, `match-highlighter`.
- `util/index.js` — `isMarkdownPath(pathname)` (fonte di verità unica Muya vs source).

---

## Note

- **Log diagnostici** (`[TOGGLE-DBG]`, `[SIDEBAR-DBG]`) → rimossi dopo conferma fix.
- **Build prod:** `electron-builder.yml` `npmRebuild:false` + cartella `patches/` = sospetti. `npm run rebuild-native` (`docs/DISTRIBUTION.md`).
- **HMR:** Muya compilato nel bundle → restart `npm run dev` per modifiche a `src/muya/`.
- **Follow-up non bloccante:** Muya `render(true)` su documenti molto grandi può dare lag → eventuale debounce content-watcher.
