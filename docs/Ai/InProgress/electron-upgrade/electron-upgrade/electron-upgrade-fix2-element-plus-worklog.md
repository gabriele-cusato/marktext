# electron-upgrade — fix2 — worklog: Element Plus size="mini"

## Avanzamento
- [x] `exportSettings/index.vue`: 6 occorrenze `size="mini"` → `size="small"`
- [x] `editor.vue`: 2 occorrenze `size="mini"` → `size="small"`
- [x] Verifica statica: `grep size="mini"` sui due file → zero residui

## Stato: DA TESTARE
Sostituzioni effettuate: exportSettings/index.vue 6 occorrenze, editor.vue 2 occorrenze (totale 8).
Verifica statica: `size="mini"` assente in entrambi i file; `size="small"` presente 6+2 volte.
Nessuna build/avvio eseguiti (compito dell'utente, come da plan).

## Test
(Da compilare dall'orchestratore dopo il test utente.)
