# residui-hard-task — BUILD-1 — worklog

Plan: `residui-hard-task-build1-plan.md`.

## Avanzamento
- [x] Censimento patch manuali esistenti (2026-07-12, orchestratore): nessuna cartella `patches/`
  nel repo, nessun `postinstall` né `patch-package` in `package.json` → **zero patch manuali oggi**.
  Utilità del setup da riconfermare con l'utente (vedi domanda aperta)
- [x] Decisione utente 2026-07-12: **NON implementare** — non è il modo corretto di impostare le
  cose senza patch reali da proteggere. Strada annotata per il futuro in
  `docs/Ai/Notes/patch-package-strada-futura.md`. TODO.md aggiornato (BUILD-1 chiuso).
- [x] `npm install` di pulizia: eseguito dall'utente 2026-07-12 sul PC principale (senza errori;
  ha risolto anche `path-browserify` mancante, vedi fix alias in `electron.vite.config.mjs`).

## Test
Non richiesto (nessuna modifica al codice). TASK CHIUSO.
