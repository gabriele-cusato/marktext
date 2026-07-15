# folder-search — plan — 2026-07-12 (esplorazione COMPLETATA, attende decisioni utente)

Origine: TODO.md: ricerca in una cartella specificando il percorso. Comportamento richiesto:
- Icona/tool nella sezione destra della tab bar.
- Click → riquadro in sovraimpressione (overlay) che chiede le info di ricerca, tra cui il percorso.
- Esegui → si apre una NUOVA finestra con la sidebar di ricerca attiva, le tab aperte sui file
  trovati e le occorrenze evidenziate.

## Esiti esplorazione (Agent-Explorer 2026-07-12) — fatti verificati

### "Implementazione parziale" citata dal TODO: NON esiste più
Il residuo full-text era `ripgrepSearcher.js` (+ `fileSearcher.js`), codice morto ereditato dal
MarkText originale, **già eliminato** dal refactor `renderer-no-node-integration` (task6). Nulla da
rimuovere né da riusare direttamente. Resta vivo solo `mt::search-files`
(`src/main/dataCenter/index.js:319-393`): `rg --files` per NOME file (Quick Open), con streaming +
cap LIMIT=30 + kill del processo — pattern da riusare per il nuovo handler di ricerca contenuto.

### ⚠️ Trappola naming: `edit.find-in-folder` è fuorviante
Il comando storico `edit.find-in-folder` (Ctrl+Shift+F, `common/commands/constants.js:10`,
`menu/actions/edit.js:93-94`, `menu/templates/edit.js:158-161`) oggi apre la ricerca nelle TAB
APERTE, non su cartella. Le chiavi locale `searchInFolder`/`findInFolder` sono legacy. Il nuovo
comando DEVE avere nome/canale diversi (es. `mt::search-in-folder`) per non collidere.

### Componenti riusabili
- **Finestra nuova con stato precaricato**: il gate single-window (`app/index.js:570-603`,
  `_createEditorWindow` con `sessionSnapshotEnabled` redirige SEMPRE alla finestra esistente) va
  bypassato col pattern del detach: `_createDetachWindow` (`app/index.js:639-649`) crea
  `new EditorWindow`, `_isRestoreSession = true`, stash dati su istanza (`_detachTab`), consumo in
  `mt::request-session-restore` (`app/index.js:990-1063`). Serve un analogo
  `_createFolderSearchWindow(files, query, options)`.
- **Motore ricerca contenuto**: NON esiste — nuovo handler main accanto a `mt::search-files`,
  stesso pattern spawn/streaming/cap ma `rg` con pattern (+ `--json` per i range dei match).
- **UI risultati**: `sideBar/search.vue` + `searchResultItem.vue` strutturalmente riusabili
  (shape `{filePath, tabId, matches:[{lineText, range}]}`, highlight via `sidebar-highlight` +
  `request-search-highlight`, jump mode-aware con `isMarkdownPath`), MA il matching è cablato su
  `editorStore.tabs` in-memory (`search.vue:186-249`, cap 500/tab e 2000 totali): serve un ramo
  "risultati esterni da IPC". Invarianti in `Completed/ricerca-e-utility` da rispettare (rischio
  regressione Ctrl+Shift+F).
- **Apertura file con cursore**: esiste `mt::open-file` (`windowManager.js:390-398`) con
  `{ cursor }` — ma UN file per volta; per il batch usare `openTabsFromPaths`
  (`windows/editor.js:377`).
- **I/O preload**: `window.fileUtils.readFile/readdir` (`preload/index.js:42-75`) per letture
  puntuali; NON ricorsivi, non adatti alla scansione (che va nel main via ripgrep).

### Buchi da colmare (nessuno banale)
1. Handler main content-search nuovo.
2. Canale/flag per passare "query + risultati" alla finestra nuova: `mt::bootstrap-editor`
   (`windows/editor.js:225-259`) non ha campi per stato applicativo extra → estenderlo o
   messaggio post-restore dedicato.
3. Ramo "risultati esterni" in `search.vue` (+ titolo/placeholder condizionali, oggi hardcoded
   "Cerca in tutte le tab", `search.vue:4,40`).
4. Overlay input percorso+query + icona tab bar (zero codice esistente; innesto in
   `editorWithTabs/tabs.vue`, coordinare con `recent-files-icon` e `window-minwidth-hamburger`).

Nota collaterale: `sideBar/treeFile.vue`/`treeFolder.vue`/`tree.vue` sembrano orfani (non
importati da `sideBar/index.vue`) — INCERTO, verificare import indiretti prima di riusarli o
proporli in rimozione.

## Decisioni utente (2026-07-12)
1. Filtri file: **tutti i file della cartella purché di formato accettato** (testuali; esclusione
   di base per i non accettati: binari, immagini, ecc.).
2. Esclusioni: **per estensione/pattern, definibili dall'utente via stringhe regex** + set base
   integrato per i file non accettati. Proposta attuativa (da confermare): riusare la preferenza
   `searchExclusions` già presente in schema (oggi morta) come default persistente, con override
   opzionale nell'overlay di ricerca.
3. Tab nella finestra nuova: **max 20**; TUTTE le occorrenze compaiono comunque nella sidebar di
   ricerca (come Ctrl+Shift+F). Click su occorrenza di file non aperto → apertura automatica del
   file, con controllo di esistenza: se il file non è disponibile → **riquadro di errore**.
4. Max match totali: **mantenere i tetti esistenti** della ricerca attuale (verificati nel codice:
   `MAX_MATCHES_PER_TAB=500`, `MAX_MATCHES_TOTAL=2000`, `search.vue:186-249`), con segnalazione
   "risultati troncati" oltre il cap.
5. Overflow oltre il cap tab: **sì**, restano elencati in sidebar e si aprono al click (punto 3).
6. Opzioni di ricerca nell'overlay: **sì** — case/parola intera/regex sulla query, come il Find
   attuale (2026-07-12).
7. Interazione apertura occorrenza: **stesso comportamento della sidebar Ctrl+Shift+F attuale**
   (click, flusso `handleSearchResultClick`) (2026-07-12).

## Decisione residua (da chiudere al plan per task)
- Conferma riuso `searchExclusions` (+ eventuali `searchMaxFileSize`/`searchIncludeHidden`/
  `searchNoIgnore`/`searchFollowSymlinks`) come preferenze persistenti della feature, con
  override nell'overlay (proposta orchestratore, non ancora confermata esplicitamente).

## Spezzatura proposta in task (da confermare dopo le decisioni)
- task1 — main: handler `mt::search-in-folder` (ripgrep pattern, streaming, cap) + unit test.
- task2 — main: `_createFolderSearchWindow` + passaggio stato (bootstrap esteso o canale dedicato).
- task3 — renderer: ramo risultati esterni in sidebar + apertura batch tab + highlight.
- task4 — renderer: overlay input + icona tab bar (DOPO recent-files-icon, stessi file).

## Prerequisiti bloccanti
- Decisioni 1-5 chiuse e plan per task approvati.
- Leggere `Completed/ricerca-e-utility` e `Completed/drag-detach-multi-window` (invarianti
  sidebar + multi-finestra) prima di ogni task che li tocca.
- Ordine: task4 dopo `recent-files-icon` (stessi file tabbar).
- Build/preview bloccati su questo PC: verifica runtime sul PC principale.

## Skill di codice
`coding-standard`.
