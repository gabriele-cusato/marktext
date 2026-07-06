# drag-html5-dnd-task3 — Detach in nuova finestra via HTML5 DnD

## Obiettivo

Re-implementare il detach (drag di una tab fuori dalla finestra → nuova finestra) sopra l'HTML5 DnD nativo introdotto dal task2: nel `dragend`, quando il drop non è stato gestito (`dropHandledThisDrag` falso) e il punto di rilascio in coordinate schermo (`event.screenX`/`event.screenY`, disponibili nativamente sull'evento senza polling) cade FUORI dai bounds della finestra propria, avviare il detach riusando l'infrastruttura già esistente (`_createDetachWindow`, canale IPC `mt::detach-tab`, `DETACH_TAB`/`RESTORE_SESSION`). NON usare `dropEffect` (vedi blocco aggiornamento sotto).

Dipende da task2 (reorder stessa finestra via HTML5 DnD) concluso e testato: questo task riusa lo stesso `dragstart`/stato drag introdotto in task2, aggiungendo solo la gestione del caso "drop fuori".

> **AGGIORNAMENTO 2026-07-03 (`docs/Ai/DECISIONS.md` 2026-07-03) — `dropEffect === 'none'` NON è più il segnale di detach.**
> Bug piattaforma **electron/electron#42252** (Windows, Electron ≥28, mai fixato): per i drag HTML5 interni `dropEffect` risulta SEMPRE `'none'` al `dragend`, anche quando il rilascio avviene su un target valido con `dragover` cancellato — quindi non distingue "drop fuori da tutto" da "drop sulla propria tab bar". La decisione di detach va presa sulle **coordinate schermo del `dragend`** (`event.screenX`/`event.screenY`, disponibili nativamente sull'evento, senza polling `mousemove`): rilascio fuori dai bounds di ogni finestra MarkText → detach. Resta valido l'obiettivo di eliminare il polling `onDragMove`/`lastDragScreen`.
> I punti del plan che citavano `dropEffect === 'none'` come segnale sono stati corretti in place (2026-07-03, post PASS task2): il bounds-check su coordinate schermo è IL meccanismo di decisione, non un fallback. Questo blocco resta come motivazione della correzione.

## Prerequisiti bloccanti

