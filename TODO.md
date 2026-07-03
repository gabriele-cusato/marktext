# TODO

> Storico dettagliato: `EASY-TASK.md`, `MEDIUM-EASY-TASK.md`, `MEDIUM-TASK.md`, `HARD-TASK.md`, `DESIGN-TASK.md`, `DRAG-TASK.md` + riassunti per feature in `docs/Ai/Completed/index.md`.

## Fatto (sintesi, aggiornato 2026-07-04)

- [x] **Facile — tutti**: conversione EOL, conversione/rilevamento encoding, UPPER/lowercase, operazioni riga (sposta/duplica/elimina), copia percorso dal tab, zoom Ctrl+rotella, selezione blocco in Muya, word wrap, selezione colonna Alt+drag.
- [x] **Medio-facile — tutti**: evidenzia occorrenze parola selezionata, context menu tasto destro Windows, stile UI v2, toggle rapido Muya↔source, controlli finestra macOS (implementato — verifica visiva su Mac reale pendente).
- [x] **Medio — fatti**: Find & Replace potenziato (case/word/regex), trova in tutti i file aperti (Ctrl+Shift+F), markdown solo per .md (`isMarkdownPath`), apertura .html nel browser (T-M5), commenti con shortcut (T-M2 `Ctrl+/` + mode CM per estensione T-M1).
- [x] **Difficile — tutti**: multi-cursore additivo Ctrl (H1), file non salvati in userData + session restore + chiusura silenziosa (H2-a/b/c), pin tab (H4), detach tab + multi-finestra a sessione unica + drag HTML5 nativo (H5 + `DRAG-TASK.md`), counter Untitled globale tra finestre, commenti `Ctrl+K C/U` per linguaggio (H3), undo unificato Muya↔source (H8).
- [x] ~~Cronologia undo persistente~~ — scartato (decisione 2026-06-09, HARD-TASK H6).
- [x] Numeri di riga — già presenti (HARD-TASK H7).

## Da fare

### Residui HARD-TASK (minori)

- [ ] **BUILD-1** — setup `patch-package` (serve un giro npm).
- [ ] **B-REV11** — accelerator duplicati: test runtime per capire chi vince, poi azzerare il perdente.
- [ ] **M-REV10** — resync DOM↔store post-drag ridondante: probabilmente codice morto dopo la rimozione di dragula → verificare e in caso eliminare.
- [ ] **Smoke-test sessione su Linux** (macOS e Windows già ok).

### Nuovi

- [ ] **Fix grafici** (specifiche da definire).
- [ ] **Fix warnings** (build/console).
- [ ] **Fix aggiornamenti npm e librerie** (incluso `npm install` di pulizia post rimozione dragula).

### Rimandati (non in programma, riaprire solo su richiesta)

Fold/unfold blocchi (T-M3) · indentazione automatica (T-M4) · auto-switch source per file grandi (T-M6) · indicatore visivo drag cross-finestra (DRAG-TASK)
