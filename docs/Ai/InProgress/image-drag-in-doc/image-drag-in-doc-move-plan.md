# image-drag-in-doc — task "move" — plan implementativo — 2026-07-17

## Obiettivo del task

Trascinare un'immagine GIÀ presente nel documento in un'altra posizione del documento per spostarla.
Oggi il drag è disabilitato di proposito (`preventDefault` sul `dragstart`) e il browser ripiega
sulla selezione. Implementare il move come nuova feature Muya, senza rompere: drop di immagini
esterne, resize del transformer, selezione al click, spring-loading taskbar (electron#42252).

## Vincoli di scope (decisione utente 2026-07-18)

- Il move funziona SOLO dentro la stessa tab/documento: nessun trasferimento tra tab, tra
  finestre, o verso l'esterno. Garantito da: gate su stato locale del contentState (ogni
  istanza Muya ha il suo; un'altra finestra ha `internalImageDrag` null → rifiuto passivo)
  + guardia coordinate al dragend (sotto).
- Solo modalità Muya: vale by-design (tutti gli handler vivono nell'engine Muya; la source
  mode è CodeMirror e non li ha). Nessun codice extra richiesto, solo non uscire da `src/muya/`.
- Solo l'area di testo editabile (il container Muya, la zona dove funziona lo zoom): il ghost
  e il `dropAnchor` nascono solo da `dragover` sul container; rilascio su tabbar/sidebar/status
  bar NON deve muovere nulla. Doppia protezione: (a) `dragleave` già azzera il `dropAnchor`
  uscendo dall'editor; (b) guardia esplicita nel `dragend` fallback: eseguire il move SOLO se
  `event.clientX/clientY` cadono dentro i bounds del container Muya
  (`container.getBoundingClientRect()`), oltre a richiedere `dropAnchor` valorizzato.
- Fatto verificato (Completed/drag-html5-dnd): `blockForeignTabDropOutsideTabbar` in tabs.vue
  (capture globale) fa stopPropagation SOLO per il MIME `text/mt-tab-id` → non tocca il drag
  immagine. Simmetricamente gli handler della tabbar sono gated sullo stato del drag tab →
  un drag immagine sopra la tabbar non fa nulla. Non modificare tabs.vue.

## Skill di codice da caricare

`coding-standard` (JS puro, engine Muya: no Electron/Node, solo DOM/BOM).

## Prerequisiti bloccanti

Verificare esistenza e leggibilità PRIMA di toccare codice; se uno manca o è ambiguo, fermarsi
senza modificare nulla e segnalare:

- Questo plan: `docs/Ai/InProgress/image-drag-in-doc/image-drag-in-doc-move-plan.md`.
- Worklog del task: `docs/Ai/InProgress/image-drag-in-doc/image-drag-in-doc-move-worklog.md`
  (aggiornare SOLO questo worklog).
- Analisi rischi feature: `docs/Ai/InProgress/image-drag-in-doc/image-drag-in-doc-plan.md`.
- File sorgente da modificare (elenco completo in "File da toccare").
- Pattern di riferimento (SOLA LETTURA, non modificare):
  `src/renderer/src/components/editorWithTabs/tabs.vue` (righe ~505-825: MIME custom
  `text/mt-tab-id`, stato locale del drag, flag anti-doppia-esecuzione, decisione su `dragend`).
- File/cartelle vietati: nessuno dichiarato per questo task; NON toccare file fuori dall'elenco
  "File da toccare".
- Target di verifica: `npm run build` (electron-vite build, PC principale, npm funzionante) +
  `npm run test:unit` (vitest, baseline 42 verdi).
- Version control: VIETATO commit/amend/push/pull/rebase/merge. Consentite solo verifiche
  read-only (`git status`, `git diff`) — DECISIONS 2026-07-01. L'utente ha già fatto il commit
  preventivo prima di questo task.

## File da toccare (SOLO questi)

1. `src/muya/lib/eventHandler/dragDrop.js` — dragstart condizionato + nuovo listener dragend.
2. `src/muya/lib/contentState/dragDropCtrl.js` — ramo interno in dragover/drop + funzione di move.

Nessun altro file. In particolare NON toccare: `src/muya/lib/ui/transformer/index.js`,
`clickEvent.js`, `imageCtrl.js` (le sue funzioni si USANO, non si modificano), `tabs.vue`,
`app.vue`.

## Fatti già verificati (Agent-Explorer 2026-07-17 — non ri-esplorare)

- Un'immagine NON è un blocco: è un token inline (`![alt](src)` o `<img>`) dentro il `text` di un
  blocco `span` (`paragraphContent`), figlio di un blocco `p`.
- `getImageInfo(imgNode)` (`src/muya/lib/utils/getImageInfo.js:5-20`) dal nodo IMG risale al
  wrapper `.ag-inline-image` e ritorna `{ key, token, imageId }`; `token.raw` è il markdown
  dell'immagine, `token.range = {start, end}` gli offset nel `block.text`.
- Rendering: wrapper `span#<key>_<id>_<rangeStart>.ag-inline-image` con `data-raw`, dentro
  `span.ag-image-container` che contiene l'`<img>` (nessun `draggable` esplicito → default true).
- `dragStartHandler` attuale (`src/muya/lib/eventHandler/dragDrop.js:13-17`): se
  `event.target.tagName === 'IMG'` → `event.preventDefault()`. Il file binda su `container`:
  `dragstart`, `dragover` (delega `contentState.dragoverHandler`), `drop` (delega
  `contentState.dropHandler`); su `window`: `dragleave`. NESSUN listener `dragend` oggi.
- Transformer (`src/muya/lib/ui/transformer/index.js`): `mouseDown` filtra subito con
  `if (!target.closest('.circle')) return` → intercetta SOLO le maniglie, mai l'IMG. Il
  `preventDefault` su dragstart (riga 61) è sul container del transformer (i cerchi), non
  sull'IMG. Nessun conflitto col drag dell'immagine: percorsi mutuamente esclusivi.
- Selezione: avviene sull'evento `click` (`clickEvent.js:156-188`, `selectImage` + toolbar +
  transformer). Consentire il dragstart NON rompe il click "secco".
