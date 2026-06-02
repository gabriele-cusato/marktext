# MEDIUM-EASY-TASK — Piano operativo (sessione vuota)

## Progress

| T | % | Status |
|---|---|---|
| T5 Toggle | 100% | ✅ DONE (bug1 perdita contenuto + bug2 disable risolti) |
| T1 Highlight | 100% | ✅ DONE (wordsOnly) |
| T4A No-IDE + sidebar | 100% | ✅ DONE (sidebar a destra, X, ingranaggio rimosso) |
| T4B Ricerca tab | 80% | ⚠️ 3 bug aperti → vedi "DA RIPRENDERE": A) highlight Muya, B) Invio input sidebar, C) live search |
| T4 Ctrl+F source | 100% | ✅ DONE (find su CodeMirror + highlight giallo) |
| T2 Registry | 100% | ✅ DONE (testato: voce appare/sparisce) |
| T3 UI | - | SKIPPED |

> **Dettaglio completo dei fix e dei bug aperti: vedere la sezione finale
> "SESSIONE FIX 2026-06-01" in fondo a questo file.**

## Test checklist

**T5 — Toggle Source/MD (status bar)**
- [x] Bottone "MD" visibile nella status bar (modalità Muya)
- [x] Click → passa a Source, etichetta diventa "Source", chip evidenziato
- [x] Click di nuovo → torna Muya, etichetta "MD"
- [x] `Ctrl+E` continua a funzionare identico al bottone
- [ ] ??? Spunta nel menu View > Source Code Mode resta sincronizzata
- [ ] In entrambe le modalità il documento non perde contenuto

BUG: 
1 [ ] - se passo a source mode perdo contenuto, e poi se torno indietro il contenuto è completamente eliminato (non è che non si vede, ma proprio viene cancellato)
sembra che solo la modifica alla prima riga venga presa, dopodichè tutto perso
2 [ ] - il bottone source NON è bloccato in file che non hanno estensione md (il bottone dev'essere abilitato per file untitled e file md, per il resto dev'essere messo a source e disabilitato come il bottone wrap)

**T1 — Highlight occorrenze (source mode)**
- [x] Selezionare una parola ≥2 caratteri in source mode → le altre occorrenze si colorano in blu tenue
- [x] La selezione attiva è chiaramente più evidente dell'highlight delle occorrenze
- [x] Selezionare 1 carattere → nessun highlight (minChars:2)
- [x] Deselezionare → highlight sparisce
- [x] Funziona con tema scuro (railscasts/one-dark) e tema chiaro
- [x] In modalità Muya non appare nessun highlight (addon solo source)

BUG: 
1 [ ] - selezionando anche solo lettere funziona, dovrebbe funzionare solo con parole intere, se faccio doppio click su una parola, solo quella puo funzionare, se seleziono alcune lettere (piu di 2) non deve funzionare

**T4A — No-IDE: rimozione apertura cartella + sidebar sotto tab bar**
- [x] Menu File non mostra "Open Folder"
- [ ] ??? Menu View non mostra "Toggle Sidebar"
- [x] `Ctrl+Shift+O` non apre il dialogo cartella
- [x] `Ctrl+J` inerte (nessuna sidebar che appare)
- [ ] Sidebar di ricerca (quando aperta) parte sotto la tab bar, non la copre
- [ ] La sidebar NON copre la finestra title bar
- [ ] Icona sidebar mostra solo l'icona "search" (no files/toc)
- [ ] Icona settings in fondo alla sidebar ancora funziona
- [ ] La sidebar è ridimensionabile tramite drag-bar

BUG: 
1 [ ] - Ctrl+shift+F non fa nulla, non apre nulla (ne muya ne source mode)
2 [ ] - Ctrl+F non funziona in source mode ma solo in muya (apertura riquadro ricerca)

**T4B — Ctrl+Shift+F: ricerca in tutte le tab**
- [ ] `Ctrl+Shift+F` apre la sidebar di ricerca
- [ ] Digitare una parola → risultati raggruppati per tab
- [ ] Il conteggio match (es. "5 results in 2 files") è corretto
- [ ] Filtri Case Sensitive / Whole Word / Regex funzionano
- [ ] Click su un match in una tab non attiva → switch tab + posizione cursore sulla riga (source mode)
- [ ] Click su un match nella tab già attiva (source) → cursore va alla riga corretta senza perdere history undo
- [ ] Tab Untitled (senza pathname) trovate e cliccabili
- [ ] Regex non valida mostra errore, non crasha
- [ ] Ctrl+F (find singola tab) non è influenzato
- [ ] Cancellare la keyword → lista risultati sparisce

**T2 — Context menu Windows "Open with MarkText"**
- [ ] ??? (Solo dopo `npm run build:win` + install ???) Click destro su qualsiasi file in Esplora Risorse → voce "Open with MarkText" presente
- [ ] Clicking la voce → MarkText apre il file
- [ ] Disinstallando MarkText → voce rimossa dal context menu

> **Scopo.** Questo file contiene TUTTO il necessario per implementare i task della sezione
> **"Medio-facile"** di `TODO.md` (più la ricerca in tutte le tab, spostata qui su richiesta utente)
> partendo da una sessione senza contesto. Ogni task ha: cosa fare, file esatti, approccio,
> rischi/invarianti da non rompere, come verificare.
>
> **PRIMA DI TOCCARE CODICE leggere, in quest'ordine:**
> 1. `marktext/CLAUDE.md` (root) — checklist generale obbligatoria (grep call-site, IPC, bus, CSS, keybinding).
> 2. `marktext/EASY-TASK.md` — storico editor (Muya vs source, dirty flag, save, watcher, shortcut). In
>    particolare la sez. **A** (doppia modalità), **B** (bollino), **H** (shortcut mode-aware), e la
>    tabella "Se la tua modifica tocca…".
> 3. `marktext/DESIGN-TASK.md` — UI v2 (token `--v2-*`, status bar, tabs, `markRaw` su CodeMirror).
>
> **Regola d'oro (da CLAUDE.md):** prima di cambiare firma/rimuovere qualcosa di "visibile dall'esterno"
> (funzione, evento bus, canale IPC, classe CSS, keybinding) → **grep tutti i call-site**. Non assumere
> che "nessun altro lo usa".

---

## Stato e decisioni utente (già prese — NON richiedere di nuovo)

