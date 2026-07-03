# drag-html5-dnd-task2 — worklog

## Prerequisiti verificati (2026-07-02)

- Worklog task1b letto: **GATE PASS** esplicito confermato (overlay `.v2-tabbar-drag-region` risolve causa
  n.1, rimozione/disattivazione dragula risolve causa n.2).
- Worklog task1 letto: **FAIL** con le due cause (app-region ancestor + `preventDefault()` dragula su
  `mousedown`).
- `DRAG-TASK.md` §2 (Fix proposto) e §4.1/4.2/4.3 (Invarianti) letti.
- `DESIGN-TASK.md` sezione dragula/app-region letta (righe ~34-44, ~138).
- `MEDIUM-TASK.md` sezione Invarianti tab bar (righe 39-78, punti 1-10) letta.
- `HARD-TASK.md` sezione H4 Pin tab (righe 738-775) letta.
- `tabs.vue` letto per intero (1420 righe).
- Nessun blocco: si procede con l'implementazione.

## Avanzamento

- [x] Ri-confermare punti cablaggio dragula attuale (righe possono essere shiftate).
      Confermato via lettura completa del file (2026-07-02): import `dragula`/`dom-autoscroller`
      (righe ~209-210), init `drake = dragula(...)` con `accepts` H4 (righe ~725-752), handler
      `.on('drag'/'dragend'/'drop', ...)` (righe ~753-802, incluso il trigger detach H5-2
      `lastDragScreen`/`onDragMove`/`editorStore.DETACH_TAB` dentro `dragend`), `drake.destroy()`
      spike (riga ~811), `autoScroller` init (righe ~813-818) + cleanup in `onBeforeUnmount`
      (righe ~824-827), `resyncDomToStore` (righe ~516-537), CSS `.gu-*` non scoped in coda al
      file. Righe shiftate di poco rispetto al plan (atteso), nessuna deviazione sostanziale.
- [x] Aggiungere `dragstart` reale su `.v2-tab` e rimuovere gli spike task1/task1b (log,
      `drake.destroy()`), normalizzando i commenti SPIKE dell'overlay.
      `onTabDragStart(event, file)` sostituisce `onTabDragStartSpike`: `dataTransfer.setData
      ('text/mt-tab-id', String(file.id))` (solo id, coerente con DRAG-TASK.md §2.1) +
      `effectAllowed = 'move'`. Rimossi `onTabDragStartSpike`, `onTabMouseDownSpike` (script) e
      `@mousedown="onTabMouseDownSpike(file)"` dal template. Rimossa la riga `drake.destroy()`
      insieme a tutto l'init dragula (vedi sotto). Commenti "SPIKE (drag-html5-dnd-task1b...)"
      dell'overlay `.v2-tabbar-drag-region` normalizzati in commenti definitivi (template,
      `.v2-tabbar`, `.v2-tabbar-scroll`, regola CSS `.v2-tabbar-drag-region`): la struttura resta,
      descritta come definitiva con riferimento a "Inv. 5 drag-html5-dnd-task2" dove pertinente.
