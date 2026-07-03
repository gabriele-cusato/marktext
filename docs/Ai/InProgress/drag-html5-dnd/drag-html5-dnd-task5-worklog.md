# drag-html5-dnd-task5 — worklog

## Esecuzione (orchestratore, 2026-07-03, chiusura feature)

Eseguito direttamente dall'orchestratore a valle del PASS completo dei test utente su
task2/task3 (reorder, detach, migrazione, taskbar, drop esterni — round 9).

## Avanzamento

- [x] Grep finale conferma zero riferimenti vivi a dragula/dom-autoscroller/.gu-* in
      `src/`: unico codice vivo residuo era il selettore `:not(.gu-mirror)` in
      `INSERT_DETACHED_TAB` (`store/editor.js:1042`), rimosso col fix task4 (stesso
      giro). Restano SOLO commenti storici/esplicativi che citano dragula per spiegare
      cosa è stato rimosso e perché (voluti, non codice).
- [x] Residui in `tabs.vue`: nessuno da rimuovere (import/init/handler/CSS `.gu-*` già
      rimossi in task2, verificato con grep).
- [x] Rimosse le dipendenze `dragula@^3.7.3` e `dom-autoscroller@^2.3.4` da
      `package.json`. NB: serve un `npm install` per riallineare `node_modules`/lockfile
      (segnalato all'utente).
- [x] Verifica statica: `package.json` parse JSON OK; parse SFC `tabs.vue` OK;
      `node --check store/editor.js` OK. Build completa non eseguita in questo giro
      (nessun import residuo da risolvere: la rimozione non può rompere il bundle).

## Test

- Reorder interno, detach nuova finestra, migrazione su finestra esistente: PASS utente
  2026-07-03 (round 9 task3) — eseguiti PRIMA della rimozione delle dipendenze, che
  erano già senza riferimenti nel codice: nessun percorso runtime le caricava più.
  Al prossimo `npm install` + `npm run dev`, un rapido smoke-test dei tre scenari chiude
  definitivamente.
