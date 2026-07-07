# warning-fix — task9 — worklog

## Avanzamento
- [x] Mappa flussi export con possibili DNA cursore (Agent-Explorer, 2026-07-05)
- [x] Analisi statica del punto in cui il marker causa il warn — CAUSA TROVATA (confidenza alta)
- [ ] ~~Log temporaneo mirato~~ — probabilmente non necessario, vedi sotto
- [ ] Verifica corruzione: file salvato su disco contiene `ag-...`? (esito: ___ — VERIFICA UTENTE)
- [x] Causa confermata e documentata (staticamente; resta la conferma runtime del punto sopra)
- [ ] Piano di fix scritto (da approvare, fuori scope task)

## Esito indagine (Agent-Explorer, 2026-07-05)

### Causa (confidenza alta, analisi statica completa)
NON è una "rimozione fallita" del marker: è una finestra di mutazione by-design.
`ContentState.prototype.getMuyaIndexCursor` (`src/muya/lib/utils/importMarkdown.js:465-533`):
1. inserisce i DNA cursore direttamente nel `.text` dei blocchi live (righe 478-491); con cursore
   a **offset 0 su un heading** il marker finisce PRIMA di `###` → `ag-0-xxx### testo`;
2. esegue `new ExportMarkdown(blocks).generate()` (righe 494-498) MENTRE il testo è mutato;
3. `normalizeHeaderText` (`exportMarkdown.js:186`) esige che la stringa inizi con `#` → regex
   fallisce → `console.warn` (riga 189) = il warn osservato;
4. solo dopo ripristina il testo (righe 529-531). Nessun try/finally attorno all'export.

Call-path del gesto osservato: switch a source mode → `watch(sourceCode)` in
`editorWithTabs/editor.vue:415-445` → `getMuyaIndexCursor()` (riga 434). Lo stesso ciclo gira
anche a ogni `dispatchChange()` (`muya/lib/index.js:124-134`) → il warn può comparire anche
digitando, se il cursore sta a inizio heading.

### Corruzione su disco: probabilmente NO (da confermare runtime)
- L'export "sporco" del percorso incriminato è solo interno: serve a trovare line/ch del cursore
  (righe 499-528) e viene scartato; non finisce mai in `this.markdown` né al chiamante.
- Il markdown che va al salvataggio è calcolato PRIMA della mutazione (`dispatchChange`, riga 126)
  o DOPO il ripristino (`editor.vue:438`).
- **Riserva strutturale**: senza try/finally, un'eccezione dentro `ExportMarkdown` (es.
  `normalizeTable`, accessi array senza guardia) lascerebbe il marker PERMANENTEMENTE nel blocco
  → corruzione reale al salvataggio successivo. Non è il caso osservato (solo warn, no crash),
  ma è un rischio da chiudere nel fix.

### Verifica runtime richiesta all'utente (unica rimasta)
Con il warn attivo (cursore a inizio heading, switch a source mode), salvare il file e ispezionare
il contenuto su disco: NON deve contenere `ag-0-...`. Esito atteso: pulito.

### Bozza direzioni di fix (da approvare in un secondo momento, fuori scope)
1. try/finally attorno all'export in `getMuyaIndexCursor` (chiude il rischio corruzione).
2. Rendere `normalizeHeaderText` consapevole dei DNA (riconoscere/preservare il prefisso marker
   senza warn) oppure far tollerare all'export interno il testo mutato senza passare dal
   percorso di normalizzazione. Da progettare: il warn è un falso allarme per questo export
   interno, ma il fix non deve mascherare i casi in cui il testo heading è davvero malformato.

## Test
- 2026-07-06 (utente): warn normalizeHeaderText non riprodotto; file salvato ispezionato con
  Notepad++: NESSUN marcatore `ag-0-...` su disco. Conferma l'analisi statica (export sporco solo
  interno). Resta valido il fix futuro (try/finally + gestione marker) come hardening, priorita' bassa.

## Decisione 2026-07-06 (hardening RIMANDATO, opzionale)
task9 di fatto CHIUSO: solo warning, nessuna corruzione. L'hardening (2 parti: try/finally attorno
all'export interno in `getMuyaIndexCursor` per chiudere il rischio corruzione se l'export lanciasse;
+ rendere `normalizeHeaderText` DNA-aware per zittire il falso warning) è OPZIONALE, priorità bassa,
tocca Muya. Non farlo salvo richiesta esplicita. Le 2 checkbox aperte in Avanzamento (log temporaneo
barrato, piano fix fuori scope) non vanno eseguite.