- [x] Aggiungere `dragover` con indicatore d'inserimento e calcolo indice.
      Handler `onTabsDragOver` su `ul.v2-tabs` (`@dragover.prevent`): calcola il target
      d'inserimento con `computeDragTarget(clientX)` — esclude la tab sorgente (invariante 4,
      niente `gu-mirror`) e filtra i candidati alla zona pinnata/non-pinnata della tab
      trascinata (invariante 7/H4), con fallback all'intera lista se la zona di appartenenza
      risulta vuota (es. unica pinnata). Aggiunto `dragTargetId` (ref, id della tab prima della
      quale si inserirebbe, null = fine zona) e `dragIndicatorLeft` (px, posizione
      dell'indicatore). Indicatore renderizzato come `<li class="v2-tab-drop-indicator">`
      position:absolute (stesso pattern del "+" inline, non altera offsetWidth/offsetTop —
      nessun impatto sulla detection multi-row), nuova classe CSS scoped (non riuso di `.gu-*`).
      Aggiunto `onTabsDragLeave` per nascondere l'indicatore quando il cursore lascia
      davvero la `ul` (check `relatedTarget`, non ad ogni passaggio tra tab).
- [x] Aggiungere `drop` con mutazione store (no manipolazione DOM diretta).
      Handler `onTabsDrop` su `ul.v2-tabs` (`@drop.prevent`): legge
      `dataTransfer.getData('text/mt-tab-id')` (fallback su `draggedTabId.value` se il browser
      non lo espone in `drop` per qualche motivo) e chiama SOLO
      `editorStore.EXCHANGE_TABS_BY_ID({ fromId, toId: dragTargetId.value })` — nessun
      `removeChild`/`insertBefore` (invariante 1), Vue `v-for`+`:key` riconcilia il DOM.
- [x] Aggiungere `dragend` con `tabsRenderKey`++/`recomputePinnedTab`/`updateTabRowsLayout`.
      Handler `onTabDragEnd` (`@dragend` su `li.v2-tab`): resetta `draggedTabId`/`dragTargetId`,
      poi in `nextTick` incrementa `tabsRenderKey` (invariante 2, elimina `.el` stale nel vdom) e
      richiama `recomputePinnedTab()` (bypassa il lock per costruzione, invariante 3) +
      `requestAnimationFrame(() => updateTabRowsLayout())` (invariante 6, rilancia il layout dopo
      il burst ResizeObserver del drag; passa comunque dal `layoutLockUntil`/retry esistente).
- [x] Implementare clamp pinned + fix selettore `v2-tab-pinned`→`is-pinned`.
      Clamp pinned implementato in `computeDragTarget` (vedi sopra, invariante 7): i candidati
      per il calcolo dell'indice sono filtrati alla zona pinnata/non-pinnata della tab
      trascinata. La mutazione effettiva resta comunque protetta anche a valle da
      `EXCHANGE_TABS_BY_ID` (`store/editor.js:1242`, NON toccato in questo task), che clampa già
      `realToIndex` alla zona corretta leggendo `fromPinned`/`lastPinned`/`firstUnpinned` — quindi
      l'indicatore visivo e l'esito effettivo del drop restano coerenti tra loro.
      Fix selettore (punto 8 plan, bug pre-esistente): `recomputePinnedTab`
      (`ul.querySelectorAll('li.v2-tab:not(.v2-tab-pinned)')` → `:not(.is-pinned)`, unica riga
      toccata di questa funzione), con commento che spiega il bug pre-esistente (`.v2-tab-pinned`
      non è mai applicata nel template, la classe reale H4 è `is-pinned`).
- [x] Decidere/documentare approccio autoscroll.
      **Deciso: implementato** (non rimandato), punto 10 invarianti. In `onTabsDragOver`: se
      `clientX` è entro 40px dal bordo sinistro/destro di `.v2-tabbar-scroll` (`tabContainer`,
      lo stesso elemento con `scrollLeft` già usato da `handleTabScroll` per lo scroll a
      rotellina), si applica uno scroll manuale di 12px per evento verso quel bordo
      (`AUTOSCROLL_EDGE_PX`/`AUTOSCROLL_STEP_PX`). Limite noto e documentato: `dragover` in
      Chromium si ri-genera automaticamente ogni ~350ms anche a cursore fermo (per spec HTML5
      DnD), quindi lo scroll continua ma a passo/cadenza fissi — non è fluido/accelerato come un
      loop rAF dedicato; considerato accettabile per il reorder di base (non bloccante, come da
      plan). Nessun autoscroll nativo cross-browser affidabile esiste per contenitori custom
      (motivazione DRAG-TASK.md/plan), quindi la scelta è manuale e non nativa.
- [x] Rimuovere cablaggio dragula PER INTERO (coesistenza impossibile, invariante 5bis; detach
      temporaneamente non funzionante fino a task3/4 — annotarlo).
      Rimossi: import `dragula`/`dom-autoscroller`; variabili `drake`, `autoScroller`,
      `lastDragScreen`, `onDragMove`; init `dragula([...], { accepts, moves, ... })` con tutta la
      logica di clamp H4 dentro `accepts` (sostituita dal clamp equivalente in
      `computeDragTarget`); handler `.on('drag')`, `.on('dragend')` (incluso il trigger detach
      H5-2: rilevazione "fuori finestra" via `lastDragScreen`/`screenX/Y` e chiamata
      `editorStore.DETACH_TAB(tab, drop)`), `.on('drop')`; riga spike `drake.destroy()`;
      `autoScroller = autoScroll(...)`; funzione `resyncDomToStore`; variabile
      `currentDragDropHandled`; cleanup `autoScroller.destroy(true)` / `drake.destroy()` /
      `window.removeEventListener('mousemove', onDragMove)` in `onBeforeUnmount`; blocco CSS non
      scoped `.gu-mirror`/`.gu-hide`/`.gu-unselectable`/`.gu-transit` in coda al file. NON
      toccato `store/editor.js` (`DETACH_TAB`/`EXCHANGE_TABS_BY_ID` restano invariati), NON
      toccato `package.json` (dragula resta installata, rimozione dipendenza = task5).
      **Stato atteso, non regressione**: il detach trascinando una tab fuori dalla finestra
      (H5-2) NON funziona più da questo task in poi, perché il suo trigger viveva
      esclusivamente nell'handler `dragend` di dragula appena rimosso. Task3/4 lo
      re-implementeranno sopra l'HTML5 DnD nativo (`dragend` con `dropEffect === 'none'` /
      coordinate schermo, come da `DRAG-TASK.md §2` punto 4). "Sposta in nuova finestra" da menu
      contestuale (se esiste un percorso alternativo che non passa da questo handler) non è
      stato verificato in questo task: fuori scope, non toccato.
