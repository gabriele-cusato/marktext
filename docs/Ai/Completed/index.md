# Feature Completate

## Build, Config & Quality

- **[electron-upgrade](electron-upgrade/electron-upgrade.md)** — Aggiornamento Electron 39→43 (EOL), salto diretto unico, build nativi ricompilati con `--only ced,keytar` (native-keymap N-API escluso), FIX safe-file handler parsing URL Windows E43, FIX size="mini"→small Element Plus, binario scaricato manualmente. ✅ Dev OK, packaged OK, build:win OK, commit+push.

- **[warning-fix](warning-fix/warning-fix.md)** — Risoluzione alla radice di 11 warning (build/dev/console): npm config, browserslist, Vite, electron-builder, i18n (chiavi + HTML), prop validation, Element Plus dialog, security (webSecurity + CSP dinamica custom protocol `safe-file`). 10 warning risolti, 1 ignorato (DevTools non azionabile), 1 indagine conclusa (normalizeHeaderText DNA cursore). **Regola permanente:** task10 (security) — invarianti `correctImageSrc` non toccato, `getImageInfo` unico chokepoint idempotente, CSP dev/prod via plugin Vite. Bug collaterale risolto (race transformer su cancellazione immagine).

## Editor Core

- **[editor-core](editor-core/editor-core.md)** — Architettura editor a due modalità (Muya WYSIWYG vs CodeMirror source), dirty flag, salvataggio atomico, pre-save flush, watcher file esterno, reload dialog, recaricamento forceReload (clearHistory invariante), encoding/EOL, keybinding mode-aware. 14 bug risolti B1–B14 (tutti verificati 2026-05-30). **Leggere PRIMA di modificare:** `_applySourceCodeForFile` ordering, `handlePreSave` senza guardie, `cmStatePerTab` restauro, `justLoaded` settling, `pendingExternalChange` background.

## Tab Bar & Layout

- **[tab-bar-layout](tab-bar-layout/tab-bar-layout.md)** — Tab bar multi-row v2 con hover-expand, layout absolute topright, detection two-pass, lock defer-not-drop, invarianti min-width:0 (BUG-1 risolto 6 round). macOS BUG-2 (traffic lights) e BUG-3 (single-row shift) + hint freccetta multi-row T-ME2. Task pianificati T-M1..T-M6 (mode CM per estensione, commenti, fold, indentazione, browser HTML, auto-switch file grandi). **Trappole:** absolute design load-bearing, costanti JS↔CSS sync, due-pass required per isteresi nulla.

## Ricerca & Utility

- **[ricerca-e-utility](ricerca-e-utility/ricerca-e-utility.md)** — Find Ctrl+F singola tab + Ctrl+Shift+F tutte le tab in sidebar a destra, highlight occorrenze source, sidebar layout (border-left, resize invertito), toggle Muya↔source (T5). Invarianti: `isMarkdownPath` fonte verità, `tabId` per match (Untitled), `highlightSearch` highlightOnly per Muya, `request-search-highlight` da entrambi editor. Bug 7 round risolti (highlight drag, live-search watcher, round6 jump mode-aware, round7 request-highlight su source tab-switch). **Tentativi falliti:** `editor.value.search()` dirotta Invio, solo watch senza @input fallback.

## UI v2

- **[ui-v2](ui-v2/ui-v2.md)** — Design system v2 (token `--v2-*` light/dark), status bar creato (Prg/Ln/Col/EOL/encoding/zoom), command palette quickbar, `markRaw` CodeMirror fix critico, magic margin CM interno, `justLoaded` flag Muya-specific, input type Enter vs LineBreak, dragula + Vue v-for riconciliamento `:key`. 12 bug UI fix (scroll interno CM, clone pinnedTab, tab posizione drag, mini-finestra resize). **Leggere PRIMA:** `markRaw` obbligatorio, scroll CM API (getScrollInfo, scrollTo, on('scroll')), doppio rAF per measure affidabile.

## Source Mode & Commenti

- **[source-comments-html-open](source-comments-html-open/source-comments-html-open.md)** — Source mode "da IDE": mode CodeMirror per estensione (task1), commenti `Ctrl+/` / `Ctrl+K C/U` line+block (task2), apri `.html` nel browser (task3), colori source (task5), commenti **indent-aware** dopo l'indent per `lineComment` (`.js`/`.py`, task8) e per block-comment-only (HTML/XML/Markdown `<!-- -->`, task9/11 — helper custom in `sourceCode.vue`, CodeMirror ignora `options.indent`). Bug di contorno: chord `Ctrl+K` intercettato dal main (task4/6), falso "file changed on disk" dopo save (task7), race scrittura non atomica → `rename` singola syscall (task10). ✅ 11 task, verificato utente 2026-07-06. **Trappole:** non patchare `node_modules/codemirror` per l'indent, non tornare a `move` per il save, non far ricomparire il falso "file changed" toccando il watcher.

## Editor Advanced

- **[editor-advanced](editor-advanced/editor-advanced.md)** — Multi-selezione additiva Ctrl (H1, pianificato), commenti `Ctrl+K C/U` per linguaggio (H3, bloccato da T-M1), undo unificato Muya↔source (H8, ✅ implementato 2026-06-15, 6 file, verificato runtime con 6 bug risolti). BUG-CP1 inserimento markdown reale in source, BUG-CP2 switch non ri-renderizza, BUG-CTRLZ cross-tab (fix `clearHistory()` post-`setValue`), BUG-MUYA-INPUT cursore stale (3 siti guard), BUG-MUYA-UNDO-SWITCH cursor noHistory, BUG-MUYA-HEADING-DNA testo vs heading (accettato cosmetico). **Limite noto:** righe vuote source↔Muya non 1:1 (ambiguità markdown), zero perdita dati.