- Worklog Task2 richiesto e leggibile, con test manuale superato: `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task2-worklog.md`. Se il reorder base non è confermato funzionante, fermarsi senza modificare codice.
- File letti e richiesti: `DRAG-TASK.md` (root progetto, §2 punto 3-4 "drop → finestra diversa" e "dragend con dropEffect none"), `HARD-TASK.md` sezione §H5 (cercare con grep "H5-2"/"detach"/"BUG-H5", non leggere le 2348 righe per intero), `EASY-TASK.md` sezione save/dirty/pre-save (§B/C).
- File sorgenti richiesti e leggibili: `src/renderer/src/components/editorWithTabs/tabs.vue`, `src/renderer/src/store/editor.js` (sezioni `DETACH_TAB`, `INSERT_DETACHED_TAB`, `LISTEN_FOR_SESSION`, `RESTORE_SESSION` — cercare con grep, non l'intero file), `src/main/app/index.js` (sezioni `_findEditorWindowAt`, `_createDetachWindow`, `mt::detach-tab` — cercare con grep).
- File/cartelle vietate: non toccare `src/main/windows/base.js`, `src/main/filesystem/session.js`, watcher, source mode/commenti; non leggere né modificare segreti esterni al repo.
- Target verifica: parse SFC di `tabs.vue`; `node --check` su file main toccati se applicabile; test manuale runtime drop fuori finestra.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/tabs.vue`
- `src/renderer/src/store/editor.js` (SOLO se strettamente necessario collegare il nuovo trigger HTML5 DnD a `DETACH_TAB` già esistente — non modificare la logica interna di `DETACH_TAB`/`RESTORE_SESSION` se non richiesto)
- `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task3-worklog.md`

Non toccare `src/main/app/index.js`, `src/main/windows/**` (riuso as-is di `_createDetachWindow`/`_findEditorWindowAt`, nessuna modifica prevista salvo blocco motivato), task4 (drop su finestra esistente), `package.json`, source mode/commenti, watcher.

## Regole e invarianti rilevanti

- **Detach dirty/untitled → flush pre-save + `RESTORE_SESSION` uniforme** (`DRAG-TASK.md §4.4`, `EASY-TASK.md §B/C`): NON bypassare il flush `bus.emit('pre-save')` già presente in `DETACH_TAB` (`store/editor.js`, verificato: chiamato PRIMA di leggere `t.markdown`), né la costruzione di `originalMarkdown`/`pendingSavedMarkdown`. Il nuovo trigger HTML5 DnD deve invocare `DETACH_TAB` esattamente come oggi fa dragula (stesso payload, stesso canale `mt::detach-tab`), cambia solo COME si rileva "drop fuori", non COSA succede dopo.
- Riusare `_createDetachWindow`/`_findEditorWindowAt` (main, `src/main/app/index.js`) senza modificarli: payload e canale `mt::detach-tab` restano invariati, cambia SOLO il trigger renderer (bounds-check su coordinate schermo al `dragend`, non più rilevamento dragula/polling).
- `tabsRenderKey`/`recomputePinnedTab`/`layoutLockUntil`: stesse invarianti di task2, applicate anche al path detach (il drag che finisce in detach deve comunque pulire lo stato locale della finestra sorgente).
- Non introdurre un secondo sistema di rilevamento "fuori finestra" con listener continui: il polling manuale (`onDragMove`/`lastDragScreen`/listener `mousemove`) è GIÀ stato rimosso in task2 col cablaggio dragula e NON va reintrodotto. Il bounds-check sulle coordinate del singolo evento `dragend` è IL meccanismo di decisione (regola DECISIONS.md 2026-07-03: mai `dropEffect`, sempre coordinate).
- La decisione "È un detach" vive nel renderer (rilascio fuori dai bounds della finestra propria, noti via `window.screenX`/`screenY`/`outerWidth`/`outerHeight`); il main può continuare a usare le coordinate ricevute nel payload per decidere DOVE posizionare la nuova finestra o se il punto cade su un'altra finestra MarkText (percorsi già esistenti nel handler `mt::detach-tab` — verificarli, non modificarli).

## Fatti già verificati (fonte: esplorazione Agent-Explorer 2026-07-01)

- **(AGGIORNATO 2026-07-03, post task2)** Il vecchio rilevamento H5-2 (`lastDragScreen`/`onDragMove`/listener `mousemove`/chiamata `DETACH_TAB` in `setTimeout(0)` nel `dragend` dragula) è GIÀ stato rimosso in task2 insieme a tutto il cablaggio dragula: oggi in `tabs.vue` NON esiste più alcun codice di detach. Stato attuale del `dragend` HTML5 (post fix round 3/4 task2): handler `onTabDragEnd` con flag `dropHandledThisDrag` (anti-doppia-esecuzione col `drop`, mai consegnato su questa piattaforma per electron#42252) e fallback reorder se il rilascio cade nei bounds di `.v2-tabbar` (`computeDragTarget(clientX, clientY)`, row-aware). Il ramo detach va aggiunto in QUESTO handler, mutuamente esclusivo col reorder: dentro tabbar → reorder (esistente); fuori dalla finestra → detach (nuovo); dentro finestra ma fuori tabbar → nessuna azione (drag annullato). Nota: il vecchio handler chiamava `DETACH_TAB` dentro `setTimeout(0)` per uscire dal ciclo eventi dragula — con `dragend` nativo valutare se serve ancora (es. `nextTick` per non interferire con la pulizia stato del medesimo handler); se sì, documentare nel worklog.
- `DETACH_TAB` (`store/editor.js`, righe ~975-1003): `bus.emit('pre-save')` (riga ~977) PRIMA di leggere `t.markdown`; `originalMarkdown` = `t.markdown` se salvato, `t.originalMarkdown` se dirty/untitled (riga ~985) — invariante rispettata, non toccare questa logica.
- Main: `_createDetachWindow` (`src/main/app/index.js`, righe ~566-573), `_findEditorWindowAt` (righe ~447-460), gestione `mt::detach-tab` (righe ~912-1008) — canale IPC già esistente e funzionante, da riusare invariato per il payload.
- `DRAG-TASK.md §2` punto 4 ("`dragend` con `dropEffect === 'none'` → detach") è **SUPERATO** dalla decisione `DECISIONS.md` 2026-07-03: su questa piattaforma `dropEffect` è sempre `'none'` per i drag interni (electron#42252), quindi non distingue nulla. Il segnale è il bounds-check su coordinate schermo del `dragend`.

## Sottoproblemi in ordine

1. Ri-leggere le sezioni indicate di `tabs.vue`/`store/editor.js`/`app/index.js` e ri-grep i punti citati per confermare righe correnti.
2. Confermare via grep che nessun residuo del vecchio rilevamento H5-2 esista (`lastDragScreen`/`onDragMove`/listener `mousemove`: già rimossi in task2 — solo verifica, nessuna rimozione attesa).
3. In `onTabDragEnd`, aggiungere il ramo detach, mutuamente esclusivo col fallback reorder esistente: se `dropHandledThisDrag` è falso E il punto di rilascio è FUORI dai bounds della finestra propria (confronto `event.screenX`/`event.screenY` con `window.screenX`/`window.screenY`/`window.outerWidth`/`window.outerHeight`) → `editorStore.DETACH_TAB(tab, { x: event.screenX, y: event.screenY })`, dove `tab` = `tabs.value.find(t => t.id === draggedTabId.value)` (risolverla PRIMA del reset di `draggedTabId`). NON usare `dropEffect`. Rilascio dentro la finestra ma fuori dalla tabbar = nessuna azione (drag annullato, comportamento attuale invariato).
4. Verificare se il main necessita ancora di un bounds-check per decidere DOVE posizionare la nuova finestra (non SE fare il detach) — se sì, documentarlo esplicitamente nel worklog come comportamento conservato, non nuovo.
5. Verificare che il path detach passi comunque per la pulizia stato locale già esistente in `onTabDragEnd` (`tabsRenderKey`++, `recomputePinnedTab`, `updateTabRowsLayout`, reset ref drag): la tab rimossa dalla finestra sorgente non deve lasciare layout/pinnedTab incoerenti.
6. Coda task2 (stesso file, stessi handler): rimuovere i log `[DEBUG drag-html5-dnd-task2]` in `onTabDragStart`/`onTabsDrop`/`onTabDragEnd` (reorder confermato dal test utente 2026-07-03). Aggiungere UN log temporaneo `[DEBUG drag-html5-dnd-task3]` nel nuovo ramo detach (coordinate schermo, bounds finestra, esito) per il test manuale — da rimuovere a test passato.
7. Verificare staticamente e aggiornare worklog con `[x]`, verifiche eseguite, note `DA TESTARE`.

## Verifica richiesta

- Parse SFC di `tabs.vue`; `node --check` se si toccano file main.
- Test manuale atteso:
  - Trascinare una tab fuori da qualunque finestra (es. sul desktop) e rilasciare: si apre una nuova finestra con quella tab, contenuto corretto (incluso caso dirty/non salvato).
  - Tab sorgente rimossa correttamente dalla finestra originale, nessuna tab fantasma/duplicata.
  - Ripetere con tab untitled (mai salvata) e con tab con modifiche non salvate: verificare che il contenuto arrivi intatto nella nuova finestra (flush pre-save rispettato).
  - Verificare che il drag "fuori" non venga more confuso con un drop su un'altra finestra MarkText (quello è task4): se si rilascia sopra un'altra finestra MarkText, deve attivarsi il path task4, non il detach in nuova finestra.