- [x] Verificare staticamente e riportare esito.
      Parse SFC di `tabs.vue` con `@vue/compiler-sfc` (`parse` + `compileScript` +
      `compileTemplate`) via script Node ad-hoc in scratchpad (non nel repo): **ALL OK**, nessun
      errore. Grep di conferma: nessun riferimento a codice attivo `dragula`, `autoScroll`/
      `dom-autoscroller`, `gu-mirror`/`gu-hide`/`gu-unselectable`/`gu-transit`,
      `resyncDomToStore`, `onTabDragStartSpike`, `onTabMouseDownSpike`, `drake`,
      `currentDragDropHandled`, `lastDragScreen`, `onDragMove` — restano solo alcuni commenti
      storici/esplicativi che citano "dragula" per spiegare cosa è stato rimosso e perché (non
      codice vivo).

## Stato task: DA TESTARE (fix round 1 applicato, verifica statica OK, manca retest manuale utente)

## Test

DA TESTARE lato utente (OBBLIGATORIO), su Windows, `npm run dev` + DevTools renderer:
1. Trascinare una tab e riordinarla dentro la stessa finestra: indicatore d'inserimento
   (lineetta verticale accent-color) visibile durante il drag, il drop aggiorna l'ordine
   correttamente, nessun errore console.
2. Trascinare una tab pinnata (H4): non deve poter finire oltre il confine zona
   pinnata/non-pinnata (né visivamente nell'indicatore né nell'ordine finale dopo il drop).
   Verificare anche il caso opposto (tab non-pinnata trascinata verso la zona pinnata).
3. Dopo il drop: le tab restano cliccabili/renderizzate correttamente (nessun `.el` stale),
   `pinnedTab` (clone topright, riga 2+) resta coerente, nessun layout rotto (multi-row, wrap,
   posizione "+").
4. Nessuna regressione su resize finestra durante/dopo un drag (comportamento
   `layoutLockUntil`/`lockRetryTimer` invariato).
5. Autoscroll: con molte tab aperte (più di quante entrano in riga1/scroll visibile),
   trascinare una tab vicino al bordo sinistro/destro della tab bar e verificare che scrolli
   automaticamente (passo fisso ~12px per evento `dragover`, vedi nota sopra sulla cadenza).
6. **Detach (drag-out dalla finestra): atteso NON funzionante in questo task** (rimozione
   completa del trigger dragula, invariante 5bis) — non è un fallimento del test, è lo stato
   atteso fino a task3/4. Verificare solo che trascinare una tab fuori dalla finestra non
   produca errori console e non lasci lo stato UI incoerente (es. tab bloccata in stato
   "in drag").
7. Drag region: trascinare dalla zona vuota della tabbar deve ancora spostare la finestra
   (overlay `.v2-tabbar-drag-region` invariato); doppio-click sulla zona vuota deve ancora
   massimizzare/ripristinare.

**Esito test manuale (utente, 2026-07-02): FAIL — 3 bug + 2 conferme positive.**
1. **BUG-DROP**: la tab si trascina (dragstart/indicatore ok) ma al rilascio NON viene
   riposizionata (il reorder non avviene). Causa non ovvia dall'ispezione statica
   (`onTabsDrop` → `EXCHANGE_TABS_BY_ID` sembra corretto): serve strumentazione temporanea
   (log su drop fired / ids / esito EXCHANGE).
