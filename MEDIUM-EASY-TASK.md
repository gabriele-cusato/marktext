# MEDIUM-EASY-TASK — Storico conciso (task medio-facili + ricerca in tutte le tab)

> **Scopo.** Registro sintetico di COSA è stato fatto e CON QUALE soluzione, utile alle sessioni future.
> Per le invarianti dell'editor (Muya/source, dirty flag, save, watcher, selezione) → `EASY-TASK.md`.
> Per la UI v2 (token `--v2-*`, tab bar, `markRaw`) → `DESIGN-TASK.md`.
> Per le regole obbligatorie (grep call-site, IPC, bus, CSS, keybinding) → `CLAUDE.md`.

## Stato task

| Task | Stato | Sintesi soluzione |
|---|---|---|
| T1 — Highlight occorrenze (solo source) | ✅ | Addon CM `match-highlighter`, `wordsOnly` |
| T2 — Context menu Windows "Open with MarkText" | ✅ (testabile solo dopo `build:win`) | `installer.nsh` HKCU `*\shell` |
| T3 — Stile UI professionale | ⏸️ RIMANDATO | Solo CSS, serve sessione dedicata con screenshot |
| T4A — No-IDE + sidebar solo-ricerca sotto tab bar | ✅ | Menu `visible:false`, sidebar a destra dentro `editor-row` |
| T4B — `Ctrl+Shift+F` ricerca in TUTTE le tab | ✅ | Ricerca in-memory su `tab.markdown`, highlight Muya+source |
| T4 — `Ctrl+F` find singola tab in source | ✅ | `<editor-search>` montato sempre + handler CM |
| T5 — Toggle Muya↔source (status bar + `Ctrl+E`) | ✅ | Bottone status bar, riusa percorso menu via bus |

## Decisioni utente (NON richiedere di nuovo)

- **Highlight occorrenze:** solo source (CodeMirror). Muya escluso.
- **Context menu Windows:** voce per **qualsiasi** file (`*`), HKCU (no admin).
- **No IDE:** niente apri-cartella / albero file / Split-Join. È un editor (stile Notepad++).
- **`Ctrl+Shift+F`:** cerca in tutte le tab aperte; risultati in sidebar solo-ricerca, **sotto** la tab bar
  (non copre title/tab bar). Click su risultato → switch tab + vai alla riga.
- **Toggle modalità:** riusare la shortcut esistente `Ctrl+E` (`view.source-code-mode`), non crearne una nuova.
- **Jump preciso in Muya:** non supportato (cursore approssimato, offset non `{line,ch}`) → **accettato**.

---

## ⚠️ Invarianti / cose da tenere conto (PRIMA di toccare queste aree)

