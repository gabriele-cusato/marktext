# untitled-counter-globale — task1 — Worklog

## Avanzamento

- [x] Main: `_untitledIdSeq` + handler `ipcMain.handle('mt::next-untitled-index')` (bump con localMax, incremento atomico senza await) — DA TESTARE
- [x] Main: bump passivo del counter negli handler `mt::session-save` / `mt::session-save-and-close` (max dei filename Untitled negli slice) — DA TESTARE
- [x] Main: seed del counter al boot da sessione esistente — implementato nel path `mt::request-session-restore` (sia restore normale via `loadSessionTabs`, sia detach via `_bumpUntitledSeqFromTabs([tab])`), non serve toccare `session.js` — DA TESTARE
- [x] Renderer: helper max locale estratto e riusato (`getLocalUntitledMax` in `help.js`, usato sia nel fallback di `getBlankFileState` sia come `localMax` inviato al main)
- [x] Renderer: `getBlankFileState` con param `forcedNumber` (fallback locale invariato)
- [x] Renderer: `NEW_UNTITLED_TAB` async + invoke con try/catch fallback — DA TESTARE
- [x] Verifica compatibilità async di TUTTI i chiamanti di `NEW_UNTITLED_TAB` — nessuno dipende dalla presenza sincrona della tab subito dopo la chiamata (tutti fire-and-forget o ultima istruzione del branch); nessuna modifica necessaria ai chiamanti (editor.js:825,829,846,855,859,888,1405; tabs.vue:602; recent/index.vue:22)
- [x] Grep di controllo (`Untitled-` unico sito, canale nuovo non esistente, chiamanti getBlankFileState) — confermato: unico sito `help.js:126`, canale `mt::next-untitled-index` prima assente ora usato in 1 punto renderer + 1 handler main, unico chiamante `getBlankFileState` in `editor.js:1398`
- [x] `npm run dev` parte senza errori di compilazione — vedi esito in fondo

## Test

**Esito test runtime utente (2026-07-04): TUTTO OK — "funziona ottimo".**
- Counter Untitled ora globale tra le finestre: detach di file salvato → nuova tab nella finestra 2 continua dal max globale (non riparte da 1); bidirezionale (tab creata in finestra 2 avanza il counter anche per la finestra 1).
- Comportamento monotono confermato e accettato (numeri liberati non riusati finché l'app resta aperta).
- Nessuna regressione segnalata su single-window, restore sessione, detach.
- BUG-H5-UNTITLED chiuso → ✅ ✔️. Feature conclusa.