- `dragDropCtrl.js`: `createGhost(event)` (righe 23-63) calcola e setta
  `this.dropAnchor = { position: 'up'|'down', anchor }` e disegna la linea ghost;
  `hideGhost()` (15-19) rimuove ghost e azzera `dropAnchor`. `getAnchor(block)`
  (`contentState/index.js:821-832`) ritorna sempre un blocco livello paragrafo/figure.
- `dragoverHandler` (65-102): ramo `text/uri-list`, ramo `Files` (1 sola immagine →
  `preventDefault` + ghost + `dropEffect='copy'`), else finale VUOTO DI PROPOSITO
  (righe 93-101: rifiuto passivo, regola permanente electron#42252 — NON toccarlo per i gesti
  che restano non gestiti).
- `dropHandler` (108-198, async, `preventDefault()` in testa): ramo uri-list e ramo file esterni;
  entrambi: `createBlockP(markdown)` → `insertBefore`/`insertAfter` rispetto a
  `dropAnchor.anchor` secondo `dropAnchor.position` → cursore sul nuovo blocco → `render()` →
  `dispatch('stateChange')`. Il ramo file chiama anche `imageAction` (upload/copia): il move
  interno NON deve mai chiamarlo (l'immagine esiste già).
- API contentState (`contentState/index.js`): `getBlock(key)` (381-398), `createBlockP`
  (356-361), `insertBefore`/`insertAfter` (605-...), `removeBlock(block)` (565-590),
  `render()`/`partialRender`/`singleRender`. History/undo: gestita dal setter di `this.cursor`
  (146-185) — basta replicare il pattern del dropHandler esistente (set cursor → render →
  `dispatch('stateChange')`), nessuna chiamata history esplicita.
- Mutazione testo esistente da imitare per la rimozione del token:
  `deleteImage` (`imageCtrl.js:173-189`): `block.text = oldText.substring(0, start) +
  oldText.substring(end)` usando `token.range` (NON modificare `deleteImage`, imitarne la
  tecnica).
- Vincolo piattaforma (DECISIONS 2026-07-03, electron#42252): l'evento `drop` stessa-finestra è
  INAFFIDABILE su Windows per drag HTML5 interni. Decisione reale su `dragend`; `drop` tenuto
  come percorso preferenziale con flag anti-doppia-esecuzione. Mai `preventDefault`/`dropEffect`/
  `stopPropagation` in `dragover` per gesti che NON si accetta (rifiuto passivo). Mai basarsi su
  `dropEffect` al dragend per i drag interni (è sempre 'none').
- Durante `dragover` il `dataTransfer` NON è leggibile (solo in `drop`): serve stato locale del
  drag (pattern `draggedTabId` di tabs.vue), qui in `contentState` (es.
  `this.internalImageDrag`).

## Spike preventivo a runtime (task0 — PRIMA dell'implementazione vera)

Precedente di progetto: gli spike task1/task1b del drag tab hanno scoperto a runtime cause
(soppressione dragstart) invisibili all'analisi statica. Stesso approccio qui: strumentazione
temporanea, NESSUNA logica di move, l'utente testa e riporta, poi si implementa sui fatti.

Contenuto dello spike (codice temporaneo, marcato `// SPIKE-IMG-DRAG`, da rimuovere/sostituire
nel task move):
1. In `dragStartHandler`: per IMG dentro `.ag-inline-image` → NON preventDefault, settare
   `text/mt-image-move` + `effectAllowed='move'` + log (`key`, `token.range`).
2. Log temporanei in `dragoverHandler` (ramo interno provvisorio: preventDefault + ghost +
   `dropEffect='move'`), `dropHandler` (log "drop consegnato" senza azione), `dragleaveHandler`
   (log), nuovo `dragend` (log clientX/clientY + `dropAnchor` corrente + dropEffect). Nessuna
   mutazione del documento.

Cosa deve rispondere il test utente (checklist nel worklog):
- Il `dragstart` parte davvero sull'IMG? (rischio storico n.1)
- Il `dragover` interno mostra il ghost nelle posizioni giuste? Che cursore mostra l'OS?
- Il `drop` viene consegnato oppure no (electron#42252 atteso: NO) → conferma necessità fallback?
- Al `dragend` arrivano coordinate affidabili e il `dropAnchor` è ancora valorizzato?
- Uscendo dall'editor (sidebar/tabbar) il ghost sparisce e `dropAnchor` si azzera?
- Regressioni durante lo spike: drop immagine esterna da Explorer ancora OK? Taskbar
  spring-loading ancora OK (drag testo + drag tab)? Click-selezione e resize immagine OK?

Gate: il task move parte SOLO dopo l'esito dello spike; se un fatto contraddice il plan
(es. drop consegnato, dragstart soppresso da altro), aggiornare prima il plan.

## Esito spike task0 (runtime, 2026-07-18) — fatti che AGGIORNANO le attese

- Il `dragstart` parte sull'IMG dentro `.ag-inline-image`; ghost e `dropAnchor` corretti.
- **Il `drop` interno VIENE consegnato** su questa macchina (Electron 43, target editor Muya):
  `dropEffect:'move'` round-trippa fino al dragend. Diversamente dal drag delle tab,
  electron#42252 qui non si manifesta. Conseguenza: il ramo `drop` è il percorso primario
  REALE; il fallback su `dragend` resta comunque (regola di progetto, costo nullo) e il flag
  anti-doppia-esecuzione è già stato verificato funzionante nello spike.
- `dragleave` azzera ghost/anchor sia tra paragrafi (churn continuo, normale: il ghost viene
  ricreato dal dragover successivo) sia uscendo dall'editor; al dragend dopo un drop gestito
  `dropAnchor` risulta null (hideGhost già eseguito dal drop) — il fallback deve quindi
  restare condizionato a `!internalImageDragHandled` E `dropAnchor` valorizzato.
- Rilascio su tab bar: nessun effetto (gate MIME reciproci confermati). Taskbar spring e drop
  esterni: nessuna regressione.
- **Difetto scoperto**: trascinando l'immagine su un'app esterna (es. Visual Studio) viene
  incollato testo derivato dal payload NATIVO che Chromium aggiunge al drag di un'IMG
  (URL/testo immagine). Fix richiesto nel task move: `event.dataTransfer.clearData()` nel
  dragstart PRIMA del `setData` custom → verso l'esterno non viaggia nulla di utilizzabile
  (coerente col vincolo "solo stessa tab").

## Sottoproblemi nell'ordine di implementazione

### 1. dragstart condizionato (`eventHandler/dragDrop.js`)

- Se `event.target.tagName === 'IMG'` E l'IMG sta dentro un wrapper `.ag-inline-image` del
  documento: NON fare `preventDefault`. Ricavare `imageInfo` con `getImageInfo` (import da
  `utils/getImageInfo`, passare il WRAPPER `.ag-inline-image`, non l'IMG: legge `data-raw`
  dal wrapper), poi:
  - `event.dataTransfer.clearData()` PRIMA di ogni setData: rimuove il payload nativo che
    Chromium aggiunge al drag di un'IMG (esito spike: incollava testo nelle app esterne);
  - `event.dataTransfer.setData('text/mt-image-move', imageInfo.key)` (solo stringa id, pattern
    tabs.vue);
  - `event.dataTransfer.effectAllowed = 'move'`;
  - salvare lo stato locale completo in contentState: `contentState.internalImageDrag =
    { key, token, imageId }` + azzerare il flag `internalImageDragHandled = false`.
- Se l'IMG NON è dentro `.ag-inline-image` (icone UI o altro): mantenere il `preventDefault`
  attuale.
- Il payload nel `dataTransfer` serve solo come marcatore/percorso preferenziale; la verità è lo
  stato locale (dataTransfer illeggibile in dragover).

### 2. Ramo interno in `dragoverHandler` (`dragDropCtrl.js`)

- PRIMO controllo, prima dei rami esistenti: se `this.internalImageDrag` è valorizzato →
  `event.preventDefault()` + `this.createGhost(event)` + `event.dataTransfer.dropEffect =
  'move'` + return. (Qui il preventDefault è LEGITTIMO: gesto che si intende accettare.)
- NON modificare i rami `text/uri-list`, `Files` e l'else passivo finale.

### 3. Ramo interno in `dropHandler` (`dragDropCtrl.js`)

- PRIMO controllo dopo il `preventDefault()` iniziale: se `this.internalImageDrag` è valorizzato
  e `this.dropAnchor` esiste → chiamare la funzione di move (sottoproblema 5), poi settare
  `this.internalImageDragHandled = true` e return (non proseguire nei rami esterni).
- Esito spike: su questo target il drop ARRIVA (percorso primario reale, non solo
  preferenziale); il fallback dragend copre i casi in cui non arrivasse, senza doppia
  esecuzione grazie al flag (già verificato nello spike).

### 4. Listener `dragend` nuovo (`eventHandler/dragDrop.js`)

- Bindare `dragend` sul `container` (stesso pattern degli altri listener del file).
- Logica: se `contentState.internalImageDrag` è valorizzato E `internalImageDragHandled` è
  false E `contentState.dropAnchor` è valorizzato E `event.clientX/clientY` cadono dentro i
  bounds del container Muya (guardia scope: rilascio fuori dall'area editabile = nessun move)
  → eseguire la stessa funzione di move (fallback electron#42252, decisione sul dragend).
- SEMPRE (in coda, qualunque esito): `contentState.hideGhost()` + azzerare
  `internalImageDrag` e `internalImageDragHandled`.
- NON usare `event.dropEffect` per decidere (sempre 'none' per i drag interni su Windows).
- Nota: `dragleaveHandler` su window già chiama `hideGhost()` (azzera `dropAnchor`): se il
  rilascio avviene fuori dall'editor il fallback trova `dropAnchor` nullo e non fa nulla —
  comportamento corretto (nessun move).

### 5. Funzione di move (`dragDropCtrl.js`, es. `moveImageToDropAnchor`)

Input: `this.internalImageDrag` (`{ key, token }`) + `this.dropAnchor` (`{ position, anchor }`).
Passi:
- `sourceBlock = this.getBlock(key)`; se non esiste più → abort silenzioso (cleanup a carico
  del chiamante).
- No-op se il rilascio è su se stesso: se `dropAnchor.anchor` è il parent diretto di
  `sourceBlock` (l'anchor È il paragrafo che contiene l'immagine) → return senza modifiche.
- Rimozione token dal sorgente (tecnica di `deleteImage`): `sourceBlock.text =
  text.substring(0, token.range.start) + text.substring(token.range.end)`.
- Se dopo la rimozione `sourceBlock.text` è vuoto e il paragrafo `p` parent resta senza
  contenuto → `removeBlock` del paragrafo vuoto (non lasciare `p` orfani).
  ATTENZIONE ordine: valutare la rimozione del `p` sorgente PRIMA dell'inserimento se
  l'anchor non è adiacente, ma se `dropAnchor.anchor` è un sibling del `p` sorgente la lista
  linkata va risistemata coerentemente (rimuovere prima, poi inserire, riusando i riferimenti
  ancora validi dell'anchor — l'anchor non è mai il blocco rimosso, escluso dal no-op sopra).
- `imageBlock = this.createBlockP(token.raw)` e inserimento: `position === 'up'` →
  `this.insertBefore(imageBlock, anchor)`, altrimenti `this.insertAfter(imageBlock, anchor)`
  (stesso pattern del ramo uri-list esistente).
- Cursore sul nuovo blocco (stesso pattern dei rami esistenti: key del figlio span, offset a
  fine testo), poi `this.render()` e `this.muya.eventCenter.dispatch('stateChange')` (o il
  dispatch equivalente già usato nel file — replicare l'esistente).
- NON chiamare `imageAction` (nessun upload/copia: l'immagine esiste già).

### 6. Verifica finale (build-loop)

- Grep di controllo non-regressione: i rami uri-list/Files/else passivo di `dragoverHandler` e
  `dropHandler` devono risultare invariati al diff.
- `npm run build` deve passare.
- `npm run test:unit` deve restare a baseline (42 verdi).
- Aggiornare il worklog del task (checkbox + tag DA TESTARE).

## Regole rilevanti (ripetute per contesto pulito)

- Muya è engine isolato: solo JS puro + DOM/BOM, niente Electron/Node/import Vue.
- CLAUDE.md checklist §8 (Muya) e §1-2: prima di aggiungere qualcosa, grep che non esista già;
  prima di cambiare firma, grep tutti i call-site.
- Commenti in italiano, forma all'infinito, densità come il codice circostante.
- Non introdurre log di debug permanenti.
- Test runtime (drag reale, taskbar, drop esterni, resize, undo) a carico dell'UTENTE dopo il
  task: elencare nel worklog cosa va testato, non tentare test runtime autonomi.
