# folder-search — task1 — worklog

Plan: `folder-search-task1-plan.md`.

Stato: DA TESTARE.

## Avanzamento
- [x] Costruzione argomenti rg (query/opzioni case/word/regex + preferenze search*)
- [x] Esclusioni: set base + pattern utente/preferenza come glob negativi
- [x] Streaming + parse eventi JSON di rg, accumulo per file, offset byte→caratteri
- [x] Cap 500/file e 2000 totali con kill processo e flag `truncated`
- [x] Robustezza: cartella inesistente / query vuota / regex invalida / timeout

## Test
Follow-up autorizzato dall'orchestratore: creato `tests/unit/dataCenter-search-in-folder.test.js`
(convenzione naming coerente con `tests/unit/*.test.js` esistenti, import `main_renderer/dataCenter`
via alias vitest già configurato per `src/main`). Copre la funzione pura `searchInFolder` con rg
reale (binario `@vscode/ripgrep` bundlato) su directory temporanee (`os.tmpdir`, una sottocartella
per scenario), ripulite in `afterAll`:
- match semplice (line/start/end/lineText)
- conversione offset byte→carattere su riga non-ASCII ('caffè hello mondo')
- isCaseSensitive true/false
- isWholeWord true/false
- isRegexp true con pattern valido
- isRegexp true con pattern non valido → `error`
- cartella inesistente → `error`
- query vuota → `{results: [], truncated: false}`
- esclusione per glob utente (`exclusions: ['*.log']`)

Eseguito con `npm run test:unit -- tests/unit/dataCenter-search-in-folder.test.js`: **10/10 test
passati** (Duration ~0.5s). Nessun altro test è stato toccato o eseguito.

Punti verificati a lettura di codice:
- Sintassi del file `dataCenter/index.js` riletta interamente dopo le modifiche (nessun errore
  evidente di bilanciamento parentesi/graffe, import invariati).
- rg risolto con lo stesso pattern di `mt::search-files` (`@vscode/ripgrep` + fix asar).
- Preferenze `search*` lette da uno store electron-store separato in sola lettura (nome
  `'preferences'`, stesso file usato da `Preference`), dato che `DataCenter` non riceve un
  riferimento all'istanza `Preference` (vedi `app/accessor.js`): scelta implementativa da
  segnalare all'orchestratore, non prevista esplicitamente dal plan. Non testata a unit test
  (dipende da `Store`/Electron `app.getPath`, non disponibile fuori da un processo Electron reale);
  la funzione `searchInFolder` testata riceve `preferences` come oggetto plain, quindi il test la
  bypassa passando direttamente i valori.
