# drag-html5-dnd-task3 — Detach in nuova finestra via HTML5 DnD

## Obiettivo

Sostituire il rilevamento H5-2 attuale (dragula + `screenX`/`screenY` manuale al `dragend`) con il meccanismo nativo HTML5 DnD: quando il `dragend` termina con `dropEffect === 'none'` (nessun target valido, cioè drop fuori da ogni tab bar/finestra), avviare il detach in una nuova finestra, riusando l'infrastruttura già esistente (`_createDetachWindow`, canale IPC `mt::detach-tab`, `DETACH_TAB`/`RESTORE_SESSION`).

Dipende da task2 (reorder stessa finestra via HTML5 DnD) concluso e testato: questo task riusa lo stesso `dragstart`/stato drag introdotto in task2, aggiungendo solo la gestione del caso "drop fuori".

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
- Riusare `_createDetachWindow`/`_findEditorWindowAt` (main, `src/main/app/index.js`) senza modificarli, salvo che il rilevamento "fuori bounds" cambi radicalmente (con HTML5 DnD nativo, `dropEffect === 'none'` sostituisce il bounds-check manuale su `screenX`/`screenY` — verificare se serve ancora un bounds-check lato main o se basta il segnale renderer).
- `tabsRenderKey`/`recomputePinnedTab`/`layoutLockUntil`: stesse invarianti di task2, applicate anche al path detach (il drag che finisce in detach deve comunque pulire lo stato locale della finestra sorgente).
- Non introdurre un secondo sistema di rilevamento "fuori finestra" parallelo a quello nativo HTML5 (`dropEffect`): l'obiettivo esplicito della migrazione è eliminare il polling manuale `screenX`/`screenY` (`onDragMove`, oggi righe ~640-648 in `tabs.vue`).
- Se lo stato attuale del codice rivela che il rilevamento "fuori bounds" nativo HTML5 richiede comunque un controllo di coordinate lato main (es. per decidere le coordinate della nuova finestra), è accettabile mantenere un controllo posizione minimo SOLO per il posizionamento della nuova finestra, non per la decisione "è un detach" (quella la dà `dropEffect === 'none'`).

## Fatti già verificati (fonte: esplorazione Agent-Explorer 2026-07-01)

- Rilevamento attuale H5-2: `tabs.vue`, stato `lastDragScreen`/`onDragMove` (righe ~218-224), handler `drag` inizializza `lastDragScreen` al centro finestra e aggiunge `mousemove` listener (righe ~640-648), handler `dragend` (righe ~649-674) calcola `outside` da bounds finestra e chiama `editorStore.DETACH_TAB(tab, {x,y})` in `setTimeout(0)` se fuori, poi `nextTick` per `resyncDomToStore`/`tabsRenderKey++`.
- `DETACH_TAB` (`store/editor.js`, righe ~975-1003): `bus.emit('pre-save')` (riga ~977) PRIMA di leggere `t.markdown`; `originalMarkdown` = `t.markdown` se salvato, `t.originalMarkdown` se dirty/untitled (riga ~985) — invariante rispettata, non toccare questa logica.
- Main: `_createDetachWindow` (`src/main/app/index.js`, righe ~566-573), `_findEditorWindowAt` (righe ~447-460), gestione `mt::detach-tab` (righe ~912-1008) — canale IPC già esistente e funzionante, da riusare invariato per il payload.
- `DRAG-TASK.md §2` punto 4: "`dragend` con `dropEffect === 'none'` (nessun target valido) → detach in nuova finestra (riusa `_createDetachWindow`)" — conferma che l'evento nativo HTML5 già fornisce il segnale necessario senza bisogno di bounds-check manuale sulle coordinate schermo.

## Sottoproblemi in ordine

1. Ri-leggere le sezioni indicate di `tabs.vue`/`store/editor.js`/`app/index.js` e ri-grep i punti citati per confermare righe correnti.
2. Rimuovere `lastDragScreen`/`onDragMove`/listener `mousemove` globale (sostituiti dal segnale nativo `dropEffect`).
3. Nell'handler `dragend` HTML5 (introdotto in task2), aggiungere il ramo: se `event.dataTransfer.dropEffect === 'none'` (nessun `dragover`/`drop` valido ha intercettato l'evento in nessuna tab bar, nemmeno cross-finestra), invocare `editorStore.DETACH_TAB(tab, { x, y })` con le coordinate correnti del cursore (da `event.screenX`/`event.screenY` sul `dragend`, disponibili nativamente senza polling).
4. Verificare se il main necessita ancora di un bounds-check per decidere DOVE posizionare la nuova finestra (non SE fare il detach) — se sì, documentarlo esplicitamente nel worklog come comportamento conservato, non nuovo.
5. Pulire stato locale drag della finestra sorgente dopo il detach (`tabsRenderKey`++, `recomputePinnedTab`, reset variabili drag locali).
6. Verificare staticamente e aggiornare worklog con `[x]`, verifiche eseguite, note `DA TESTARE`.

## Verifica richiesta

- Parse SFC di `tabs.vue`; `node --check` se si toccano file main.
- Test manuale atteso:
  - Trascinare una tab fuori da qualunque finestra (es. sul desktop) e rilasciare: si apre una nuova finestra con quella tab, contenuto corretto (incluso caso dirty/non salvato).
  - Tab sorgente rimossa correttamente dalla finestra originale, nessuna tab fantasma/duplicata.
  - Ripetere con tab untitled (mai salvata) e con tab con modifiche non salvate: verificare che il contenuto arrivi intatto nella nuova finestra (flush pre-save rispettato).
  - Verificare che il drag "fuori" non venga more confuso con un drop su un'altra finestra MarkText (quello è task4): se si rilascia sopra un'altra finestra MarkText, deve attivarsi il path task4, non il detach in nuova finestra.
