# editor-ui-fixes — task2 — worklog

## Avanzamento
- [x] Scrittura `file.muyaIndexCursor = liveCursor` nel watch(sourceCode) di editor.vue
- [x] Verifica ordine flush reattivo scrittura → mount sourceCode
- [x] Build di verifica

## Note verifica ordine flush
Il watch(sourceCode, ...) usa il flush di default ("pre"), eseguito dallo scheduler Vue
PRIMA dei job di render/patch dei componenti nello stesso tick. La scrittura
`file.muyaIndexCursor = liveCursor` è sincrona dentro il callback → avviene prima che Vue
monti sourceCode.vue (mount nuovo componente per il toggle del v-if). sourceCode.vue legge
`props.muyaIndexCursor` in onMounted (riga 1020), alimentato dal computed reattivo di
app.vue:145 (`currentFile.value?.muyaIndexCursor`), che a quel punto riflette già il nuovo
valore. Nessun problema di ordine riscontrato, nessuno stop necessario.

## DA TESTARE
Cursore a metà documento → switch a source → CM posizionato sulla riga corrispondente.
Verso source→Muya ancora funzionante (nessuna regressione, non toccato).
Undo unificato (pushUnified) non toccato nella logica, solo aggiunta la scrittura sullo store
subito dopo il calcolo esistente di liveCursor: verificare che l'undo unificato non regredisca.

## Esito build
`npm run build` bloccato da Criteri di gruppo Windows ("Il programma è bloccato dai Criteri
di gruppo. Per ulteriori informazioni, contattare l'amministratore del sistema."), come
previsto dal plan — non è un errore di codice, non forzato. Task marcato DA TESTARE.

## Test round 1 (2026-07-06): FALLITO — fix insufficiente
Utente: MD→source ancora non posiziona bene il cursore (source→Muya ok). Il primo fix era
insufficiente per due motivi (root cause trovata dall'orchestratore leggendo editor.vue + sourceCode.vue):

1. **Gate `dirtySince`**: la scrittura `file.muyaIndexCursor = liveCursor` era dentro il blocco
   `watch(sourceCode)` che richiede `dirtySince` (utente ha editato). Spostando SOLO il cursore in
   Muya (senza modifica) `dirtySince` resta false → il cursore Muya non veniva mai salvato sullo store.
2. **Priorità snapshot al mount**: in `sourceCode.vue` (~1207-1216) il cursore al mount aveva priorità
   `savedCursor` (snapshot CM della sessione source precedente) > `muyaIndexCursor`. Con snapshot
   allineato (nessun edit in Muya, `restoreCmStateForTab` ritorna `savedCursor`) il cursore Muya fresco
   veniva ignorato.

Nota che rende il fix sicuro: il mount di `sourceCode.vue` avviene SOLO all'ingresso in source mode
(i cambi tab in source passano da `handleFileChange` senza rimontare), quindi al mount `muyaIndexCursor`
è sempre la posizione fresca da cui l'utente arriva (Muya).

## Fix round 2 (2026-07-06)
- `editor.vue` `watch(sourceCode)`: `getMuyaIndexCursor()` + scrittura `file.muyaIndexCursor` spostati
  FUORI dal gate `dirtySince` (salvataggio cursore su OGNI switch dove Muya tiene il tab). Il gate
  `dirtySince` resta solo attorno a `pushUnified` (protezione stack invariata).
- `sourceCode.vue` mount: priorità cursore invertita → `muyaIndexCursor` → `savedCursor` → prima riga.

## DA TESTARE round 2
Cursore a metà documento in Muya (anche solo SPOSTATO, senza editare) → switch a source → CM sulla
riga corrispondente. Ripetere anche dopo un edit. Verso source→Muya ancora ok. Undo unificato non regredito.

## Test round 2 (2026-07-06): OK
Utente: MD→source ora posiziona correttamente il cursore. Fix round 2 confermato funzionante.
