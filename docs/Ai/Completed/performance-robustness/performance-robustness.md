# Performance & Robustness — Ottimizzazioni, Bug Fix, Revisioni Codice

**Scopo:** documenta ottimizzazioni performance (file grandi, molte tab, debounce, cap risultati), bug fix robustezza (race condition, close silenzioso, watcher), revisioni di codice (deduplicazione, regex, typo, i18n). Leggere PRIMA di toccare: search live, watcher, undo history, CM config, salvataggio.

**Origine:** `HARD-TASK.md` sezioni R1-R10, B-REV1-B-REV12, P-REV1-P-REV5, M-REV1-M-REV14, ITEM-PERF-WARN (2026-06-09 onward).

**Quando leggerlo:** app lagga con file grande / molte tab / search non aggiorna / watcher fa falso unlink / undo scattoso / close window scarta modifiche / accelerator duplicati / i18n mostra chiavi grezze.

**Stato:** Quasi tutti ✅ fatti. Alcuni 🧪 da testare a runtime. B-REV11, BUILD-1, M-REV10 ⏸️ bloccati.

---

## R1 — Muya Undo Depth Dinamico (✅ Implementato)

**Cosa:** `UNDO_DEPTH` 500→100 in `muya/lib/config/index.js`.

**Motivo:** ridurre footprint memoria per sessioni lunghe con molte tab Muya.

---

## R2 — Cap LRU cmStatePerTab + Undodepth 1000 (🔄 RIVISTO 2026-06-20)

**Decisione Utente RIVISTA:** cap LRU **RIMOSSO** — tutte le tab della sessione mantengono la history undo; snapshot eliminato solo a chiusura tab.

**Aggiunto:** `undoDepth:1000` per CM (contro il default 200).

**Conseguenza:** serve avviso perf "troppe tab" (rimpiazza il cap rimosso) → **ITEM-PERF-WARN** sotto.

---

## R3 — Debounce Content-Watcher Sidebar (✅ = P-REV3)

---

## R4 — Degradare Opzioni CM File Enormi (✅ Implementato)

Se file >10MB: disabilitare in `sourceCode.vue`:
- `highlightSelectionMatches` (performance highlight)
- `styleActiveLine` (highlight riga corrente)

**Test utente (2026-06-20):** file 480k righe / 16MB → lag accettabile dopo questo.

---

## R5 — Clamp MinWidth a WorkArea (✅ Implementato)

`Math.min(820, workArea.width)` in `windows/editor.js` → evita finestra impossibile su schermi piccoli.

---

## R6 — Smoke Test Mac/Linux/DPI (✔️ Solo Test)

---

## R7 — Write Atomico (Temp+Rename) (✅ Implementato)

`outputFile→.tmp+move` in `filesystem/index.js`.

**Motivo:** crash durante write non corrompe il file originale.

---

## R8 — Watcher Cloud/Rete (✔️ Già OK)

---

## R9 — Encoding/EOL Edge (✔️ Doc)

---

## R10 — Minori (✔️ Nessuna Azione)

---

## B-REV1 — Regex `[\r?\n]` ×2 (✅)

Normalizzazione EOL coerente in 2 siti.

---

## B-REV2 — Final-Newline isSaved=false (✅)

Cambio opzione final-newline marca dirty.

---

## B-REV3 — Pre-Save nei 3 Path Chiusura (✅ 🧪)

`bus.emit('pre-save')` in:
- X finestra
- Ctrl+W tab dirty
- Save All

Garantisce `tab.markdown` fresco prima di leggere.

---

## B-REV4 — Guard-Order Editor.vue (✅ 🧪)

Difensive null-check aggiunti in `editor.vue` al cambio modalità.

---

## B-REV5 — Hard-Break vs LightTouch (✅ 🧪)

Hard-break (2 spazi finali) mangiato da `normalizeBlock`. Sentinella `\x02` preserva nel confronto.

**Decisione Utente 2026-06-20:** **FIXARE** (sentinella in `normalizeBlock`).

---

## B-REV6 — Baseline Save As (✅ ✔️)

Dialog Save As è modale → no race. Annulla = tab resta dirty.

---

## B-REV7 — Filtro Save All (✅ 🧪)

`ASK_FOR_SAVE_ALL` (vs `LISTEN_FOR_CLOSE`) usava filtro diverso → inconsistenza.

**Decisione Utente 2026-06-20:** allineare a `!file.isSaved`.

