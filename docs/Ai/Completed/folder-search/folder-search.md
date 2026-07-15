# folder-search

## Scopo
Ricerca full-text in una cartella specificata. Click icona nella tab bar → overlay input percorso/query/opzioni → genera una NUOVA finestra con la sidebar di ricerca attiva, i file trovati aperti come tab (max 20), e le occorrenze evidenziate. Tutte le occorrenze (oltre il cap tab) restano in sidebar, cliccabili per apertura file.

## Modifiche

### File modificati
1. **src/main/dataCenter/index.js**
   - Aggiunto `searchInFolder(folderPath, query, options)`: spawn ripgrep con argomenti (query/opzioni case/word/regex/esclusioni), streaming parse JSON, accumulo per file, offset byte→caratteri, cap 500/file e 2000 totali con kill processo, flag `truncated`

2. **src/renderer/src/components/editorWithTabs/tabs.vue**
   - Aggiunta icona cartella con lente (magnifying glass folder) nella sezione destra
   - Click → apertura overlay `folderSearchOverlay/index.vue`

3. **src/renderer/src/components/folderSearchOverlay/index.vue** (nuovo)
   - Input percorso (con bottone dialog "…" per selezione cartella)
   - Input query
   - Checkbox case/whole-word/regex
   - Click "Search" → IPC `mt::search-in-folder` → riceve risultati → chiama `_createFolderSearchWindow` con dati

4. **src/main/app/index.js**
   - Aggiunta `_createFolderSearchWindow(searchResults, query)`: crea EditorWindow con stato precaricato, stash risultati su istanza

5. **src/renderer/src/pages/editor.vue + store/editor.js**
   - Ramo "risultati esterni" nella sidebar di ricerca: carica i risultati da IPC anziché da tab in-memory
   - Titolo/placeholder condizionali in `sideBar/search.vue`

6. **tests/unit/dataCenter-search-in-folder.test.js** (nuovo)
   - 10 test unitari per `searchInFolder`: match semplice, conversione byte→carattere, case/word/regex, errori, query vuota, esclusioni

## Da tenere a mente

**Trappola naming `edit.find-in-folder`**: Questo comando STORICO apre ricerca nelle TAB APERTE, non su cartella. Il nuovo handler usa canale diverso (`mt::search-in-folder`) per NON collidere. Non confondere i due percorsi.

**Preferenze ricerca**: Le preferenze `search*` (searchExclusions, searchMaxFileSize, ecc., introdotte in task1) sono usate come default nella ricerca cartella, con override opzionale dall'overlay. Decisione utente (2026-07-12): tenerle come base della feature, non rimuovere.

**Max risultati**: Cap 500 match/file e 2000 totali sono riusati dalla ricerca attuale (Ctrl+Shift+F); segnalazione "risultati troncati" oltre il cap.

**Overflow oltre cap tab**: Se una cartella ha 30 file trovati e max 20 tab, i 10 file extra restano in sidebar ma NON aperti. Click su occorrenza di file non aperto lo apre automaticamente.

**Percorsi con spazi**: Spawn ripgrep con array di argomenti (NON shell interpolation) → percorsi con spazi gestiti correttamente.

**Test esito**: Utente (2026-07-12/13, PC principale) OK — ricerca end-to-end funzionante, bottone "…" per dialog cartella, esempi placeholder esclusioni, percorsi con spazi OK. Feature chiusa.
