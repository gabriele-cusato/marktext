# image-drag-in-doc — plan — 2026-07-08

Feature fuori scope emersa nel test di `renderer-no-node-integration` (task5, immagini).

## Problema / richiesta
Trascinando (drag) un'immagine **già presente nel documento** verso un'altra posizione, l'editor la
**seleziona** invece di **spostarla** seguendo il cursore.

## Stato attuale (verificato)
Il drag interno delle immagini è **volutamente disabilitato** in muya — NON è una regressione né un
effetto del refactor renderer:
- `src/muya/lib/eventHandler/dragDrop.js:13-17` — `dragStartHandler`: se `event.target.tagName === 'IMG'`
  → `event.preventDefault()` (annulla il drag → il browser fa la selezione di default).
- `src/muya/lib/ui/transformer/index.js:61` — sull'overlay dell'immagine: `dragstart` →
  `event.preventDefault()`.
- `src/muya/lib/contentState/dragDropCtrl.js` `dropHandler`: gestisce **solo** drop di file immagine
  **esterni** (dal filesystem/OS) e link web `text/uri-list`. **Nessun** ramo per riposizionare un
  blocco immagine già esistente nel documento.

Quindi: lo spostamento drag-interno **non è mai esistito**. Implementarlo è una **nuova feature muya**.

## Complessità / rischi
Muya è engine isolato e delicato (vedi CLAUDE.md §8). Implementare il move richiede:
1. Consentire il `dragstart` sulle immagini (rimuovere/condizionare i due `preventDefault`) **senza**
   riabilitare drag indesiderati e senza rompere il resize handle del transformer.
2. In `dragstart` marcare il blocco immagine sorgente (id) nel `dataTransfer` (tipo custom interno).
3. In `dragover` mostrare il ghost del punto di inserimento (già esiste `createGhost`/`dropAnchor`).
4. In `dropHandler` aggiungere un ramo: se il drag è interno (tipo custom presente) → **rimuovere** il
   blocco immagine sorgente e **reinserirlo** al `dropAnchor` (up/before o down/after), poi `render()` +
   `stateChange`. Attenzione a cursore e a non duplicare l'immagine.
5. Interazione con Windows OLE drag: c'è già storia di bug (commenti in `dragDropCtrl.js` round 8,
   electron#42252, spring-loading taskbar). Un drag custom interno va testato che NON reintroduca quei
   problemi.

## Rischi principali da valutare PRIMA di implementare
- Conflitto col resize handle del transformer (entrambi usano dragstart sull'immagine).
- Selezione vs drag: distinguere click-per-selezionare da drag-per-spostare (soglia di movimento).
- Regressione sul drop di immagini esterne (il ramo esistente non deve rompersi).
- Comportamento OLE su Windows (famiglia electron#42252) — testare taskbar/spring-loading.

## Decisione aperta
Feature non banale su un engine delicato. **Da confermare con l'utente** se vale la pena implementarla o
se resta come miglioramento futuro. Se si procede: fare prima un'indagine mirata su transformer +
selezione immagine, poi un plan implementativo dettagliato.

## Stato
- Solo annotazione + analisi. Nessun codice. In attesa di decisione utente se prioritizzare.
