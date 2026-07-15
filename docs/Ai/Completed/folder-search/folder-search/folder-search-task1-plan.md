# folder-search — task1 (handler main `mt::search-in-folder`) — plan — 2026-07-12

Riferimento generale: `folder-search-plan.md` (decisioni 1-7 chiuse + decisione residua chiusa:
riuso preferenze `search*` come default persistenti, override dall'overlay).

## Obiettivo del task
Nuovo handler main `mt::search-in-folder` che cerca un testo/regex nel CONTENUTO dei file di una
cartella tramite ripgrep e ritorna i match strutturati. Solo main process: nessuna UI in questo task.

## Prerequisiti bloccanti
- Questo plan + worklog `folder-search-task1-worklog.md`.
- File da toccare esistente: `src/main/dataCenter/index.js` (pattern di riferimento:
  handler `mt::search-files`, righe ~366-440 — spawn di rg, streaming, cap, kill del processo).
- Preferenze esistenti in `src/main/preferences/schema.json`: `searchExclusions`,
  `searchMaxFileSize`, `searchIncludeHidden`, `searchNoIgnore`, `searchFollowSymlinks` (oggi morte,
  qui tornano vive come default).
- VIETATO version control; NIENTE build (build unica finale coordinata dall'orchestratore).

## Contratto (vale anche per i task 2-3, non cambiarlo senza aggiornare i loro plan)
Richiesta: `ipcMain.handle('mt::search-in-folder', (e, { directory, query, options }))` con
`options = { isCaseSensitive, isWholeWord, isRegexp, exclusions }` (exclusions = array di pattern
utente dall'overlay; se assente usare la preferenza `searchExclusions`).
Risposta: `{ results, truncated }` dove `results = [{ filePath, matches: [{ line, start, end,
lineText }] }]` — `line` 1-based; `start`/`end` offset in CARATTERI dentro `lineText` (convertire
dagli offset in byte di rg per righe non-ASCII); `lineText` troncata a una lunghezza ragionevole
(es. 250 char) mantenendo il match visibile.

## Sottoproblemi (in ordine)
1. Costruzione argomenti rg: `--json` per i match strutturati; query letterale di default
   (`--fixed-strings`) o regex se `isRegexp`; `--ignore-case` se non case sensitive;
   `--word-regexp` se whole word; `--max-filesize` da `searchMaxFileSize` (se valorizzata);
   `--hidden` se `searchIncludeHidden`; `--no-ignore` se `searchNoIgnore`; `--follow` se
   `searchFollowSymlinks`.
2. Esclusioni: set BASE integrato per file non testuali (immagini/video/audio/archivi/binari noti,
   riusare `IMAGE_EXTENSIONS` da `common/filesystem/paths` dove utile) + pattern utente
   (`exclusions` o preferenza), tutti passati come glob `-g "!..."`. rg salta già i binari per
   contenuto: il set base serve a evitare anche l'I/O inutile.
3. Streaming stdout con parse riga-per-riga degli eventi JSON `match` di rg; accumulo per file.
4. Cap: max 500 match per file, max 2000 totali (coerenti con i tetti sidebar esistenti); al
   raggiungimento: kill del processo (stesso pattern di `mt::search-files`) e `truncated: true`.
5. Robustezza: cartella inesistente → risposta `{ results: [], truncated: false, error: '...' }`
   (stringa errore per il riquadro utente, non throw); query vuota → risultati vuoti; regex utente
   non valida con `isRegexp` → error dedicato (rg esce con errore: intercettare stderr).
6. Timeout di sicurezza (es. 30s) con kill, per cartelle enormi.

## Regole
- Solo `src/main/dataCenter/index.js`. Commenti in italiano, forma all'infinito.
- Test unitari: SOLO se esiste già un'infrastruttura test nel progetto (verificare script in
  package.json); altrimenti annotare nel worklog che la verifica è runtime.

## Skill di codice
`coding-standard`.
