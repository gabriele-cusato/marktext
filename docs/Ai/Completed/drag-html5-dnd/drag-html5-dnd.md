# drag-html5-dnd — Migrazione da dragula a HTML5 DnD nativo

## Scopo

Portare il drag tab da dragula (finto, su eventi mouse) a HTML5 DnD nativo (come VS Code): reorder multi-riga dentro la finestra, detach in nuova finestra trascinando fuori, migrazione su finestra MarkText esistente con auto-chiusura della secondaria vuota, spring-loading della taskbar Windows durante il drag, copia file su desktop/Explorer via `DownloadURL` (file:// per le salvate, blob URL per le untitled), gate dropEffect 'copy' per decidere copia vs nuova finestra. **Parità VS Code raggiunta e testata (2026-07-03) su tutti i punti**, taskbar inclusa; unica eccezione: indicatore d'inserimento nella finestra destinazione durante il drag cross-finestra (rimandato, vedi punti aperti).

## Modifiche

### src/renderer/src/components/editorWithTabs/tabs.vue
- Aggiunto overlay `.v2-tabbar-drag-region` (position:absolute, inset:0, app-region:drag) come primo figlio di `.v2-tabbar` per risolvere intercettazione window-drag OS su draggable (pattern VS Code, definitivo).
- `.v2-tabbar` perde `app-region:drag` (spostato all'overlay).
- Handler `dragstart` su `.v2-tab`: `dataTransfer.setData('text/mt-tab-id', String(file.id))` + `effectAllowed='copyMove'` + `setData('DownloadURL', ...)` + `setDragImage(ghost)`.
- Handler `dragover` su `ul.v2-tabs`: calcola indice inserimento con `computeDragTarget(clientX)` escludendo tab sorgente, filtra clamp pinned/non-pinned, disegna indicatore position:absolute scoped (`.v2-tab-drop-indicator`), imposta `dropEffect='move'`, autoscroll manuale su bordi barra (12px).
- Handler `drop` su `ul.v2-tabs`: legge MIME id, chiama `EXCHANGE_TABS_BY_ID` (puro store, no DOM), flag anti-doppia-esecuzione per futuro fix Electron.
- Handler `dragend` su `.v2-tab`: decide reorder stessa finestra (bounds tabbar via `clientX/Y`) vs detach fuori finestra (bounds schermo via `screenX/Y`) vs cross-finestra (main dirotta via coordinate), resetta stato drag, incrementa `tabsRenderKey`, richiama `recomputePinnedTab`/`updateTabRowsLayout`.
- Funzione `computeDragTarget(clientX, clientY)`: raggruppa le tab per riga visiva (getBoundingClientRect), sceglie la riga sotto clientY, match X solo dentro quella riga (fix BUG-MULTIROW: il calcolo X-only matchava sempre la riga 1); esclude la sorgente, clampa la zona pinned/non-pinned.
- Handler `blockForeignTabDropOutsideTabbar` globale (capture): rifiuto PASSIVO (`stopPropagation` solo, MAI preventDefault/dropEffect) per drag tab fuori tabbar, blocca editor Muya dalle sue gesture testuali.
- Rimosso: import dragula/dom-autoscroller, init dragula, handler dragula vecchi, funzione resyncDomToStore, CSS non scoped `.gu-*`, spike temporanei task1/task1b.

### src/renderer/src/store/editor.js
- `DETACH_TAB(tab, screen)`: guardia `if (this.tabs.length <= 1 && !screen) return` (context-menu senza screen resta bloccato; drag con screen abilita ultimo-tab), payload IPC aggiunto `isLastTab: this.tabs.length === 1`.
- Auto-chiusura finestra svuotata (round 9b): `FORCE_CLOSE_TAB` e `CLOSE_TABS` a `tabs.length === 0` inviano `mt::window-emptied`; il main (`app/index.js`) chiude la finestra SOLO se non è `_isSessionOwner`. Copre sia la chiusura manuale (X, chiudi-tutte) sia la migrazione dell'ultima tab (il percorso `mt::detach-tab-ack` passa da `FORCE_CLOSE_TAB`). L'owner resta sempre aperto anche a 0 tab.
- `INSERT_DETACHED_TAB` (task4 fix): selettore corretto `:not(.is-pinned)` (era `:not(.v2-tab-pinned)` inesistente), rimosso filtro `.gu-mirror` (dragula-specifico, obsoleto).

### src/main/app/index.js
- Handler `mt::detach-tab`: letto `isLastTab` dal payload, guardia `if (isLastTab && (!targetWin || (srcEditor && srcEditor._isSessionOwner))) return` → ultimo-tab dell'owner non migra, ultimo-tab senza destinazione non crea fotocopia. Flusso cross-finestra via `_findEditorWindowAt` invariato.

### package.json
- Rimossi: `dragula@^3.7.3`, `dom-autoscroller@^2.3.4` (task5, dipendenze non più referenziate nel codice).
- **Eseguire `npm install` al primo caricamento post-chiusura feature.**

## Da tenere a mente

### Invarianti permanenti (famiglia DRAG-TASK.md §4)

1. **Tab non-discendenti di app-region:drag**: l'overlay `.v2-tabbar-drag-region` (fratello di `.v2-tabbar`, mai antenato) è la struttura definitiva introdotta da task1b. Movimento delle tab a discendente diretto di `.v2-tabbar` senza overlay riattiva il window-drag OS che sopprime dragstart nativo — **non togliere l'overlay**.

2. **Rifiuto passivo su dragover non gestito** (famiglia electron#42252, REGOLA PERMANENTE in DECISIONS.md 2026-07-03): in un handler `dragover`, per gesti che NON si intende accettare, mai `preventDefault`, mai assegnare `dropEffect` (nemmeno 'none'), mai `stopPropagation` generalizzato. Il rifiuto corretto è passivo: dragover non cancellato = target non-accettante. Violazioni di questa regola corrompono lo stato del drag OLE per l'intero gesto su Windows: era la causa CONFERMATA (round 8, test utente) dello spring-loading taskbar morto per tutti i drag originati da MarkText — colpevoli i rami else di `setupDragDropHandler` in `app.vue` (window-level) e del `dragoverHandler` di Muya (`contentState/dragDropCtrl.js`), oggi resi passivi con commenti definitivi. Un preventDefault+dropEffect='none' window-level (blocker round 1) aveva inoltre ucciso il drop cross-finestra (fix round 5: il blocker `blockForeignTabDropOutsideTabbar` fa SOLO stopPropagation mirato sul MIME tab, per impedire a Muya di accettare — unico stopPropagation legittimo). Vale per qualunque drop-target futuro.

3. **Logica reorder/detach su `dragend`, non su `drop` o `dropEffect`**: electron/electron#42252 (Windows, Electron ≥28, non fixato) rende `drop` evento non consegnato e `dropEffect` sempre 'none' per drag interni stessa finestra. Decisioni prese su **coordinate schermo del `dragend`** (native, senza polling): dentro tabbar → reorder; fuori bounds finestra → detach; dentro finestra ma fuori tabbar → annulla. `onTabsDrop` tenuto come path preferenziale con flag anti-doppia-esecuzione (se futuro Electron fixa il bug, funziona e dragend non duplica).

4. **Revoca blob al dragstart successivo, non al dragend**: il CF_HDROP differito della DownloadURL per drag esterni può materializzare il blob dopo la fine del gesto. Revoca anticipata al dragend corrompe la copia. **Revoca nel dragstart successivo** (reset ref draggedBlobUrl precedente) e in `onBeforeUnmount` per smontaggio a metà drag.

5. **Clamp pinned/non-pinnata**: implementato in `computeDragTarget` (indicatore visivo) e protetto a valle da `EXCHANGE_TABS_BY_ID` in store (mutazione effettiva). Idem `INSERT_DETACHED_TAB` — entrambi coerenti, nessun doppio clamp.

6. **Fix selettore pre-esistente**: classe CSS reale per tab pinned è `.is-pinned`, NON `.v2-tab-pinned` (che non esiste nel template). Il filtro `:not(.v2-tab-pinned)` non ha mai effetto → corretto in `recomputePinnedTab` e `INSERT_DETACHED_TAB` per aderenza alla realtà.

### Bug risolti e lezioni

| Fase | Bug | Causa radice | Fix | Note |
|------|-----|--------------|-----|------|
| Task1 | dragstart non parte | app-region:drag ancestor sopprime (cause n.1) + dragula preventDefault mousedown (n.2) | task1b overlay + task2 rimozione dragula | Entrambe le cause simultanee |
| Task2 round 1 | drop non consegnato, reorder non funziona | electron#42252: dropEffect non round-trippa interni finestra | decidi su dragend + computeDragTarget(clientX) | Permanente per questo progetto |
| Task2 round 2 | indicatore stile/altezza | CSS hardcoded su intera ul | style inline con offsetTop/offsetHeight | Segue multi-riga correttamente |
| Task2 round 4 | drag testo in zona editor | editor Muya accetta drop generic | blockForeignTabDropOutsideTabbar (rifiuto passivo) | Vedi invariante n.2 |
| Task3 round 5 | taskbar morta, cross-finestra morto | blockForeignTabDropOutsideTabbar con preventDefault/dropEffect='none' (attivo) | cambio rifiuto a passivo (solo stopPropagation) | electron#42252 innescato da preventDefault |
| Task3 round 6 | ultima-tab non migra, finestra secondaria non chiude | guardia `tabs.length<=1` sempre vera per dragend | guardia `tabs.length<=1 && !screen`, ack chiude finestra vuota | Distingue context-menu (no screen) da drag (screen) |
| Task3 round 8 | taskbar spring-loading morto per TUTTI i drag MarkText (anche testo) | rami else `dragover` in app.vue (window-level) e Muya dragDropCtrl: `dropEffect='none'`+stopPropagation su ogni drag non gestito (famiglia electron#42252) | rami resi passivi (nessuna azione) | Harness Electron 39 minimale aveva scagionato Electron/frameless/formati → causa DENTRO MarkText; RISOLTO, testato PASS |
| Task3 round 9a | drop tab incollava path/URI su Chrome/Notepad | `text/uri-list` (spike 7c) genera anche CF_UNICODETEXT + shortcut .url nell'OLE | rimosso uri-list, ripristinato `DownloadURL` (solo CF_HDROP differito) | I formati sono irrilevanti per la taskbar (harness): si scelgono per il comportamento sui drop esterni |
| Task3 round 9b | finestra secondaria restava aperta chiudendo l'ultima tab con la X | auto-chiusura esisteva solo nel percorso detach-ack | nuovo canale `mt::window-emptied` da `FORCE_CLOSE_TAB`/`CLOSE_TABS` a 0 tab; main chiude solo se NON `_isSessionOwner` | Sostituisce anche il send diretto del round 6 (niente doppia esecuzione) |
| Task3 round 9d | copia su desktop apriva ANCHE la nuova finestra | detach decideva solo sui bounds, ignorando l'esito del drop esterno | gate `dropEffect==='copy'` al dragend: copia consumata → niente detach | 'copy' round-trippa solo per drop ESTERNI accettati; drag interni sempre 'none' (electron#42252) |

### Tentativi falsificati (NON ritentare)

- **dragula + koffi raise-finestre** (Strada B DRAG-TASK.md §3bis): scartato esplicitamente da utente 2026-07-02. Non riproporlo senza nuova richiesta esplicita.
- **JS window drag con IPC/setPosition** (mousedown+move → IPC → main): scartato 2026-07-02. Perde tracking del mouse a velocità normale, fa perdere Snap Layouts Win11, doppio-click-massimizza, Aero Snap (tutti nativi hit-test HTCAPTION). Solo fallback estremo.
- **Toggle app-region dinamico** (attiva/disattiva drag durante drag): scartato 2026-07-02. Chromium non ricalcola regioni affidabilmente (issue Electron #6970).
- **Formati del dataTransfer come cura per la taskbar** (spike 7/7b/7c task3: DownloadURL, text/uri-list, blob): falsificati empiricamente TUTTI. L'harness Electron 39 minimale ha dimostrato che QUALSIASI payload (perfino solo MIME custom) attiva lo spring-loading — il problema non erano i formati ma i nostri handler dragover globali (round 8, vedi invariante 2). Non ritentare mai la strada dei formati per problemi taskbar. I formati si scelgono SOLO per il comportamento sui drop esterni: `DownloadURL` = copia file, niente testo esposto; `text/uri-list` = incolla l'URI nei target testuali (per questo è stato rimosso, round 9a).

### Punti rimasti aperti

1. **BUG-FLICKER** (emerso durante i test round 8, 2026-07-03): tab che sfarfallano + drag finestra/tab morti, visto UNA volta dopo uno snap Windows a metà schermo durante un drag; mai riprodotto nonostante tentativi mirati. Trappola anti-loop attiva nel watch `hasMultiRow` di tabs.vue (console.error con dump stato se ≥6 flip in <3s): se ricompare, la causa resta scritta in console. Non rimuovere la trappola finché non è chiuso.

2. **H5-RE-BUG1** (ri-drag tab omonime): ipotizzato dissolto con rimozione dragula (match manuale screenX/id sparito). Non ri-osservato nei test. Riaprire se il sintomo ricompare.

3. **Indicatore d'inserimento cross-finestra** (unico pezzo di parità VS Code mancante): durante il drag sopra la tab bar di un'ALTRA finestra MarkText non compare la lineetta (la tab viene comunque inserita all'indice corretto al rilascio). Richiederebbe un canale IPC di notifica dragover cross-finestra. Rimandato: riaprire solo su richiesta utente.

4. **`npm install` richiesto**: dipendenze dragula/dom-autoscroller rimosse da package.json in task5. Al primo run post-chiusura: `npm install` per allineare node_modules, poi smoke-test rapido di reorder/detach/migrazione.

5. **Downside cosmetico accettato** (electron#42252): durante il drag sopra la propria tabbar il cursore OS mostra il divieto (stato operazione azzerato lato browser, non modificabile da JS). Rivalutare se Electron fixa il bug upstream.
