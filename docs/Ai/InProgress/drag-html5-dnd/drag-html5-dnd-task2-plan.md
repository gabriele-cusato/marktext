# drag-html5-dnd-task2 — Reorder tab stessa finestra via HTML5 DnD

## Obiettivo

Sostituire dragula con HTML5 native Drag and Drop per il **reorder delle tab dentro la stessa finestra** (non ancora detach/cross-finestra, quello è task3/task4). Al termine di questo task il drag interno deve funzionare tramite `draggable`/`dragstart`/`dragover`/`drop` nativi, preservando TUTTE le invarianti già risolte in passato con dragula (vedi sezione dedicata).

Dipende dal GATE spike, superato il 2026-07-02: il task1 originale è FALLITO (due cause sovrapposte), il task1b (overlay drag "alla VS Code") è PASS. Vedere worklog task1 e task1b per i dettagli: entrambe le cause sono state identificate e risolte, e i vincoli che ne derivano sono incorporati in questo plan.

## Prerequisiti bloccanti

- Worklog Task1b richiesto e leggibile con esito **GATE PASS** esplicito: `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1b-worklog.md`. Leggere anche il worklog task1 (`...-task1-worklog.md`, esito FAIL con le due cause). Se il PASS del task1b manca, fermarsi senza modificare codice.
- File letti e richiesti: `DRAG-TASK.md` (root progetto, sezioni 2 "Fix proposto" e 4.1/4.2/4.3 "Invarianti"), `DESIGN-TASK.md` (sezione dragula/`-webkit-app-region`), `MEDIUM-TASK.md` (sezione "Invarianti tab bar BUG-1", punti 1-10), `HARD-TASK.md` (sezione H4 pinned tab, cercare "H4" con grep — non leggere le 2348 righe per intero, solo le sezioni su pinned tab/drag/tab bar).
- File sorgente richiesto e leggibile: `src/renderer/src/components/editorWithTabs/tabs.vue` (tutto, 1366 righe circa — file piccolo, leggibile per intero).
- File/cartelle vietate: non toccare `store/editor.js` DETACH_TAB/INSERT_DETACHED_TAB/RESTORE_SESSION (riservati a task3/task4), non toccare `src/main/app/index.js`, non toccare `package.json` (rimozione dipendenze riservata a task5 — dragula resta installata ma non più usata da questo task in poi per il reorder interno), non leggere né modificare segreti esterni al repo.
- Target verifica: parse SFC di `tabs.vue`; test manuale runtime reorder tab.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/tabs.vue`
- `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task2-worklog.md`

Non toccare `store/editor.js`, `src/main/**`, `package.json`, keybindings, menu, command palette, IPC, watcher, source mode/commenti.

## Regole e invarianti rilevanti (da NON reintrodurre — fonte: DRAG-TASK.md §4 + esplorazione codice 2026-07-01)

Nota: i numeri di riga indicati sotto sono quelli rilevati dall'esplorazione al momento della scrittura di questo plan; possono essere shiftati. Ri-grep per nome funzione/classe prima di editare, non fidarsi ciecamente del numero.

1. **Mai manipolare il DOM a mano nel drop handler** (`removeChild`/`insertBefore`): mutare SOLO lo store (`editorStore.EXCHANGE_TABS_BY_ID` o equivalente), lasciare che Vue `v-for`+`:key` riconcili il DOM. La funzione attuale `resyncDomToStore` (`tabs.vue:381-402`) esiste solo perché dragula manipola il DOM autonomamente (mirror/drop nativo della libreria) — con HTML5 DnD nativo il drop handler è puro JS che aggiorna solo lo store, quindi `resyncDomToStore` NON serve più per questo path e va rimossa insieme al resto del cablaggio dragula (non lasciarla come codice morto).
2. **`.el` staleness / `tabsRenderKey`**: `tabsRenderKey` (`tabs.vue:379`, uso nel `:key` riga 22) va conservato e incrementato al termine del drag (equivalente dell'attuale incremento su `dragend`, riga ~672) per forzare il remount e evitare `.el` stale.
3. **`recomputePinnedTab` fuori dal lock, dopo il drop**: va richiamato esplicitamente dopo il drop HTML5 (oggi `tabs.vue:688`), bypassando `layoutLockUntil` come fa oggi.
4. **Filtro dell'elemento in drag nel calcolo indice**: oggi si filtra `gu-mirror` (dragula-specifico, righe 677/683) dal sibling per calcolare l'indice next-tab. Con HTML5 DnD non esiste mirror DOM: calcolare l'indice di inserimento dalla posizione `dragover` (coordinata `clientX` rispetto ai centri delle tab esistenti), escludendo esplicitamente l'elemento sorgente dal calcolo (tracciato via `dataTransfer`/stato locale, non via classe CSS).
5. **Drag region (AGGIORNATO post-task1b, 2026-07-02)**: `-webkit-app-region: drag` NON sta più su `.v2-tabbar` — sta sull'overlay `.v2-tabbar-drag-region` (primo figlio di `.v2-tabbar`, `position:absolute; inset:0`), struttura DEFINITIVA introdotta dal task1b (pattern VS Code: le tab non devono MAI tornare discendenti di un elemento `app-region: drag`, altrimenti il window-drag OS sopprime il `dragstart` — causa n.1 del FAIL task1). NON rimuovere l'overlay né i `no-drag` esistenti su `.v2-tab`, `.v2-tab-new-li`, `.v2-topright-clone`, `.v2-tr-plus`, `.v2-tr-btn`, `ul`. Aggiornare i commenti dell'overlay nel codice da "SPIKE (drag-html5-dnd-task1b)" a commenti definitivi (la struttura resta, non è più uno spike).
5bis. **Dragula NON può coesistere con HTML5 DnD sulle stesse tab (causa n.2 del FAIL task1, verificata 2026-07-02)**: `grab()` di dragula esegue `e.preventDefault()` sul `mousedown` (`node_modules/dragula/dragula.js` ~riga 113) e in Chromium questo sopprime la generazione del `dragstart` nativo. Quindi in questo task il cablaggio dragula va rimosso PER INTERO (init, handler, autoscroller, resync), incluso il path detach H5-2 che vi è costruito sopra: il detach resterà TEMPORANEAMENTE non funzionante finché task3/task4 non lo re-implementano via HTML5 DnD. Annotarlo esplicitamente nel worklog come stato atteso, non come regressione.
6. **Lock defer-not-drop (Inv.4 `MEDIUM-TASK.md`)**: `layoutLockUntil`/`lockRetryTimer` (`tabs.vue`, dichiarazione ~233-238, uso in `updateTabRowsLayout` ~413-422) restano invariati; durante il drag il ResizeObserver può fare burst — al termine drag rilanciare `updateTabRowsLayout` + `recomputePinnedTab` come oggi avviene su `dragend`.
7. **Pinned tab (H4)**: il reorder deve restare clampato alla zona pinnata/non-pinnata (oggi implementato nella funzione `accepts` passata a `dragula(...)`, righe ~619-638, che legge `tabs.value`/`file.pinned`). Con HTML5 DnD, implementare lo stesso clamp nel calcolo dell'indice in `dragover`/`drop`: una tab pinnata non può essere droppata dopo l'ultima tab pinnata, e viceversa.
8. **Bug pre-esistente trovato durante l'esplorazione, da correggere in questo task se tocchi `recomputePinnedTab`**: `tabs.vue:546` filtra `ul.querySelectorAll('li.v2-tab:not(.v2-tab-pinned)')`, ma la classe reale applicata nel template per le tab H4-pinned è `is-pinned` (`tabs.vue:27`), non `v2-tab-pinned`. Il `:not()` quindi non esclude mai nulla. Correggere il selettore in `is-pinned` mentre si tocca questa funzione per il reorder.
9. **Distinguere `pinnedTab` (ref locale, "tab attiva in riga 2+", concetto di layout/clone nel topright) da `file.pinned`/`tab.pinned` (flag H4 persistente)**: sono due concetti diversi nello stesso file, non confonderli nel refactor (l'esplorazione ha verificato che oggi sono già tenuti distinti — mantenerli così).
10. **Autoscroll**: `dom-autoscroller` (`tabs.vue:691-696`, cleanup riga 702) oggi fa scroll orizzontale della tab bar durante il drag dragula. HTML5 DnD nativo supporta scroll automatico solo in modo limitato (nessun autoscroll built-in affidabile cross-browser per contenitori custom) — implementare uno scroll manuale nel gestore `dragover` se il cursore è vicino ai bordi della tab bar, oppure documentare esplicitamente nel worklog se si decide di rimandare l'autoscroll a un task successivo (non bloccante per il reorder di base).
11. **`data-id` sulle `<li>`**: continuare a usare l'id della tab (mai filename/pathname) come identificatore nel `dataTransfer` (`dataTransfer.setData('text/mt-tab-id', tab.id)` per coerenza con quanto già pianificato in `DRAG-TASK.md §2.1`).

## Fatti già verificati (fonte: esplorazione Agent-Explorer 2026-07-01)

- Cablaggio dragula attuale interamente in `tabs.vue`: import righe 198-199, init dragula righe 612-639 (`accepts` = clamp pinned/non-pinnata), handler `drag`/`dragend`/`drop` righe 640-689, `resyncDomToStore` righe 381-402, autoScroller righe 691-696 + cleanup 699-740, CSS `.gu-*` non scoped righe 1349-1366.
- `tabsRenderKey` (riga 379, uso riga 22), `layoutLockUntil`/`lockRetryTimer` (righe 233-238, uso 413-422), `recomputePinnedTab` (righe 543-569, chiamata anche da drop handler riga 688) — tutti confermati e da preservare.
- Costanti JS↔CSS in sync da NON toccare (Inv.5): `DYN_SLOT_W=158`, `26` (v2-tab-new-li width), `TOPRIGHT_RIGHT_OFFSET=10`, `HOVER_BUFFER=12`, `ulPadding=6`, `GAP=3`.
- `.v2-topright { position: absolute }` (Inv.1) e `.editor-middle{min-width:0}` + clamp `tabbarClientW` (Inv.2) da non toccare.
- `.v2-tab-name{flex-grow:1;min-width:0}` (B7) da non rompere col nuovo markup se si modifica il template della `<li>`.
- Il "+" inline absolute e `while(row1Count>1)` (Inv.8, righe ~489-498) non correlati al drag, non toccare.
- Nessuna traccia oggi di `draggable`/`dragstart`/`dragover` HTML5 nel file: tutto da aggiungere ex novo.
- **Stato del codice post-spike task1/task1b (2026-07-02, orchestratore — ri-grep per righe correnti):**
  - Template: overlay `<div class="v2-tabbar-drag-region" />` primo figlio di `.v2-tabbar` (DEFINITIVO, tenere; solo normalizzare i commenti SPIKE); `draggable="true"` + `@mousedown="onTabMouseDownSpike(file)"` + `@dragstart="onTabDragStartSpike(file)"` su `li.v2-tab` (SPIKE, sostituire con l'implementazione reale).
  - Script: funzioni `onTabDragStartSpike`/`onTabMouseDownSpike` (solo console.log — SPIKE, rimuovere); `drake.destroy()` subito dopo l'init dragula con commento SPIKE (rimuovere insieme a tutto il cablaggio dragula).
  - CSS: regola `.v2-tabbar-drag-region` (DEFINITIVA, tenere; normalizzare commento); `.v2-tabbar` senza più `app-region: drag` (commento SPIKE da normalizzare).

## Sottoproblemi in ordine

1. Ri-leggere `tabs.vue` per intero e ri-grep tutti i punti citati sopra per confermare righe correnti (possono essere shiftate).
2. Aggiungere `draggable="true"` sulla `.v2-tab` (già presente dallo spike), handler `dragstart` reale (`dataTransfer.setData('text/mt-tab-id', tab.id)`, eventuale `setDragImage`), rimuovere gli spike temporanei di task1/task1b (`onTabDragStartSpike`, `onTabMouseDownSpike`, `drake.destroy()` — sostituiti da questa implementazione reale) e normalizzare i commenti "SPIKE (drag-html5-dnd-task1b)" dell'overlay in commenti definitivi.
3. Aggiungere handler `dragover` sul contenitore tab bar: `preventDefault()`, calcolare indice di inserimento da `clientX` (escludendo l'elemento sorgente), disegnare indicatore visivo (lineetta/ghost) — nuovo elemento CSS scoped, non riusare classi `.gu-*`.
4. Aggiungere handler `drop`: leggere `dataTransfer.getData('text/mt-tab-id')`, calcolare indice finale, chiamare `editorStore.EXCHANGE_TABS_BY_ID` (o funzione store equivalente) — SOLO mutazione store, nessuna manipolazione DOM diretta.
5. Aggiungere handler `dragend`: reset stato locale drag, incrementare `tabsRenderKey`, richiamare `recomputePinnedTab` + `updateTabRowsLayout` fuori dal lock.
6. Implementare clamp pinned/non-pinnata nel calcolo indice (punto 7 invarianti) e correggere il bug selettore `v2-tab-pinned`→`is-pinned` (punto 8) in `recomputePinnedTab`.
7. Decidere e documentare l'approccio autoscroll (punto 10 invarianti): implementarlo o rimandarlo esplicitamente, motivando nel worklog.
8. Rimuovere il cablaggio dragula PER INTERO (vedi invariante 5bis: la coesistenza è impossibile): init `drake`, handler `drag`/`dragend`/`drop` vecchi (incluso il rilevamento detach H5-2 `lastDragScreen`/`onDragMove` — il detach resta temporaneamente non funzionante fino a task3/task4, annotarlo nel worklog), `resyncDomToStore`, `dom-autoscroller`, CSS `.gu-*` non scoped, import `dragula`/`autoScroll`. NON toccare `package.json` (rimozione dipendenze = task5). NON toccare `DETACH_TAB`/store né il main: solo il trigger renderer in `tabs.vue` viene rimosso.
9. Verificare staticamente (parse SFC) e aggiornare worklog con `[x]`, verifiche eseguite, note `DA TESTARE`.

## Verifica richiesta

- Parse SFC di `tabs.vue`.
- Test manuale atteso:
  - Trascinare una tab e riordinarla dentro la stessa finestra: indicatore d'inserimento visibile, drop aggiorna l'ordine correttamente.
  - Trascinare una tab pinnata: non può finire oltre il confine zona pinnata/non-pinnata.
  - Dopo il drop: nessun `.el` stale (le tab restano cliccabili/renderizzate correttamente), `recomputePinnedTab` aggiornato, nessun layout rotto (multi-riga, wrap, "+" inline).
  - Nessuna regressione su resize finestra durante/dopo un drag (lock ResizeObserver).
  - Autoscroll (se implementato in questo task): trascinare una tab vicino al bordo della tab bar con molte tab aperte, verificare scroll automatico.
