# folder-search — worklog

Plan: `folder-search-plan.md`.

## Avanzamento
- [x] Esplorazione (Agent-Explorer 2026-07-12): residuo full-text GIÀ eliminato dal refactor
  no-node; censiti componenti riusabili (pattern detach-window, pattern ripgrep `mt::search-files`,
  UI sidebar), buchi da colmare e trappola naming `edit.find-in-folder` — esiti nel plan
- [ ] Decisioni utente (filtri, limiti, ricorsione, case/regex)
- [ ] Plan implementativo per task + approvazione
- [ ] (implementazione: checklist da dettagliare nei plan dei task)

## Test
Esito utente (2026-07-12/13, PC principale): OK di base sull'intera feature (task1-4:
handler rg + unit test, finestra risultati, sidebar, overlay con icona). Fix post-test
inclusi e verificati: bottone "…" per il dialog di selezione cartella, esempi concreti
nel placeholder esclusioni. Percorsi con spazi sicuri (spawn con array di argomenti).
Feature chiusa.
