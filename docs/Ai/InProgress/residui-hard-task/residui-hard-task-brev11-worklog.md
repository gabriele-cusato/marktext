# residui-hard-task — B-REV11 — worklog

Plan: `residui-hard-task-brev11-plan.md`.

## Avanzamento
- [x] Ri-censimento duplicati sui keybindings ATTUALI (2026-07-12, orchestratore): estrazione
  `['id', 'accel']` dai 3 file (99 binding ciascuno; 72 con accelerator su win/linux, 84 su darwin)
  → **ZERO accelerator assegnati a più comandi su tutte le piattaforme**. I duplicati storici sono
  stati dissolti dalle riassegnazioni di menu-shortcut-overhaul (Batch 1/1b).
- [x] Test runtime: non necessario (nessun duplicato residuo)
- [x] Azzeramenti: non necessari
- [ ] Chiudere il task: aggiornare TODO.md (B-REV11 → dissolto) — attesa conferma utente
  (residuo teorico non coperto dal censimento: eventuali conflitti tra keybindings e accelerator
  hardcoded nei menu template / shortcut di sistema Electron; fuori scope B-REV11 originale)

## Test
Non richiesto (nessuna modifica al codice).

## Test
(compilare dopo il test)
