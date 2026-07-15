# HANDOFF — stato sessione 2026-07-16 e ripresa

Ultima scrittura: 2026-07-16. Se questa data non è recente, non considerare il file attendibile.

## Cosa è successo in questa sessione (2026-07-16)

1. **Pulizia log debug: FATTA** (feature `debug-log-cleanup`, Agent-Code). Rimossi tutti i
   `[PARTE-F-DEBUG]` (keyboard.js -21 righe, backspaceCtrl.js -65 righe incluso l'else vuoto)
   e `[FMT-TOGGLE-DEBUG]` (formatCtrl.js -6, formatPicker/index.js -2). Solo rimozioni (93
   righe, zero aggiunte), grep zero occorrenze, build OK. Stato: DA TESTARE dall'utente
   (smoke: Ctrl+Backspace nei code block, toggle format multi-blocco).
2. **Archiviazione feature concluse: FATTA** (Agent-Summary + completamento spostamenti da
   parte dell'orchestratore). 9 feature spostate in `Completed/` con riassunto + index
   aggiornato: recent-files, menu-shortcut-overhaul, format-toggle-off,
   font-registry-fallback, locales-align, window-minwidth-hamburger, folder-search,
   preferences-refinement, residui-hard-task. In `InProgress/` restano solo: HANDOFF.md,
   `debug-log-cleanup/` (DA TESTARE), `image-drag-in-doc/` (attiva),
   `tabs-squared/` (riferimento futuro, decisione 2026-07-12).
3. **Fix combo di ieri**: risultano già committati dall'utente (git status pulito sui file).

## Stato commit

- NON committati: rimozione log debug (4 file in `src/muya/`) + archiviazione doc
  (Completed/, index.md, cartella debug-log-cleanup, questo HANDOFF).
- L'utente vuole commit preventivo PRIMA di image-drag (modifica pericolosa).

## Cosa manca (in ordine)

1. **Test utente** della pulizia log (smoke) + **conferma esplicita** per procedere.
2. **Commit dell'utente** (pulizia log + archiviazione doc).
3. **image-drag-in-doc** (ultima feature grossa): rilanciare Agent-Explorer col prompt
   salvato in `image-drag-in-doc/image-drag-in-doc-explorer-prompt.md`, poi plan
   implementativo + gate, poi Agent-Code. Analisi rischi già in `image-drag-in-doc-plan.md`
   (transformer/resize, selezione vs drag, regressione drop esterni, vincoli electron#42252).
   SOLO dopo il commit dell'utente.

## Bug/attività aperte non bloccanti

- `normalizeHeaderText` (vedi `docs/Ai/Notes/bug-normalizeHeaderText-id-contaminati.md`, serve repro).
- TODO.md: test macOS/Linux dell'overhaul, smoke-test sessione su Linux, verifica "Opened
  Tabs Search" (Ctrl+Shift+F, in teoria già funzionante).

## Note operative

- PC principale: build/dev consentiti, build solo per modifiche grandi (DECISIONS 2026-07-12).
- Gate obbligatorio prima di OGNI Agent-Code (DECISIONS 2026-07-03): riepilogo + OK esplicito.
- Git: solo verifiche read-only, mai commit/push (DECISIONS 2026-07-01).
- Dopo modifiche alle locale: `npm run minify-locales` obbligatorio.
- Unit test: `npm run test:unit` (vitest, 42 verdi).
