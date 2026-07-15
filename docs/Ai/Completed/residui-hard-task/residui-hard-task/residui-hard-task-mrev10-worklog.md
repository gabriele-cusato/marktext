# residui-hard-task — M-REV10 — worklog

Plan: `residui-hard-task-mrev10-plan.md`.

## Avanzamento
- [x] Esplorazione (Agent-Explorer 2026-07-12): grep esaustivo di
  `resyncDomToStore|resync|domOrder|childNodes` in `tabs.vue` (letto per intero) e in tutta `src/`
  → **zero occorrenze**. Il reorder attuale usa solo `computeDragTarget` +
  `EXCHANGE_TABS_BY_ID` (`tabs.vue:493-545,607-612,646-647`; store `editor.js:1265`).
- [x] Verdetto: la funzione è stata **GIÀ RIMOSSA** dalla migrazione drag-html5-dnd
  (documentato in `Completed/drag-html5-dnd/drag-html5-dnd.md:18` e task2-worklog:24,90).
  `HARD-TASK.md:249,1808-1812` cita righe pre-migrazione: riferimento obsoleto.
- [x] Rimozione: NON necessaria (nulla da rimuovere).
- [ ] Chiudere: aggiornare TODO.md (M-REV10 → risolto/obsoleto) — attesa conferma utente.

## Test
Non richiesto (nessuna modifica al codice).
