## TODO (ordine per difficoltà crescente)

### Facile (~10-30 righe)

- [x] **Conversione EOL** — **FATTO:** si possono scegliere tutti e tre i tipi: CRLF (Windows `\r\n`), LF (Unix `\n`), CR (vecchio Mac `\r`). **DA VERIFICARE:** controllare se all'apertura di un file viene già rilevato e applicato l'EOL corretto in base al sistema operativo corrente, oppure se è da implementare.
- [x] **Conversione encoding** — **FATTO.** (`ced` già in `package.json`; `iconv-lite` non presente, da installare se servisse ancora.)
- [ ] **Bug rilevamento encoding all'apertura** — se si salva un file con encoding diverso da un editor esterno (es. Notepad++ → ANSI) e poi si apre in MarkText, l'encoding mostrato è ancora UTF-8 (errato). Viceversa, se si cambia encoding da MarkText (es. UTF-8 BOM) e si riapre in Notepad++, il formato risulta corretto. Ipotesi: `ced` non rileva correttamente all'apertura, oppure il valore di encoding non viene aggiornato prima di mostrarlo in UI. **Da fare:** verificare il flusso di apertura file → rilevamento encoding → aggiornamento store, capire dove la catena si rompe.
- [ ] **UPPERCASE / lowercase / Title Case** — prendere testo selezionato nel renderer, applicare trasformazione stringa, sostituire. Hook su shortcut via CodeMirror commands o Muya selection API.
- [ ] **Operazioni riga** (sposta su/giù, duplica, elimina) — vedi `EASY-TASK.md` per analisi dettagliata e decisioni shortcut. Split/Join spostati sotto (Medio-facile).
- [x] **Copia percorso file dal tab** — aggiungere voci context menu al componente tab (`src/renderer/components`). `clipboard.writeText()` con path/filename/directory del file corrente. **FATTO: funziona correttamente.**
- [ ] **Zoom testo Ctrl+rotella** — lo zoom Ctrl+rotella funziona già, ma agisce su tutta l'app (incluse title bar e tab bar). Da limitare allo zoom solo nella sezione testuale (markdown/simil notepad++), lasciando invariate title bar e tab bar.
- [ ] **Bug: Ctrl+Shift+↑/↓ non seleziona in Muya** — in source mode funziona (Alt+↑/↓ sposta riga, Shift+↑/↓ seleziona). In Muya: Shift+↑/↓ funziona, ma Ctrl+Shift+↑/↓ non estende la selezione. Comportamento standard Windows = estende selezione per paragrafo/blocco. Investigare in `src/muya/lib/eventHandler/` se il tasto Ctrl viene intercettato senza implementare selezione estesa. Fix atteso: piccola aggiunta alla keymap Muya.
- [x] **Word Wrap toggling** — **FATTO:** disabilitato nella visualizzazione markdown (Muya), abilitabile nella visualizzazione simil notepad++ (CodeMirror source mode).

### Medio-facile

- [ ] **Selezione a blocco/colonna** (Alt+drag) — CodeMirror ha addon `rectangular-selection` nativo, abilitarlo in source mode. Per Muya molto più complesso: considerare solo source mode.
- [ ] **Evidenzia occorrenze parola selezionata** — CodeMirror: addon `matchHighlighter`. Per Muya: listener su `selectionchange`, cercare occorrenze nel DOM, applicare classe CSS highlight.
- [ ] **Context menu tasto destro Windows** — in `package.json` sezione `build.nsis` aggiungere chiave registro `HKCR\*\shell\MarkText`. ~10 righe.
- [ ] **Rimuovi dialog "vuoi salvare?"** — intercettare `before-close` in `src/main/`, salvare contenuto silenziosamente in `app.getPath('userData')` invece di mostrare dialog. ~20-30 righe.
- [ ] **Stile UI più professionale** — modificare variabili CSS (`border-radius`, font, spacing) nei file tema in `static/`. Solo CSS.
- [ ] **Split / Join righe** (source mode, stile Notepad++ `Ctrl+I` / `Ctrl+J`) — CodeMirror NON ha comandi built-in: implementare a mano, solo in source mode. **Join** (`Ctrl+J`): unire la riga corrente con la successiva via `replaceRange`. **Split** (`Ctrl+I`): dividere le righe lunghe al margine della finestra (più complesso, dipende dalla larghezza del wrap). Rendere mode-aware: in markdown `Ctrl+I`=emphasis e `Ctrl+J`=sidebar restano invariati.

- [ ] **Toggle rapido Muya ↔ source mode** — shortcut (es. Ctrl+Alt+S o bottone in toolbar) per passare al volo da modalità WYSIWYG (Muya) a source mode (CodeMirror) e viceversa, senza dover usare il menu File. Utile per vedere/modificare il markdown grezzo e poi tornare alla vista renderizzata. Verificare se lo store già ha un flag `sourceMode` per tab; in caso aggiungere shortcut che lo togla e rimonta il componente corretto preservando posizione cursore.