## Editor UI Fixes

- **[editor-ui-fixes](editor-ui-fixes/editor-ui-fixes.md)** — Quattro fix UI: errore console al rename tab (try/catch scrollToCursor), cursore non mantenuto Muya→source (gate dirtySince + priorità mount), menu quickInsert che si restringe post-ricerca (fullRenderObj pristino), etichette lunghe sottomenu "turn into" che si sovrappongono (CSS flex+ellipsis). ✅ Verificato utente 2026-07-06 (4/4 task).

## Session Persistence

- **[session-persistence](session-persistence/session-persistence.md)** — Backup periodico (~7s) di tab non salvate in userData/backup/, restore al boot di tutte le tab (untitled/dirty/salvate), chiusura silenziosa finestra (default ON, gate preferenza). Atomico (tmp+rename), nessun popup, crash-safe (max ~7s persi). Single-window Notepad++ con feature ON. File 8 toccati (session.js NUOVO, main process session-save handlers, pref schema/default). ✅ Verificato utente 2026-06-21 (macOS + feedback Linux/Windows smoke-test). **Prerequisito H5 multi-finestra-aware.**

## Performance & Robustness

- **[performance-robustness](performance-robustness/performance-robustness.md)** — Ottimizzazioni 10 (Muya undo depth, CM opciones file grandi, minWidth clamp, write atomico, debounce content-watcher, cap search results), bug fix 12 (B-REV: regex, final-newline, pre-save path 3, guard order, hard-break, baseline SaveAs, filtro SaveAll, Untitled-NaN, close fallito, extend rangeCount, accelerator dup, race dialog), perf gate 5 (P-REV: LCS size-guard, changeGeneration cursor, contentVersion sidebar, no doppia input, cap risultati), code cleanup 14 (M-REV: byte NUL, pinnedTab dup, snapshot restore, normalizeMarkdown, watcher fotocopia, typo LINTEN, tab shape implicit, regex escape, doppio watch, resync ridondante, canToggleMode isMarkdownPath, i18n, isCollapsed morto, Muya montato dietro). ITEM-PERF-WARN avviso "troppe tab" (soglia 15→25→35…). BUG-WINCLOSE X custom scartava modifiche (fix cmd-close-window). BUG-SAVE-UNLINK falso unlink dopo rename atomico (fix watcher _isPendingIgnore).

## Drag, Detach & Multi-Window

- **[drag-detach-multi-window](drag-detach-multi-window/drag-detach-multi-window.md)** — Drag tab fuori finestra crea finestra nuova (detach), multi-finestra unified session (sessione UNICA tra finestre, merge ordine creation). H5-B sessione multi-finestra-aware ✅ 2026-06-26 (OPUS, snapshot `<winId>-<id>`, registro main, merge serializzato). H5-1 detach context menu ✅ 2026-06-26. H5-2 detach drag ✅ 2026-06-26. **⚠️ SUPERATO dragula → HTML5 DnD nativo:** vedi `drag-html5-dnd.md` per drag attuale (reorder nativo, detach, anteprima marker, copia desktop, spring-loading taskbar fix). H5-RE: 1 problema residuo (counter Untitled non globale tra finestre); empty-window e ri-drag omonime risolti/dissolti da drag-html5-dnd. **Invarianti multi-finestra:** sesione UNICA indice flat, owner dinamico, snapshot namespaced, merge by order.

## Tab Naming & Counter

- **[untitled-counter-globale](untitled-counter-globale/untitled-counter-globale.md)** — Counter Untitled globale e monotono shared tra tutte le finestre (BUG-H5-UNTITLED fix). Root cause: calcolo locale nel renderer → numeri duplicati cross-finestra durante detach. Soluzione: counter main `_untitledIdSeq` + handler invoke `mt::next-untitled-index` con `localMax` protettivo, bump passivo da session-save, renderer async fallback locale, helper `getLocalUntitledMax` estratto e riusato. ✅ Verificato utente 2026-07-04 (detach, bidirezionalità, restore, monotonia). **Trappole:** atomicità `++counter` sincrona, fallback locale critico, monotonia accettata user-facing.

## UI/Interazione

- **[drag-html5-dnd](drag-html5-dnd/drag-html5-dnd.md)** — Migrazione drag tab da dragula a HTML5 DnD nativo, parità VS Code raggiunta e testata: reorder multi-row, detach in nuova finestra, migrazione cross-finestra (con auto-chiusura secondaria svuotata, canale `mt::window-emptied`), spring-loading taskbar RISOLTO (regola "rifiuto passivo dragover", famiglia electron#42252), copia file su desktop/Explorer via DownloadURL con gate dropEffect 'copy'. Leggere PRIMA di toccare: drag&drop, tabs.vue, handler dragover ovunque, detach/migrazione, payload dataTransfer. Contiene invarianti permanenti e tentativi falsificati da non ripetere. Aperti: indicatore cross-finestra (rimandato), BUG-FLICKER (trappola attiva), `npm install` post rimozione dragula.