---

## B-REV8 — Untitled-NaN Guard (✅ 🧪)

Se il numero Untitled non parseable → fallback a contatore numerico.

---

## B-REV9 — Chiusura su Save Fallito (✅ ✔️)

Se save fallisce, finestra NON si chiude; mostra dialog errore (EPERM rosso) + "Close" manuale.

---

## B-REV10 — Extend() Guard RangeCount (✅ 🧪)

In Muya `arrowCtrl.js`: check `rangeCount` prima di `extend()` (no crash su selezione nulla).

---

## B-REV11 — Accelerator Duplicati (⏸️)

Grep verificato: duplicati trovati. "Chi vince" è runtime-dependent.

**Status:** serve test runtime R-6 (conflitto risolto o crash).

---

## B-REV12 — Race FileChangedDialog (✅ ✔️)

File modificato 2 volte a ~200ms di distanza → dialog non auto-chiude, riapertura manuale OK.

---

## P-REV1 — Size-Guard LCS (✅ ✔️)

File >3000 righe: `lightTouch` mergeWithOriginal è O(N³) (Longest Common Subsequence). Guard taglia il rigenato se impossibile → `return originalMarkdown` + niente freeze.

---

## P-REV2 — ChangeGeneration CursorActivity (✅ 🧪)

`cursorActivity` gated su `lastChangeGen !== currentGeneration` → skip getValue/wordCount/N12 su puro movimento cursore (niente I/O inutile).

---

## P-REV3 — ContentVersion Sidebar (✅ = R3)

Sidebar live-search debounced ~250ms su `tabs.map(t=>t.markdown)` content-watcher.

---

## P-REV4 — OnInput No Doppia Search (✅ ✔️)

Input sidebar non esegue search 2 volte (su `watch` + `@input`). Primario `watch(keyword)`, `@input` fallback.

---

## P-REV5 — Cap Risultati Ricerca (✅ 🧪)

**Nuovi cap:**
- `MAX_MATCHES_PER_TAB=500` (search.vue)
- `MAX_MATCHES_TOTAL=2000` (search.vue)
- `MAX_MARKS=1000` (sourceCode.vue)

Evita lag UI con file enormi + molti match.

---

## M-REV1 — Byte NUL Search.vue (✅)

Rimosso (assorbito P-REV3) — il byte NUL non è più un problema.

---

## M-REV2 — PinnedTab Triplicato (✅ 🧪)

`recomputePinnedTab()` è il **clone** della tab attiva in riga 2+. Bug: il clone veniva computato 3 volte (watcher hasMultiRow + currentFile.id + call esplicito).

Fix: call centralizzato da drop handler (se post-resize) + watcher su `currentFile.id` e `hasMultiRow` → unica computazione.

---

## M-REV3 — Restore Snapshot CM Dup (✅ 🧪)

Helper `restoreCmStateForTab` esportato da `sourceCode.vue` — 2 siti → 1 funzione.

---

## M-REV4 — NormalizeMarkdown Dup (✅ 🧪)

`adjustTrailingNewlines` esportata da `util/index.js`; private copies rimosse da `editor.js` + `sourceCode.vue`.

---

## M-REV5 — ~35 Watcher Fotocopia (✅ 🧪)

19 watcher identici in `editor.vue` (uno per option) → `SIMPLE_OPTION_WATCHERS` table+loop (riduce bloat, migliora manutenibilità).

---

## M-REV6 — Typo LINTEN_FOR_* (✅ 🧪)

Rinomina `LISTEN_FOR_*` in `store/editor.js` + `app.vue` (typo spelling corretto, non cambia logica).

---

## M-REV7 — Shape Tab Implicita (✅ 🧪)

Campi `justLoaded`+`pendingExternalChange` aggiunti a `defaultFileState` in `store/help.js` (explicit vs implicit).

---

## M-REV8 — Regex `/[-_]/g` (✅ 🧪)

Fix regex: `replace(/-_/g,'')` → `/[-_]/g` (escaping corretto in character class).

---

## M-REV9 — Due Watch ShowSideBar (✅ 🧪)

2 watcher identici in `search.vue` → unificati in un solo watch.

---

## M-REV10 — ResyncDomToStore Ridondante (⏸️)

Funzione usata in drag detection. Serve test drag per capire se è davvero ridondante.

---

## M-REV11 — CanToggleMode Usa isMarkdownPath (✅ 🧪)

