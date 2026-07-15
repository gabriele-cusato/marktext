# folder-search — task3 — worklog

Plan: `folder-search-task3-plan.md`.

## Avanzamento
- [x] Ricezione e store dello stato folder-search dal main
- [x] Ramo risultati esterni in `search.vue` (mapping shape + titolo/placeholder condizionali)
- [x] Indicatore "risultati troncati"
- [x] Click su occorrenza: file aperto = flusso attuale; non aperto = esistenza → apri con cursore
      / riquadro errore
- [x] Non-regressione Ctrl+Shift+F (stato esterno assente = comportamento identico)

## Note non-regressione
Con `editorStore.folderSearchState === null` (default, e caso di ogni finestra editor normale
NON aperta da folder-search): `isExternalMode` è sempre `false` → `displayResult`/`displayTruncated`
puntano a `searchResult`/`searchTruncated` (stessi ref invariati), `searchTitle`/`searchPlaceholder`
restituiscono le stesse chiavi/fallback hardcoded di prima, `watch(keyword)` chiama `search()`
esattamente come prima (guard `isExternalMode.value` false → no-op), `search()` e i cap
MAX_MATCHES_PER_TAB/MAX_MATCHES_TOTAL non sono stati toccati. L'unico codice nuovo che gira sempre
è il `watch(folderSearchState, ..., {immediate:true})`, che con stato `null` ritorna subito senza
side-effect. In `searchResultItem.vue` il branch "tab non aperto" (`!openedTab`) ora fa un controllo
`isFile` in più prima di `mt::open-file`: per la ricerca in-tab quel branch è comunque irraggiungibile
a runtime (i risultati sono sempre costruiti da `tabs.value`, quindi `openedTab` è sempre trovato) →
nessuna modifica di comportamento osservabile per Ctrl+Shift+F.

## Test
Esito utente (2026-07-12/13, PC principale): OK — verifica end-to-end della feature senza
anomalie riportate. Chiuso.
