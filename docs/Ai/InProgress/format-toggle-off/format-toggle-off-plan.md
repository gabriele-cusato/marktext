# format-toggle-off — plan — 2026-07-12

Origine: TODO.md: negli strumenti di formattazione su testo selezionato (menu selezione /
formatPicker), se un format è GIÀ attivo sulla selezione, ripremerlo deve TOGLIERLO; oggi lo
riapplica/riaggiunge.

## Esiti indagine (Agent-Explorer 2026-07-12) — fatti verificati
- **Il toggle ESISTE già nel motore**: `ContentState.prototype.format`
  (`formatCtrl.js:252-349`) per selezione singolo-blocco fa già rimozione se il format è attivo
  (`currentFormats.length` → loop `clearFormat`, righe 281-287), usando `selectionFormats()`
  (157-196) e `clearFormat()` (52-88). Funzione UNICA condivisa da tutti i chiamanti.
- Chiamanti censiti: picker (`formatPicker/index.js:111`), bus `'format'` → `editor.vue:960`
  (`handleInlineFormat`), menu app + shortcut via `main/menu/actions/format.js:13-65` → IPC
  `mt::editor-format-action` → `listenForMain.js:87-89`. Percorso SEPARATO in source mode:
  `sourceCode.vue:587` (CodeMirror, logica propria) — fuori scope.
- **Selezione parziale**: già gestita "estendi/normalizza" (288-297: rimuove marker sovrapposti,
  riavvolge tutta la selezione). Nessuna duplicazione lì.
- **Sospetto principale per la duplicazione (INCERTO, da confermare a runtime)**: il picker fa una
  `contentState.render()` extra PRIMA di `format()` (`formatPicker/index.js:110`, assente negli
  altri percorsi) + nessun `preventDefault` su `mousedown` nel picker → doppio giro
  DOM→cache→DOM degli offset; se l'offset devia anche solo della lunghezza del marker,
  `currentFormats` (contenimento stretto) risulta vuoto → ramo "aggiungi" invece di "rimuovi".
- **Gap VERIFICATO distinto**: selezione MULTI-blocco (`formatCtrl.js:318-348`) non ha alcun
  toggle-off — `clearBlockFormat` + `addFormat` incondizionato (strip+riavvolgi, mai spegne).

## Prerequisiti bloccanti
- Conferma runtime del sospetto (PC principale): log temporanei su `start.offset`/`end.offset` in
  `formatCtrl.js:262` vs `token.range` del token attivo, cliccando dal picker un format già
  applicato. Stesso metodo log-first della Parte F di menu-shortcut-overhaul.
- DECISO (utente 2026-07-12) — comportamento multi-paragrafo "come Word":
  - Lo stato dell'interruttore riflette l'INTERA selezione: se anche solo una parte NON ha il
    format, l'interruttore appare spento.
  - Click con interruttore spento → normalizzare: rimuovere le sotto-sezioni già formattate con
    quel format e applicare UN format unico all'intera selezione.
  - Secondo click (ora interruttore acceso) → rimuovere il format da tutta la selezione.
  - Gli ALTRI stili presenti nella selezione (diversi dal format premuto) restano INVARIATI.
  - Nota implementativa: il caso singolo-blocco fa già così (ramo "estendi/normalizza" +
    ramo rimozione); va portato lo stesso comportamento sul ramo multi-blocco (318-348) e va
    corretto lo stato `.active` del picker per riflettere l'intera selezione.
- Regola CLAUDE.md §8 (Muya isolato, impatti su tutti i chiamanti).

## Obiettivo
Toggle coerente per i format inline da qualsiasi percorso WYSIWYG (picker, shortcut, menu app);
`clear`/link/image restano azioni non-toggle. Fix atteso: correzione del percorso picker
(offset/selezione), NON riscrittura della logica format (già corretta).

## File da toccare (attesi)
- `src/muya/lib/ui/formatPicker/index.js` (percorso picker); `formatCtrl.js` solo per l'eventuale
  toggle multi-blocco.

## Skill di codice
`coding-standard`.

## Test
PC principale: per ogni format — applica, ripremi → rimosso; selezione parziale; format annidati
(strong+em); undo dopo toggle; stesso esito via shortcut e via menu.
