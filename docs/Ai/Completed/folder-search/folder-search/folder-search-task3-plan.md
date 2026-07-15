# folder-search — task3 (sidebar: ramo risultati esterni) — plan — 2026-07-12

Riferimento generale: `folder-search-plan.md`.

## Obiettivo del task
La sidebar di ricerca (`sideBar/search.vue`) deve saper mostrare anche risultati "esterni"
arrivati dal main (folder search) oltre a quelli calcolati sulle tab aperte; click su
un'occorrenza di file non aperto → apertura automatica del file con controllo di esistenza e
riquadro di errore se non disponibile. Solo renderer.

## Prerequisiti bloccanti
- Questo plan + worklog `folder-search-task3-worklog.md`.
- Leggere PRIMA `docs/Ai/Completed/ricerca-e-utility/ricerca-e-utility.md` (invarianti della
  sidebar Ctrl+Shift+F; se il path differisce cercarlo con fd in Completed). RISCHIO PRINCIPALE
  del task: regressione della ricerca nelle tab aperte — ogni modifica deve lasciare identico il
  percorso esistente quando non ci sono risultati esterni.
- Contratto dati dal task1 (`folder-search-task1-plan.md`, sezione Contratto) e canale di
  consegna dal task2 (`folder-search-task2-plan.md`, sottoproblema 3): verificare nel codice
  main GIÀ implementato il nome esatto del canale e la shape consegnata, e adeguarsi.
- Fatti verificati (Agent-Explorer 2026-07-12): `search.vue:186-249` matching cablato su
  `editorStore.tabs` con cap `MAX_MATCHES_PER_TAB=500` / `MAX_MATCHES_TOTAL=2000`; shape item
  `{filePath, tabId, matches:[{lineText, range}]}`; highlight via eventi `sidebar-highlight` +
  `request-search-highlight`; jump mode-aware con `isMarkdownPath`; titolo/placeholder hardcoded
  "Cerca in tutte le tab" (`search.vue:4,40`).
- VIETATO version control; NIENTE build (build unica finale).

## Sottoproblemi (in ordine)
1. Ricezione stato: listener del canale scelto dal task2; salvare `{ directory, query, options,
   results, truncated }` nello store più adatto (guardare dove vive lo stato della sidebar oggi;
   preferire store Pinia esistente a uno nuovo).
2. Ramo esterno in `search.vue`: se lo stato folder-search è presente, la lista mostra i risultati
   esterni (mappando il contratto task1 nella shape della sidebar: `tabId` assente finché il file
   non è aperto; `range` costruito da `line`/`start`/`end` nel formato che gli eventi highlight
   si aspettano — verificarlo nel codice esistente). Query precompilata con la query usata;
   titolo/placeholder condizionali (folder search vs tab aperte) mantenendo hardcoded lo stile
   attuale (i18n non in scope qui).
3. Indicatore troncamento: se `truncated`, mostrare una riga "risultati troncati" in fondo alla
   lista (stile coerente con la sidebar).
4. Click su occorrenza (stesso flusso `handleSearchResultClick` attuale per i file già aperti):
   se il file NON è aperto → controllo esistenza via API preload (`window.fileUtils`, verificare
   la funzione disponibile; se manca una exists, usare il canale IPC più adatto già esistente) →
   se esiste: apertura con cursore posizionato sul match (`mt::open-file` con `{ cursor }`,
   pattern `windowManager.js:390-398`) e highlight; se non esiste: riquadro di errore (usare il
   componente dialog/notification già in uso nel renderer, non crearne uno nuovo).
5. Non-regressione: con stato folder-search assente, comportamento IDENTICO a oggi (Ctrl+Shift+F
   sulle tab aperte); i cap 500/2000 esistenti restano invariati.

## Regole
- File attesi: `src/renderer/src/components/sideBar/search.vue` (+ `searchResultItem.vue` solo se
  indispensabile), store Pinia interessato, eventuale preload SOLO in lettura (annotare se serve
  estenderlo: in quel caso fermarsi e riferire, il preload è superficie IPC sensibile).
- Commenti in italiano, forma all'infinito.

## Skill di codice
`coding-standard` (Vue 3).
