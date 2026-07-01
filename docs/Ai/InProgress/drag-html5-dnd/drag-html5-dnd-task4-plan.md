# drag-html5-dnd-task4 — Drop su finestra esistente via HTML5 DnD (H5-RE)

## Obiettivo

Gestire il caso in cui una tab viene trascinata da una finestra e rilasciata sulla tab bar di un'ALTRA finestra MarkText già aperta (non una nuova finestra, quello è task3). Oggi questo path usa il canale `mt::receive-detached-tab` → `INSERT_DETACHED_TAB` (percorso IPC DIVERSO da quello di task3 `mt::detach-tab`→`RESTORE_SESSION`). Con HTML5 DnD nativo va sostituito il rilevamento cross-finestra (oggi via IPC/poll `screen.getCursorScreenPoint`, se ancora presente per questo path — verificare) e va aggiunto l'indicatore d'inserimento (lineetta) nella finestra di destinazione durante il `dragover` cross-finestra.

Dipende da task2 e task3 conclusi e testati: riusa lo stesso `dragstart`/stato drag di task2, e si integra con la distinzione "drop fuori vs drop su altra finestra" introdotta in task3.

## Prerequisiti bloccanti

- Worklog Task2 e Task3 richiesti e leggibili, con test manuali superati.
- File letti e richiesti: `DRAG-TASK.md` (root progetto, §2 punto 3 "drop → finestra diversa: il main trasferisce il payload... B ricostruisce la tab all'indice, A chiude la sorgente all'ack" e §3bis tabella "Lineetta inserimento cross-finestra"), `HARD-TASK.md` sezione H5-RE (cercare con grep "H5-RE"/"INSERT_DETACHED_TAB"/"receive-detached-tab", non leggere il file per intero).
- File sorgenti richiesti e leggibili: `src/renderer/src/components/editorWithTabs/tabs.vue`, `src/renderer/src/store/editor.js` (sezioni `INSERT_DETACHED_TAB`, `LISTEN_FOR_SESSION` — canale `mt::receive-detached-tab`/`mt::detach-tab-ack`, cercare con grep), `src/main/app/index.js` (gestione IPC relativa, cercare con grep).
- Nota importante da verificare come primo sottoproblema: DRAG-TASK.md descrive nel §2 "Fix proposto" un SOLO percorso IPC per il cross-finestra, ma l'esplorazione del codice (2026-07-01) ha trovato DUE percorsi IPC distinti nel codice attuale: `mt::detach-tab`→`RESTORE_SESSION` (nuova finestra, task3) e `mt::receive-detached-tab`→`INSERT_DETACHED_TAB` (finestra esistente, questo task). Questo task usa il SECONDO percorso; non confonderlo col primo.
- File/cartelle vietate: non toccare `src/main/windows/base.js`, `src/main/filesystem/session.js`, watcher, source mode/commenti; non leggere né modificare segreti esterni al repo.
- Target verifica: parse SFC di `tabs.vue`; `node --check` su file main toccati se applicabile; test manuale runtime drop cross-finestra su finestra esistente.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/tabs.vue`
- `src/renderer/src/store/editor.js` (SOLO la sezione `INSERT_DETACHED_TAB`/`LISTEN_FOR_SESSION`, per il fix del selettore e per collegare il nuovo trigger — non toccare `DETACH_TAB`/`RESTORE_SESSION`, riservati a task3)
- `src/main/app/index.js` (SOLO se il rilevamento cross-finestra nativo richiede modifiche al routing IPC esistente — documentare nel worklog prima di procedere se necessario)
- `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task4-worklog.md`

Non toccare `package.json`, source mode/commenti, watcher, `src/main/windows/base.js`.

## Regole e invarianti rilevanti

- **Bug pre-esistente da correggere in questo task**: `src/renderer/src/store/editor.js`, `INSERT_DETACHED_TAB` (riga ~1029) filtra `document.querySelectorAll('li.v2-tab:not(.v2-tab-pinned):not(.gu-mirror)')`. Due problemi: (a) la classe `v2-tab-pinned` non esiste mai nel template (quella reale è `is-pinned`, `tabs.vue:27`), il `:not()` sulle pinned non ha mai effetto; (b) `.gu-mirror` è dragula-specifico e sparisce con la migrazione (nessun mirror DOM con HTML5 DnD nativo), quel filtro va rimosso perché diventa un no-op sicuro ma inutile — sostituire con `is-pinned` per il filtro pinned e rimuovere `.gu-mirror` dalla query.
- Riusare `mt::receive-detached-tab`/`mt::detach-tab-ack`/`INSERT_DETACHED_TAB` come canale dati (payload tab), cambiando SOLO il trigger (da rilevamento dragula/poll a evento HTML5 DnD nativo `drop` sulla finestra destinazione).
- L'indicatore d'inserimento (lineetta) nella finestra di destinazione durante il `dragover` cross-finestra è un requisito esplicito di parità VS Code (`DRAG-TASK.md §1` comportamento atteso 1): implementarlo riusando lo stesso meccanismo visivo introdotto in task2 per il reorder stessa finestra, esteso al caso cross-finestra (la finestra B deve ricevere un segnale — probabilmente via IPC, dato che `dataTransfer` nativo non attraversa i processi renderer di finestre Electron diverse nello stesso modo di un drag-in-page — verificare questo punto con precisione nel sottoproblema 1, è un'area con incertezza reale).
- Detach dirty/untitled → stesso trattamento invariante di task3 (flush pre-save prima di leggere `markdown`, non bypassare baseline).
- `tabsRenderKey`/`recomputePinnedTab`/`layoutLockUntil`: stesse invarianti di task2/task3, applicate sia alla finestra sorgente (dopo che la tab è stata "presa") sia alla finestra destinazione (dopo l'inserimento).
- `H5-RE-BUG1` (ri-drag tab omonime): DRAG-TASK.md ipotizza che si dissolva con la migrazione (sparisce il match manuale `screenX`/id di dragula). Non è in scope risolverlo esplicitamente in questo task, ma verificare a runtime durante il test se il sintomo persiste o è effettivamente sparito, e annotarlo nel worklog in entrambi i casi.

## Fatti già verificati (fonte: esplorazione Agent-Explorer 2026-07-01)

- Percorso IPC per drop su finestra esistente: `mt::receive-detached-tab` → `INSERT_DETACHED_TAB` (`store/editor.js`, righe ~1007-1050), calcola l'indice di inserimento da coordinate schermo→DOM rect (non da nome file: verificato, nessun match per `filename`/`pathname` in questo percorso, solo `id`).
- `getUniqueId()` (`src/renderer/src/util/index.js`, righe 22-23) è un contatore a livello di modulo del renderer (`let id = 0`): ogni finestra (processo renderer separato) può generare `id` che collidono tra finestre diverse (es. entrambe con `mt-0`). Non risulta causare oggi un bug diretto nel percorso H5-RE (verificato: `INSERT_DETACHED_TAB` crea sempre un `id` nuovo lato finestra destinazione via `createDocumentState`), ma è un fatto architetturale da tenere presente: se durante l'implementazione emergono collisioni di `id` cross-finestra, non è un bug nuovo introdotto da questo task, è preesistente — documentarlo, non tentare di risolverlo qui salvo blocchi reali riscontrati.
- `_isSessionOwner` (main, `src/main/windows/editor.js`, righe ~31/246) distingue finestra owner da finestra detached — non direttamente parte di questo task ma utile per capire il contesto multi-finestra.

## Sottoproblemi in ordine

1. **Da chiarire per primo**: verificare con precisione come oggi viene rilevato "il cursore è sopra la tab bar di un'altra finestra" nel percorso H5-RE attuale (probabile IPC + poll `screen.getCursorScreenPoint`, citato in `DRAG-TASK.md §3bis` come soluzione dragula). Capire se HTML5 DnD nativo cross-finestra Electron richiede comunque un canale IPC per notificare la finestra B del `dragover` (dato che `dataTransfer` non attraversa processi renderer separati come farebbe dentro la stessa pagina), o se esiste un meccanismo nativo Electron/Chromium sufficiente. Documentare la scelta nel worklog PRIMA di implementare, con la fonte.
2. Ri-leggere `INSERT_DETACHED_TAB`/`LISTEN_FOR_SESSION` e il routing IPC main relativo, ri-grep per righe correnti.
3. Correggere il bug selettore `v2-tab-pinned`→`is-pinned` e rimuovere il filtro `.gu-mirror` obsoleto in `INSERT_DETACHED_TAB`.
4. Implementare il trigger nativo per il drop cross-finestra su finestra esistente: `dragend` nella finestra sorgente con target = altra finestra MarkText (da distinguere da task3 "nessun target" e dal reorder interno task2 "stessa finestra") → invia payload via IPC esistente (`mt::receive-detached-tab` o canale equivalente) alla finestra destinazione.
5. Implementare l'indicatore d'inserimento nella finestra destinazione durante il `dragover` cross-finestra (riusando lo stile visivo di task2), basato sul meccanismo di notifica scelto al punto 1.
6. Gestire l'ack (`mt::detach-tab-ack` o equivalente) per chiudere la tab nella finestra sorgente solo dopo conferma di inserimento riuscito nella destinazione.
7. Pulire stato locale drag su entrambe le finestre (sorgente e destinazione) dopo il drop: `tabsRenderKey`++, `recomputePinnedTab`, `layoutLockUntil` release.
8. Verificare staticamente e aggiornare worklog con `[x]`, verifiche eseguite, note `DA TESTARE`, incluso esito osservato su H5-RE-BUG1 (persiste o dissolto).

## Verifica richiesta

- Parse SFC di `tabs.vue`; `node --check` su file main toccati.
- Test manuale atteso:
  - Aprire due finestre MarkText, trascinare una tab dalla finestra A e rilasciarla sulla tab bar della finestra B: indicatore d'inserimento visibile in B durante il drag, drop inserisce la tab nella posizione corretta, tab rimossa da A solo dopo conferma.
  - Ripetere con tab dirty/untitled: contenuto integro nella finestra destinazione.
  - Ripetere con due tab OMONIME (stesso nome file, percorsi diversi o entrambe untitled) tra le due finestre: verificare se il sintomo H5-RE-BUG1 (ri-drag non funziona) è ancora presente o risolto dalla migrazione — annotare l'esito in ogni caso.
  - Verificare che il clamp pinned (H4) sia rispettato anche nell'inserimento cross-finestra.