| Task | Decisione presa |
|---|---|
| 1. Evidenzia occorrenze | **Solo source mode (CodeMirror)**. Muya escluso (troppo complesso, tocca l'engine). |
| 2. Context menu Windows | Aggiungere voce "Open with MarkText" al menu tasto-destro di **qualsiasi file** (`*`). |
| 3. Stile UI professionale | **RIMANDATO** — solo bozza/placeholder, da definire in sessione dedicata con screenshot. |
| 4. No-IDE + ricerca tab | **Niente Split/Join.** Rimuovere apertura cartelle + albero file (è un editor, non un IDE). **`Ctrl+Shift+F` = cerca in TUTTE le tab aperte**, risultati in una **sidebar solo-ricerca** che resta **dentro l'area editor, sotto la tab bar** (non copre title/tab bar). Click su un risultato → **switch tab + vai alla riga**. |
| 5. Toggle Muya↔source | Bottone nel **footer/status bar** accanto a "Wrap" **+** shortcut. La shortcut **esiste già: `Ctrl+E`** → riusarla, non crearne una nuova. |

---

## ✅ Verifiche già eseguite (codice sicuro da implementare)

Controlli fatti su questo codebase il 2026-06-01 → le indicazioni sotto sono confermate:

| Verifica | Esito |
|---|---|
| Addon CM `match-highlighter.js` + `matchesonscrollbar.js` presenti in `node_modules` | ✅ esistono (nome con trattino) |
| Opzione/classe addon (`highlightSelectionMatches` / `cm-matchhighlight`, `showToken:false` default) | ✅ confermato da codice addon |
| `searchcursor` necessario per highlight | ❌ NON serve |
| Shortcut toggle Muya↔source già esistente | ✅ `Ctrl+E` = `view.source-code-mode` |
| `LISTEN_TOGGLE_VIEW()` invocata all'init | ✅ `pages/app.vue:231` |
| `bus.on('view:toggle-view-entry')` + `TOGGLE_VIEW_MODE`/`SET_SINGLE_PREFERENCE` | ✅ `store/preferences.js:180/131/143` |
| `bus`, `t`, `sourceCode` disponibili in `statusBar/index.vue` | ✅ righe 115/111/12 |
| Call-site di `sideBarMenuItem` (rischio crash se rimosso) | ✅ 4 trovati → usare `visible:false`, NON rimuovere |
| Catena trigger `Ctrl+Shift+F` | ✅ keybinding `edit.find-in-folder` → menu `findInFolder` → IPC `mt::editor-edit-action` → `listenForMain.js:10` (`rightColumn:'search'`, `showSideBar:true`, bus `findInFolder`) → `sideBar/search.vue` (`bus.on('findInFolder')`) |
| `searchResultItem.handleSearchResultClick` fa già "switch tab + vai a riga" | ✅ `sideBar/searchResultItem.vue:127` (trova tab, setta `cursor`, `UPDATE_CURRENT_FILE`/`file-changed renderCursor`) |
| Layout: dove sta la sidebar oggi | ✅ `pages/app.vue:6` `<side-bar>` è sibling di `.editor-middle`, `height:100vh` (copre anche l'altezza della tab bar) |
| Punto dove spostarla sotto la tab bar | ✅ `editorWithTabs/index.vue` (`<tabs/>` poi `.container`) |
| NSIS: config in `electron-builder.yml` + `build/windows/installer.nsh` (HKCU) | ✅ confermato |
| Voci menu reali | ✅ Open Folder `file.js:37`, Toggle Sidebar `view.js:53`, Find in Folder `edit.js:159` |
| `app.vue` usa `<script setup>` (no sezione `components:{}`) | ✅ basta gestire import + tag |

**Unico punto NON testabile in dev:** Task 2 (registro Windows) → solo dopo `npm run build:win` + install.

---

## TASK 1 — Evidenzia occorrenze della parola selezionata (solo source)

**Obiettivo.** In source mode (CodeMirror), selezionando una parola, tutte le altre occorrenze uguali
nel documento si evidenziano con un colore **più tenue / meno opaco** della selezione attiva (devono
essere meno evidenti, requisito esplicito).

**Approccio (semplice).** Addon nativo CodeMirror `match-highlighter` (NON importato ora). Si abilita via
opzione `highlightSelectionMatches`; lo stile si controlla con la classe CSS `.cm-matchhighlight`.

**File e modifiche.**

1. `src/renderer/src/codeMirror/index.js` — aggiungere gli import accanto agli altri addon (riga ~2-4):
   ```js
   import 'codemirror/addon/search/matchesonscrollbar'
   import 'codemirror/addon/search/match-highlighter'
   ```
   ✅ **VERIFICATO** (lettura `node_modules/codemirror/addon/search/match-highlighter.js`):
   - il file è `match-highlighter.js` (CON trattino), NON `matchhighlighter`.
   - dipende da `./matchesonscrollbar` (lo fa `require` internamente) → importarlo prima per sicurezza.
   - NON serve `searchcursor`.

2. `src/renderer/src/components/editorWithTabs/sourceCode.vue` — in `onMounted`, dentro
   `codeMirrorConfig` (intorno a riga 482-500), aggiungere:
   ```js
   highlightSelectionMatches: {
     minChars: 2,           // non evidenziare selezioni di 1 carattere
     showToken: false,      // evidenzia SOLO ciò che è selezionato (non la parola sotto il cursore)
     annotateScrollbar: false,
     style: 'matchhighlight' // → classe CSS .cm-matchhighlight
   },
   ```
   ✅ **VERIFICATO** (codice addon): default già `showToken:false`, `minChars:2`, `style:'matchhighlight'`,
   `trim:true`, `annotateScrollbar:false` → si potrebbe usare anche `highlightSelectionMatches: true`.
   Classe CSS finale `cm-matchhighlight` (prefisso `cm-` aggiunto da CM). `showToken:false` è importante:
   con `true` evidenzierebbe la parola sotto il cursore anche senza selezione (NON quello richiesto).

3. `src/renderer/src/codeMirror/index.css` — definire la classe con opacità ridotta:
   ```css
   .CodeMirror .cm-matchhighlight {
     background-color: rgba(56, 139, 253, 0.18); /* molto più tenue di --cmSelectionColor (0.6) */
     border-radius: 2px;
   }
   ```
   **NB:** la selezione attiva usa `--cmSelectionColor` (default `rgba(56,139,253,0.6)`, EASY-TASK sez. F).
   L'highlight delle occorrenze DEVE restare più chiaro → alpha basso (~0.15-0.20).

**Rischi / invarianti.**
- L'addon lavora dentro CodeMirror (overlay) → **non interagisce con store, `cursorActivity`/N12/dirty flag**
  (EASY-TASK sez. A/B). Non toccare quella logica.
- Con temi scuri (railscasts/one-dark) verificare che l'highlight resti visibile ma tenue; se serve,
  override a specificità alta come per la selezione (EASY-TASK B4-bis).
- Non confondere con `styleActiveLine` (già attivo): cose diverse, nessun conflitto.

**Verifica.** File in source mode, selezionare una parola ripetuta → le altre occorrenze si colorano
leggermente; la selezione attiva resta nettamente più evidente.

---

## TASK 2 — Context menu tasto destro Windows ("Open with MarkText")

**Obiettivo.** Aggiungere al menu contestuale di Esplora Risorse (click destro su un file) la voce per
aprire il file con MarkText.

**Correzione rispetto a TODO.md.** Il TODO dice «`package.json` sezione `build.nsis`». In realtà la
config NSIS è in `electron-builder.yml` (chiave `nsis:`) e usa uno **script custom** già esistente:
`build/windows/installer.nsh` (referenziato da `nsis.include: windows/installer.nsh`). Quel file scrive
già chiavi di registro (associazione `.md` ecc.) in **HKCU** (`Software\Classes\…`), coerente con
`perMachine: false` (install per-utente, no admin). → La voce va aggiunta **lì**, in HKCU, NON in
package.json e NON in HKCR (che vorrebbe admin).

**File e modifiche.** `build/windows/installer.nsh`:

1. Nel macro `customInstall` (dentro il blocco "YES", prima dell'etichetta `SkipAssoc:`):
   ```nsis
   ; Voce context-menu "Open with MarkText" su qualsiasi file (*)
   WriteRegStr       HKCU "Software\Classes\*\shell\MarkText" "" "Open with MarkText"
   WriteRegExpandStr HKCU "Software\Classes\*\shell\MarkText" "Icon" "$INSTDIR\marktext.exe,0"
   WriteRegExpandStr HKCU "Software\Classes\*\shell\MarkText\command" "" '"$INSTDIR\marktext.exe" "%1"'
   ```

2. Nel macro `customUnInstall`, cleanup (prima la sottochiave `command`):
   ```nsis
   DeleteRegKey HKCU "Software\Classes\*\shell\MarkText\command"
   DeleteRegKey HKCU "Software\Classes\*\shell\MarkText"
   ```

**Rischi / invarianti.**
- `*\shell\MarkText` vale per TUTTI i file (l'utente ha chiesto "qualsiasi file"). Mantenere lo stile
  delle chiavi già presenti (HKCU, `WriteRegExpandStr` per i path con `$INSTDIR`).
- `%1` = path del file cliccato; virgolette `"%1"` obbligatorie (path con spazi).

**Verifica.** **NON testabile in dev.** Le chiavi si scrivono solo dall'installer → `npm run build:win`,
installare il `.exe`, poi click destro su un file → "Open with MarkText". Disinstallando deve sparire.

---

## TASK 3 — Stile UI più professionale (RIMANDATO)

**Stato: bozza / placeholder.** Decisione utente: rimandare a sessione dedicata con screenshot.

**Dove si agirebbe (solo CSS).**
- Token v2: `src/renderer/src/assets/styles/v2-tokens.css` (colori `--v2-*`, shadow, timing, font —
  Inter + JetBrains Mono già caricati).
- Temi: `src/renderer/src/assets/themes/*.theme.css`.
- Aree possibili (da concordare): `border-radius`, spacing/padding, tipografia, palette colori.

**Quando si riprende:** chiedere all'utente uno screenshot/riferimento prima di toccare i token. Una
variabile CSS può essere usata in più temi → cambiare un file non aggiorna gli override negli altri.

---

## TASK 4 — Editor (no IDE): rimuovi apri-cartella + albero file, e `Ctrl+Shift+F` = cerca in tutte le tab

**Contesto / chiarimento del "bug" segnalato.**
- `Ctrl+J` = `view.toggle-sidebar`: apriva la sidebar file-explorer originale (albero cartelle/search/TOC),
  che appariva "vuota" solo perché nessuna cartella era aperta. Non è un crash.
- `Ctrl+I` = `format.emphasis` (corsivo in Muya): **non è un bug**, era solo l'effetto visibile vicino.

**Decisione utente.** È un editor di testo (stile Notepad++), non un IDE:
1. **Rimuovere** l'apertura cartelle e l'**albero file** (la parte "IDE").
2. **`Ctrl+Shift+F` deve cercare in TUTTE le tab aperte** (non più ripgrep su cartella su disco), con i
   risultati mostrati in una **sidebar solo-ricerca** (riuso dei componenti esistenti) che resta **dentro
   l'area editor, sotto la tab bar** (NON deve coprire title/tab bar della finestra).
3. Click su un risultato → **switch alla tab + vai alla riga** del match.
4. **Niente Split/Join.**

Questo task è il più grande (complessità Medio, ~80-150 righe). Conviene farlo per ultimo tra i funzionali.
Si divide in **4A (rimozione IDE + layout sidebar)** e **4B (ricerca in tutte le tab)**.

---

### 4A — Rimuovere apri-cartella + albero file; sidebar solo-ricerca sotto la tab bar

**Strategia (sicura — VERIFICATA).** NON cancellare gli oggetti MenuItem: `sideBarMenuItem` ha **4
call-site** che fanno `getMenuItemById('sideBarMenuItem').checked` → rimuoverlo crasherebbe. Quindi:
**nascondere** le voci con `visible: false`, svuotare le keybinding non più usate, e **ridurre** la
sidebar al solo pannello ricerca. NON rimuovere store `project.js`, IPC o watcher: restano inerti.

✅ **Call-site di `sideBarMenuItem` (NON romperli):** `templates/view.js:53` (def), `menu/index.js:264`
(`updateMenuItem`), `actions/edit.js:162-163` (findInFolder), `actions/view.js:117` (`changeMenuByName`).
Con `visible:false` l'item esiste ancora → tutti sani.

**File e modifiche.**

1. **Keybindings** (tutti e 3: `keybindingsWindows.js`, `keybindingsLinux.js`, `keybindingsDarwin.js`):
   - `file.open-folder` → `''`
   - `view.toggle-sidebar` → `''` (la sidebar ora si apre solo con Ctrl+Shift+F)
   - **LASCIARE** `edit.find-in-folder` su `Ctrl+Shift+F` (verrà ricablata in 4B, NON disabilitarla).

2. **Menu templates — `visible: false` (NON cancellare l'oggetto):**
   - `templates/file.js` voce **Open Folder** (riga ~36-42) → `visible: false`. Valutare anche **Open
     Recent** cartelle (riga ~47).
   - `templates/view.js` voce **Toggle Sidebar** (riga ~51-60, `id:'sideBarMenuItem'`) → `visible: false`
     (lasciare `id` e resto: i 4 call-site dipendono dall'item).

3. **Sidebar ridotta a solo-ricerca** (`src/renderer/src/components/sideBar/`):
   - `help.js` → in `sideBarIcons` tenere SOLO `{ id:'search' }`; togliere `files` e `toc` (rimuovere
     anche gli import `FilesIcon`/`TocIcon` ora inutilizzati).
   - `index.vue` → la colonna destra (`right-column`) renderizza già `search.vue` quando
     `rightColumn==='search'`. Con una sola icona, `rightColumn` sarà sempre `'search'`. Si possono
     rimuovere i rami `tree`/`toc` (`v-if rightColumn==='files'` e `'toc'`) + relativi import `Tree`/`Toc`
     per pulizia. (Opzionale: lasciare ma non si attivano mai.)
   - **NON** rimuovere `index.vue` del tutto: serve come contenitore della ricerca.
   - ⚠️ **`store/layout.js` default `rightColumn: 'files'` (riga 9):** con l'icona `files` rimossa, se la
     sidebar si aprisse con `rightColumn==='files'` mostrerebbe vuoto. In pratica l'unico opener rimasto
     (Ctrl+Shift+F → `listenForMain.js:10`) forza già `rightColumn:'search'`, quindi è innocuo; ma per
     pulizia/robustezza cambiare il default a `rightColumn: 'search'`.

4. **Spostare la sidebar SOTTO la tab bar** (requisito esplicito: non coprire title/tab bar).
   Oggi: `pages/app.vue:6` monta `<side-bar>` come sibling di `.editor-middle`, full-height a sinistra
   di tutto (quindi a fianco anche della tab bar). Per metterla sotto la tab bar va spostata **dentro**
   `editorWithTabs/index.vue`, in una flex-row dopo `<tabs/>`:
   - In `pages/app.vue`: rimuovere `<side-bar v-if="init" />` (riga 6) e l'import (riga 69).
   - In `components/editorWithTabs/index.vue`: il template è
     ```
     .editor-with-tabs (flex column)
       <tabs/>
       .container (flex:1) → editor / source-code
     ```
     Avvolgere `.container` (e la nuova sidebar) in una **flex-row** sotto `<tabs/>`:
     ```html
     <tabs />
     <div class="editor-row">           <!-- display:flex; flex:1; min-height:0 -->
       <side-bar v-if="showSideBar" />  <!-- ora a sinistra, SOTTO la tab bar -->
       <div class="container" @wheel="onContainerWheel"> … </div>
     </div>
     ```
     Importare `SideBar` qui. La sidebar (`height:100vh` nel suo CSS) va corretta a `height:100%` per
     riempire la riga (non più tutta la finestra). `index.vue` già legge `showSideBar`/`sideBarWidth`
     (usati per `max-width`): rivedere quel calcolo (con la sidebar dentro la row il `max-width` su
     `.editor-with-tabs` non serve più, è il flex della row a gestire le larghezze).
   - **Rischio layout:** è la parte più delicata. La sidebar usa `height:100vh` e `padding-top:40px`
     (per stare sotto la title bar originale). Spostandola nella row va messa `height:100%` e tolto il
     `padding-top:40px` (non c'è più la title bar sopra di lei). Verificare lo scroll dei risultati
     (`.search-result { flex:1; overflow-y:auto }` resta valido dentro `height:100%`).

5. **Keybinding `view.toggle-sidebar` svuotato** → `Ctrl+J` inerte. `Ctrl+I` resta corsivo in Muya.

**Verifica 4A.** Niente albero file; menu senza Open Folder/Toggle Sidebar; `Ctrl+Shift+O` non apre il
dialog cartella; la sidebar (quando aperta) parte sotto la tab bar e non copre tab/finestra.

---

### 4B — `Ctrl+Shift+F` = ricerca in tutte le tab aperte

**Catena trigger (riusare, NON ricrearla).** ✅ verificata:
`edit.find-in-folder` (Ctrl+Shift+F) → `actions.findInFolder` (`menu/actions/edit.js:93`) → IPC
`mt::editor-edit-action` 'findInFolder' → `store/listenForMain.js:10` `EDITOR_EDIT_ACTION` → `SET_LAYOUT
{ rightColumn:'search', showSideBar:true }` + `bus.emit('findInFolder')` → `sideBar/search.vue`
(`bus.on('findInFolder')`). **Tutto questo resta**: cambia solo COSA fa la ricerca.

**Modifica core.** `src/renderer/src/components/sideBar/search.vue` — sostituire la ricerca ripgrep
su cartella con una ricerca **in memoria sulle tab aperte**:

- Importare `tabs` da `useEditorStore` (`const { tabs } = storeToRefs(editorStore)`).
- Riscrivere `search()`: iterare `tabs.value`, per ciascuna tab cercare in `tab.markdown` (contenuto
  corrente, **incluse modifiche non salvate**). Per ogni tab costruire un risultato nella **stessa forma
  dati** che `searchResultItem.vue` già consuma, così il componente risultato si riusa quasi invariato:
  ```js
  // forma attesa da searchResultItem.vue:
  {
    filePath: tab.pathname || tab.filename,   // vedi NB untitled sotto
    tabId: tab.id,                            // AGGIUNTA: per matchare anche untitled
    matches: [
      { lineText: '<testo riga>', range: [[line, chStart], [line, chEnd]] },
      ...
    ]
  }
  ```
  Implementazione ricerca per tab: `const lines = tab.markdown.split('\n')`; per ogni riga trovare le
  occorrenze del `keyword` (rispettando i toggle `isCaseSensitive`/`isWholeWord`/`isRegexp` già presenti
  nel componente) e pushare un match con `range` `[[i, start],[i, end]]` e `lineText = lines[i]`.
- Rimuovere/ignorare: `RipgrepDirectorySearcher`, `projectTree`, `showNoFolderOpenedMessage`,
  `inclusions: MARKDOWN_INCLUSIONS`, cancel-timer ripgrep, `openFolder()`. (La ricerca in memoria è
  sincrona e veloce: niente cancel/async necessari. Si può lasciare un piccolo debounce sull'input.)
- Placeholder input → cambiarlo (es. nuova chiave i18n "Cerca in tutte le tab") al posto di
  `searchInFolder`.

**Click su un risultato → switch tab + vai alla riga.** `searchResultItem.vue:127`
`handleSearchResultClick` fa **già** quasi tutto: trova la tab e setta `cursor` (`{anchor:{line,ch},
focus:{line,ch}}`), poi `UPDATE_CURRENT_FILE` (cambia tab) o `bus.emit('file-changed', {renderCursor})`.
**Una sola adattamento necessario:** oggi trova la tab via `isSamePathSync(file.pathname, filePath)` →
le tab **Untitled non hanno pathname**. Cambiare il match per usare `tabId`:
```js
const openedTab = tabs.value.find(f => f.id === props.searchResult.tabId)
                  || tabs.value.find(f => window.fileUtils.isSamePathSync(f.pathname, props.searchResult.filePath))
```
- ✅ In **source mode**, cambiando tab, il jump è preciso: `sourceCode.vue handleFileChange` (riga 141)
  onora `cursor` a riga 217 → `setSelection(anchor, focus, {scroll:true})`.
- ⚠️ **BUCO VERIFICATO da gestire — match nella tab GIÀ attiva (source):** `handleFileChange` a riga 151
  fa **early-return** su `id === tabId.value` (fix anti-loop commitTimer) PRIMA del blocco cursor →
  quindi se il match è nella tab corrente, l'`emit('file-changed', {cursor, renderCursor})` di
  `handleSearchResultClick` NON salta alla riga. Va aggiunto un branch nel ramo same-tab di
  `handleFileChange`:
  ```js
  if (id === tabId.value) {
    // ... (forceReload e justLoaded già gestiti) ...
    // AGGIUNTA: jump richiesto dalla ricerca sulla tab già attiva.
    // Solo setSelection (NESSUN setValue) → non azzera la history undo.
    if (renderCursor && cursor && editor.value) {
      const { anchor, focus } = cursor
      try { editor.value.setSelection(anchor, focus, { scroll: true }) } catch (e) { /* clamp come riga 220 */ }
    }
    return
  }
  ```
  Nota: aggiungere `renderCursor` alla destrutturazione di `handleFileChange` (riga 141, oggi non c'è).
  `setSelection` senza `setValue` è sicuro per la history (EASY-TASK sez. A: il loop nasce da setValue+setHistory).
- ⚠️ In **Muya** il cursore preciso è approssimato: Muya usa `muyaIndexCursor` (offset `{focus,anchor}`),
  non `{line,ch}`. Risultato pratico: switch alla tab corretta + scroll, posizione fine non garantita
  (accettato dall'utente). NON tentare di reimplementare il cursore Muya qui.

**Rischi / invarianti.**
- La ricerca legge `tab.markdown` (store). In source mode `tab.markdown` può essere **stale fino a ~1s**
  (debounce, EASY-TASK sez. A/C). Conseguenza minore: una modifica digitata <1s fa potrebbe non comparire
  subito nei risultati. Se serve precisione, emettere `bus.emit('pre-save')` prima di cercare per forzare
  il flush del tab attivo (riusa `handlePreSave`); ma è un nice-to-have, non bloccante.
- `searchResultItem.vue` usa `window.path.basename/extname(filePath)` per il titolo: per le Untitled
  passare `tab.filename` come `filePath` evita crash (basename di una stringa semplice è ok).
- Non rompere la Find&Replace della singola tab (`components/search/index.vue`, Ctrl+F): è un altro
  componente, indipendente. Questo task tocca SOLO la sidebar (`sideBar/search.vue` + `searchResultItem.vue`).
- Mantenere `bus.off` simmetrici se si aggiungono `bus.on` (CLAUDE.md). `search.vue` già fa
  `bus.on('findInFolder')` in onMounted — verificare l'eventuale off.

**Verifica 4B.** Aprire 2-3 tab con testo. `Ctrl+Shift+F` → si apre la sidebar ricerca sotto la tab bar;
digitando una parola compaiono i risultati raggruppati per tab con conteggio match; click su un match →
passa alla tab giusta e (in source) posiziona il cursore sulla riga. Funziona anche con tab Untitled.

---

## TASK 5 — Toggle rapido Muya ↔ source (bottone status bar + shortcut esistente)

**Scoperta chiave.** La shortcut esiste GIÀ: `['view.source-code-mode', 'Ctrl+E']`
(`keybindingsWindows.js:97`) → `toggleSourceCodeMode` (`menu/actions/view.js`) →
`mt::toggle-view-mode-entry` 'sourceCode' → `preferences.js` `TOGGLE_VIEW_MODE`. **NON creare una nuova
shortcut.** Basta documentarla e aggiungere il bottone.

**Obiettivo.** Bottone nella status bar v2, accanto a "Wrap", che togla Muya↔source riusando il percorso
esistente.

**File e modifiche.** `src/renderer/src/components/statusBar/index.vue`

1. **Template** — accanto al bottone "Wrap" (riga ~11-21):
   ```html
   <button
     class="v2-chip"
     :class="{ 'v2-chip-on': sourceCode }"
     :title="t('statusBar.toggleSource', 'Toggle Source / Markdown (Ctrl+E)')"
     @click="toggleSourceMode"
   >{{ sourceCode ? 'Source' : 'MD' }}</button>
   ```
   (`sourceCode` già disponibile: usato a riga 12 per disabilitare "Wrap".)

2. **Script** — aggiungere:
   ```js
   const toggleSourceMode = () => {
     bus.emit('view:toggle-view-entry', 'sourceCode')
   }
   ```
   ✅ **VERIFICATO:** `LISTEN_TOGGLE_VIEW()` invocata in `pages/app.vue:231`; listener
   `bus.on('view:toggle-view-entry')` in `store/preferences.js:180` → `TOGGLE_VIEW_MODE` (131) +
   `DISPATCH_EDITOR_VIEW_STATE` (sincronizza la spunta nel menu). `bus` e `t` già importati
   (`statusBar/index.vue:115/111`). Nessun import nuovo. Alternativa diretta (salta sync menu):
   `preferencesStore.SET_SINGLE_PREFERENCE({ type:'sourceCode', value:!sourceCode.value })` (`:143`).
   Preferire la via bus.

3. **i18n** (opzionale): chiave `statusBar.toggleSource` in `static/locales/en.json` (le altre lingue
   usano il fallback; il 2° arg di `t(...)` è già un default inline).

**Rischi / invarianti.**
- Il toggle rimonta l'editor corretto (Muya↔source). La meccanica è delicata (EASY-TASK sez. A:
  `_applySourceCodeForFile` PRIMA di `file-changed`, guard `handleFileChange`, `cmStatePerTab`). **NON
  reimplementarla**: riusando il percorso del menu quelle invarianti restano rispettate.
- Etichetta: mostra la modalità corrente (`Source`/`MD`) con `v2-chip-on` in source.

**Verifica.** Cliccare il bottone → alterna WYSIWYG/source; etichetta e `v2-chip-on` si aggiornano; la
spunta nel menu View resta sincronizzata; `Ctrl+E` continua a funzionare identico.

---

## Ordine consigliato di esecuzione

1. **Task 5** (piccolo, isolato, riusa percorso esistente) → warm-up.
2. **Task 1** (addon + CSS, isolato a source mode).
3. **Task 4** (il più grande: 4A rimozione/layout, poi 4B ricerca tab). Fare i grep con calma; il punto
   delicato è lo spostamento sidebar (layout).
4. **Task 2** (NSIS, verificabile solo con build:win → ultimo).
5. **Task 3** → rimandato (placeholder).

## Checklist finale prima di chiudere
- [ ] Grep eseguiti per ogni rimozione/spostamento (Task 4: `open-folder`, `sideBarMenuItem`, `side-bar`,
      `findInFolder`, `RipgrepDirectorySearcher`).
- [ ] `sideBarMenuItem` NON rimosso (solo `visible:false`) → nessun crash sui 4 call-site.
- [ ] Sidebar spostata: `height:100%` (non `100vh`), tolto `padding-top:40px`, scroll risultati ok.
- [ ] `searchResultItem` adattato per match via `tabId` (tab Untitled).
- [ ] Jump nella tab GIÀ attiva (source): aggiunto branch `setSelection` nel ramo same-tab di
      `handleFileChange` (altrimenti l'early-return riga 151 lo salta).
- [ ] `store/layout.js` default `rightColumn:'search'`.
- [ ] Nessun `bus.on` orfano senza `bus.off`.
- [ ] Selezione/dirty flag in source NON toccati (Task 1 è solo overlay CM).
- [ ] Provato sia in Muya che in source dove rilevante (Task 4B jump, Task 5 toggle).
- [ ] Aggiornare `EASY-TASK.md` / questo file con eventuali bug emersi (stile storico esistente).

---

# SESSIONE FIX 2026-06-01 — stato bug (documentazione per fix futuri)

> Registro della sessione: cosa è stato risolto (con causa + file:riga del fix) e cosa resta
> aperto. Diagnosi guidate da log temporanei `[TOGGLE-DBG]` / `[SIDEBAR-DBG]` (vedi NOTE in fondo).

## ✅ RISOLTI

### T1 — highlight occorrenze solo su parole intere
- **File:** `src/renderer/src/components/editorWithTabs/sourceCode.vue` (config CM `highlightSelectionMatches`, ~riga 514).
- **Causa:** l'addon `match-highlighter` senza `wordsOnly` evidenziava qualsiasi selezione ≥2 caratteri (anche lettere interne a una parola).
- **Fix:** aggiunto `wordsOnly: true`. L'addon (`isWord()`) evidenzia solo se la selezione è una parola intera → doppio-click su parola = OK; selezione di lettere interne = nessun highlight.

### T5-bug2 — bottone "Source" non disabilitato su file non-md
- **File:** `src/renderer/src/components/statusBar/index.vue`.
- **Fix:** computed `canToggleMode` (untitled + `.md/.markdown/.mdown/.mkd/.mkdn/.mdwn` → abilitato; altre estensioni → disabilitato, grigio come "Wrap"). Guard anche in `toggleSourceMode`. Regola estensione allineata a `editor.js:730` (`_applySourceCodeForFile`).

### T5-bug1 — perdita contenuto al toggle Muya↔source
- **File:** `sourceCode.vue` → `onMounted` (ramo `cmStatePerTab.has(id)`) + `handleFileChange` (stesso ramo).
- **Causa (confermata coi log `[TOGGLE-DBG]`):** `cmStatePerTab` ripristinava lo **snapshot stale** invece del contenuto dello store quando i due divergono. Repro: modifica in Muya DOPO aver lasciato source mode → al rientro in source lo snapshot vecchio sovrascriveva le modifiche. Log decisivo: `mount RESTORE-SNAPSHOT snapshot.len=18 | store.len=29 | equal=false`.
- **Fix:** se `snapshot.content !== store.markdown` → carico il contenuto dello **store** (verità), history azzerata (l'undo dello snapshot sarebbe incoerente). Se combaciano → ripristino snapshot+history (preserva undo tra cambi tab).

### T4A — sidebar di ricerca invisibile nonostante `showSideBar=true`
- **File:** `src/renderer/src/assets/styles/v2-tokens.css` (regola `.side-bar`).
- **Causa (confermata coi log `[SIDEBAR-DBG]`):** la regola v2 `.side-bar { display:none !important }` (nascondeva la vecchia sidebar IDE) vinceva sul `v-show`. La catena `Ctrl+Shift+F` funzionava già tutta (IPC → `EDITOR_EDIT_ACTION` → `SET_LAYOUT{search,showSideBar:true}` → `handleFindInFolder`, `showSideBar=true`), ma il render era bloccato dal CSS.
- **Fix:** rimossa la regola `display:none`. La visibilità è gestita solo da `v-show="showSideBar"` in `sideBar/index.vue` (default `false` all'avvio → nascosta; `true` all'apertura ricerca → visibile).

### Avvio app installata (build) — crashava, ora si apre
- **Causa probabile:** build incompleta / processo zombie (single-instance lock, `main/index.js:69-75` esce in silenzio). Risolto rifacendo `npm run build:win` pulito.
- **Diagnostica utile (per il futuro):** log produzione in `%APPDATA%\marktext\logs\<anno><mese>\main.log` (path da `envPaths.js:16`). Lanciare l'exe con `--enable-logging` da PowerShell mostra errori precoci. Vedi anche NOTE build sotto.

## 🔲 DA RISOLVERE (bug emersi testando T4A/T4B)

### T4A-1 — sidebar posizionata a SINISTRA invece che a destra
- **File:** `src/renderer/src/components/editorWithTabs/index.vue` (`.editor-row`).
- **Causa:** `<side-bar />` è renderizzata PRIMA di `.container` nella flex-row → appare a sinistra.
- **Fix proposto:** spostare `<side-bar />` DOPO `.container` (o usare `order` CSS). NB: la `drag-bar` (`sideBar/index.vue`) è `position:absolute; right:0` → con sidebar a destra va spostata su `left:0`.

### T4A-2 — icona ingranaggio (in fondo alla sidebar) apre le VECCHIE preferences
- **File:** `src/renderer/src/components/sideBar/index.vue` → `handleLeftBottomClick` (~riga 110).
- **Causa:** chiama `projectStore.OPEN_SETTING_WINDOW()` (finestra preferenze legacy).
- **Fix proposto:** aprire il modal v2 con `bus.emit('show-settings-modal')` (evento già usato dalla command palette / status bar).

### T4B-1 — `Ctrl+Shift+F` non avvia la ricerca sulla selezione corrente
- **File:** `src/renderer/src/components/sideBar/search.vue` → `handleFindInFolder` (usa `searchMatches.value.selectedText`).
- **Causa:** la selezione attiva dell'editor (Muya o CodeMirror) non viene catturata/passata come keyword iniziale.
- **Fix proposto:** al trigger, leggere la selezione corrente (CM `getSelection()` in source; selezione Muya in WYSIWYG) e precompilare `keyword` + lanciare `search()`.

### T4B-2 — i risultati di ricerca NON vengono evidenziati nel testo
- **Causa:** la ricerca in-memoria sulle tab trova e lista i match, ma non li evidenzia nell'editor attivo.
- **Fix proposto:** evidenziare almeno il match cliccato (CM `markText`/`setSelection` in source; in Muya l'highlight è approssimato). Valutare highlight di tutti i match nella tab attiva.

### T4B-3 — click su un risultato in Muya rimuove gli spazi tra paragrafi
- **File:** `src/renderer/src/components/sideBar/searchResultItem.vue` (jump) + Muya `setMarkdown`.
- **Causa:** il jump in Muya passa per un `setMarkdown`/normalizzazione che collassa le blank line; in Muya il cursore è approssimato (offset, non `{line,ch}` — già noto, vedi Task 4B).
- **Nota:** tocca l'engine Muya → da gestire con cautela. Possibile evitare il re-render se la tab è già attiva.

### T4 (Ctrl+F singola tab) — non funziona in source mode
- **File:** `src/renderer/src/components/editorWithTabs/editor.vue:82` (`<editor-search v-if="!sourceCode" />`).
- **Causa:** il pannello find è montato SOLO in Muya → in source non esiste, nessuno ascolta `find`.
- **Piano concordato (Opzione 1, NON ancora implementato):**
  1. Spostare `<editor-search>` da `editor.vue` a `editorWithTabs/index.vue` (montato sempre).
  2. In `editor.vue` guardare `handleSearch`/`handReplace`/`handleFindAction` con `if (sourceCode.value) return`.
  3. In `sourceCode.vue` aggiungere handler `searchValue`/`replaceValue`/`find-action` che cercano su CodeMirror (rispettando case/word/regex), evidenziano (`markText`), gestiscono index + next/prev, e popolano `currentFile.searchMatches` nella stessa shape `{ value, index, matches:[...] }`. `bus.off` simmetrici.

## 🔄 AGGIORNAMENTO — round 2 (stessa sessione) — aggiorna lo stato "DA RISOLVERE" sopra

### ✅ Risolti in questo round
- **T4A-1 — sidebar a destra**: in `editorWithTabs/index.vue` `<side-bar />` spostata DOPO `.container`; in `sideBar/index.vue` `border-right`→`border-left`, `drag-bar` `right:0`→`left:0` e logica resize invertita (`startWidth - offset`).
- **T4A-2 — ingranaggio rimosso**: `sideBar/help.js` `sideBarBottomIcons = []` (+ import `SettingIcon` rimosso).
- **X di chiusura sidebar**: `sideBar/search.vue` header con titolo + X → `closeSidebar()` (`SET_LAYOUT rightColumn:'', showSideBar:false`).
- **T4B realtime**: `sideBar/search.vue` input `@keyup`→`@input` (aggiorna i risultati a ogni carattere/incolla).
- **Logica trigger Ctrl+F / Ctrl+Shift+F** (`store/listenForMain.js` `EDITOR_EDIT_ACTION`): usa `editorStore.currentSelection` + stato sidebar.
  - Ctrl+Shift+F: chiusa→apre(+cerca selezione); aperta+selezione→aggiorna; aperta+no selezione→chiude.
  - Ctrl+F: sidebar aperta→mette selezione nella sidebar (no flottante), no selezione→niente; chiusa→find singola tab.
  - Selezione tracciata in `editorStore.currentSelection` via `SET_SELECTION` (Muya `SELECTION_CHANGE`, CM `cursorActivity`). `sideBar/search.vue` ascolta `sidebar-search-set`.
- **T4 — Ctrl+F find flottante in SOURCE (Opzione 1)**:
  - `<editor-search>` spostato da `editor.vue` a `editorWithTabs/index.vue` (montato sempre); handler Muya `handleSearch`/`handReplace`/`handleFindAction` guardati con `if (sourceCode.value) return`.
  - `sourceCode.vue`: handler `searchValue`/`find-action`/`replaceValue` su CodeMirror (`getSearchCursor`), con case/word/regex, navigazione next/prev, replace singolo/all. Import `searchcursor` in `codeMirror/index.js`.
  - **Highlight occorrenze (source)**: ogni match `markText` con classe `.cm-search-match` (ambra tenue, CSS in `sourceCode.vue`); il match corrente usa la selezione CM (evidenza forte).

### 🔲 Ancora aperti
- **T4B-3 — click su risultato in Muya rimuove gli spazi tra paragrafi**: non affrontato (engine Muya, `setMarkdown` normalizza). Da gestire con cautela.
- **Highlight risultati della ricerca SIDEBAR (tutte le tab) dentro l'editor attivo**: l'highlight `.cm-search-match` copre il find flottante Ctrl+F in source; la ricerca all-tabs della sidebar NON evidenzia ancora i match nell'editor attivo (path separato `sideBar/search.vue`). Da chiarire con l'utente se richiesto.

## 🔄 AGGIORNAMENTO — round 3 (stessa sessione)

### ✅ Risolti in questo round
- **Realtime ricerca sidebar**: `sideBar/search.vue` usa ora `watch(keyword, () => search())` (al posto di `@keyup`/`@input`) → i risultati si aggiornano a ogni cambio del termine, in modo affidabile.
- **Highlight ricerca SIDEBAR nell'editor attivo**: `search()` emette `bus.emit('sidebar-highlight', {value, opt})`.
  - SOURCE: `sourceCode.vue` `handleSidebarHighlight` → `highlightSourceMatches(jump:false)` (evidenzia senza spostare il cursore).
  - MUYA: `editor.vue` `handleSidebarHighlight` → `editor.value.search()` (evidenza blu nativa, senza scroll).
  - Pulizia evidenziazioni alla chiusura sidebar (`watch(showSideBar)` + `closeSidebar`).
- **Ctrl+F source: rimosso il doppio highlight (giallo + blu)**: prima `handleSourceSearch` usava `setSelection` sul match corrente → il match-highlighter (basato su selezione) aggiungeva il blu. Ora il match corrente è evidenziato con un **mark dedicato** `.cm-search-match-current` (giallo/ambra forte) + `scrollIntoView`, **senza** `setSelection` → niente blu. Colori: `.cm-search-match` giallo tenue, `.cm-search-match-current` ambra forte (scelti per leggibilità anche daltonici; coerenti col find di Muya).

### 🔲 Ancora aperto (unico)
- **T4B-3 — click su risultato in Muya rimuove gli spazi tra paragrafi**: non affrontato (engine Muya, `setMarkdown` normalizza; cursore Muya approssimato). Da valutare separatamente.

## 🔄 AGGIORNAMENTO — round 4 (stessa sessione)

### ✅ Risolti / regressioni corrette
- **Ctrl+Shift+F mentre è aperto il riquadro flottante Ctrl+F**: ora il flottante si chiude prima che appaia la sidebar. `store/listenForMain.js` `findInFolder` emette `bus.emit('search-blur')` (il riquadro `search/index.vue` lo ascolta → `emptySearch`).
- **REGRESSIONE: tasto Invio rotto in Muya** — vedi "tentativi falliti" sotto. Corretto rimuovendo l'highlight sidebar in Muya.
- **Ricerca live sidebar non aggiornava** — dipendeva dallo stesso errore Muya (eccezione in `editor.value.search` durante l'emit highlight). Rimosso quel path → la live (via `watch(keyword)`) funziona.
- **Highlight source sidebar spariva al cambio tab**: il componente `sourceCode.vue` si rimonta e il `setValue` interno (setTimeout 150ms) cancella i mark. Fix: a fine di quel setTimeout `bus.emit('request-search-highlight')`; `sideBar/search.vue` risponde (`handleRequestHighlight`) ri-evidenziando se la ricerca è attiva.
- **Spazi tra paragrafi (T4B-3)**: l'utente riferisce che ora "sembra non li tolga più" → probabilmente risolto come side-effect; **da riverificare**.

### 🧪 Tentativi che NON hanno funzionato (per non ripeterli)
- **Highlight della ricerca sidebar in Muya via `editor.value.search(value, opt)`**: NON usare. Mette Muya in "modalità ricerca" e **dirotta il tasto Invio** (non inserisce più il ritorno a capo) finché lo stato ricerca resta attivo. Il riquadro flottante Ctrl+F lo gestisce perché ripulisce lo stato alla chiusura; la sidebar no → Invio restava rotto. → Highlight sidebar lasciato SOLO in source mode (`sourceCode.vue`, mark CSS), Muya escluso (commento esplicito in `editor.vue`).
- **`@keyup`/`@input` sull'input sidebar per la live search**: poco affidabile → sostituito con `watch(keyword, () => search())`.

## ⏭️ DA RIPRENDERE — prossima sessione (3 bug aperti, priorità alta)

> Stato al termine sessione: **tutto il resto funziona** (toggle, find flottante source con highlight
> giallo, sidebar a destra + X, trigger Ctrl+F/Ctrl+Shift+F, Invio in Muya nell'editor OK).
> Restano questi 3 bug, probabilmente 2 collegati (vedi sotto).

### BUG A — Muya: la ricerca SIDEBAR non evidenzia il testo nei file Muya (in source funziona)
- **Contesto:** l'highlight sidebar in source mode funziona (`sourceCode.vue` `handleSidebarHighlight` → `.cm-search-match`). In Muya **non** evidenzia nulla.
- **Perché ora manca:** era stato tentato con `editor.value.search(value, opt)` in `editor.vue`, ma quello DIROTTA il tasto Invio di Muya (vedi "tentativi falliti" round 4) → rimosso.
- **Da fare domani:** trovare un modo per evidenziare le occorrenze in Muya SENZA rompere l'Invio. Idee da valutare:
  1. Capire COME `editor.value.search` dirotta l'Invio (probabile keybinding/stato "find" in `src/muya/lib/`) e **ripulire quello stato** dopo aver evidenziato, così l'Invio resta libero.
  2. Highlight DOM-based custom (marcare le occorrenze nel DOM di Muya senza usare il motore di ricerca Muya), simile al `markText` di CodeMirror.
  3. In alternativa: accettare che in Muya l'highlight sidebar non c'è (decisione utente).

### BUG B — Invio NON funziona nella barra di ricerca della SIDEBAR
- **Sintomo:** premendo Invio nell'input della sidebar non succede nulla.
- **Causa:** in `sideBar/search.vue` l'input ora ha solo `v-model="keyword"` (rimosso `@keyup`/`@input`); la ricerca è affidata a `watch(keyword, () => search())`. Manca un handler esplicito per Invio (prima `@keyup` copriva anche Invio).
- **Da fare domani:** aggiungere `@keydown.enter` / `@keyup.enter` sull'input → `search()` (o "vai al prossimo match"). **NB:** l'utente sospetta un legame con BUG C (vedi sotto): forse l'input non riceve affatto gli eventi tastiera.

### BUG C — Live search NON funziona (né lista né highlight)
- **Sintomo:** digitando nell'input sidebar i nuovi risultati NON compaiono nella lista E non vengono evidenziati nel testo della tab attiva.
- **Causa sospetta (DA CONFERMARE):** `watch(keyword, () => search())` (aggiunto in `sideBar/search.vue`) non sta scattando, OPPURE `v-model` non aggiorna `keyword` mentre si digita → `search()` non viene mai richiamato. Collegato a BUG B (in entrambi l'input sidebar sembra non reagire alla tastiera).
- **Da fare domani (diagnosi prima del fix):**
  1. Log temporaneo in `search()` e nel `watch(keyword)` per vedere se scattano mentre si digita.
  2. Verificare che `keyword.value` si aggiorni davvero (v-model) — controllare che l'input non sia coperto/disabilitato e che abbia il focus.
  3. Se il `watch` non basta, **ripristinare** `@input="onKeyup"` (o `@keyup`) sull'input in aggiunta al watch.
  4. Controllare che `search()` non lanci eccezioni (es. in `emitEditorHighlight`) che interrompano la catena.
- **File:** `src/renderer/src/components/sideBar/search.vue` (input ~riga 4-11; `search()`; `watch(keyword)`; `emitEditorHighlight`).

### Riferimento file toccati per la ricerca (mappa rapida)
- `sideBar/search.vue` — input sidebar, `search()` in-memory tutte le tab, `watch(keyword)`, emit `sidebar-highlight`, `closeSidebar`, X.
- `sideBar/index.vue` — sidebar a destra (border-left, drag-bar left, resize invertito); niente ingranaggio.
- `sideBar/help.js` — `sideBarBottomIcons = []`.
- `store/listenForMain.js` — `EDITOR_EDIT_ACTION`: logica trigger Ctrl+F/Ctrl+Shift+F + `search-blur`.
- `store/editor.js` — `currentSelection` + `SET_SELECTION`; `SELECTION_CHANGE` la aggiorna (Muya).
- `editorWithTabs/index.vue` — `<editor-search>` montato sempre; `<side-bar>` a destra.
- `editorWithTabs/editor.vue` — handler Muya search guardati `if (sourceCode.value) return`; **NIENTE** highlight sidebar Muya (rompe Invio).
- `editorWithTabs/sourceCode.vue` — find CM (`getSearchCursor`), `.cm-search-match` / `.cm-search-match-current`, `handleSidebarHighlight`, `request-search-highlight` al mount.
- `codeMirror/index.js` — import `searchcursor`.

## ⚠️ NOTE

### Log diagnostici TEMPORANEI — RIMOSSI
- `[TOGGLE-DBG]` (`sourceCode.vue`, `editor.vue`) e `[SIDEBAR-DBG]` (`listenForMain.js`, `sideBar/search.vue`): **rimossi** dopo conferma dei fix (toggle + sidebar).

### Build produzione
- `electron-builder.yml:49` `npmRebuild: false` + cartella `patches/` mancante (DESIGN-TASK S3) = sospetti per eventuali crash futuri sui moduli nativi. Rimedio documentato: `npm run rebuild-native` (`docs/DISTRIBUTION.md`).
- Warning build `cannot find path for dependency name=undefined` = warning generico electron-builder, benigno (l'app parte).
