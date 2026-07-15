# format-toggle-off

## Scopo
Nei controlli formattazione su testo selezionato (menu selezione, formatPicker), se un format è già attivo sulla selezione, ripremerlo deve **togglare OFF** (rimuovere il format), non riapplicarlo.

## Modifiche

### File modificati
1. **src/muya/lib/contentState/formatCtrl.js**
   - Aggiunto helper top-level `blockRangeHasFormat(block, format)` per verificare se una porzione di selezione in un blocco è interamente coperta dal format
   - Nel ramo multi-blocco (`start.key !== end.key`, righe ~318+): calcolo `wholeSelectionHasFormat` percorrendo i blocchi; se true rimuove il format (nessun `addFormat`), altrimenti normalizza e applica
   - Log temporanei `[FMT-TOGGLE-DEBUG]` (rimossi da feature `debug-log-cleanup` 2026-07-16)

2. **src/muya/lib/ui/formatPicker/index.js**
   - Nessuna modifica di comportamento (verificato: lo stato `.active` del picker usa già `selectionFormats()` con containment corretto per singolo-blocco; multi-blocco non raggiunge il picker)

## Da tenere a mente

**Single-block toggle era già funzionante**: La logica toggle per selezione singolo-blocco esisteva già in `ContentState.prototype.format` (ramo 281-287). La modifica ha **esteso** il toggle al ramo multi-blocco (318-348), portandolo al comportamento "come Word": se anche solo una parte della selezione NON ha il format, click applica; secondo click su format attivo su TUTTA la selezione lo rimuove.

**Gli ALTRI stili restano invariati**: Il toggle non tocca i format diversi dal tipo selezionato — se una selezione ha strong+em e toggla off strong, em resta intatto.

**Percorsi che usano la funzione format**: Shortcut, menu app, formatPicker, e menu bus `'format'` usano tutti `ContentState.prototype.format` → il toggle funziona da ogni percorso WYSIWYG.

**Nessun toggle per clear/link/image**: Queste sono azioni non-toggle (clear rimuove tutto, link/image hanno dialogo di input). Rimangono invariate.

**Test esito**: Utente (2026-07-12/13, PC principale) OK — toggle multi-blocco stile Word funzionante. Il sospetto di un bug del picker su singolo-blocco non è stato riprodotto nel test finale, considerato chiuso. Feature chiusa.
