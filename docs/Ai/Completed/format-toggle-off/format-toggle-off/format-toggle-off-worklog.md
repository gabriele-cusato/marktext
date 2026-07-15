# format-toggle-off — worklog

Plan: `format-toggle-off-plan.md`.

## Avanzamento
- [x] PARTE 1 — toggle multi-blocco "come Word" in `ContentState.prototype.format`
      (`src/muya/lib/contentState/formatCtrl.js`, ramo `start.key !== end.key`, righe ~318+):
      aggiunto helper `blockRangeHasFormat` (top-level, prima di `formatCtrl`) che verifica se
      la porzione di selezione in un blocco è interamente coperta dal format richiesto,
      riusando `selectionFormats`. Nel ramo multi-blocco si calcola `wholeSelectionHasFormat`
      percorrendo gli stessi blocchi del ciclo `clearBlockFormat` esistente; se true il format
      viene solo rimosso (nessun `addFormat`), se false comportamento invariato
      (normalizza + riavvolgi). `clearBlockFormat` (già esistente) è riusato identico in
      entrambi i casi: rimuove sempre le sotto-istanze del format richiesto, quindi gli altri
      stili presenti restano intatti.
- [x] PARTE 2 — stato `.active` del formatPicker: VERIFICATO (non modificato). Grep dei due
      punti che dispatchano `muya-format-picker` con `formats`
      (`src/muya/lib/eventHandler/keyboard.js:325`, `src/muya/lib/contentState/clickCtrl.js:175`)
      mostra che il picker si apre SOLO per selezione a singolo blocco
      (`start.key === end.key` / `anchor.key === focus.key`); per multi-blocco la selezione
      lascia il picker nascosto (`reference: null`) o inalterato. Lo stato `.active`
      (`formatPicker/index.js:75`, invariato) usa già `formats` da `selectionFormats()` con
      containment sull'intera selezione (start/end) del blocco corrente — semantica già
      coerente con "intera selezione ha il format", quindi nessuna modifica necessaria dato che
      il caso multi-blocco non raggiunge mai il picker nei percorsi attuali.
- [x] PARTE 3 — log runtime da testare sul PC principale (SOLO log aggiunti, nessun cambio di
      comportamento). Aggiornati per essere stringhe piatte (non oggetti): i log a oggetto
      comparivano come "Object" collassato in console, dati inutilizzabili nel primo giro di test.
      - `src/muya/lib/contentState/formatCtrl.js` ~riga 294 (dopo calcolo `currentFormats` nel
        ramo singolo-blocco): `console.log(\`[FMT-TOGGLE-DEBUG] formatCtrl.format single-block type=${type} startOffset=${start.offset} endOffset=${end.offset} currentFormatsLength=${currentFormats.length} currentFormatsTypes=${currentFormats.map(...).join(',')} activeFormatRange=${activeFormatRange}\`)`
        — `activeFormatRange` è `${currentFormats[0].range.start}-${currentFormats[0].range.end}`
        se `currentFormats.length`, altrimenti `'none'` (token range del format attivo, se
        presente).
      - `src/muya/lib/ui/formatPicker/index.js` in `selectItem()` (riga 114), subito prima di
        `contentState.format(item.type)`: `console.log(\`[FMT-TOGGLE-DEBUG] formatPicker.selectItem requestedType=${item.type}\`)`.
      Elenco esatto per rimozione futura: le 2 righe `console.log(\`[FMT-TOGGLE-DEBUG]...\`)` sopra
      (+ i rispettivi commenti `// eslint-disable-next-line no-console`, non necessari perché
      `no-console` è già `off` in `eslint.config.mjs` ma innocui).
- [ ] Test runtime su PC principale (vedi sezione Test del plan): applica/toglie per ogni
      format, selezione parziale, format annidati, undo, stesso esito shortcut/menu/picker.
- [ ] Diagnosi picker: confermare o escludere il sospetto della Parte 3 dai log raccolti.

## Stato: DA TESTARE (parti 1-2 implementate e build verificata; log della parte 3 resi piatti e
leggibili in console; test runtime e diagnosi picker mancanti, richiedono PC principale — secondo
giro di test utente)

## Test
Esito utente (2026-07-12/13, PC principale): OK — toggle-off multi-blocco stile Word
funzionante. Il bug del picker su selezione singolo-blocco NON è stato riprodotto nel
secondo giro di test → considerato chiuso senza ulteriori modifiche.
Restano da rimuovere i log `[FMT-TOGGLE-DEBUG]` (formatCtrl.js, formatPicker/index.js —
elenco punti sopra in questo worklog).
