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

- [x] **Fix warnings** (build/console).
- [x] **Fix aggiornamenti npm e librerie** (incluso `npm install` di pulizia post rimozione dragula).

### Menu/UI overhaul — follow-up (2026-07-09)

- [ ] **Locales** — aggiustare le stringhe di traduzione (allineare a menu/palette dopo l'overhaul).
- [ ] **Preferences** — controllo generale e rifinitura delle preferenze.
- [ ] **Bug combo box in Preferences** — espandendo una combo senza scrollare, le sotto-voci escono dal riquadro dal lato ALTO e restano nascoste (si vedono solo scrollando). Fix overflow/posizionamento dropdown.
- [ ] **Tabs — aspetto alternativo** — valutare bordi squadrati stile Apple (possibile resa più gradevole).
- [ ] **Icona File recenti** — aggiungerla tra l'icona cartella e l'icona command palette (icona nuova a scelta libera). Lega alla feature `recent-files`.
- [ ] **Finestra — width minima + hamburger** — ridurre la width minima; sotto una soglia mostrare un'icona hamburger che raccoglie le icone command palette, cartella e file recenti.
- [ ] **Strumenti selezione testo — toggle off** — se un format è già attivo sulla selezione, ripremendolo deve TOGLIERLO, non riapplicarlo (oggi lo riaggiunge).
- [ ] **Test su macOS e Linux** — dell'overhaul menu/shortcut + fix sopra.

### Rimandati (non in programma, riaprire solo su richiesta)

Fold/unfold blocchi (T-M3) · indentazione automatica (T-M4) · auto-switch source per file grandi (T-M6) · indicatore visivo drag cross-finestra (DRAG-TASK)