- **`sideBarMenuItem`**: NON rimuovere l'oggetto MenuItem (4 call-site fanno `getMenuItemById(...).checked` → crash). Solo `visible:false`.
- **Sidebar dentro `editor-row`** (`editorWithTabs/index.vue`): deve restare `height:100%` (NON `100vh`), senza `padding-top:40px`; sta a destra (renderizzata dopo `.container`), drag-bar `left:0`, resize invertito.
- **Match tab nella ricerca**: usare `tabId` (le tab Untitled non hanno `pathname`).
- **Jump same-tab source**: solo `setSelection` (MAI `setValue`: aggiungerebbe un change annullabile spurio nello stack undo — ⚠️ NB: `setValue` **NON** azzera l'undo CM5, vedi BUG-CTRLZ in HARD-TASK). **Same-tab Muya**: nessun emit `file-changed` (un `importMarkdown` ricollasserebbe le blank line).
- **Switch a tab Muya**: NON passare un cursore formato CodeMirror (`{line,ch}` senza `.key` → crash `findOutMostBlock` in `render()`). `setBlocks` ripristina il DOM esatto (blank line salve). Vedi `isMarkdownPath`.
- **Highlight in Muya**: usare SOLO `editor.value.highlightSearch(value, opt, preserveCursor)` (`highlightOnly:true`). MAI `editor.value.search()` → dirotta il tasto Invio.
- **`request-search-highlight`**: deve essere emesso da ENTRAMBI gli editor quando ricaricano contenuto (mount source + `handleFileChange` di `editor.vue` e `sourceCode.vue`), altrimenti l'highlight si perde al cambio tab.
- **`handleSidebarHighlight`**: mutuamente esclusivo tra le due viste (`editor.vue` guarda `if (sourceCode.value) return`; `sourceCode.vue` guarda `if (!sourceCode.value) return`) → niente doppio highlight.
- **`isMarkdownPath` (`util/index.js`)**: fonte di verità UNICA per decidere Muya vs source (riusata da `_applySourceCodeForFile`). Se cambiano le estensioni markdown, modificare SOLO qui.
- **`bus.on` ⇒ `bus.off` simmetrico** in `onBeforeUnmount` (listener orfani = esecuzioni multiple dopo remount).
- **HMR**: Muya è compilato nel bundle → dopo modifiche a `src/muya/` serve **restart** `npm run dev`.
- **T2 (registry)**: verificabile SOLO dopo `npm run build:win` + install, non in dev.

---

## Soluzioni per task

### T1 — Highlight occorrenze (source)
- `codeMirror/index.js`: import `addon/search/matchesonscrollbar` + `addon/search/match-highlighter` (col trattino).
- `sourceCode.vue` (config CM, ~514): `highlightSelectionMatches: { wordsOnly:true, minChars:2, showToken:false, style:'matchhighlight' }`.
  `wordsOnly:true` → evidenzia solo parole intere (doppio-click), non lettere interne.
- `codeMirror/index.css`: `.cm-matchhighlight` alpha basso (~0.18) → più tenue della selezione (`--cmSelectionColor`).

### T2 — Context menu Windows (registry)
- `build/windows/installer.nsh`: in `customInstall` scrivi HKCU `Software\Classes\*\shell\MarkText` (titolo, Icon, `command "%1"`); in `customUnInstall` cancella le due chiavi. **Verificabile solo dopo `npm run build:win` + install.**

### T4A — Rimozione IDE + sidebar solo-ricerca a destra, sotto la tab bar
- **Keybindings** (Win/Linux/Darwin): `file.open-folder`→`''`, `view.toggle-sidebar`→`''`. **Lasciato** `edit.find-in-folder` su `Ctrl+Shift+F`.
- **Menu** `visible:false` (NON rimuovere gli oggetti): Open Folder (`templates/file.js`), Toggle Sidebar (`templates/view.js`, `id:'sideBarMenuItem'` ha 4 call-site → rimuoverlo crasherebbe).
- **Sidebar ridotta:** `sideBar/help.js` → `sideBarIcons` solo `{id:'search'}`, `sideBarBottomIcons = []` (rimosso ingranaggio + import inutili). `store/layout.js` default `rightColumn:'search'`.
- **Sidebar a destra, sotto la tab bar:** spostata da `pages/app.vue` dentro `editorWithTabs/index.vue` in una flex-row (`.editor-row`) **dopo** `<tabs/>`, renderizzata DOPO `.container` (così sta a destra). `sideBar/index.vue`: `border-right`→`border-left`, drag-bar `right:0`→`left:0`, resize invertito (`startWidth - offset`), `height:100vh`→`100%`, tolto `padding-top:40px`.
- **X di chiusura:** `sideBar/search.vue` header con X → `SET_LAYOUT {rightColumn:'', showSideBar:false}`.
- ⚠️ La sidebar era invisibile per la regola `.side-bar { display:none !important }` in `v2-tokens.css` (nascondeva la vecchia IDE) → **rimossa**; ora visibilità solo via `v-show="showSideBar"`.

### T4B — Ricerca in tutte le tab
- Catena trigger riusata (NON ricreata): `edit.find-in-folder` → `actions/edit.js` → IPC `mt::editor-edit-action` → `store/listenForMain.js` `EDITOR_EDIT_ACTION` → `SET_LAYOUT{search,showSideBar:true}` + `bus.emit('findInFolder')` → `sideBar/search.vue`.
- `sideBar/search.vue`: `search()` itera `tabs.value`, cerca su `tab.markdown` (split per riga, rispetta toggle case/word/regex), costruisce risultati `{filePath: tab.pathname||tab.filename, tabId: tab.id, matches:[{lineText, range:[[l,c],[l,c]]}]}`. Live via `watch(keyword)` + `@input` (fallback) + **content-watcher** su `tabs.map(t=>t.markdown)` (aggiorna risultati anche modificando il documento). `@keydown.enter` → `onEnter`→`search()`.
- `searchResultItem.vue` `handleSearchResultClick`: trova tab via **`tabId`** (gestisce Untitled senza pathname). Comportamento **mode-aware** (vedi round 6).
- **Trigger logico Ctrl+F / Ctrl+Shift+F** (`store/listenForMain.js`): usa `editorStore.currentSelection` (tracciata da `SET_SELECTION`; Muya `SELECTION_CHANGE`, CM `cursorActivity`). Ctrl+Shift+F: chiusa→apre+cerca selezione; aperta+selezione→aggiorna; aperta+no sel→chiude. Ctrl+F: sidebar aperta→passa selezione alla sidebar; chiusa→find singola tab. Apre sidebar → `bus.emit('search-blur')` chiude il find flottante.
- **Highlight nell'editor attivo:** `search()` → `bus.emit('sidebar-highlight', {value, opt, preserveCursor})`.
  - Source: `sourceCode.vue handleSidebarHighlight` → `highlightSourceMatches` (mark `.cm-search-match`, no spostamento cursore).
  - Muya: `editor.vue handleSidebarHighlight` → `editor.value.highlightSearch(value, opt, preserveCursor)` (vedi round 5).
  - Pulizia all'`closeSidebar` e su `watch(showSideBar)`.

### T4 — `Ctrl+F` find flottante anche in source
- `<editor-search>` spostato da `editor.vue` a `editorWithTabs/index.vue` (montato sempre). Handler Muya (`handleSearch`/`handReplace`/`handleFindAction`) guardati con `if (sourceCode.value) return`.
- `sourceCode.vue`: handler `searchValue`/`find-action`/`replaceValue` su CM (`getSearchCursor`), case/word/regex, next/prev, replace singolo/all. Import `searchcursor` in `codeMirror/index.js`.
- Highlight: `.cm-search-match` (giallo tenue) per tutti, `.cm-search-match-current` (ambra forte) + `scrollIntoView` per il corrente, **senza** `setSelection` (evita doppio highlight blu del match-highlighter).

### T5 — Toggle Muya↔source (status bar)
- `statusBar/index.vue`: bottone `v2-chip` accanto a "Wrap", label `Source`/`MD`, `v2-chip-on` se `sourceCode`. `toggleSourceMode` → `bus.emit('view:toggle-view-entry', 'sourceCode')` (listener in `store/preferences.js` → `TOGGLE_VIEW_MODE` + sync spunta menu). `Ctrl+E` continua identico.
- Computed `canToggleMode`: abilitato per untitled + estensioni markdown; disabilitato (grigio, come Wrap) per le altre, allineato a `_applySourceCodeForFile`.

---

## Bug risolti (cronologia compressa)

| Bug | Causa | Fix (file) |
|---|---|---|
| T1 highlight su lettere interne | addon senza `wordsOnly` | `wordsOnly:true` (`sourceCode.vue`) |
| T5 perdita contenuto al toggle | `cmStatePerTab` ripristinava snapshot stale vs store | se `snapshot.content !== store.markdown` carica lo store + **`clearHistory()` esplicito** (⚠️ `setValue` NON azzera l'undo CM5, vedi BUG-CTRLZ in HARD-TASK); altrimenti ripristina snapshot+history (`sourceCode.vue`) |
| T5 bottone non disabilitato su non-md | mancava guard estensione | computed `canToggleMode` + guard in `toggleSourceMode` (`statusBar/index.vue`) |
| Sidebar invisibile con `showSideBar=true` | `.side-bar{display:none !important}` v2 vinceva sul `v-show` | regola rimossa (`v2-tokens.css`) |
| Sidebar a sinistra | `<side-bar>` prima di `.container` | spostata dopo; border-left, drag-bar left, resize invertito |
| Ingranaggio apriva prefs legacy | `OPEN_SETTING_WINDOW()` | rimosso (`sideBarBottomIcons=[]`) |
| Ctrl+Shift+F non cercava la selezione | selezione non catturata | `currentSelection` + `SET_SELECTION` (`store/editor.js`, `listenForMain.js`) |
| Ctrl+Shift+F non chiudeva il find flottante | — | `findInFolder` emette `bus.emit('search-blur')` |
| **REGRESSIONE** Invio rotto in Muya | `editor.value.search()` chiamava `setCursorToHighlight` → dirottava la selezione/Invio | rimosso quel path; sostituito da `highlightSearch` highlightOnly (round 5) |
| Highlight source spariva al cambio tab | remount → `setValue` (setTimeout 150ms) cancella i mark | a fine setTimeout `bus.emit('request-search-highlight')`; `search.vue handleRequestHighlight` ri-evidenzia |
| **round5 A** highlight Muya senza rompere Invio | `searchCtrl.js search()` spostava il cursore sul match | guard `if (value && !options.highlightOnly) setCursorToHighlight()`; nuovo `muya/lib/index.js highlightSearch(value,opt,preserveCursor)` → `search({highlightOnly:true})` + `render(!!preserveCursor)`; `editor.vue handleSidebarHighlight`. `preserveCursor=true` (editing doc) ripristina il caret reale; `false` (digito in sidebar) non ruba il focus |
| **round5 B** Invio nell'input sidebar inerte | solo `v-model`, nessun handler | `@keydown.enter.prevent="onEnter"` (`search.vue`) |
| **round5 C** live search non aggiornava | (1) HMR stale (Muya nel bundle → serve restart `npm run dev`); (2) `search()` ripartiva solo su `keyword`, non sul contenuto | `@input` fallback + content-watcher su `tab.markdown`; `emitEditorHighlight` in try/catch |
| **round6** click match Muya rimuove le blank line | jump faceva `importMarkdown` (re-parse) che collassa i paragrafi vuoti; cursore CM (`{line,ch}`, senza `.key`) → crash `findOutMostBlock` su tab diversa | helper condiviso `isMarkdownPath` (`util/index.js`, riusato da `_applySourceCodeForFile`); `searchResultItem.vue` jump **mode-aware**: Muya stessa-tab→nessun emit; Muya tab-diversa→`UPDATE_CURRENT_FILE` senza cursore CM (`setBlocks` preserva il DOM); source→invariato |
| **round7** highlight perso al cambio tab (cliccando un match in altro file) | `request-search-highlight` emesso SOLO da `sourceCode.vue` al mount → mancava per target Muya e per switch source→source | `editor.vue handleFileChange`: emit dopo `setMarkdown`; `sourceCode.vue handleFileChange`: emit a fine ramo tab-switch |
| Avvio app build crashava | build incompleta / processo zombie (single-instance lock) | `npm run build:win` pulito. Log prod: `%APPDATA%\marktext\logs\...\main.log`; lanciare exe con `--enable-logging` |

## ⚠️ Tentativi falliti (NON ripetere)
- **Highlight Muya via `editor.value.search(value, opt)`**: mette Muya in "modalità ricerca" e **dirotta l'Invio** finché lo stato resta attivo. Usare invece `highlightSearch` (`highlightOnly:true`), che evidenzia senza toccare il cursore.
- **`@keyup`/`@input` da soli per la live search**: inaffidabili → primario `watch(keyword)`, `@input` solo come fallback.

## Mappa file ricerca (rapida)
- `sideBar/search.vue` — input, `search()` in-memory tutte le tab, `watch(keyword)`/`@input`/content-watcher, emit `sidebar-highlight`, `handleRequestHighlight`, X/close.
- `sideBar/searchResultItem.vue` — risultati; `handleSearchResultClick` jump **mode-aware** (match via `tabId`).
- `sideBar/index.vue` — sidebar a destra (border-left, drag-bar left, resize invertito). `sideBar/help.js` — solo icona search, nessun bottom icon.
- `store/listenForMain.js` — `EDITOR_EDIT_ACTION`: trigger Ctrl+F / Ctrl+Shift+F + `search-blur`.
- `store/editor.js` — `currentSelection`/`SET_SELECTION`; `_applySourceCodeForFile` usa `isMarkdownPath`.
- `editorWithTabs/index.vue` — `<editor-search>` sempre montato; `<side-bar>` nella `editor-row`.
- `editorWithTabs/editor.vue` — handler Muya guardati `if (sourceCode.value) return`; `handleSidebarHighlight`→`highlightSearch`; emit `request-search-highlight` post-setMarkdown.
- `editorWithTabs/sourceCode.vue` — find CM (`getSearchCursor`), `.cm-search-match`/`.cm-search-match-current`, `handleSidebarHighlight`, `request-search-highlight` (mount + ramo tab-switch).
- `muya/lib/contentState/searchCtrl.js` — guard `highlightOnly` su `setCursorToHighlight`. `muya/lib/index.js` — `highlightSearch`.
- `codeMirror/index.js` — import `searchcursor`, `matchesonscrollbar`, `match-highlighter`.
- `util/index.js` — `isMarkdownPath(pathname)` / `MARKDOWN_EXTENSIONS` (fonte di verità unica Muya vs source).

## Note
- **Log diagnostici** (`[TOGGLE-DBG]`, `[SIDEBAR-DBG]`) → rimossi dopo conferma fix.
- **Build prod:** `electron-builder.yml` `npmRebuild:false` + cartella `patches/` mancante = sospetti per crash su moduli nativi → `npm run rebuild-native` (`docs/DISTRIBUTION.md`). Warning `cannot find path for dependency name=undefined` = benigno.
- **HMR:** Muya è compilato nel bundle → dopo modifiche a `src/muya/` serve **restart** `npm run dev`, l'hot-reload non basta.
- **Follow-up non bloccante:** in Muya `render(true)` per keystroke su documenti molto grandi può dare lag → eventuale debounce ~200ms sul content-watcher.