### Medio (~50-150 righe)

- [ ] **Fix grafica impostazioni** — studiare componente settings in `src/renderer/components`, identificare e correggere problemi layout.
- [ ] **Find & Replace potenziato** — estendere dialog esistente con checkbox (case, whole word, regex, wrap, direction), passare flag alla logica di ricerca CodeMirror/Muya.
- [ ] **Trova in tutti i file aperti** — iterare su tutti i tab nello store Pinia, eseguire ricerca su ciascun contenuto, mostrare risultati aggregati in panel sidebar.
- [ ] **Markdown solo per .md** — in `loadMarkdownFile` controllare estensione: se non `.md` forzare source mode (CodeMirror plain text) saltando parsing Muya.
- [ ] **Apertura browser per .html/.htm** — NON presente: `openExternal` usato solo per URL in markdown (`src/main/menu/actions/file.js:480`), non per file corrente. Aggiungere shortcut che chiama `shell.openExternal(filePath)`. Attivo solo se file corrente è `.html`/`.htm`.
- [ ] **Commenti con shortcut** — NON presente: `toggleComment` assente nel codebase. Mappare estensione → sintassi commento (`//`, `#`, `<!-- -->`), toggle su riga/selezione. CodeMirror ha `toggleComment` built-in per source mode.
- [ ] **Indentazione automatica** — parziale: solo auto-indent su Enter in Muya (`src/muya/lib/contentState/enterCtrl.js`), nessun shortcut dedicato per linguaggio. CodeMirror: `indentAuto` command. Per Muya: studiare se espone API oltre enterCtrl.
- [ ] **Fold/unfold blocchi** — CodeMirror: addon `foldGutter` + `markdownFold`. Per Muya: pulsante collassa su ogni heading/fenced block, nascondere blocchi figli via CSS.
- [ ] **Auto-switch CodeMirror per file grandi** — in `loadMarkdownFile` leggere `fs.stat`, se size > soglia (default 2MB) impostare flag `forcedSourceMode: true`. Soglia configurabile da Preferences via `electron-store`.

### Difficile (~100-300 righe, richiede studio architettura)

- [ ] **Multi-cursore / multi-selezione** — CodeMirror supporta multi-cursor nativo (Ctrl+click), abilitare in source mode. Per Muya: richiede modifiche profonde al data model blocchi, valutare solo source mode.
- [ ] **File non salvati NON in temp** — autosave attuale salta untitled (controlla `pathname && autoSave` in `src/renderer/src/store/editor.js:1149`). Trovare tutti gli usi di `os.tmpdir()`, spostare storage in `app.getPath('userData')`. Garantire cleanup corretto alla chiusura.
- [ ] **Session restore** — autosave attuale non persiste untitled né ripristina sessione. Alla chiusura: serializzare tab aperti (path + contenuto non salvato) in JSON su `userData`. All'avvio: riaprire tab. Logica split main process (IO) e renderer (restore stato editor).
- [ ] **Cronologia undo persistente** — serializzare stack undo di Muya/CodeMirror su `userData` alla chiusura, deserializzare all'apertura. Studiare formato interno undo di Muya prima di procedere.
- [ ] **Numeri di riga** — presenti solo per code block in Muya (`renderLineNumber.js`, `codeBlockCtrl.js`), NON per editor generico. CodeMirror: `lineNumbers: true`. Per Muya: colonna CSS con contatore righe sincronizzato allo scroll. Complessità nel sync scroll e calcolo altezze blocchi variabili.
- [ ] **Pin tab** — NON presente. Da implementare: flag `pinned` nel data model tab (store), voce "Pin/Unpin" nel context menu, `tabs.vue` diviso in 2 zone (`<ul>` pinnate + `<ul>` normali), dragula limitato alla propria zona. Richiede modifica a `EXCHANGE_TABS_BY_ID`.
- [ ] **Tab drag fuori finestra (detach)** — trascinare una tab fuori dalla tab bar deve aprire una nuova `BrowserWindow` Electron con quel file. Dragula attuale gestisce solo reorder interno. Richiede: (1) rilevare drag-out dai bounds della finestra via `mousemove` + coordinate; (2) IPC renderer→main `mt::detach-tab` con payload file serializzato; (3) main crea nuova `BrowserWindow` e carica il file; (4) ghost window trasparente che segue il cursore durante il drag; (5) gestione file non salvati; (6) sincronizzazione se file già aperto in altra finestra. Complessità simile a VS Code `moveEditorToNewWindow`.