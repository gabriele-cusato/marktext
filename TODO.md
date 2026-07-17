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

- [x] ~~**BUILD-1** — setup `patch-package`~~ — chiuso 2026-07-12 senza implementare: zero patch manuali in `node_modules` (verificato), setup senza scopo oggi. Strada annotata per il futuro in `docs/Ai/Notes/patch-package-strada-futura.md`.
- [x] **B-REV11** — accelerator duplicati: dissolto 2026-07-12 — ri-censimento sui keybindings attuali post menu-shortcut-overhaul: zero duplicati su tutte le piattaforme.
- [x] **M-REV10** — resync DOM↔store post-drag: già risolto — `resyncDomToStore` rimossa interamente dalla migrazione drag-html5-dnd (2026-07-02/03), nulla da eliminare. I riferimenti in HARD-TASK.md a righe di tabs.vue sono pre-migrazione, obsoleti.
- [ ] **Smoke-test sessione su Linux** (macOS e Windows già ok).

### Nuovi

- [x] **Fix warnings** (build/console).
- [x] **Fix aggiornamenti npm e librerie** (incluso `npm install` di pulizia post rimozione dragula).

### Menu/UI overhaul — follow-up (2026-07-09)

- [x] **Locales** — chiuso 2026-07-13 (feature `locales-align`: 9 lingue a parità 0/0, +chiavi quickInsert inline; ricordare `npm run minify-locales` dopo ogni modifica alle locale).
- [x] **Preferences** — controllo generale chiuso 2026-07-13 (feature `preferences-refinement` task1: size mini, `watcherUsePolling` esposto+ricercabile, session snapshot i18n). Resta aperto SOLO il bug combo (riga sotto).
- [x] **Bug combo box in Preferences** — CHIUSO 2026-07-13. Tripla causa: popper EP sotto il backdrop del settings modal (fix `zIndex: 3600` in main.js), dropdown teleportata fuori dal riquadro (fix `:teleported="false"` nei wrapper) e classe hover legacy `.hover` mai matchata in EP 2.x (fix `.is-hovering`/`.highlighted`). Dettagli in `docs/Ai/InProgress/preferences-refinement/preferences-refinement-task2-combo-overflow-worklog.md`.
- [x] **Tabs — aspetto alternativo** — CHIUSO SENZA IMPLEMENTARE (decisione utente 2026-07-12: non da fare; plan conservato in `docs/Ai/InProgress/tabs-squared/` come riferimento futuro).
- [x] **Icona File recenti** — chiuso 2026-07-13 (feature `recent-files` + `recent-files-icon`, test utente OK).
- [x] **Finestra — width minima + hamburger** — chiuso 2026-07-13 (feature `window-minwidth-hamburger`: min 550px, soglia 700, popover hamburger con Teleport su body; test utente OK).
- [x] **Strumenti selezione testo — toggle off** — chiuso 2026-07-13 (feature `format-toggle-off`, multi-blocco stile Word; bug picker singolo-blocco non riprodotto; restano da rimuovere i log `[FMT-TOGGLE-DEBUG]`).
- [ ] **Test su macOS e Linux** — dell'overhaul menu/shortcut + fix sopra.
- [x] **Drag immagini nel documento** — chiuso 2026-07-18 (feature `image-drag-in-doc`, task move): spostamento drag&drop di un'immagine già nel documento, solo stessa tab/modalità Muya/area editabile; spike preventivo + fix stato stale post-move (drop esterni). Test utente OK. Commit utente + Agent-Summary pendenti.
- [x] **Folder Search** — chiuso 2026-07-13 (feature `folder-search` task1-4: handler rg + unit test, finestra risultati, sidebar, overlay con icona e bottone "…"; test utente OK).
- [ ] **Opened Tabs Search** Ricerca tra tutte le tab aperte (in teoria la feature è gia funzionante tramite la sidebar di ricerca aperta con Ctrl shift F, verificare)

### Rimandati (non in programma, riaprire solo su richiesta)

Fold/unfold blocchi (T-M3) · indentazione automatica (T-M4) · auto-switch source per file grandi (T-M6) · indicatore visivo drag cross-finestra (DRAG-TASK)
