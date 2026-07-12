# Worklog — Parte G — menu-shortcut-overhaul

Task-bug: Ctrl+K Ctrl+C (commenta) in modalità Source → al rientro in MD crash
`IndexSizeError` in `Selection.setCursorRange` (offset oltre la lunghezza del nodo) + cascata
errori Vue. Fonte autorevole: `menu-shortcut-overhaul-plan.md`, Parte G. Decisione utente
2026-07-12: resta batch di questa feature (non feature separata).

## Prerequisiti bloccanti
- Verifica runtime sul PC principale (riproduzione + conferma della direzione di fix).

## Avanzamento
- [x] Clamp difensivo offset in `Selection.setCursorRange`/`setCursor`
  (`muya/lib/selection/index.js` ~371/533/216) prima di `setStart`/`setEnd`
- [ ] Riproduzione post-clamp: niente crash, switch Source→MD funziona
- [ ] Traccia causa a monte (perché l'offset resta stale dopo commento in Source) — indagine
  separata, decidere se fixare qui o rimandare

### Dettaglio implementazione (clamp)

Aggiunto helper `clampOffset(node, offset)` a livello di modulo (dopo
`filterOnlyParentElements`, prima della classe `Selection`): per nodi di testo
(`nodeType === 3`) il massimo è `node.length`, per nodi elemento è
`node.childNodes.length`. Con offset già valido il risultato è identico
all'originale (nessun cambio di comportamento).

Punti clampati (tutti in `src/muya/lib/selection/index.js`):
- `select(startNode, startOffset, endNode, endOffset)` — `range.setStart` e
  `range.setEnd` ora usano `clampOffset`. Questo è il punto generico usato sia
  da `moveCursor` sia da `setCursorRange` (via `this.select(anchorNode,
  anchorOffset)`), quindi copre anche il caso della traccia del crash
  (`setCursorRange` → `setStart` con offset 35 oltre la lunghezza del nodo).
- `setFocus(focusNode, focusOffset)` — `selection.extend` ora usa
  `clampOffset` (stesso rischio IndexSizeError di `setStart`/`setEnd`, chiamato
  subito dopo `select()` dentro `setCursorRange`).
- `importSelectionMoveCursorPastAnchor` — `range.setStart(currentNode.parentNode,
  currentNodeIndex + 1)` clampato per coerenza (offset qui è già bounded
  internamente dal loop che cerca l'indice, ma il plan lo cita come punto a
  rischio ~riga 216).

Punti valutati e lasciati invariati perché l'offset è già validato/bounded
internamente prima della chiamata (nessun rischio aggiuntivo, evitato di
toccare codice non necessario):
- `importSelection`: `range.setStart(node, selectionState.start - charIndex)` e
  `range.setEnd(node, selectionState.end - charIndex)` — bounded dalla
  condizione `if` immediatamente sopra (`selectionState.start <=
  nextCharIndex` / `selectionState.end <= nextCharIndex`).
- `range.setEnd(node.parentNode, endIndex + 1)` — `endIndex` trovato scorrendo
  `childNodes` fino al match, sempre indice valido.
- `range.setStart(lastTextNode, lastTextNode.length)` /
  `range.setEnd(lastTextNode, lastTextNode.length)` — offset è già il massimo
  valido per definizione.
- `importSelectionMoveCursorPastBlocks`: `range.setStart(...,
  0)` — offset 0 sempre valido.
- `getCaretOffsets`: `preCaretRange.setEnd`/`postCaretRange.setStart` con
  `range.endOffset` — offset proveniente da un Range già valido esistente.

Nota: `setCursorRange` (righe ~550-554 circa) contiene già un clamp
preesistente (`Math.min(anchorOffset, anchorNode.textContent.length)`) che per
i nodi elemento usa `textContent.length` invece di `childNodes.length` — è
probabilmente proprio la causa per cui l'offset stale (35) superava comunque
`childNodes.length` e arrivava a `setStart` non protetto (IndexSizeError "no
child at offset 35"). Non l'ho toccato: è codice preesistente e la task
richiede solo il clamp difensivo aggiuntivo, non di correggere quella logica.
Con il nuovo clamp in `select()`/`setFocus()` il valore che esce da quel
calcolo preesistente viene comunque reso sicuro prima di `setStart`/`extend`.

### Indizi osservati su causa a monte (per indagine separata)

- `getNodeAndOffset` (dentro `setCursorRange`) ha un ramo di fallback
  (`return { node, offset }` a fine funzione) che restituisce il nodo
  contenitore con l'offset originale non ricalcolato quando nessun figlio
  soddisfa la condizione di lunghezza cumulata — è il caso plausibile in cui
  l'offset "35" arriva intatto fino al clamp preesistente basato su
  `textContent.length` (vedi nota sopra), che non lo riduce a sufficienza per
  un nodo elemento.
- Il clamp preesistente (righe ~550-554) usa `textContent.length` anche per i
  nodi elemento (`nodeType === 1`), ma per un elemento l'offset massimo valido
  per `Range.setStart` è `childNodes.length`, non `textContent.length` (che
  tipicamente è molto più grande). Questa discrepanza è coerente con l'errore
  osservato ("no child at offset 35").
- Non è stata investigata la causa per cui, dopo "commenta" in Source
  (Ctrl+K Ctrl+C) e rientro in MD, l'albero venga ricostruito con un numero di
  figli inferiore all'offset salvato nel `Cursor` — richiede riproduzione a
  runtime, fuori scope di questo task.

## Test
DA TESTARE — verifica statica (node --check) eseguita con esito positivo
sulla sintassi; nessuna build/runtime eseguita (compito dell'utente/altro
task). Riproduzione del bug e conferma dell'assenza di crash post-clamp da
fare a runtime.
