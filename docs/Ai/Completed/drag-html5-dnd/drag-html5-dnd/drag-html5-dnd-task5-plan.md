# drag-html5-dnd-task5 — Cleanup dipendenze dragula/dom-autoscroller

## Obiettivo

A migrazione completata e verificata (task2, task3, task4 tutti testati con successo), rimuovere ogni residuo del vecchio sistema dragula: dipendenze npm, import, CSS globali non scoped, eventuale codice morto rimasto.

Questo task va eseguito PER ULTIMO, solo quando reorder interno, detach nuova finestra e drop su finestra esistente sono tutti confermati funzionanti — rimuovere prima le dipendenze romperebbe funzionalità non ancora migrate.

## Prerequisiti bloccanti

- Worklog Task2, Task3, Task4 richiesti e leggibili, tutti con test manuale superato: `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task2-worklog.md`, `...task3-worklog.md`, `...task4-worklog.md`. Se anche uno solo dei tre non è confermato funzionante, fermarsi senza modificare codice.
- File sorgenti richiesti e leggibili: `src/renderer/src/components/editorWithTabs/tabs.vue`, `package.json`.
- File/cartelle vietate: non toccare `src/main/**`, `store/editor.js`, source mode/commenti, watcher; non leggere né modificare segreti esterni al repo.
- Target verifica: grep di conferma assenza riferimenti residui a `dragula`/`dom-autoscroller`/`.gu-` in tutto `src/`; build/lint se disponibile.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/tabs.vue`
- `package.json`
- `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task5-worklog.md`

Non toccare altri file. Se il grep di conferma trova riferimenti a dragula fuori da `tabs.vue`/`package.json`, fermarsi e segnalarlo nel worklog invece di rimuoverli a cuor leggero (potrebbero essere usi legittimi non previsti dall'esplorazione).

## Regole e invarianti rilevanti

- Non rimuovere nulla che sia ancora effettivamente in uso: prima di cancellare, grep ogni simbolo (`dragula`, `autoScroll`/`dom-autoscroller`, classi `.gu-*`) per conferma zero riferimenti residui dopo task2/3/4.
- Se l'autoscroll (invariante 10 di task2) è stato rimandato invece che implementato con HTML5 nativo, questo task NON deve rimuovere `dom-autoscroller` finché non c'è un sostituto — verificare lo stato dichiarato nel worklog task2 prima di decidere.
- Aggiornare eventuali commenti nel codice che citano ancora dragula/mirror/gu- se restano riferimenti testuali obsoleti.

## Fatti già verificati

- `package.json`: dipendenze `dragula@^3.7.3` (riga 46 al momento dell'esplorazione) e `dom-autoscroller@^2.3.4` (riga 48) — righe da riconfermare.
- CSS `.gu-mirror`, `.gu-hide`, `.gu-unselectable`, `.gu-transit` non scoped in `tabs.vue`, righe ~1349-1366 al momento dell'esplorazione.
- Nessun altro file nel repo (fuori da `tabs.vue`/`package.json`) risultava referenziare dragula/dom-autoscroller al momento dell'esplorazione (2026-07-01) — riconfermare con grep fresco prima di procedere, dato che task2/3/4 potrebbero aver spostato codice.

## Sottoproblemi in ordine

1. Grep `dragula`, `dom-autoscroller`/`autoScroll`, `.gu-mirror`/`.gu-hide`/`.gu-unselectable`/`.gu-transit` su tutto `src/` per la conferma finale post-migrazione.
2. Rimuovere import, inizializzazione, handler, CSS residui in `tabs.vue` se confermati non più in uso.
3. Rimuovere le due dipendenze da `package.json` (`dragula`, `dom-autoscroller`) se non più referenziate in nessun file.
4. Verificare che il build/lint non segnali import mancanti o simboli non definiti dopo la rimozione.
5. Aggiornare worklog task5 con `[x]`, verifiche eseguite, note `DA TESTARE`.

## Verifica richiesta

- Grep di conferma zero riferimenti residui.
- `node --check`/parse SFC su `tabs.vue`.
- `npm run build` se eseguibile nell'ambiente (documentare se bloccato, come per altri task del progetto).
- Test manuale atteso: ripetere rapidamente i tre scenari di task2/task3/task4 (reorder interno, detach nuova finestra, drop finestra esistente) per confermare nessuna regressione dopo la rimozione delle dipendenze.