2. **BUG-INDICATORE-STILE**: lineetta verticale secca non adatta alle tab a pillola (VS Code
   la usa su tab rettangolari): serve un effetto diverso, coerente con le pill arrotondate.
3. **BUG-INDICATORE-ALTEZZA**: l'indicatore è alto quanto l'intera `ul` (top/bottom fissi) →
   in multi-row attraversa e si sovrappone alle tab delle righe successive. Va confinato alla
   riga della tab target (offsetTop/offsetHeight dell'elemento target, non altezza ul).
4. **BUG-DRAG-ZONA-TESTO**: il drag tab risulta accettato anche sopra la zona testo (editor
   Muya, contenteditable → drop target di default per drag testuali; verificato:
   `dragDropCtrl.js` non blocca i type sconosciuti). Il drop tab deve essere valido SOLO
   sulla tab bar: bloccare `dragover` fuori da `.v2-tabbar` quando i types contengono
   `text/mt-tab-id` (dropEffect 'none'), così il futuro `dropEffect === 'none'` di task3
   resta un segnale affidabile anche per il detach.
5. ✅ **Conferma anticipata OLE/taskbar**: trascinando la tab sulla taskbar di Windows il drag
   OLE funziona (il rischio ⚠️ hover-taskbar di DRAG-TASK.md è già di fatto verificato).
6. ✅ Detach fuori finestra non funzionante = atteso (task3/4), non è un bug di questo task.

**Retest dopo Fix round 1 (utente, 2026-07-03):**
- Indicatore: OK ("barretta carina, va bene") — BUG-INDICATORE-STILE e -ALTEZZA chiusi.
- BUG-DROP ancora presente. Log console durante reorder: compaiono SOLO
  `onTabDragStart (mt-6)` e `onTabDragEnd, dropEffect: none`. NON compaiono `onTabsDrop fired`
  né il log post-EXCHANGE → l'evento `drop` non viene mai consegnato, e il browser chiude il
  gesto con `dropEffect: 'none'` (nessun target valido registrato) nonostante `dragover` giri
  (l'indicatore si muove) e sia cancellato via `.prevent`.
- NUOVO BUG-GHOST: il drag image di default mostra un rettangolo con angoli quadrati invece
  della pillola (screenshot del box dell'elemento con sfondo opaco su Windows).

**Diagnosi BUG-DROP (orchestratore, 2026-07-03):** `onTabsDragOver` non imposta mai
`event.dataTransfer.dropEffect = 'move'`. Con `effectAllowed = 'move'` e dropEffect lasciato
al default, Chromium può risolvere l'operazione corrente a 'none' → il target non è valido →
`drop` non viene generato e `dragend` riporta `dropEffect: 'none'`. Quirk noto del modello
HTML5 DnD (dropEffect va dichiarato esplicitamente nel dragover del target). Coerente con la
cronologia: il bug esiste da prima del blocco capture zona-testo (fix round 1), quindi non è
causato da quello. Fix round 2: settare `dropEffect = 'move'` in `onTabsDragOver` (+
`@dragenter.prevent` sulla ul per aderenza alla spec) e fix BUG-GHOST via `setDragImage` con
clone-pillola fuori schermo.

## Fix round 1 (2026-07-03)

Istruzioni ricevute dall'orchestratore sui 3 bug rilevati dal test manuale. File toccato:
solo `tabs.vue` (nessun'altra modifica a `store/editor.js`/main/`package.json`).

- [x] **BUG-DROP**: causa non deducibile staticamente dall'ispezione del codice (`onTabsDrop` →
      `EXCHANGE_TABS_BY_ID` sembra corretto: `dataTransfer.getData('text/mt-tab-id')` e
      `tab.id` sono entrambi stringhe — `getUniqueId()`, `src/renderer/src/util/index.js:126`,
      genera id stringa prefissata — quindi non è un mismatch di tipo evidente). Aggiunta
      strumentazione TEMPORANEA `[DEBUG drag-html5-dnd-task2]` (NON toccato `store/editor.js`,
      vietato): `console.log` in `onTabDragStart` (id sorgente), `onTabsDrop` (`event`,
      `droppedId`, `dragTargetId.value`, e — dopo la chiamata a `EXCHANGE_TABS_BY_ID` — l'array
      `tabs.value.map(t => t.id)` per leggere l'esito senza toccare lo store), `onTabDragEnd`
      (`event.dataTransfer.dropEffect`). Nessuna causa evidente identificata con certezza in
      questo giro: la strumentazione resta per il retest, nessuna modifica di logica applicata
      "a caso" (principio: non correggere su supposizione non verificata).
- [x] **BUG-INDICATORE-STILE** (decisione utente: "barretta arrotondata"): CSS
      `.v2-tab-drop-indicator` aggiornato — `width: 3px`, `border-radius: 2px`,
      `box-shadow: 0 0 4px var(--v2-accent)` (glow), `background: var(--v2-accent)` invariato.
      Rimossi i `top`/`bottom` fissi in CSS (ora gestiti da style inline, vedi punto sotto).
- [x] **BUG-INDICATORE-ALTEZZA**: in `onTabsDragOver` calcolati anche `dragIndicatorTop`
      (`refEl.offsetTop`) e `dragIndicatorHeight` (`refEl.offsetHeight`), dove `refEl` è
      `targetEl` (tab davanti alla quale si inserirebbe) oppure, nel caso "in fondo alla zona",
      l'ultimo candidato della zona (`candidates[candidates.length - 1]`) — mai l'intera `ul`.
      Applicati come style inline `top`/`height` sul `<li class="v2-tab-drop-indicator">`
      (oltre a `left` già esistente). In più, fix collegato non esplicitamente richiesto ma
      necessario per l'invariante "sparisce quando si esce dalla tab bar": la visibilità
      dell'indicatore non è più legata a `draggedTabId` (che resta valorizzato per tutta la
      durata del drag, anche fuori dalla `ul`) ma a un nuovo ref dedicato
      `dragIndicatorVisible` — impostato `true` in `onTabsDragOver` (il cursore è sulla `ul`) e
      `false` in `onTabsDragLeave` (uscita reale dalla `ul`, check `relatedTarget` invariato) e
      in `onTabDragEnd` (fine gesto).
- [x] **BUG-DRAG-ZONA-TESTO**: aggiunta funzione `blockForeignTabDropOutsideTabbar`,
      registrata in `onMounted` con `window.addEventListener('dragover',
      blockForeignTabDropOutsideTabbar, true)` (fase capture) e rimossa simmetricamente in
      `onBeforeUnmount`. Condizione: se `event.dataTransfer.types.includes('text/mt-tab-id')`
      (basato sui MIME types, non su `draggedTabId` locale — vale quindi anche per un drag di
      tab in arrivo da un'ALTRA finestra, requisito esplicito per il futuro
      `dropEffect === 'none'` di task3/4) e il target NON è dentro `.v2-tabbar` →
      `preventDefault()` + `dropEffect = 'none'` + `stopPropagation()` (ferma la propagazione
      verso il dragover handler di Muya sull'editor, che altrimenti accetta il drop come testo
      generico). Gestito il caso `event.target` nodo di testo: `event.target.closest ?
      event.target : event.target.parentElement` prima di chiamare `.closest('.v2-tabbar')`.
      Essendo in fase capture e condizionato su target dentro `.v2-tabbar` → non fa nulla
      (return anticipato), non interferisce con il flusso `dragover`/`drop` esistente sulla
      `ul` (che gestisce normalmente il proprio bubbling in fase bubble).
- [x] Verifica statica: parse SFC di `tabs.vue` con `@vue/compiler-sfc` (`parse` +
      `compileScript` + `compileTemplate`) via script Node ad-hoc in scratchpad: **ALL OK**,
      nessun errore.

**Stato: DA TESTARE.** Retest lato utente richiesto sui 3 punti + verifica che i log
`[DEBUG drag-html5-dnd-task2]` in console aiutino a isolare la causa di BUG-DROP (in
particolare confrontare `droppedId`/`dragTargetId` loggati con gli id reali delle tab, e
l'array `tabs.value` prima/dopo `EXCHANGE_TABS_BY_ID` per capire se lo store viene mutato
correttamente ma la vista non si aggiorna, oppure se lo store stesso non muta). La
strumentazione è temporanea e marcata `[DEBUG ...]`: da rimuovere in un giro successivo una
volta confermata la causa/il fix.

## Fix round 2 (2026-07-03)

Istruzioni ricevute dall'orchestratore su BUG-DROP (diagnosi già fatta) e sul nuovo
BUG-GHOST rilevato nel retest 2026-07-03. File toccato: solo `tabs.vue`. Log
`[DEBUG drag-html5-dnd-task2]` NON rimossi (servono ancora al retest di conferma).

- [x] **BUG-DROP**: in `onTabsDragOver`, subito dopo l'early-return, aggiunto
      `event.dataTransfer.dropEffect = 'move'` con commento che richiama la diagnosi
      (Chromium risolve l'operazione a 'none' se il target non dichiara esplicitamente il
      dropEffect nel proprio `dragover`, anche con `effectAllowed='move'` sull'origine → il
      `drop` non viene mai generato). Aggiunto anche `@dragenter.prevent` sulla `ul.v2-tabs`
      nel template (aderenza alla spec: il target va designato anche in `dragenter`, non solo
      in `dragover`).
- [x] **BUG-GHOST**: in `onTabDragStart`, creato un ghost via `cloneNode(true)` del `li`
      sorgente (`event.currentTarget`) — scelto il clone anziché costruire un div a mano
      perché il nodo clonato mantiene l'attributo scoped di Vue: la nuova classe
      `v2-tab-drag-ghost` aggiunta via `classList.add` riceve quindi regolarmente lo stile
      scoped esistente, senza bisogno di un blocco `<style>` non scoped separato né di
      duplicare a mano tutte le regole visive della pillola (già coperte da `.v2-tab` +
      contenuto clonato). Il ghost viene appeso a `document.body`, posizionato fuori
      viewport via CSS (`position: fixed; top:-1000px; left:-1000px`, nuova regola scoped
      `.v2-tab-drag-ghost`) e passato a `event.dataTransfer.setDragImage(ghost, offsetX,
      offsetY)` con offset = coordinate del mouse relative al rettangolo della tab sorgente
      (`event.clientX/Y - rect.left/top`, `rect = event.currentTarget.getBoundingClientRect()`).
      Riferimento salvato nella variabile di modulo `dragGhostEl` (non un `ref`: non serve
      reattività). Rimozione del nodo dal DOM in `onTabDragEnd` (fine gesto, successo o
      annullato) e, per sicurezza, in `onBeforeUnmount` (smontaggio a metà di un drag).
- [x] Verifica statica: parse SFC di `tabs.vue` con `@vue/compiler-sfc` (`parse` +
      `compileScript` + `compileTemplate`) via script Node ad-hoc in scratchpad: **ALL OK**,
      nessun errore.

**Stato: DA TESTARE.** Retest lato utente richiesto: reorder tab funzionante (drop consegnato,
ordine aggiornato) + drag image a pillola (niente più angoli quadrati/sfondo opaco). Nessuna
deviazione dalle istruzioni ricevute; nessun altro file toccato oltre `tabs.vue` e questo
worklog.

**Retest dopo Fix round 2 (utente, 2026-07-03): BUG-DROP ANCORA PRESENTE — diagnosi finale:
bug piattaforma, non nostro.**
- Log console: `dragover` gira e viene cancellato con `dropEffect='move'` impostato, ma il
  valore non round-trippa (i log lo rivedono `'none'`); al rilascio arrivano
  `dragleave`+`dragend` con `dropEffect:'none'`; `onTabsDrop` MAI chiamato.
- Diagnosi (tracer DnD completo + ricerca online): **electron/electron#42252** — la consegna
  del `drop` per i drag HTML5 interni alla stessa finestra è rotta su Windows da Electron 28+,
  mai fixata upstream. Escluse cause nostre (overlay disattivato, MIME `text/plain` aggiunto,
  `dropEffect`/`dragenter.prevent` del round 2: tutti identici).
- Decisione registrata in `docs/Ai/DECISIONS.md` 2026-07-03 e riportata nel plan task2
  (sezione "AGGIORNAMENTO 2026-07-03"): reorder da decidere su `dragend`
  (bounds tabbar + `computeDragTarget(clientX)` + `EXCHANGE_TABS_BY_ID`), `onTabsDrop` tenuto
  come percorso preferenziale con flag anti-doppia-esecuzione. Downside accettato: cursore di
  divieto durante il drag sopra la propria tabbar.
- Esito BUG-GHOST (drag image a pillola del round 2): **OK, chiuso** (conferma utente
  2026-07-03, "la pillola è ok ora").

## Fix round 3 (2026-07-03)

Implementazione della regola DECISIONS.md 2026-07-03 (reorder deciso su `dragend`, bug
piattaforma electron#42252). File toccato: solo `tabs.vue`.

- [x] Aggiunto flag di modulo `dropHandledThisDrag` (reset in `onTabDragStart`, settato
      `true` in `onTabsDrop` dopo `EXCHANGE_TABS_BY_ID`): anti-doppia-esecuzione se un
      futuro Electron torna a consegnare il `drop` (che resta percorso preferenziale).
- [x] Fallback reorder in `onTabDragEnd`: se il drop non è scattato e il punto di
      rilascio (`event.clientX/clientY`, sempre presenti sul `dragend`) cade dentro i
      bounds di `.v2-tabbar` → `computeDragTarget(clientX)` (stesso calcolo del
      `dragover`, coerente con l'indicatore mostrato) + `EXCHANGE_TABS_BY_ID`. Nessuna
      manipolazione DOM (invariante 1); il ricalcolo del target al dragend evita di
      dipendere da `dragTargetId` azzerato da un eventuale `dragleave` finale.
- [x] Rimosso il tracer diagnostico `[DEBUG dnd-tracer]` (window-level, entrambe le fasi)
      e le sue registrazioni in `onMounted`/`onBeforeUnmount`: causa individuata, non
      serve più.
- [x] Rimosso `setData('text/plain', ...)` aggiunto in diagnosi: escluso come causa del
      BUG-DROP e avrebbe incollato l'id della tab nelle app esterne. Resta solo il MIME
      custom `text/mt-tab-id` (conforme a DRAG-TASK.md §2.1).
- [x] Corretto il commento di `blockForeignTabDropOutsideTabbar` che indicava
      `dropEffect === 'none'` come futuro segnale affidabile per il detach task3/4
      (superato dalla decisione 2026-07-03: si useranno le coordinate schermo).
- [x] Log `[DEBUG drag-html5-dnd-task2]` mantenuti ma ridotti a: dragstart (id sorgente),
      drop (se compare = piattaforma fixata), dragend fallback (inside/coordinate, esito
      reorder). Da rimuovere a reorder confermato dal retest.
- [x] Verifica statica: parse SFC di `tabs.vue` con `@vue/compiler-sfc` (`parse` +
      `compileScript` + `compileTemplate`) via script Node in scratchpad: **ALL OK**.
      Grep di conferma: nessun residuo `dbgDndTracer`/`DBG_DND_EVENTS`/`text/plain`
      (resta solo il commento esplicativo sulla rimozione).

**Stato: DA TESTARE (retest manuale utente sul reorder via dragend).**

**Retest dopo Fix round 3 (utente, 2026-07-03): reorder FUNZIONA via dragend, ma con
BUG-MULTIROW.**
- Il reorder ora avviene (log: `onTabDragEnd fallback, inside tabbar: true` → `reorder via
  dragend` con l'array riordinato; `onTabsDrop fired` mai comparso, come atteso col bug
  piattaforma electron#42252).
- **BUG-MULTIROW**: le tab si possono spostare SOLO in prima riga, TRANNE l'ultimo posto
  della riga finale. Causa (diagnosi orchestratore): `computeDragTarget` usa solo
  `clientX`, mai `clientY` — in multi-row scandisce i candidati in ordine DOM (riga 1 →
  riga 2 → ...) e prende la prima tab con centro-x oltre il cursore, che è quasi sempre
  una tab di riga 1. L'unico caso fuori riga 1 è `clientX` oltre TUTTI i centri → target
  null → fine lista ("ultimo posto della riga finale"). Bug presente fin dal primo giro
  (il calcolo è sempre stato X-only), mascherato finché i test avvenivano su riga 1.
- Fix round 4 delegato ad Agent-Code: raggruppare i candidati per riga visiva
  (getBoundingClientRect), scegliere la riga sotto `clientY`, target solo in quella riga;
  oltre l'ultima tab di una riga non-finale = inserimento prima della prima tab della
  riga successiva, con indicatore disegnato a fine riga corrente.

## Fix round 4 (2026-07-03)

Fix di BUG-MULTIROW su istruzioni dell'orchestratore. File toccato: solo `tabs.vue`.

- [x] Nuova firma `computeDragTarget(clientX, clientY)` (era `clientX` soltanto).
      Mantenuti invariati: esclusione della tab sorgente (`draggedTabId`) e filtro di
      zona pinnata/non-pinnata (invariante 7/H4) con fallback all'intera lista se la
      zona è vuota. Se non ci sono candidati → return anticipato
      `{ targetId: null, indicatorEl: null, indicatorAfter: false }`.
- [x] Raggruppamento dei candidati per riga visiva: scan in ordine DOM, nuova riga
      quando il `top` di `getBoundingClientRect()` si discosta dal `top` della riga
      corrente di più di metà della sua altezza. Ogni riga tiene `top`, `bottom` (max
      dei bottom) e le celle `{ el, rect }`.
      Scelta della riga: `rowIdx = rows.findIndex(r => clientY <= r.bottom)`, fallback
      all'ultima riga se `-1` (cursore sotto tutte le righe o nei gap/sopra la prima —
      coerente col comportamento richiesto).
      Match X SOLO dentro la riga scelta: prima cella con `clientX < rect.left +
      rect.width / 2` → `{ targetId, indicatorEl: quella cella, indicatorAfter: false }`.
      Se nessuna cella della riga matcha (cursore oltre l'ultima tab della riga):
      `targetId` = data-id della prima cella della riga successiva (o `null` se è
      l'ultima riga), `indicatorEl` = ultima cella della riga CORRENTE (dove punta il
      mouse), `indicatorAfter: true`.
      Return type cambiato da `{ targetId, targetEl, candidates }` a `{ targetId,
      indicatorEl, indicatorAfter }`: i due call site non avevano più bisogno
      dell'intera lista `candidates`, solo dell'elemento di riferimento per
      l'indicatore e se disegnarlo prima o dopo di esso.
- [x] Aggiornato il commento della funzione: spiega il raggruppamento per riga e
      perché serve `clientY` (causa BUG-MULTIROW: il calcolo X-only matchava sempre
      la prima riga in ordine DOM, indipendentemente da quale riga fosse sotto il
      cursore).
- [x] Aggiornato call site `onTabsDragOver`: chiama `computeDragTarget(event.clientX,
      event.clientY)`. Logica di posizionamento indicatore riscritta secondo le
      istruzioni: se `indicatorEl` → `dragIndicatorLeft = indicatorAfter ?
      indicatorEl.offsetLeft + indicatorEl.offsetWidth + 1 : indicatorEl.offsetLeft -
      2`, `dragIndicatorTop = indicatorEl.offsetTop`, `dragIndicatorHeight =
      indicatorEl.offsetHeight`; altrimenti (nessun candidato, ul con la sola tab
      trascinata) → `dragIndicatorLeft = 6` (ulPadding) invariato. Aggiunto un
      commento che richiama la non-mescolanza tra `offsetLeft/offsetTop` (sistema di
      coordinate dell'indicatore, relativo alla ul) e `getBoundingClientRect`
      (usato solo dentro `computeDragTarget` per il confronto col cursore).
- [x] Aggiornato call site `onTabDragEnd` (fallback reorder, blocco `if (inside)`):
      chiama `computeDragTarget(event.clientX, event.clientY)`, uso di `targetId`
      invariato.
- [x] Nessun'altra modifica: overlay `.v2-tabbar-drag-region`, `dropHandledThisDrag`,
      `onTabsDrop`, `blockForeignTabDropOutsideTabbar`, ghost `setDragImage`,
      autoscroll in `onTabsDragOver`, `tabsRenderKey`/`recomputePinnedTab`/
      `updateTabRowsLayout` in `onTabDragEnd` non toccati. Log `[DEBUG
      drag-html5-dnd-task2]` esistenti non rimossi.
- [x] Verifica statica: parse SFC di `tabs.vue` con `@vue/compiler-sfc` (`parse` +
      `compileScript` + `compileTemplate`) via script Node in scratchpad: **ALL OK**.
      Grep di conferma: nessun call site residuo di `computeDragTarget(` a 1 solo
      argomento (entrambi i 2 call site passano `event.clientX, event.clientY`).

**Retest dopo Fix round 4 (utente, 2026-07-03): PASS — BUG-MULTIROW risolto.**
Reorder multi-row funzionante: le tab si spostano su tutte le righe, non più solo verso
la prima. Nessun bug residuo segnalato dall'utente.

**Stato task2: FUNZIONANTE (test manuale superato).** Coda residua accorpata al task3
(stesso file, stessi handler): rimozione dei log `[DEBUG drag-html5-dnd-task2]` in
`onTabDragStart`/`onTabsDrop`/`onTabDragEnd`.