Bottone "Source" status bar: guard estensione via `isMarkdownPath` (fonte di verità unica).

---

## M-REV12 — i18n Status Bar (✅ 🧪)

8 chiavi in `en.json` (`statusBar.*`, `theme.*`); altre lingue fallback en.

---

## M-REV13 — isCollapsed Morto (✅ 🧪)

Proprietà rimossa da `searchResultItem.vue` (mai usata).

---

## M-REV14 — Muya Montato Dietro CM (✔️ Nota)

Architetturalmente accettato (due editor paralleli in DOM, uno hidden).

---

## ITEM-PERF-WARN — Avviso "Troppe Tab" (✅ 🧪)

**Nuovo componente** `perfWarningDialog.vue`, montato in `editorWithTabs/index.vue` accanto a `fileChangedDialog`.

**Stile:** copiate 1:1 da `fileChangedDialog.vue` (classi `fc-*`, animazioni `v2dropIn`/`v2fadeIn`).

**Trigger:** `watch(() => tabs.value.length)`. Soglia: avviso a **15** tab, poi ad ogni **+10** (25, 35, …). Logica a bande: avvisa solo salendo in una banda nuova; scendendo sotto si ri-arma.

**i18n (FIX bug runtime 2026-06-20):** testi **hardcoded in inglese inline** (fallback v2) per evitare chiavi grezze se i18n non è aggiornato. Interpolazione `{count}` fatta con `.replace`.

**Test:** apri tab fino a 15 → box appare. Chiudi (OK/ESC). Fino a 25 → riappare. Scendi sotto soglia e risali → riappare.

---

## BUG-SAVE-UNLINK — Salvataggio → Barra Arancio "Removed From Disk" (✅ 🧪)

**Problema:** `Ctrl+S` attiva il rename atomico (R7) → chokidar emette `unlink` spurio (falso "file cancellato") → barra arancio + dialog reload errato.

**Fix:** `watcher.js` handler `unlink` fa peek non-consumante `_isPendingIgnore` della lista ignore → sopprime il falso unlink durante la finestra di ignore del save.

**⚠️ MAIN process** → riavviare `npm run dev`.

---

## Test Runtime (Batch A — Verificati Utente 2026-06-13)

✔️ **B-REV1/2/4/6/8/10/11/12** — spot-check confermato (basso rischio).

⚠️ **B-REV3 (pre-save 3 path):** non distinguibile a mano (<1s impraticabile), ma OK per construction (guard PRESENTE).

⚠️ **B-REV9 (save fallito):** era bloccato da BUG-WINCLOSE (X custom scartava modifiche). Risolto: ora file sola-lettura → modifica → X finestra → "Save" → dialog Close/Keep open.

---

## BUG-WINCLOSE — X Titlebar Custom Scartava Modifiche (✅ ✔️)

**Sintomo:** chiudendo finestra (X custom) con tab dirty, nessun dialog "salvare?" → finestra esce, modifiche perse.

**Root Cause:** `tabs.vue:340` `winClose` mandava `mt::close-window` → `forceClose(win)` = chiusura immediata, **bypassa** `win.on('close')` → ask-for-close.

**Fix:** `winClose` → `mt::cmd-close-window` (`win.close()` → innesca `on('close')` → flusso save-confirm).

**Test:** tab dirty → **X finestra** → dialog Save/Don't Save/Cancel; "Save" salva e chiude.

---

## Mappa File (Rapida)

| Cosa | File |
|---|---|
| Muya undo depth | `muya/lib/config/index.js` |
| CM options big files | `sourceCode.vue` |
| MinWidth clamp | `windows/editor.js` |
| Write atomico | `filesystem/index.js` |
| Content-watcher debounce | `store/editor.js` (perf gate), `search.vue` (watcher) |
| Cap search results | `search.vue`, `sourceCode.vue` |
| Perf warning dialog | NUOVO `perfWarningDialog.vue` |
| Accelerator duplicati | `src/main/keyboard/keybindings*.js` |
| i18n status bar | `en.json`, `statusBar/index.vue` |
| Watcher unlink ignore | `src/main/filesystem/watcher.js` |

---

## Cross-Link

- **Editor Core** (`editor-core/editor-core.md`): invarianti pre-save (B3, B8, B13)
- **Session Persistence** (`session-persistence/session-persistence.md`): watcher + avoid false unlink
