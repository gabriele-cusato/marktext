# HANDOFF — stato sessione 2026-07-18 e ripresa

Ultima scrittura: 2026-07-18. Se questa data non è recente, non considerare il file attendibile.

## Cosa è successo in questa sessione (2026-07-18)

1. **image-drag-in-doc: FATTA e TESTATA** (ultima feature grossa). Task "move": spostamento
   drag&drop di un'immagine già nel documento (solo stessa tab, solo Muya, solo area
   editabile). Flusso: Agent-Explorer (prompt salvato) → plan implementativo
   (`image-drag-in-doc-move-plan.md`) → spike runtime task0 (orchestratore) → Agent-Code →
   fix round 1 (orchestratore, 3 righe): stato `internalImageDrag` stale dopo move via drop
   (render stacca la sorgente → dragend non risale → drop esterni morti). Round 2 test
   utente: PASS su tutto. File toccati: `src/muya/lib/eventHandler/dragDrop.js`,
   `src/muya/lib/contentState/dragDropCtrl.js`. Build OK, unit test 42/42.
   Scoperta utile: su questo target il drop interno ARRIVA (electron#42252 non morde
   sull'editor, a differenza della tabbar); fallback dragend tenuto comunque.
2. Test utente della pulizia log (`debug-log-cleanup`) e commit precedente: già fatti
   dall'utente prima di questa sessione.

## Cosa manca (in ordine)

1. **Commit dell'utente** di image-drag-in-doc (annunciato, forse già fatto alla ripresa).
2. **Agent-Summary per image-drag-in-doc**: esplicitamente RIMANDATO su richiesta utente —
   avviarlo solo quando l'utente dà l'ok (riassunto in `Completed/` + mv dettagli + index,
   regola DECISIONS 2026-07-08). Anche `debug-log-cleanup/` (testato) è candidato ad
   archiviazione con lo stesso giro.
3. TODO.md residui: test macOS/Linux dell'overhaul, smoke-test sessione su Linux, verifica
   "Opened Tabs Search" (Ctrl+Shift+F, in teoria già funzionante).

## Bug/attività aperte non bloccanti

- `normalizeHeaderText` (vedi `docs/Ai/Notes/bug-normalizeHeaderText-id-contaminati.md`, serve repro).

## Note operative

- PC principale: build/dev consentiti, build solo per modifiche grandi (DECISIONS 2026-07-12).
- Gate obbligatorio prima di OGNI Agent-Code (DECISIONS 2026-07-03): riepilogo + OK esplicito.
- Git: solo verifiche read-only, mai commit/push (DECISIONS 2026-07-01).
- Dopo modifiche alle locale: `npm run minify-locales` obbligatorio.
- Unit test: `npm run test:unit` (vitest, 42 verdi).
