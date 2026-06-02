# Storico bug & fix (B1–B14)

Ogni voce: **sintomo**, **causa**, **fix**. Tutti risolti e testati.

??? bug "B1 — Bollino su tab non modificate all'apertura"
    **Sintomo:** aprendo un file la tab mostra subito il bollino.
    **Causa:** Muya fa ≥2 pass di normalizzazione all'init; `justLoaded` era one-shot (booleano).
    **Fix:** `justLoaded` da booleano a **timestamp** + finestra `LOAD_SETTLE_MS=400ms`.

??? bug "B2 — Prompt ricarica file esterno non compariva"
    **Causa:** `watcher.js` filtrava markdown-only → chokidar ignorava i file non-`.md` aperti come tab.
    **Fix:** per `type === 'file'` non filtrare per estensione.
    **Nota crash:** gli handler watcher sono chiamati dal main via `ipcMain.emit` → firma `(win, filePath)`, non `event.sender`.

??? bug "B3 — File ANSI con accenti → mojibake"
    **Causa:** `ced` su file piccoli/ASCII restituisce `ASCII` → mappato a `utf8` → byte Windows-1252 letti come UTF-8.
    **Fix:** `isValidUtf8(buffer)`; se ci sono byte > 0x7F **e** UTF-8 non valido → `windows-1252`. BOM ha precedenza.

??? bug "B4 — Selezione poco visibile nei temi scuri"
    **Fix base:** alzato alpha di `--selectionColor`.
    **B4-bis:** variabile dedicata `--cmSelectionColor` per CodeMirror, disaccoppiata da Muya (railscasts forzava `#272935 !important`).

??? bug "B5 — Zoom Ctrl+Plus / Ctrl+- non funzionanti"
    **Fix:** aggiunti accelerator `Ctrl+Plus`/`Ctrl+-` per `window.zoomIn`/`zoomOut` (erano vuoti).

??? bug "B6 — Ctrl+Z cross-tab + contaminazione source/history su close"
    **Causa (3):** `CLOSE_TABS` non chiamava `_applySourceCodeForFile`; `handleFileChange` processava eventi con `sourceCode=false`; Muya usava `id:'muya'` fisso.
    **Fix:** `_applySourceCodeForFile` in `CLOSE_TABS`; guard `if (!sourceCode.value) return`; `currentMuyaTabId` invece di `'muya'`.

??? bug "B7 — Spazio vuoto a destra nelle tab con filename corto"
    **Causa:** `.v2-tab-name` senza `flex-grow`. **Fix:** `flex-grow:1` (con `min-width:0` per l'ellipsis).

??? bug "B8 — Bollino riappare ~1s dopo Ctrl+S in source"
    **Causa:** `FILE_SAVE` legge `tab.markdown` ma in source è debounced 1s → salva contenuto stale.
    **Fix:** `pre-save` flush — `handlePreSave` cancella il commitTimer e committa sincrono.

??? bug "B9 — Bollino riappare al click cursore dopo save"
    **Causa:** con lightTouch ON, `savedMarkdown` ≠ `tab.markdown` in formattazione.
    **Fix:** se `normalizeBlock` coincide → `isSaved=true` e `originalMarkdown = tab.markdown`.

??? bug "B10 — Ctrl+Shift+↑/↓ non estende selezione in Muya"
    **Causa:** `arrowHandler` usciva early per ogni `shiftKey` senza preventDefault.
    **Fix:** handler esplicito per `ctrl+shift+ArrowUp/Down` prima dell'early-return.

??? bug "B11 — Reload esterno: contenuto non aggiorna + UX dialog"
    **Causa:** `handleFileChange` early-return su stessa tab saltava `setValue`; `loadChange` non impostava `justLoaded`.
    **Fix:** nuovo `fileChangedDialog.vue`; `loadChange` → `isSaved=true` + `justLoaded` + `forceReload:true`.

??? bug "B12 — Reload UX follow-up"
    N12 normalizza entrambi i lati; Annulla → `markDivergedFromDisk` (bollino persiste); dialog stile v2; context menu "Reload".

??? bug "B13 — Ctrl+S in source salva contenuto stale"
    **Causa:** `handlePreSave` aveva la guardia `&& !isFirstLoad.value` → il flush non avveniva mai per tab mai cambiata.
    **Fix:** rimossa la guardia (un Ctrl+S è sempre esplicito).

??? bug "B14 — Dialog reload appariva per tab in background"
    **Fix:** dialog solo se la tab è `currentFile`; altrimenti `tab.pendingExternalChange`, consumato allo switch.
