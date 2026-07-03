# HARD-TASK — Piano sezione "Difficile" + audit robustezza / casi limite

> **Scopo.** Piano implementativo per i task della sezione *Difficile* di `TODO.md` (+ il fix BUG-1 di
> `MEDIUM-TASK.md` validato sul codice) e **audit dei casi limite** per rendere l'app solida su uso misto,
> macchine/schermi non testati, documenti enormi, molte tab, sessioni lunghe.
> Leggere PRIMA: `CLAUDE.md` (regole grep/IPC/bus), `EASY-TASK.md` (invarianti editor/dirty/save),
> `MEDIUM-EASY-TASK.md` (ricerca, `isMarkdownPath`), `DESIGN-TASK.md` (UI v2, `markRaw`, scroll CM),
> `MEDIUM-TASK.md` §7 (lezioni layout tab bar — NON toccare absolute/padding-right).
>
> Stato anchor di riga: verificati il 2026-06-09 — ri-grep prima di editare.
> Legenda: ✅ verificato nel codice · ⚠️ da verificare a runtime / fonte esterna · 🟡 scelta di design motivata.

---

## PUNTO DELLA SITUAZIONE (2026-06-21)

**Fatto (codice):** tutti i micro-fix §7 + refactor M-REV; H8 (undo unificato, verificato runtime);
H4 Pin tab (logica + revisione cosmetica); BUG-CP1 + CP1b (markdown reale in source); BUG-SAVE-UNLINK
(falso "removed from disk" al save); ITEM-PERF-WARN (avviso "troppe tab"); R1/R4/R5/R7; R2 **rivisto**;
**H2-a/b/c — persistenza sessione + single-window stile Notepad++ (2026-06-21, ✅ VERIFICATO DALL'UTENTE:
"funziona tutto perfettamente")**. Dettagli implementativi: sezione TESTING → "Sessione 2026-06-21".

### 🔖 RIPRENDERE DOMANI (handoff 2026-06-21)

**H2 è FATTO e verificato a runtime** (backup periodico 7s + chiusura silenziosa + restore di tutte le tab + crash-safe +
single-window + apri-file accoda alla sessione). Bug `An object could not be cloned` risolto (deepClone). Restano:

- 🔶 **H5-B + H5-1 + H5-2 ✅ codice fatto (2026-06-26, OPUS) — DA TESTARE A RUNTIME.** Ordine eseguito: B → H5-1 → H5-2.
  **PROSSIMO STEP: test runtime** (riavviare `npm run dev` — modificati file MAIN: `app/index.js`, `session.js`). Sequenza consigliata:
  B1/B7 (1 finestra, no regressioni) → H5-1 (context menu "Move to New Window" → nasce 2ª finestra, tab migra) → B2–B6
  (2 finestre: snapshot `<winId>-<id>` distinti, race, Q1 chiusura finestra non scarta tab) → H5-2 (trascina tab fuori → nuova finestra).
  Dettagli implementativi B in §H5 "🅱️ PIANO IMPLEMENTATIVO B" (header "✅ IMPLEMENTATO"); H5-1/H5-2 nelle Fasi sotto.
  ✅ **Domanda gate RISOLTA (2026-06-25):** il detach **bypassa** il gate single-window; le finestre multiple condividono UNA
  sessione (modello NPP — vedi §H5 "MODELLO MULTI-FINESTRA / SESSIONE UNICA"). Chiudere una finestra NON scarta le sue tab
  (restano in sessione, merge al riavvio in ordine di apertura finestra). ⚠️ Il pezzo grosso/rischioso NON è il detach ma B:
  oggi il backup gira solo nell'owner (`store/editor.js:951`) e `session.json` è flat, sovrascritto da una sola finestra
  (`session.js:91`) → 6 criticità verificate + fix in §H5 "🅱️".
- **H3** — `Ctrl+K C/U` commenta per linguaggio. Bloccato: serve T-M1 (`MEDIUM-TASK.md`) + permesso esplicito.
- **BUG-CP2** — switch source↔Muya non ri-renderizza md inserito via palette. Serve REPRO runtime dall'utente.
- **Smoke-test H2 su Linux** (macOS ✅ già verificato dall'utente 2026-06-21, su build firmato): il path
  `app.getPath('userData')/backup` è cross-platform corretto; resta solo Linux (`~/.config/marktext`), nessun problema atteso.

**Minori / da testare:** bug unpin (tab non torna a posizione originale, accettato); B-REV5 (hard-break 2 spazi,
test rimandato); B-REV11 (accelerator duplicati, serve runtime); M-REV10 (resync drag, serve test);
BUILD-1 (patch-package, serve npm). Vari ✅ 🧪 da spot-check runtime (vedi colonna Stato).

---

### 🔖 RIPRENDERE (handoff 2026-06-28, OPUS) — H5 polish/bug + H3

> **Test H5 runtime (utente, 2026-06-28): tutti POSITIVI** — B1–B7, H5-1, H5-2, H5-RE funzionano.
> → H5-B / H5-1 / H5-2 passano a ✅ ✔️ una volta chiusi i 2 bug sotto. Restano da fare:

**BUG-H5-EMPTYWIN** ✅ ✔️ (risolto, confermato utente 2026-07-04) — una finestra (detached / non-owner) con **tutte le tab chiuse resta aperta e vuota** (solo il bottone "+" per creare una tab), non si chiude e non è più chiudibile. **Deve auto-chiudersi** quando si chiude l'ultima tab di una finestra non-owner. Investigare il flusso di chiusura tab nelle finestre detached + interazione col gate single-window (la owner NON deve chiudersi quando resta vuota — lì la blank tab è attesa; il fix vale solo per le finestre nate dal detach).

**BUG-H5-UNTITLED** ✅ ✔️ RISOLTO (2026-07-04, feature `untitled-counter-globale`, verificato utente) — il **counter Untitled non è globale tra finestre**. Comportamento osservato: la nuova finestra riparte dal counter della tab trascinata — (a) detach di un file **salvato su disco** → nuova tab nella finestra 2 = `Untitled-1` (sbagliato); (b) detach di `Untitled-6` → nuova tab nella finestra 2 = `Untitled-7` (giusto per caso: eredita solo il counter locale della tab migrata). Requisito: **counter unico condiviso tra TUTTE le finestre, bidirezionale** — nuova tab in qualunque finestra = max globale + 1, e la finestra originale deve tenere conto degli Untitled creati nelle altre. Oggi il numero è calcolato per-renderer dalle sole tab locali (B-REV8, `store/editor.js`). Serve coordinare il prossimo indice Untitled a livello di sessione/main tra tutte le finestre (contatore nel main, non per-renderer).

**H5-RE-BUG1** ✅ ✔️ (risolto, confermato utente 2026-07-04) — ri-drag di **tab omonime** non funziona. Sospetto: match per `filename`/`pathname` invece che per `id` univoco in qualche punto del flusso detach/insert/close. Investigazione **statica** (Agent-Explorer): grep i confronti `filename`/`pathname` nel percorso re-attach e nel drag-back.

> ⚠️ **SUPERATO 2026-06-28 → piano spostato in `DRAG-TASK.md`:** il polish H5-RE + il raise-finestre confluiscono nella **migrazione del drag tab a HTML5 native DnD** (parità VS Code: anteprima d'inserimento + hover-taskbar che rivela le finestre + drop-fuori = nuova finestra). **koffi/raise-Win32 SCARTATO** (reso inutile dal drag OLE nativo). I 3 bug sotto (EMPTYWIN, UNTITLED, RE-BUG1) restano validi. Il blocco "Path A" e "RAISE/RESTORE" qui sotto è storico.

**H5-RE polish — DECISIONE UTENTE: Path A (stile VS Code, drag DOM).** Hover-taskbar nativo ESCLUSO (richiede `startDrag` nativo che su Windows congela il processo → incompatibile col feedback live; conflitto verificato via ricerca 2026-06-28). Da implementare:
- **Bring-to-front LIVE** della finestra destinazione durante il drag: nel main, poll `screen.getCursorScreenPoint()` ~16ms + hit-test `win.getBounds()` → alza la finestra sotto il cursore. Meccanismo: `win.moveTop()` (Electron puro, no addon, non garantito 100% su ogni build Win) **oppure** `SetWindowPos(HWND_TOP, SWP_NOACTIVATE)` via FFI nativa (più solido). `showInactive()`/`setAlwaysOnTop()` = bug noti, NON usare.
- **Anteprima / insert-marker** nella tab bar destinazione: il main fa da relay → `webContents.send('drag-over', x)` alla finestra target → disegna un placeholder all'indice di inserimento calcolato da `x` client.
- **Ghost window** leggera opzionale (DOM minimale, no framework) che segue il cursore.

**RAISE/RESTORE finestre come target di drop (richiesta utente) — fattibile, ⏸️ DECISIONE APERTA.** Ricerca 2026-06-28: de-iconizzare + alzare le altre finestre **senza rompere il drag dragula** è possibile SOLO con `ShowWindow(hWnd, SW_SHOWNOACTIVATE)` + `SetWindowPos(SWP_NOACTIVATE|SWP_NOMOVE|SWP_NOSIZE)` su `win.getNativeWindowHandle()`, via **FFI nativa (`koffi`, no rebuild)**, innescato al **cursor-exit** (NON al drag-start: troppo intrusivo, il drag è quasi sempre riordino). Perché funziona: dragula usa listener mouse sul `document` + Chromium tiene `SetCapture` sull'HWND sorgente → la finestra A continua a ricevere `mousemove` (coord fuori bounds = segnale d'uscita) e con NOACTIVATE non perde focus/capture. `win.restore()` NO (attiva → rischio rilascio capture → drag rotto). **Limiti:** finestre su altro desktop virtuale Windows non alzabili (escluderle dai target); multi-monitor ok. **Costo:** dipendenza nativa `koffi`. **Alternativa senza dipendenza:** pattern Chrome/VS Code (minimizzate non sono target; drop fuori = nuova finestra). → **DA DECIDERE: aggiungere `koffi` per il raise robusto, oppure restare sul pattern Chrome/VS Code.**

**H3 (commenti per linguaggio) — ✅ ✔️ FATTO (confermato utente 2026-07-04). Piano storico (corretto 2026-06-28):**
- Mappare **SOLO** `Ctrl+K C` (commenta) e `Ctrl+K U` (decommenta). **NIENTE** `Ctrl+K Ctrl+C`/`Ctrl+K Ctrl+U` (l'utente ha corretto la richiesta iniziale).
- **`Ctrl+K` è libero da liberare:** `view.toggle-toc` è **di fatto morto** — la sidebar v2 (`sideBar/index.vue:33`) renderizza solo `<side-bar-search/>`, `sideBar/toc.vue` NON è montato da nessuna parte (orfano post-T4A); l'action `showTableOfContents` (`menu/actions/view.js:63`) imposta `rightColumn='toc'` che nessuno disegna → no-op. Azzerare l'accelerator `'view.toggle-toc' → ''` nelle 3 mappe (`keybindingsWindows.js:101`, `Linux:102`, `Darwin:98`), **lasciando** la voce comando/menu (mai rimuovere l'oggetto).
- **Prerequisito duro: T-M1** (`MEDIUM-TASK.md` §T-M1, "mode CM per estensione", foundational). Senza, `sourceCode.vue:718` forza `mode='markdown'` per tutti → commento sempre `<!-- -->`. T-M1 = helper `setModeForFile(cm, filename)` in `codeMirror/index.js` (riusa `mode/meta`+`loadmode` già presenti) al posto della riga 718 + in `handleFileChange`. Decisione T-M1 già LOCKED ("sì, riusando l'infrastruttura CM").
- **Implementazione H3:** `import 'codemirror/addon/comment/comment'`; handler che iterano `cm.listSelections()` e applicano `lineComment`/`uncomment` a ogni range; fallback `blockComment` se il mode non ha line-comment (leggere `cm.getModeAt(pos).lineComment`, niente euristiche sul contenuto); binding in `extraKeys` `'Ctrl-K C'`/`'Ctrl-K U'`. Solo source (in Muya l'addon non agisce). Conviene agganciare **T-M2** (`Ctrl+/` toggleComment, stesso addon, già pianificato).

---

### 🔖 STATO (2026-07-04) — esiti test utente

- ✅ ✔️ **BUG-H5-EMPTYWIN** e **H5-RE-BUG1** (ri-drag omonime) risolti e confermati. **H5-RE** chiuso.
- ✅ ✔️ **H3** (Ctrl+K C/U commenti per linguaggio) fatto e confermato.
- ✔️ **BUG-CP2** chiuso: ramo A, duplicato di BUG-MUYA-HEADING-DNA (cursore prima del simbolo di blocco, qualunque riga; no fix per decisione A).
- ✅ ✔️ **B-REV5** testato: hard-break ok sui file source, sui `.md` no → accettato come limite.
- ✅ ✔️ **BUG-H5-UNTITLED — RISOLTO e verificato runtime dall'utente (2026-07-04: "funziona ottimo").** Fix: counter globale monotono nel main (`_untitledIdSeq` in `app/index.js` + handler invoke `mt::next-untitled-index` + bump passivo da session-save/restore/detach); renderer `NEW_UNTITLED_TAB` async chiede N al main con fallback locale (`getLocalUntitledMax` estratto in `help.js`, `getBlankFileState` con param `forcedNumber`). Decisione utente: comportamento MONOTONO (numeri liberati non riusati finché l'app è aperta). Plan+worklog: `docs/Ai/InProgress/untitled-counter-globale/`. ⚠️ MAIN toccato → riavviare `npm run dev`. Test: scenari 1-4 nel plan (detach file salvato → Untitled continua dal max; bidirezionale tra finestre; restore da sessione; monotono).

---

## STATO TASK (aggiornato ad ogni task completato)

Legenda stato: ⬜ da fare · 🔧 in corso · ✅ fatto (codice) · 🧪 da testare a runtime · ⏸️ bloccato (serve decisione/verifica runtime) · ❌ scartato · ✔️ già ok (nessun lavoro)

**Completamento PESATO: 104 / 132 pt (≈79%)** — aggiornato 2026-07-04: +H3 fatto (3 pt); CP2 chiuso come duplicato HEADING-DNA → escluso dal peso (totale 135→132). Restano solo minori ⏸️ (BUILD-1, B-REV11, M-REV10) + spot-check 🧪. Dato precedente: 101/135 pt (≈75%). — peso per sforzo (1 pt ≈ 0,8% del totale; colonna *Peso* in tabella, somma attiva = 135 pt). Conteggio semplice task: 39/54 (72%). Aggiornato 2026-06-26 (H5-B + H5-1 + H5-2 + H5-RE codice fatto, 18 pt). Prima 2026-06-25 (+H5-B aggiunto), 2026-06-20 (sessione 2). Escludono dal peso H6 (scartato), H7/R6/R8/R9/R10/S-REV1/M-REV14 (note o già ok), R3 (= P-REV3) e DESIGN-HISTORY-SPLIT (= H8) per non doppiare. H8 (undo unificato) ✅ verificato runtime 2026-06-15. **Legenda pesi + validazione decisioni sul codice: blocco sotto la tabella (2026-06-20).**

> Stato `✅ ✔️` = codice fatto **e verificato runtime OK** · `✅ 🧪` = codice fatto, verifica runtime puntuale non ancora fatta (vedi sezione TESTING).

| ID | Task | Stato | Peso |
|----|------|-------|------|
| BUG-1 | Fix wrap tab bar (§1) | ✔️ già ok (verificato nel codice: while loop `row1Count>1` presente, PLUS_W rimosso) | 2 · 1,6% |
| H1 | Multi-selez additiva Ctrl (source) | ✅ 🧪 (ctrlHeld + beforeSelectionChange + Esc + Ctrl+D guard) | 5 · 4,0% |
| H2-a | Snapshot storage userData | ✅ ✔️ (2026-06-21, verificato utente, OPUS — NPP-style: `<userData>/backup/` + `session.json` indice + `<id>.snapshot` per-tab; scrittura atomica; backup periodico ogni N**secondi** gated su `contentVersion`; path+intervallo configurabili) | 8 · 6,4% |
| H2-b | Session restore | ✅ ✔️ (2026-06-21, verificato utente — restore al boot di TUTTE le tab: untitled vuote/con contenuto, file esterni dirty, file salvati ri-letti da disco; file sparito → Untitled+notifica) | 8 · 6,4% |
| H2-c | Chiusura silenziosa finestra | ✅ ✔️ (2026-06-21, verificato utente — **REVISIONE decisione utente: default ON** stile Notepad++, niente popup; solo finestra owner; crash-safe via backup periodico) | 3 · 2,4% |
| H3 | Ctrl+K C/U commenta (source) | ✅ ✔️ (confermato utente 2026-07-04) | 3 · 2,4% |
| H4 | Pin tab | ✅ 🧪 (pinned in help.js + TOGGLE_PIN_TAB + close protection + zone clamp + dragula accepts + CSS + i18n) — **revisione cosmetica 2026-06-20**: icona ⊞ → puntina SVG; sfondo "in rilievo" + accento verticale SULLA tab pinnata; rimosso il bordo-sliver sulla vicina (era fuorviante, sembrava un indicatore pin). Logica ordine/drag/menu Pin↔Unpin già corrette (confermato leggendo il codice). | 5 · 4,0% |
| H5-B | Sessione multi-finestra-aware (PREREQ detach; piano completo §H5 "🅱️ PIANO IMPLEMENTATIVO B") | ✅ 🧪 (2026-06-26, OPUS — 3 file; registro per-finestra + merge serializzato + snapshot namespacato; da testare B1-B7) | 5 · 4,0% |
| H5-1 | Detach via context menu | ✅ 🧪 (2026-06-26, OPUS — voce "Move to New Window" + `mt::detach-tab` → `_createDetachWindow` riusa il flusso restore (saved/untitled/dirty uniforme) → ack `mt::detach-tab-ack` chiude la tab sorgente) | 5 · 4,0% |
| H5-2 | Detach via drag-out | ✅ 🧪 (2026-06-26, OPUS — dragula `drag`/`dragend` + `mousemove` screen-pos; `revertOnSpill` → drop fuori finestra → `DETACH_TAB` in setTimeout(0)) | 5 · 4,0% |
| H5-RE | Re-attach: drag tab in finestra esistente alla posizione del drop | ✅ ✔️ (confermato utente 2026-07-04; ri-drag omonime risolto; bring-to-front + anteprima migrati in `DRAG-TASK.md`) | 3 · 2,4% |
| H5-3 | Ghost window | ❌ rimandato | — |
| H8 | Undo/redo unificato Muya↔source (opzione B) | ✅ ✔️ (verificato runtime 2026-06-15; 6 file. Iterazione bug runtime → sezione TESTING Batch H8) | 8 · 6,4% |
| H6 | Undo persistente | ❌ scartato | — |
| H7 | Numeri di riga | ✔️ già ok | — |
| R1 | Muya undo depth dinamico | ✅ 🧪 (UNDO_DEPTH 500→100 in muya/lib/config/index.js) | 2 · 1,6% |
| R2 | ~~Cap LRU cmStatePerTab~~ + undoDepth 1000 | 🔄 **RIVISTO 2026-06-20 (decisione utente)**: cap LRU **RIMOSSO** — tutte le tab della sessione mantengono la history undo; snapshot eliminato solo a chiusura tab. `undoDepth:1000` resta. ⬜ Da aggiungere: avviso perf "troppe tab" (vedi ITEM-PERF-WARN). | 2 · 1,6% |
| R3 | Debounce content-watcher sidebar | ✅ ✔️ (= P-REV3) | — (in P-REV3) |
| R4 | Degradare opzioni CM file enormi | ✅ ✔️ (setOption highlightSelectionMatches/styleActiveLine se >10MB in sourceCode.vue) — **verificato utente 2026-06-20: file 480k righe / 16MB → lag accettabile.** | 2 · 1,6% |
| R5 | Clamp minWidth a workArea | ✅ 🧪 (Math.min(820, workArea.width) in windows/editor.js) | 1 · 0,8% |
| R6 | Smoke test mac/Linux/DPI | ✔️ solo test | — |
| R7 | Write atomico (temp+rename) | ✅ 🧪 (outputFile→.tmp+move in filesystem/index.js) | 2 · 1,6% |
| R8 | Watcher cloud/rete | ✔️ già ok | — |
| R9 | Encoding/EOL edge | ✔️ doc | — |
| R10 | Minori | ✔️ nessuna azione | — |
| BUILD-1 | patch-package setup | ⏸️ (serve npm) | 1 · 0,8% |
| B-REV1 | Regex `[\r?\n]` ×2 | ✅ ✔️ | 1 · 0,8% |
| B-REV2 | final-newline isSaved=false | ✅ ✔️ | 1 · 0,8% |
| B-REV3 | pre-save nei 3 path chiusura | ✅ 🧪 | 2 · 1,6% |
| B-REV4 | guard-order editor.vue | ✅ 🧪 | 1 · 0,8% |
| B-REV5 | hard-break vs lightTouch | ✅ ✔️ (testato utente 2026-07-04: hard-break 2 spazi preservato sui file source; sui file .md no — **accettato come limite**, nessun altro fix) | 2 · 1,6% |
| B-REV6 | baseline Save As | ✅ ✔️ | 2 · 1,6% |
| B-REV7 | filtro Save All | ✅ 🧪 (allineato a `!file.isSaved` in store/editor.js) | 1 · 0,8% |
| B-REV8 | Untitled-NaN guard | ✅ 🧪 | 1 · 0,8% |
| B-REV9 | chiusura su save fallito | ✅ ✔️ | 3 · 2,4% |
| B-REV10 | extend() guard rangeCount | ✅ 🧪 | 1 · 0,8% |
| B-REV11 | accelerator duplicati | ⏸️ (serve runtime R-6) | 1 · 0,8% |
| B-REV12 | race fileChangedDialog | ✅ ✔️ | 2 · 1,6% |
| BUG-CTRLZ | Ctrl+Z cross-tab (setValue non azzera undo) | ✅ ✔️ (switch + forceReload) | 2 · 1,6% |
| BUG-WINCLOSE | X custom finestra scartava modifiche (forceClose) | ✅ ✔️ | 2 · 1,6% |
| BUG-MUYA-INPUT | Muya cursore stale → getBlock null (sistemico, 3 siti) | ✅ ✔️ (3/3 guard, #1 testato) | 3 · 2,4% |
| BUG-MUYA-UNDO-SWITCH | Ctrl+Z post-switch: stati history fantasma (key nuove) | ✅ 🧪 (fix core noHistory) | 2 · 1,6% |
| BUG-MUYA-HEADING-DNA | 1ª riga heading come testo dopo switch (cursor-DNA `ch=0`) | ✔️ (opzione A: cosmetico, documentato, no fix) | — |
| BUG-CP1 | Inserimento markdown reale in source da palette/menu (§7.14) | ✅ 🧪 (handleParagraphInSource + handleFormatInSource espanso — heading/list/blockquote/block + strong/em/u/mark/etc. Selection-aware per del/link: selezione→formato, cursore→line-op legacy) | 5 · 4,0% |
| BUG-CP2 | Switch source↔Muya non ri-renderizza md inserito via palette (§7.15) | ✔️ chiuso 2026-07-04 — repro utente = **ramo A**: duplicato di BUG-MUYA-HEADING-DNA (decisione A, no fix). Dettaglio repro: accade solo se il cursore è subito PRIMA del simbolo di blocco (es. prima di `#`), su **qualunque riga** (non solo la prima); tornando in source, spostando il cursore altrove e rifacendo lo switch, la riga torna renderizzata | — (duplicato HEADING-DNA) |
| BUG-CP1b | Comando "Table" in source apriva ANCHE il dialog Muya (handleEditParagraph senza guard source) | ✅ ✔️ (guard `if (sourceCode.value) return` in editor.vue:902) | 1 · 0,8% |
| BUG-SAVE-UNLINK | Salvataggio → barra arancio "removed from disk" + bollino dirty (effetto collaterale R7: rename atomico → chokidar 'unlink') | ✅ 🧪 (watcher.js: handler 'unlink' ora fa peek `_isPendingIgnore` e sopprime il falso unlink durante la finestra di ignore del save) | 2 · 1,6% |
| ITEM-PERF-WARN | Avviso "troppe tab → possibile lag, chiudine alcune" (sostituisce il cap LRU rimosso in R2) | ✅ 🧪 (nuovo `perfWarningDialog.vue`, stile = `fileChangedDialog.vue`; soglia 15 poi +10; watch su `tabs.length`; testi con default inline anti-chiave-grezza) | 2 · 1,6% |
| DESIGN-HISTORY-SPLIT | undo non condiviso Muya↔source (2 engine separati) | ✅ risolto da H8 (opzione B, verificato 2026-06-15) | — (in H8) |
| P-REV1 | size-guard LCS | ✅ ✔️ | 2 · 1,6% |
| P-REV2 | changeGeneration cursorActivity | ✅ 🧪 (lastChangeGen gate in listenChange — skip getValue/wordCount/N12 su puro movimento cursore) | 3 · 2,4% |
| P-REV3 | contentVersion sidebar | ✅ ✔️ (= R3) | 3 · 2,4% |
| P-REV4 | onInput no doppia search | ✅ ✔️ | 1 · 0,8% |
| P-REV5 | cap risultati ricerca | ✅ 🧪 (MAX_MATCHES_PER_TAB=500, MAX_MATCHES_TOTAL=2000 in search.vue + MAX_MARKS=1000 in sourceCode.vue) | 2 · 1,6% |
| M-REV1 | byte NUL search.vue | ✅ (rimosso, assorbito P-REV3) | 1 · 0,8% |
| M-REV2 | pinnedTab triplicato | ✅ 🧪 (watcher currentFile.id + hasMultiRow → chiamano recomputePinnedTab(); selector aggiornato a :not(.v2-tab-pinned)) | 2 · 1,6% |
| M-REV3 | restore snapshot CM dup | ✅ 🧪 (helper restoreCmStateForTab in sourceCode.vue — 2 siti → 1 funzione condivisa) | 2 · 1,6% |
| M-REV4 | normalizeMarkdown dup | ✅ 🧪 (adjustTrailingNewlines esportata da util/index.js; private copies rimosse da editor.js + sourceCode.vue) | 1 · 0,8% |
| M-REV5 | ~35 watcher fotocopia | ✅ 🧪 (SIMPLE_OPTION_WATCHERS table+loop in editor.vue — 19 watcher → 1 ciclo) | 3 · 2,4% |
| M-REV6 | typo LINTEN_FOR_* | ✅ 🧪 (rinomina store/editor.js + app.vue) | 1 · 0,8% |
| M-REV7 | shape tab implicita | ✅ 🧪 (justLoaded+pendingExternalChange in help.js) | 1 · 0,8% |
| M-REV8 | regex `/[-_]/g` | ✅ 🧪 | 1 · 0,8% |
| M-REV9 | due watch showSideBar | ✅ 🧪 (unificati in un solo watch in search.vue) | 1 · 0,8% |
| M-REV10 | resyncDomToStore ridondante | ⏸️ (serve test drag) | 2 · 1,6% |
| M-REV11 | canToggleMode usa isMarkdownPath | ✅ 🧪 | 1 · 0,8% |
| M-REV12 | i18n status bar | ✅ 🧪 (en.json + 3 stringhe + ENC_GROUPS computed in statusBar/index.vue) | 2 · 1,6% |
| M-REV13 | isCollapsed morto | ✅ 🧪 (rimosso da searchResultItem.vue) | 1 · 0,8% |
| M-REV14 | Muya montato dietro CM | ✔️ nota | — |
| S-REV1 | contextIsolation | ✔️ nota (fuori scopo) | — |

### Pesi & validazione decisioni (2026-06-20)

**Pesi (peso per sforzo, story-point 1/2/3/5/8 → % sul totale a 1 pt ≈ 0,8%):**
- Totale attivo = **135 pt** · Fatto (✅/✅🧪) = **101 pt (≈75%)** · Da fare (⬜/⏸️) = **34 pt (≈25%)** (H5-B + H5-1 + H5-2 + H5-RE fatti 2026-06-26; restano H3 3pt bloccato, BUG-CP2, vari ⏸️ da test runtime).
- Esclusi dal peso (—): scartati (❌), già-ok/note (✔️), e i duplicati di lavoro R3 (= P-REV3) e DESIGN-HISTORY-SPLIT (= H8).
- Il numero pesato (32%) è < del conteggio task (42%) perché i pezzi pesanti — H1, H2-a/b, H4, H5-1/2 — sono ancora aperti.

**Decisioni §4 validate LEGGENDO il codice (non più solo dalle descrizioni del file):**
- **B-REV5** ✅ confermato: `normalizeBlock` (`store/editor.js:1717`) toglie i trailing space (`/[ \t]+$/gm`) → **mangia l'hard-break a 2 spazi**; `getMarkdownForSave:1893` su normalizzati uguali → `return originalMarkdown` → la modifica solo-whitespace **non viene scritta**. Consiglio: fix sentinella in `normalizeBlock` (preserva ` {2,}$`). Resta decisione utente (fix vs documentare).
- **B-REV7** ✅ confermato: filtro `ASK_FOR_SAVE_ALL:588` = `!(file.isSaved && /[^\n]/.test(file.markdown))` include le tab **salvate-ma-vuote** tra gli unsaved; `LISTEN_FOR_CLOSE:544` usa il pulito `!file.isSaved`. Consiglio: allineare a `!file.isSaved`.
- **H1** ⚠️ consiglio RAFFINATO dal codice: solo **Ctrl+D duplica** (`sourceCode.vue:425`, usa `getCursor('from'/'to')` = solo primaria) va guardato con multi-selez; **Ctrl+L** (`deleteLine`, :442) e **Alt+↑/↓** (`swapLineUp/Down`, :721) sono **già multi-selezione-aware** → niente guard.
- **H4** ✅ design valido: nessun concetto `pinned` nel codice oggi; `CLOSE_OTHER_TABS` (`tabs.vue:284`) chiuderebbe tutto → con H4 servirà un filtro pinned solo se si vuole protezione.
- **B-REV11** invariato: duplicati già grep-verificati; il "chi vince" è solo runtime (R-6).

**Decisioni utente LOCKED (2026-06-20) — non richiedere di nuovo:**
- **B-REV5** → **FIXARE** (sentinella hard-break in `normalizeBlock`).
- **B-REV7** → **allineare a `!file.isSaved`**.
- **H2-c** → **dietro preferenza, default OFF** finché testato; poi ON.
- **H1** → guard multi-selez SOLO su Ctrl+D (duplica); Ctrl+L e Alt+↑/↓ già ok.
- **H4 close-others** → **pinnate PROTETTE**: "Chiudi altre"/"Chiudi tutte" NON chiudono le tab pinnate
  (si chiudono solo singolarmente). Serve filtrare le pinnate in `CLOSE_OTHER_TABS`/`CLOSE_ALL_TABS` (`store/editor.js`).
- **BUG-CP1** → **fix (B)**: inserimento markdown reale in source via CodeMirror; root cause verificata
  (routing bus incompleto + collisione `del`/`link`). Conviene farlo insieme/dopo H3 (stessa infrastruttura CM insert).

**🔶 OPUS-only:** H2-a, H2-b, H2-c, H5-1, H5-2 = rischiosi → li implementa Opus, **per ultimi**. Sonnet
NON deve scriverli; deve solo lasciarli pronti (architettura già in §2). A contesto pulito Opus riparte da §2 + §H2/§H5.

**🟢 Eseguibili da Sonnet 4.6 a sessione pulita** (dopo le decisioni sopra): tutti i micro-fix §7, BUILD-1,
BUG-1, R1/R2/R4/R5/R7, P-REV2/P-REV5, M-REV2/3/4/5/6/7/9/12/13, B-REV5/B-REV7, H1, H4,
BUG-CP1 (fix B, feature media — meglio dopo/insieme a H3).
**⛔ NON Sonnet:** H2-a/b/c, H5-1/2 (🔶 Opus). **⛔ Prima investigare a runtime:** BUG-CP2 (probabile duplicato
di HEADING-DNA). **Dipendenza esterna (permesso a leggere):** H3 → `MEDIUM-TASK.md` (T-M1);
H4 → `MEDIUM-TASK.md` (§7 + T-M6); BUG-CP1 fix B si appoggia all'infrastruttura CM-insert di H3.

---

## TESTING (popolato ad ogni task completato)

> Per ogni task chiuso qui sotto: cosa testare a runtime. Vuoto finché non parte l'implementazione.

### Batch A (micro-fix) — da testare con `npm run dev`

**ESITO (verificato dall'utente 2026-06-13):**
- ✔️ **B-REV1** — file `?` senza newline finale: salvato/riaperto, il `?` resta. Console pulita. **OK.**
- ✔️ **B-REV6** — dialog Save As è modale (non si edita mentre è aperto → quella race non scatta); Annulla = tab resta dirty, bollino coerente. **OK.**
- ✔️ **B-REV2** — cambio opzione final-newline su tab dirty: bollino resta acceso; Ctrl+Z non lo spegne (è opzione, non testo); ritorno al valore originale non spegne (dirty sticky, coerente con line-ending/encoding); si spegne solo con `Ctrl+S`. **Comportamento corretto e voluto. OK.**
- 🧪 **B-REV4 / B-REV8 / B-REV10 / M-REV8 / M-REV11** — codice completo, basso rischio, non esercitati singolarmente a runtime (spot-check consigliato ma non bloccante).

⚠️ **B-REV10 tocca Muya** (`arrowCtrl.js`) → niente hot reload, **riavviare `npm run dev`** prima di testarlo.

- **B-REV1** — Crea `nota.md` con contenuto `Da fare?` **senza newline finale**. Apri in MarkText, modifica una parola, `Ctrl+S`. Riapri il file fuori da MarkText → il `?` finale **deve esserci** (pre-fix spariva). Verifica anche: digitando `?` a fine doc il bollino dirty si accende.
- **B-REV2** — Tab con modifiche non salvate (bollino acceso). Dalla status bar cambia l'opzione final-newline → il bollino **deve restare acceso** (pre-fix si spegneva).
- **B-REV4** — Cambia tab/modalità (Muya↔source) rapidamente più volte → nessun `TypeError` su `editor.value` null nella console DevTools (fix difensivo).
- **B-REV6** — (a) `Save As` su untitled: mentre il dialog è aperto edita il testo, poi conferma → la baseline è il contenuto scritto, il bollino riflette il vero stato. (b) Apri `Save As` e **Annulla** → la tab resta dirty (bollino acceso), nessun falso "salvato".
- **B-REV8** — Apri più untitled (incluso uno il cui nome non finisce con `-N`) → la numerazione "Untitled-N" resta corretta, mai "Untitled-NaN".
- **B-REV10** — In Muya, posiziona il cursore senza selezione attiva e premi `Ctrl+Shift+↑/↓` → nessun crash/eccezione (estende la selezione al blocco).
- **M-REV8** — (basso impatto) Apri un file con encoding non-UTF8 rilevato via `ced` → encoding corretto in status bar (il fix corregge nomi tipo `x-mac-…`).
- **M-REV11** — File `.md` o untitled → bottone "Source" della status bar **attivo**; file `.txt`/`.js` → **disabilitato** (come prima). Comportamento identico al pre-fix, ma ora guidato da `isMarkdownPath`.

### Batch B (perdita dati / freeze) — da testare con `npm run dev`

⚠️ **B-REV9 tocca il MAIN process** (`menu/actions/file.js`) → niente hot reload, **riavviare `npm run dev`**. Gli altri sono renderer (hot reload, ma fai full reload se serve).

- **B-REV3** (pre-save 3 path) — In **source mode** digita testo e **chiudi la finestra entro 1 secondo** → "Salva" → riapri: le ultime battute devono esserci (pre-fix: perse). Ripeti per: (a) X finestra, (b) `Ctrl+W` su tab dirty → "Salva", (c) "Save All".
- **B-REV9** (save fallito) — Apri un file, rendilo **sola lettura** da Esplora risorse (Proprietà → Sola lettura), modificalo in MarkText, chiudi la finestra → "Salva" → **dialog di errore + finestra resta aperta** (pre-fix: si chiudeva e le modifiche andavano perse). Premendo "Close" la finestra si chiude comunque.
- **P-REV1** (LCS guard) — File **molto grande** (>3000 righe totali), modifica una riga, `Ctrl+S` con lightTouch ON → nessun freeze (salva il rigenerato). Su file piccoli il formato resta preservato come prima.
- **P-REV3 / R3** (contentVersion + debounce) — Sidebar ricerca aperta con keyword attiva + molte tab / file grande → modifica un documento: i risultati si aggiornano **live con ~250ms di debounce**, niente lag pesante per battito. Verifica che la live-search funzioni ancora (modifica doc → lista aggiornata).
- **P-REV4** (no doppia search) — Digita nell'input ricerca sidebar → cerca correttamente, comportamento invariato (internamente niente doppia esecuzione).
- **B-REV12** (race dialog) — File aperto: da un'altra app salvalo **2 volte a ~200ms di distanza subito dopo** aver chiuso il dialog di reload → il **secondo dialog non deve auto-chiudersi**.
- **M-REV1** (byte NUL) — Verifica tecnica: `search.vue` non è più trattato come binario da grep/diff (il byte NUL è stato rimosso). Niente da testare a runtime.

**ESITO Batch B (verificato dall'utente 2026-06-13):**
- ✔️ **B-REV12** — il dialog reload riappare a ogni modifica esterna non applicata, si annulla solo con Cancel. **OK.**
- ✔️ **P-REV3 / R3 / P-REV4** — live search + input funzionano. **OK.**
- ✔️ **P-REV1** — file da 60k righe: il **salvataggio NON lagga** (modifica + Ctrl+S immediato). **OK.** Il lag di scroll/scrittura del documento stesso + 38k match accumulati in sidebar = **R4** (degrade CM), **P-REV5** (cap risultati), **T-M6** (auto-source file grandi) → ancora da fare, NON regressione.
- 🧪 **B-REV3** — non distinguibile a mano (finestra <1s impraticabile; a velocità normale il debounce 1s ha già committato il contenuto). Fix corretto by-construction (guard `pre-save`). Il "non salvato" osservato chiudendo = chiusura **senza confermare "Salva"** (atteso). Da considerare OK salvo prova contraria.
- ⚠️ **B-REV9 — era BLOCCATO da BUG-WINCLOSE (vedi sotto).** Il riquadro rosso `EPERM` con la x è il path **manuale** (`Ctrl+S` → `mt::tab-save-failure`), già esistente e corretto. B-REV9 è il path **chiusura finestra**, che però era irraggiungibile: la X custom faceva forceClose silenzioso. Risolto BUG-WINCLOSE → ora ritestabile: file sola-lettura → modifica → **chiudi la FINESTRA** → "Save" → **dialog Close/Keep open**, finestra resta aperta.

**BUG-WINCLOSE — la X della titlebar custom scartava le modifiche non salvate (perdita dati, scoperto in test):**
- Sintomo: chiudendo la **finestra** (X custom) con una tab **dirty**, nessun dialog "salvare?" → finestra si chiude e app esce, modifiche perse. Il dialog compariva solo chiudendo la **tab**.
- Root cause (`tabs.vue:340` `winClose`): mandava `mt::close-window` → `windowManager.forceClose(win)` = chiusura immediata, **bypassa** `win.on('close')` → `ask-for-close` → `LISTEN_FOR_CLOSE` → dialog. Il flusso save-confirm partiva solo dalla X **nativa** (Alt+F4). Rendeva anche B-REV9 irraggiungibile.
- Fix: `winClose` → `mt::cmd-close-window` (`win.close()` → innesca `win.on('close')` → stesso flusso save-confirm della X nativa).
- Test: tab dirty → **X della finestra** → deve apparire il dialog **Save / Don't Save / Cancel**; "Save" salva e chiude, "Don't Save" chiude scartando, "Cancel" annulla.

**BUG-MUYA-INPUT — cursore stale Muya → `getBlock` null → null-deref (SISTEMICO, 3 siti distinti):**
- Sintomo: dopo switch rapidi Muya↔source + click/scrittura veloce in Muya (e su `Ctrl+Z`) → eccezioni renderer `TypeError: Cannot read properties of null`.
- **Famiglia unica di root cause**: una `key` di cursore (da selezione DOM o snapshot history) punta a un blocco **non più esistente** (desync DOM/content-state dopo rebuild/`setMarkdown` al cambio modalità, o snapshot undo incoerente) → `this.getBlock(key)` → `null` → deref `.text`/`.parent` su null. **3 funzioni diverse fanno questo deref**, perciò serve un guard in ognuna (un solo guard NON basta):

  | # | File:riga | Deref che crasha | Trigger | Stato |
  |---|-----------|------------------|---------|-------|
  | 1 | `inputCtrl.js:108→116` | `block.text` (`block=getBlock(start.key)`) | scrittura in Muya | ✅ guard `if(!block)return` applicato |
  | 2 | `updateCtrl.js:27/33` | `startBlock.text`/`endBlock.text` in `checkNeedRender` (`getBlock(cStart.key/cEnd.key)`) | chiamato da `inputCtrl.js:389` durante lo stesso input | ✅ guard `if(!startBlock||!endBlock)return false` applicato |
  | 3 | `index.js:628` | `block.parent` in `findOutMostBlock` (block null da `setNextRenderRange`, `getBlock(start.key)`/`end.key`) | path **undo** `history.js:23 → render → setNextRenderRange:223` | ✅ guard `if(!startBlock||!endBlock){renderRange=[null,null];return}` applicato |

- **Perché il guard #1 non copre #2 e #3**: `checkNeedRender` ri-legge `this.cursor` e richiama `getBlock` per conto suo (key `cStart/cEnd`, può differire da `start`); `setNextRenderRange` gira sul path undo (non passa da `inputHandler`). Stessa malattia, tre punti di sangue.
- **INCONGRUENZA nei log inviati = NESSUNA, è runtime stale**: la traccia `inputCtrl.js:116` (deref `.text`) è **esattamente** il bug già fixato dal guard #1 — riappare solo perché **Muya non ha hot reload e `npm run dev` non era stato riavviato** dopo l'edit. Le altre due tracce (`updateCtrl.js:33`, `index.js:628`) sono siti **nuovi e distinti**, non coperti dal guard #1.
- **NON è regressione di questa sessione**: i fix Batch A su Muya erano in `arrowCtrl.js`; fragilità Muya pre-esistente esposta dai test rapidi.
- Fix proposti (stesso pattern difensivo del guard #1, scartano l'azione stale):
  - #2 `checkNeedRender`: `if (!startBlock || !endBlock) return false` prima dei due `tokenizer(...)`.
  - #3 `setNextRenderRange`: `if (!startBlock || !endBlock) { this.renderRange = [null, null]; return }` → fallback = full render ([null,null] è il default di init, `index.js:89`, sicuro).
- ⚠️ Tutti file Muya → **restart `npm run dev`** (no hot reload) prima di ritestare.
- Test: alterna Muya↔source rapidamente + click/scrittura ripetuta; poi `Ctrl+Z` ripetuti dopo gli switch → nessun crash in console. (Difficile da forzare: dipende dal timing del desync.)
- **ESITO test utente (2026-06-14): #1 (scrittura) OK, nessun crash.** #3 (undo) non crasha più → ma sono emersi 2 comportamenti pre-esistenti prima mascherati dal crash → vedi BUG-MUYA-UNDO-SWITCH e BUG-MUYA-HEADING-DNA.

**BUG-MUYA-UNDO-SWITCH — dopo switch Muya↔source i primi Ctrl+Z "non fanno nulla" (history fantasma):**
- Sintomo (utente): fatti più switch Muya↔source, i primi N `Ctrl+Z` non annullano nulla di visibile; dopo qualche pressione iniziano gli undo "veri".
- Root cause (verificata, `contentState/index.js:163-170`, setter `cursor`): quando si setta il cursore, se `prevCursor.start.key !== cursor.start.key` → `history.push` **immediato**. Ogni switch source→Muya passa per `setMarkdown` → `importMarkdown` **ricostruisce i blocchi con key NUOVE** → la key del cursore differisce SEMPRE da `prevCursor` → push di uno **stato fantasma** (contenuto identico, solo key diverse) ad ogni switch. N switch = N stati fantasma in cima allo stack → i primi `Ctrl+Z` li consumano senza differenza visibile, poi raggiungono l'edit reale.
- **Pre-esistente, NON regressione**: il push fantasma c'è da sempre; prima era **mascherato** perché `Ctrl+Z` dopo switch crashava (sito #3) prima di mostrare il comportamento. Il guard #3 ha tolto il crash → ora il fantasma è visibile.
- `importCursor` (`utils/importMarkdown.js:611`, `this.cursor = cursor`) è l'**unico** chiamante che applica il cursore dopo un import (chiamato solo da `setMarkdown`, `index.js:220`).
- **Fix APPLICATA (core, ~1 riga)**: in `importCursor` (`utils/importMarkdown.js`), prima di `this.cursor = cursor`, `cursor.noHistory = true` → set di cursore "programmatico" (load/switch/tab-change) non crea più checkpoint. `prevCursor`/`currentCursor` si aggiornano comunque (righe 151-152, fuori dal check) → il primo edit utente reale pusha normalmente. Flag verificato: `Cursor` ctor lo conserva (`selection/cursor.js:5,42`) — è lo STESSO flag che usa `undo`.
- **Rischio ri-valutato BASSO** (non medio): `importCursor` ha un solo chiamante (`setMarkdown`); la digitazione normale NON passa di lì → undo/redo in editing normale intatto. Alternativa non-core scartata (get/setHistory in editor.vue: più fragile, coupling con interni history Muya).
- ⚠️ File Muya → **restart `npm run dev`**. Test runtime: vedi sezione TESTING.

**BUG-MUYA-HEADING-DNA — tornando in Muya la 1ª riga heading appare come testo finché non si digita:**
- Sintomo (utente, riproducibile su untitled): scrivi `# ciao`, vai in source, torna in Muya → `# ciao` appare come **testo semplice** (non H1); alla prima lettera digitata torna H1. Una 2ª riga `# ciao2` non ha il problema — solo la riga dov'è il cursore.
- Root cause (verificata): switch source→Muya passa `muyaIndexCursor` → `setMarkdown` chiama `addCursorToMarkdown` (`utils/importMarkdown.js:523`) che **inserisce stringhe-marcatore `CURSOR_*_DNA` nel markdown grezzo PRIMA del parsing** per localizzare il cursore. Se il cursore è a inizio riga (`ch=0`) di una riga heading, il DNA viene anteposto: `<DNA># ciao` → il `# ` **non è più a inizio riga** → il parser lo classifica come **paragrafo**, non heading. `convertMuyaIndexCursortoCursor` poi rimuove il DNA dal testo, lasciando `# ciao`, ma il tipo blocco è già "paragrafo". Digitando → `checkInlineUpdate` riconosce `# ` → converte in heading (H1 ricompare).
- Solo la riga del cursore è colpita (DNA inserito solo su `anchor.line`/`focus.line`). Vale per qualsiasi sintassi di blocco a inizio riga (heading, `>`, liste).
- **Pre-esistente, NON regressione**: bug Muya storico del meccanismo cursor-DNA, indipendente dai guard di questa sessione. **Contenuto NON corrotto**: `getMarkdown` legge `block.text = "# ciao"` sia da paragrafo sia da heading → salvataggio corretto. È puramente visivo e si auto-corregge alla prima digitazione.
- Fix possibili (per gravità/rischio):
  - (A) **Documentare come minore** e non toccare: cosmetico, self-healing, fix robusto è invasivo. Più semplice/sicuro.
  - (B) Dopo `setMarkdown` (ramo `muyaIndexCursor`), forzare la ri-riconoscizione block-level del blocco del cursore (riusare `checkInlineUpdate`) → mima la prima digitazione subito. Rischio medio (effetti collaterali su altri tipi di blocco), da verificare.
  - (C) In `addCursorToMarkdown`, gestire `ch=0` su riga con sintassi di blocco inserendo il DNA dopo il marker e correggendo l'offset recuperato → più complesso/fragile. Sconsigliato.
  - Raccomandazione: (A) salvo che l'effetto dia fastidio nell'uso reale → allora (B).
- **DECISIONE utente (2026-06-14): opzione (A)** — documentato come minore, nessun fix applicato (cosmetico, self-healing, contenuto salvato corretto). Se in futuro l'effetto darà fastidio → riconsiderare (B).
- **Osservazione utente 2026-07-04 (da repro CP2):** il bug scatta quando il cursore è posizionato **subito prima del simbolo di blocco** (es. prima di `#`), su qualunque riga, non solo la prima. Workaround: in source spostare il cursore fuori dal simbolo → allo switch la riga torna renderizzata. Conferma la root cause cursor-DNA a `ch=0`. BUG-CP2 chiuso come duplicato di questo bug.

**DESIGN-HISTORY-SPLIT — la history undo NON è condivisa tra Muya e source (architetturale, scoperto in test):**
- Sintomo (utente): scrivi "riga a" in Muya, "riga b" in source → `Ctrl+Z` in source annulla solo "riga b" (non risale agli edit Muya); tornato in Muya, "riga b" non è nella history Muya.
- Causa (verificata): **due editor, due sistemi di undo separati**. Muya = snapshot block-tree (`contentState/history.js`), vive nell'istanza Muya. Source = stack CM5, vive in `cmStatePerTab` (Map per-tab, `sourceCode.vue:11`, restore via `setHistory` a `sourceCode.vue:773`). Lo switch trasferisce **solo il contenuto** (markdown via `getMarkdownAndCursor`/`setMarkdown`/`setValue`), **mai la history**. `sourceCode.vue:864` (source→Muya) passa markdown+cursore, niente history.
- **NON è regressione**: comportamento inerente da sempre; reso più evidente ora che gli stati fantasma (BUG-MUYA-UNDO-SWITCH) sono spariti. La separazione è **voluta** e **rinforzata** da BUG-CTRLZ (`clearHistory` aggiunto apposta per impedire il bleed di history cross-tab/cross-contesto).
- **Tensione di design**: condividere la history tra modalità è in conflitto diretto con l'isolamento appena introdotto per BUG-CTRLZ → un "share" naive può riaprire il bleed cross-tab.
- Opzioni:
  - **(A) Accettare + documentare come limite noto** (standard per editor dual-mode). Rischio zero. Mantiene undo fine-grained dentro ogni modalità (char-level in source, strutturale in Muya).
  - **(B) Undo unificato a livello tab** (nuovo stack di snapshot **markdown** nello store; ogni commit di entrambe le modalità pusha; Ctrl+Z ripristina il markdown nell'editor attivo). Task grande, rischio alto, **degrada** l'undo fine-grained dentro la singola modalità (salti per-commit). Batch a sé.
  - **(C) Bridge solo allo switch** (seed di 1 snapshot pre-switch nell'editor di destinazione) → undo attraversa il confine UNA volta. Valore marginale, ancora messy cross-formato.
- **DECISIONE utente: ⏸️ in attesa.**

**BUG-CTRLZ — Ctrl+Z cross-tab (scoperto in test, root cause individuata):**
- Sintomo: in una tab source, `Ctrl+Z` ripristina il contenuto di un'ALTRA tab (l'utente: in `test9` è ricomparso `ZZZTEST` di `test.txt`).
- Root cause (verificata sul sorgente CM5, `codemirror.js:6238-6244`): **`setValue()` NON azzera l'undo stack** — aggiunge un change `origin:"setValue"` annullabile. Più note del progetto danno per scontato il contrario (`EASY-TASK §104`, `MEDIUM-EASY §37`, `MEDIUM-EASY T5 §94`: "setValue azzera l'undo") → la "history azzerata" promessa **non avveniva mai** → bleed cross-tab e snapshot stale. (Le 3 note sono state corrette nei rispettivi doc.)
- **Fix applicato** (`sourceCode.vue handleFileChange`, ramo tab-switch senza snapshot valido): `editor.value.clearHistory()` dopo il posizionamento cursore. Copre sia tab nuova sia snapshot stale (entrambi `historyToRestore=null`).
- **Test:** edita `test.txt` (source), apri `test9.txt` (source), `Ctrl+Z` → NON deve comparire il contenuto di `test.txt`; l'undo della nuova tab parte vuoto.
- ✅ **forceReload** (stessa root cause): aggiunto `clearHistory()` dopo il `setValue` del ramo forceReload (`sourceCode.vue`). Dopo un reload da disco l'undo riparte pulito (intento doc EASY §104). Test: file aperto in source → modificalo da un'altra app → reload → `Ctrl+Z` non deve tornare al contenuto pre-reload.
- ✅ NOTA: le 3 note errate su `setValue` (`EASY §104`, `MEDIUM-EASY §37`, `MEDIUM-EASY T5 §94`) sono state **corrette** nei rispettivi doc.

### Batch H8 (undo unificato Muya↔source) — ✅ VERIFICATO RUNTIME (2026-06-15)

⚠️ **Tocca Muya core** (`importMarkdown.js`, `lexer.js`) → **restart `npm run dev`** (no hot reload) per quei file. Il resto è renderer (hot reload).

**File (6):**
- NUOVO `src/renderer/src/store/unifiedHistory.js` — Map non-reattiva per-tab: `seedUnified`, `pushUnified(…, origin)`, `unifiedUndo`, `unifiedRedo`, `clearUnified`, `isUnifiedTarget`. Anti-loop su uguaglianza markdown. (Flag `DEBUG=false` + log `[H8]` lasciati come toggle per ridiagnosi futura.)
- `sourceCode.vue` — cattura in `on('change')` (boundary CM via `lastUndoSize`); `handleUndo/Redo` deviati; `handleUnifiedReplay`; seed mount/tab-switch/reload; **flush tail allo switch source→Muya** in onBeforeUnmount (#1); `bus.on/off` simmetrico
- `editor.vue` — cattura in `on('change')` Muya (`lastMuyaIndex`); `handleUndo/Redo` deviati con **flush-tail live+sincrono gated su `dirtySince`**; `handleUnifiedReplay`; flag modulo **`replaying`/`dirtySince`** (push solo su edit utente reale); **flush Muya→source** in `watch(sourceCode)` gated su `dirtySince` (#1); `replaying`-guard in `setMarkdownToEditor`/`handleFileChange`
- `store/editor.js` — `clearUnified` in `FORCE_CLOSE_TAB` e nel ramo reload-da-disco
- `muya/lib/utils/importMarkdown.js` — guard `importCursor` (cursore vuoto≠null → fallback firstBlock); clamp riga/ch in `addCursorToMarkdown` (#2-B); `case 'space'` ricrea paragrafi vuoti (fix C)
- `muya/lib/parser/marked/lexer.js` — token `space` porta `lines` (n° `\n` del gap) per fix C

**ESITO test (T1–T10 verificati via log `[H8]`, poi rimossi): tutti OK.** Cross-modale, granularità parola, redo simmetrico, flush-tail, reload, dirty flag, no-crash: confermati.

**Bug runtime trovati e risolti durante il testing iterativo (root cause comune: Muya `getMarkdown` NON è idempotente — il re-parse normalizza):**

1. **CRASH `getActiveBlocks` reading 'key'** — `convertMuyaIndexCursortoCursor` ritorna `{anchor:null,focus:null}` (cursore su riga vuota/fuori range, marcatori DNA non inseribili); `importCursor` `if(!cursor)` non lo intercetta → `Cursor` con `start/end` undefined → deref. 2° crash `selectionChange reading 'type'` = cascata dello stato corrotto. **Fix:** guard in `importCursor` (no anchor/focus né start/end → fallback firstBlock).
2. **Barriera undo + redo morto in Muya** — il flush-tail leggeva `currentFile.markdown` **stale** (aggiornato async da `dispatchChange`/`setTimeout(0)`) → ri-pushava lo stato vecchio, troncava e inchiodava l'indice. **Fix:** stato live+sincrono (`getMarkdown`/`getMuyaIndexCursor`) + flag `replaying`/`dirtySince` → push solo su edit utente reale (mai sul residuo ri-serializzato di replay/load/switch).
3. **Tail perso allo switch (`gamma`→`g`)** — la cattura source pusha solo ai boundary di parola CM; l'ultima parola senza spazio finale non entrava nello stack. **Fix #1:** flush del contenuto live al confine di switch (source→Muya in onBeforeUnmount; Muya→source in `watch(sourceCode)`).
4. **Cursore a inizio doc dopo undo cross-modale** — `muyaIndexCursor` (line/ch) fuori range dopo normalizzazione → marcatore non inserito → fallback firstBlock. **Fix #2-B:** clamp riga/colonna al range valido (riga vuota = posizione valida).
5. **Righe vuote compattate passando a Muya + tolte al salvataggio** — il lexer scartava il conteggio `\n` (un solo token `space`) e `markdownToState` ignorava `case 'space'`. **Fix C (globale):** `lexer.js` conserva `lines`; `markdownToState` ricrea `(lines-2)/2` paragrafi vuoti **solo a top-level** (no liste/blockquote/code). Round-trip Muya↔source **idempotente**; open/save non rimuove più le righe vuote. Limiti minori: righe vuote a inizio/fine doc ±1; gap dispari da source si normalizzano al pari.
6. **Stack troncato a idx=0 allo switch (redo morto)** — doc Muya vuoto serializza a `"\n"`≠`""` → `muya-switch-flush` non-gated pushava → `splice` azzerava lo stack (es. 35→2). **Fix:** gate `muya-switch-flush` su `dirtySince` (push solo se edit reale).

**Note di design consolidate:**
- `dirtySince`/`replaying` (editor.vue) sono il cuore: l'uguaglianza-markdown da sola NON protegge dai push spuri perché Muya ri-serializza (compatta vuoti, doc vuoto→`"\n"`). Tutti i flush Muya (undo/redo/switch) DEVONO essere gated su `dirtySince`. Il lato source non serve gating (CM `setValue`/`getValue` idempotente).
- Fix C (preservazione righe vuote) è **globale** per scelta: rende parse/serialize fedele e ferma la rimozione silenziosa al salvataggio. ⚠️ eventuali unit test Muya che asseriscono il collasso delle righe vuote ora falliscono (atteso).

**LIMITE NOTO (accettato 2026-06-15) — conteggio righe vuote source↔Muya non 1:1:** un blocco di righe vuote in markdown è *ambiguo* (`riga1\n\n\n\nriga2` = "2 paragrafi distanziati" **o** "riga1 + paragrafo vuoto + riga2" → stessi byte) → nessuna mappa può distinguerli, l'1:1 perfetto è **impossibile** in markdown. Inoltre Muya esporta **2 `\n` per paragrafo vuoto** → la mappa `k=(gap-2)/2` dimezza (3 righe vuote in source → 1 paragrafo vuoto mostrato in Muya). **Nessuna perdita dati:** il round-trip del markdown è preservato (salvando, le 3 righe vuote restano 3 nel file); differisce solo il conteggio *visivo* in Muya. Miglioria possibile ma non risolutiva (export `1 \n`/vuoto + import `k=gap-2` → 3→2, resta −1 per il separatore di paragrafo, e cambia il formato di salvataggio globale) → **scartata**, si accetta il limite.

---

### Sessione 2026-06-20 (rev 2) — feedback runtime utente + fix

**Fatti in questa sessione (renderer = hot reload; `watcher.js` = MAIN → riavviare `npm run dev`):**

- **H4 pinned tabs — revisione cosmetica** (`tabs.vue`): icona `⊞` → **puntina SVG** (`v2-tab-pin`); sfondo "in rilievo" + accento verticale a sinistra (`box-shadow inset 2px` + `--v2-surface2`) **sulla tab pinnata**; rimosso il `border-left` sulla tab *vicina* (`.is-pinned + .v2-tab:not(.is-pinned)`) — era la fonte di tutta la confusione (l'utente lo scambiava per l'indicatore pin e cliccava la tab sbagliata). **La logica era già corretta**: `TOGGLE_PIN_TAB` ordina pinnate-prima, il context menu mostra Pin/Unpin sul tab giusto, il drag-clamp tiene le pinnate in zona. Nessun bug funzionale, solo cosmetico.
  - TEST: pinna 2 tab → entrambe a sinistra con puntina + accento; nessun "spicchio" su tab non pinnate. Right-click tab pinnata → "Unpin Tab" → torna tra le non-pinnate. Drag pinnata → resta tra le pinnate. "Chiudi altre/tutte" non chiude le pinnate.
  - ⚠️ **BUG MINORE NOTO (accettato, non fixato):** all'**unpin** la tab NON ritorna alla sua posizione originale pre-pin — `TOGGLE_PIN_TAB` (`store/editor.js`) la mette in testa alla zona non-pinnata (ordine pinnate-prima, relativo preservato), non dove stava prima del pin. Per ripristinarla servirebbe memorizzare l'indice pre-pin (dato persistente) e gestirne lo spostamento al drag → rimandato. Comportamento attuale = stile VS Code.
- **R2 — cap LRU RIMOSSO** (`sourceCode.vue`): tutte le tab mantengono la history undo per l'intera sessione (decisione utente). Snapshot rimosso solo a chiusura tab.
  - TEST: apri >10 file source, modifica ognuno, switcha avanti/indietro su tutti → `Ctrl+Z` funziona su **ogni** tab (pre-fix: le >10 più vecchie perdevano l'undo).
- **BUG-CP1b** (`editor.vue:902`): guard `if (sourceCode.value) return` in `handleEditParagraph` → comando "Table" in source non apre più il dialog Muya spurio.
  - TEST: source .md → comando **Table** → solo markdown inserito, nessun dialog rows/columns. Muya mode → Table → dialog normale.
- **BUG-SAVE-UNLINK** (`watcher.js`): l'handler `unlink` ora fa peek non-consumante (`_isPendingIgnore`) della lista ignore → sopprime il falso "removed from disk" generato dal rename atomico R7. ⚠️ MAIN process → **riavviare `npm run dev`**.
  - TEST: apri file su disco, modifica, `Ctrl+S` ripetuti veloci → **mai** la barra arancio "[file] has been removed from disk"; il bollino dirty resta spento dopo il salvataggio.
- **ITEM-PERF-WARN — avviso "troppe tab"** (NUOVO componente `perfWarningDialog.vue`, montato in `editorWithTabs/index.vue` accanto a `file-changed-dialog`):
  - **Come è fatto:** stile/animazioni copiate 1:1 da `fileChangedDialog.vue` (classi `fc-*`, `v2dropIn`/`v2fadeIn`, fade-out 220ms) — è il box che l'utente voleva ("stesso del file cambiato dall'esterno"). Bottone singolo OK + ESC/click-fuori per chiudere.
  - **Trigger:** `watch(() => tabs.value.length)`. Soglia: avviso a **15** tab, poi ad ogni **+10** (25, 35, …). Logica a bande: `bandFor(n)` = più grande `15+10k ≤ n`; avvisa solo salendo in una banda nuova (`band > lastWarnLevel`); scendendo sotto si ri-arma (`band < lastWarnLevel`). `watch` NON è `immediate` → all'avvio con molte tab non spamma.
  - **i18n (FIX bug runtime):** la prima versione mostrava le chiavi grezze `store.editor.tooManyTabs*`. Causa: le chiavi sono **solo in `en.json`**; il locale attivo (it) non le ha e il fallback en richiede che i messaggi en in memoria siano aggiornati (caricati da disco via preload all'avvio in `i18n/index.js`) → senza restart completo mancavano. **Fix robusto:** testi con **default inline** nel componente (`t(key, DEFAULT)`) + interpolazione `{count}` fatta a mano con `.replace` → non mostra mai più la chiave grezza, in qualunque locale. Le chiavi en.json restano per la traduzione quando l'i18n è a posto.
  - TEST: apri tab fino a 15 → box (stile = file-changed, con fade). Chiudi (OK/ESC/click-fuori). Fino a 25 → riappare. Scendi sotto soglia e risali → riappare. Verifica testo leggibile (NON `store.editor.tooManyTabs*`).

**Confermati dall'utente (nessuna azione):**
- **R4** file 480k righe / 16MB → lag accettabile. ✔️
- **B-REV5** (hard-break 2 spazi finali) → **test rimandato** (minore, da verificare in futuro). Resta ✅ 🧪.
- **Item 7 — Save All**: è nelle icone in testa alla **sidebar file-tree** (`tree.vue` → `saveAll(false)` = salva tutti, `saveAll(true)` = salva e chiudi). Nessuna scorciatoia tastiera assegnata (eventuale TODO).

**✅ H2-a/b/c (ITEM-4 utente) — IMPLEMENTATO 2026-06-21 (OPUS).** Vedi sezione dedicata sotto.

---

### Sessione 2026-06-21 (OPUS) — H2 persistenza sessione stile Notepad++ (a+b+c insieme)

**Revisione decisioni utente (2026-06-21, soppiantano le LOCKED 2026-06-20 su H2-c):**
- **silentClose default ON** (non OFF): comportamento Notepad++ diretto, niente popup "salvare?" alla chiusura.
- **Crash-safety OBBLIGATORIA**: i file non salvati vivono su disco via **backup periodico** (come NPP "session snapshot
  and periodic backup") → qualunque chiusura (crash, kill, power-loss) è recuperabile, NON solo la chiusura pulita.
- **Cartella di backup configurabile** (NPP la ha hardcoded, issue #3096) + **intervallo configurabile in secondi**
  (default = stesso di NPP = **7s**).
- Restore al boot di **TUTTE** le tab a prescindere da come è stato chiuso: untitled con contenuto, untitled vuote,
  file esterni con modifiche non salvate, file esterni salvati.

**Ricerca NPP (fonti ufficiali, vedi link in fondo alla sezione):** feature "Enable session snapshot and periodic backup"
(Settings→Preferences→Backup): auto-salva i file modificati ogni N secondi in `%AppData%\Notepad++\backup\`; alla chiusura
con modifiche non salvate NON chiede di salvare, tiene il backup e ricarica da lì al riavvio; default timer **7 secondi**;
path hardcoded (#3096); il periodic backup funziona solo per la **prima istanza** (→ da noi: solo la finestra "owner").

**Architettura realizzata (main = IO, renderer = stato):**
- **Layout su disco** (`<userData>/backup/`, o cartella scelta): `session.json` = indice ordinato delle tab
  (pathname, isSaved, isActive, pinned, hasBackup, cursor, encoding/eol); `<id>.snapshot` = contenuto delle SOLE tab non
  al sicuro su disco (untitled o file dirty). I file salvati NON hanno snapshot → al restore si rileggono dal disco.
  Scrittura **atomica** (tmp+rename, riusa il pattern R7) sia per `session.json` sia per gli snapshot. Cleanup snapshot
  orfani ad ogni scrittura (simmetria create/delete, §9).
- **Backup periodico** (renderer, finestra owner): `setTimeout` ricorsivo con intervallo = pref secondi; scrive solo se
  `contentVersion` è cambiato dall'ultimo flush (niente I/O inutile); `bus.emit('pre-save')` prima di leggere `tab.markdown`
  (flush sincrono del source debounced, invariante B-REV3).
- **Chiusura silenziosa** (owner + feature ON): in `LISTEN_FOR_CLOSE`, intercetta `mt::ask-for-close` → `pre-save` →
  `mt::session-save-and-close` (il main scrive **await** e POI `window-close-by-id`) → nessun popup. Feature OFF o finestra
  non-owner → flusso popup attuale **identico** (zero regressioni).
- **Restore al boot**: `app/index.js createWindow()` → se `sessionSnapshotEnabled` && `hasSessionSync` && nessun file da CLI
  → `_restoreSessionWindow()` (finestra con `_isRestoreSession=true` → NIENTE blank tab; bootstrap manda `isRestore`).
  Il renderer, su bootstrap `isRestore`, invia `mt::request-session-restore`; il main risolve le tab (file da disco freschi
  + watcher via `addToOpenedFiles`; snapshot per dirty/untitled; baseline dirty = contenuto disco) e risponde con
  `mt::restore-session` → action `RESTORE_SESSION` ricostruisce le tab in ordine, attiva quella giusta (`isActive`),
  riordina pinnate-prima (invariante H4). File sparito → riaperto come Untitled + notifica `mt::show-notification`.
- **Owner** = prima editor window (`_sessionOwnerAssigned` in `app/index.js`; flag `_isSessionOwner` nella EditorWindow →
  bootstrap → module var `isSessionOwner` nel renderer). Multi-finestra: solo l'owner fa backup+close silenzioso, le altre
  mantengono il popup (no perdita dati) — **stesso limite di NPP** (solo prima istanza).

**File toccati (8):**
- NUOVO `src/main/filesystem/session.js` — IO: `resolveBackupDir`, `writeSession` (snapshot+indice+cleanup atomici),
  `hasSessionSync`, `loadSessionTabs` (risolve file da disco + snapshot, gestisce file mancanti).
- `src/main/windows/editor.js` — flag `_isRestoreSession`/`_isSessionOwner`; `addBlankTab` soppressa in restore;
  `isRestore`/`isSessionOwner` nel payload `mt::bootstrap-editor`.
- `src/main/app/index.js` — import session + `WindowLifecycle`; **single-window gate in `_createEditorWindow`**
  (riusa la finestra esistente quando feature ON) + helper `_getExistingEditorWindow`; owner dinamico;
  `_restoreSessionWindow(appendFiles, rootDir)`; branch restore-first+append in `createWindow()`; append dei file CLI
  nel handler `mt::request-session-restore`; 4 handler IPC (`mt::session-save`, `mt::session-save-and-close`,
  `mt::request-session-restore`, `mt::select-session-backup-path`).
- `src/main/preferences/schema.json` + `static/preference.json` — 3 pref (`sessionSnapshotEnabled` default **true**,
  `sessionBackupPath` default `""`, `sessionBackupInterval` default **7**). ⚠️ I default REALI vengono dal preference.json
  STATICO, non dallo schema (schema = solo validazione electron-store); `Preference.init` migra le chiavi nuove sugli
  install esistenti via `hasSameKeys`.
- `src/renderer/src/store/preferences.js` — 3 default mirror + action `SELECT_SESSION_BACKUP_PATH`.
- `src/renderer/src/store/editor.js` — module vars `isSessionOwner`/`sessionBackupTimer`/`lastBackupVersion`; bootstrap
  branch `isRestore`; close silenzioso in `LISTEN_FOR_CLOSE`; nuove action `COLLECT_SESSION`/`RESTORE_SESSION`/`LISTEN_FOR_SESSION`.
- `src/renderer/src/pages/app.vue` — registra `LISTEN_FOR_SESSION()` in onMounted.
- `src/renderer/src/prefComponents/general/index.vue` — sezione "Session snapshot & periodic backup" (bool + range secondi
  + folder-picker). Testi **hardcoded in inglese** per evitare chiavi i18n grezze (lezione ITEM-PERF-WARN).

**Complessità:** alta (~450 righe). **Rischio:** medio — contenuto da: canale sessione PARALLELO (non passa da `FILE_SAVE`,
non tocca `handlePreSave`/baseline/`pendingSavedMarkdown`, invarianti B8/B9/B13); gate `contentVersion`; feature gated da
preferenza (OFF = comportamento identico a oggi); riuso pipeline standard per watcher/disk-read.

**Single-window stile Notepad++ (revisione 2026-06-21, feedback utente — i "limiti 1 e 2" del primo giro sono RISOLTI):**
- **Limite 1 RISOLTO** — aprire un file (CLI/doppio-click) con feature ON: ora **ripristina la sessione E accoda** il
  file come ultima tab; se il file è **già aperto** in sessione, porta solo il focus su quella tab (no doppione).
  Boot: `createWindow()` fa restore-first + passa i file CLI a `_restoreSessionWindow` → il main, DOPO `mt::restore-session`,
  chiama `openTabsFromPaths` (dedup in `NEW_TAB_WITH_CONTENT` via `isSamePathSync`). NPP-exact.
- **Limite 2 RISOLTO** — **single-window**: con feature ON NON si apre mai una 2ª finestra. Chokepoint UNICO
  `_createEditorWindow` (tutto passa di lì: New Window, `--new-window`, apertura file, `openFilesInNewWindow`): se esiste
  già una editor window la **riusa** (apre lì le tab + `bringToFront`); "New Window" puro → nuova tab vuota (come Ctrl+N
  di NPP). L'OS-level single-instance lock già esiste in produzione (`index.js:70`). L'owner è quindi sempre l'unica
  finestra → determinato in modo dinamico (`_getExistingEditorWindow()===null`, corretto anche su macOS re-activate).
  Con feature OFF: multi-finestra come prima (zero regressioni).
- Backup periodico = finestra di perdita ≤ intervallo (default 7s) in caso di crash; chiusura pulita = zero perdita
  (flush finale sincrono).

**⚠️ File MAIN (no hot reload): `session.js`, `windows/editor.js`, `app/index.js`, `preferences/schema.json`,
`static/preference.json` → RIAVVIARE `npm run dev`.** Renderer (editor.js/app.vue/preferences.js/general) = hot reload
(full reload Ctrl+R consigliato).

**macOS / Linux (risposta domanda utente 2026-06-21):** la **cartella è presa correttamente su tutti e 3 gli OS** —
`app.getPath('userData')` è API Electron cross-platform → Win `%APPDATA%\marktext`, macOS `~/Library/Application Support/marktext`,
Linux `~/.config/marktext` (o `$XDG_CONFIG_HOME`); il `/backup` + scrittura atomica (fs-extra) sono OS-agnostici. La logica
di auto-save (timer renderer + IPC + fs) è **identica** su tutte le piattaforme → funziona. Routing apertura-file verificato
anche per il path macOS `open-file` (Finder): cold launch → `createWindow()` (restore+append); app già pronta →
`_openFilesToOpen` → riusa la finestra unica → stesso flusso gated. **✅ macOS VERIFICATO DALL'UTENTE (2026-06-21,
build firmato con `CSC_IDENTITY_AUTO_DISCOVERY=false`): "funziona tutto"** — backup in `~/Library/Application Support/marktext/backup`,
restore + chiusura silenziosa OK. Note di comportamento macOS confermate: (1) `window-all-closed` NON chiude l'app →
chiudendo la finestra la sessione si salva comunque (flusso `close`), re-activate dal dock → restore (owner ricalcolato
dinamicamente). **Resta da smoke-testare solo Linux** (nessun problema architetturale atteso; `app.getPath('userData')`
risolve `~/.config/marktext`). Caveat residuo: i build **mas** (Mac App Store) disabilitano il single-instance lock
(`index.js:69`, `!process.mas`) → 2 istanze possibili (raro, non riguarda il build normale macOS).

**Bug runtime risolto (2026-06-21, primo avvio):** `Error: An object could not be cloned` ai `send` di
`mt::session-save` (tick periodico) e `mt::session-save-and-close` (X chiusura, che bloccava anche la chiusura della
finestra). Causa: `COLLECT_SESSION` ritorna oggetti con **proxy reattivi Pinia/Vue** (cursor/encoding) → structured-clone
IPC non li serializza. **Fix:** `deepClone(this.COLLECT_SESSION())` ai due `send` (stesso idioma già usato per
`deepClone(unsavedFiles)`). Auditati gli altri send sessione: gli altri 2 non hanno payload, i send main→renderer sono
oggetti plain → nessun altro punto colpito.

**TEST RUNTIME (da eseguire con `npm run dev`):**
- [ ] **T1 default ON**: prima apertura → in Preferences→General c'è "Session snapshot & periodic backup" **spuntato**,
  intervallo 7s, location "Default: &lt;userData&gt;/backup".
- [ ] **T2 chiusura silenziosa**: apri tab con modifiche → chiudi finestra → **NESSUN popup** "salvare?", si chiude subito.
- [ ] **T3 restore completo**: apri 3 untitled scritte + 1 untitled vuota + 2 file esterni con modifiche + 2 file salvati →
  chiudi → riapri → ritrovi **tutte 8** le tab, stesso ordine, tab attiva giusta, bollino dirty su quelle non salvate,
  contenuto corretto, untitled vuota presente.
- [ ] **T4 crash-safety**: scrivi in una untitled, **attendi ~8s** (un ciclo di backup), poi **killa il processo** (Task
  Manager / chiudi il terminale di dev) → riapri → il contenuto non salvato è ripristinato (≤ intervallo perso).
- [ ] **T5 path configurabile**: Preferences → "Select folder" → scegli una cartella → chiudi/riapri → la sessione è in
  quella cartella (verifica `session.json` + eventuali `.snapshot`).
- [ ] **T6 intervallo**: porta l'intervallo a 1s → verifica che `session.json` si aggiorni più spesso (mtime) mentre scrivi.
- [ ] **T7 file esterno cambiato fuori**: tra chiusura e riapertura, modifica da un'altra app un file salvato ripristinato →
  alla riapertura scatta il dialog reload del watcher (riuso meccanismo esistente).
- [ ] **T8 file esterno cancellato**: cancella su disco un file dirty tra le sessioni → al restore si riapre come **Untitled**
  col contenuto del backup + notifica.
- [ ] **T9 feature OFF = nessuna regressione**: spegni la pref → chiusura mostra di nuovo il **popup** "salvare?"; al riavvio
  NON ripristina (tab vuota/normale). Comportamento identico al pre-H2.
- [ ] **T10 pinned + source/Muya**: pinna 2 tab, lasciane una in source mode con testo non committato → chiudi/riapri →
  pinnate restano prime, il testo source non committato è salvato (grazie al `pre-save` nel flush).
- [ ] **T11 cleanup**: salva su disco una tab che prima era dirty → al ciclo di backup successivo il suo `.snapshot` sparisce
  dalla cartella; chiudi una tab → al backup successivo non è più in `session.json`.
- [ ] **T12 apertura file = restore + append**: con feature ON + sessione esistente, apri un file da CLI/doppio-click →
  ripristina **tutta la sessione** E aggiunge quel file come ultima tab (focus su di esso). Se il file era **già** in
  sessione → niente doppione, porta solo il focus su quella tab.
- [ ] **T13 single-window**: con app già aperta, apri un altro file (doppio-click/CLI) → **nessuna 2ª finestra**, la tab
  si aggiunge a quella esistente (portata in primo piano). "New Window" (Ctrl+N) → **nuova tab**, non nuova finestra.
- [ ] **T14 feature OFF = multi-finestra**: spegni la pref → "New Window"/apertura-in-nuova-finestra tornano a creare
  finestre separate (comportamento storico, nessuna regressione).

**Link usati per le info (NPP):**
- Notepad++ User Manual — Preferences/Backup: https://npp-user-manual.org/docs/preferences/
- Default backup path `%AppData%\Notepad++\backup` + path hardcoded (issue #3096):
  https://github.com/notepad-plus-plus/notepad-plus-plus/issues/3096
- Default timer 7 secondi + "Backup in every X seconds":
  https://community.notepad-plus-plus.org/topic/21782/faq-periodic-backup-vs-autosave-plugin

---

## 0. Decisioni utente (LOCKED — non richiedere di nuovo, 2026-06-09)

1. **Multi-selezione**: solo source mode. Comportamento richiesto: **tenendo premuto Ctrl** le selezioni
   sono **additive** — seleziono qualcosa (mouse o Shift+frecce), sposto il cursore, seleziono altro:
   la selezione precedente NON si perde finché Ctrl resta premuto. → **H1**.
2. **Cronologia undo persistente**: **SCARTATA** (non persistere). Session restore ripristina solo
   contenuto+cursore; l'undo riparte da zero alla riapertura. → **H6** (solo motivazione).
3. **Rimozione dialog "vuoi salvare?"**: vale **solo per chiusura finestra/app**. La chiusura della
   **singola tab** mantiene il dialog (azione esplicita). → **H2-c**.
4. **Numeri di riga**: GIÀ OK così — source ha `lineNumbers:true`, Muya conta i **paragrafi** (Prg in
   status bar). **Nessun lavoro**. → **H7**.
5. **NUOVO task**: **`Ctrl+K C` / `Ctrl+K U`** commenta/decommenta righe stile Visual Studio, adattato
   al linguaggio del file, **solo source mode**. → **H3** (aggiunto anche a `TODO.md` sez. Difficile).

---

## 1. Fix BUG-1 tab bar (da MEDIUM-TASK §7) — VALIDATO sul codice

**Stato verifica (2026-06-09):** il fix proposto in `MEDIUM-TASK.md` §7 è **corretto e applicabile**.
Verificato su `tabs.vue` reale:
- ✅ `PLUS_W = 35` esiste a riga 178 (unused, valore errato) → rimuovere.
- ✅ `const multiRow = row1Count < items.length` a riga 422 → punto esatto dell'edit.
- ✅ Width CSS `.v2-tab-new-li` = **26px** (riga 903) → la costante 26 del fix è giusta.
- ✅ Tutte le variabili usate dal fix esistono nello scope: `row1ContentWidth`, `row1Count`, `items`,
  `dynamicPaddingRight` (riga 401), `leftPad` (riga 411), `ulPadding`, `GAP`, `tabbarEl`.
- ✅ In multi-row il "+" inline è rimosso via `v-if` (commento riga 449-450) → il check serve solo
  nello stato single-row, coerente col fix.

**Irrobustimento obbligatorio rispetto alla versione §7:** usare `while (row1Count > 1)` invece di
`while (row1Count > 0)`. Col `> 0`, se una sola tab + "+" non entrassero, riga 1 resterebbe **vuota**
(`ul.width = 6px` → layout rotto, `recomputePinnedTab` su array incoerente). Col `> 1` resta sempre
almeno 1 tab in riga 1. Caso teorico con `minWidth:820`, ma il guard costa zero.

**Nota di stabilità (perché il loop non oscilla):** quando il check demota una tab e `multiRow` flippa,
il topright si espande → `topRightResizeObs` rifira → ricalcolo con `dynamicPaddingRight` nuovo (~353)
→ il loop principale converge da solo. L'eventuale demotion "in eccesso" del while è transitoria.
Restano valide le verifiche runtime 1–10 elencate in `MEDIUM-TASK.md` §7 (incl. taratura
`PLUS_TOLERANCE` SOLO se il wrap risulta visivamente troppo anticipato) e la rimozione dei log `[TABDBG]`.

---

## 2. Task Difficile — piano per task

### H1 — Multi-selezione additiva con Ctrl (source only)

**Obiettivo (spec utente).** In source mode, con **Ctrl premuto**: ogni nuova selezione (mouse drag,
Ctrl+click, o spostamento cursore + Shift+frecce) si **aggiunge** alle precedenti invece di sostituirle.
Rilasciato Ctrl, il comportamento torna standard. Digitare con N selezioni attive scrive su tutte
(già nativo CM5). Muya escluso.

**Complessità.** Media-alta (~60-100 righe in `sourceCode.vue` + eventuale helper in `codeMirror/index.js`).

**Cosa c'è già (CM5 nativo — base solida):**
- ✅ CM5 supporta multi-selezione nel core: `listSelections()`, `setSelections()`, `addSelection()`,
  e la digitazione/delete/paste agiscono su tutti i cursori.
- ⚠️ **Mouse**: il default CM5 (`configureMouse`) aggiunge una selezione con **Ctrl+click/drag**
  (Cmd su mac) e fa selezione rettangolare con Alt+drag (quest'ultima già confermata funzionante,
  vedi `TODO.md` riga 14). `configureMouse` NON è overridato in `sourceCode.vue` (grep fatto, zero match)
  → la parte mouse dovrebbe **già funzionare**: VERIFICARE a runtime per prima cosa (Ctrl+drag su due
  punti diversi → due selezioni). Fonte: manuale CM5 § `configureMouse` — https://codemirror.net/5/doc/manual.html
- ❌ **Tastiera**: NON nativo. Con più selezioni attive, un movimento freccia "semplice" le collassa a 1.
  Questa è la parte da implementare.

**Design proposto (parte tastiera):**
1. **Tracking stato Ctrl**: flag modulo `ctrlHeld` aggiornato da `keydown`/`keyup` sul wrapper CM
   (`editor.value.getWrapperElement()`) + **reset a `false` su `window` blur e su `editor.on('blur')`**
   (se l'utente cambia finestra con Ctrl premuto il keyup si perde — classico bug stuck-modifier).
2. **Hook `beforeSelectionChange`** (evento CM5 core): riceve `{ ranges, origin, update }`.
   Logica: se `ctrlHeld` **e** l'editor ha già ≥1 selezione **non vuota** **e** il cambio arriva da
   movimento tastiera (`origin` di tipo `*move`/`+move`) **e** il nuovo set di ranges è più piccolo
   del precedente (= CM sta collassando), allora `update([...vecchieRangeNonVuote, nuovaRangePrimaria])`.
   Così le selezioni esistenti sopravvivono e il cursore primario si muove/estende libero.
3. **Uscita dalla modalità**: `Esc` → comando CM `singleSelection` (built-in) via `extraKeys`,
   con guardia: se il pannello find è aperto, `Esc` deve continuare a chiuderlo (verificare l'handler
   esistente del find prima di bindare — grep `Esc`/`Escape` in `search/index.vue` e `sourceCode.vue`).
4. **Condizione di attivazione stretta**: la logica additiva scatta SOLO con `ctrlHeld && ≥1 selezione
   non vuota`. Con un solo cursore vuoto, Ctrl+frecce resta il word-jump standard → zero cambi al
   comportamento abituale.

**Rischi / invarianti:**
- ⚠️ `beforeSelectionChange` fire **anche per i cambi via API** (search, jump della sidebar,
  `handleFormatInSource`): il filtro su `origin` + `ctrlHeld` li esclude, ma testare esplicitamente
  click su risultato ricerca sidebar con Ctrl premuto (jump usa `setSelection` — origin API).
- ⚠️ **N12 / `cursorActivity`** (`sourceCode.vue`): fa il dirty-check e arma `commitTimer`
  (vedi `EASY-TASK.md` §A). Multi-selezione genera più `cursorActivity` → nessun problema atteso
  (idempotente), ma verificare che il bollino non flickeri.
- ⚠️ Operazioni riga custom (`Ctrl+D` duplica, `Ctrl+L` elimina, `Alt+↑/↓` swap): scritte per selezione
  singola. Con multi-selezione attiva possono comportarsi male → guardia esplicita: se
  `listSelections().length > 1`, agire solo sulla primaria o no-op (decidere al momento, documentare).
- ⚠️ IME/composizione: durante composition gli eventi selection cambiano — la condizione `origin` li
  esclude, ma testare con IME se disponibile.
- Pattern `bus.on`⇒`bus.off` non serve qui (eventi CM, non bus), ma i listener `keydown/keyup/blur`
  su `window` vanno rimossi in `onBeforeUnmount` (stessa disciplina).

**Test:** Ctrl+drag 2 selezioni → digita → scrive su entrambe; Ctrl + Shift+frecce aggiunge seconda
selezione senza perdere la prima; rilascio Ctrl + freccia → collassa a cursore singolo; Esc → singola;
Alt+Tab con Ctrl premuto → niente stuck mode; undo dopo edit multi-cursore → un singolo step coerente.

---

### H2 — Persistenza sessione unificata (3 task TODO in 1 architettura)

Copre, **in quest'ordine di implementazione**: (a) file non salvati NON in temp; (b) session restore;
(c) rimozione dialog "vuoi salvare?" alla chiusura finestra. Il TODO li elenca separati ma sono un
unico sistema: (c) è SICURO solo quando (a)+(b) funzionano — stessa conclusione già annotata in `TODO.md`.

> **DECISIONE UTENTE 2026-06-20 (ITEM-4):** SÌ a questa feature (comportamento atteso stile **Notepad++**:
> chiudo l'app → riapro → ritrovo tutte le tab, anche untitled/non salvate; nessun popup "vuoi salvare?").
> Modalità: **prima il piano completo (questo §H2), POI l'esecuzione** in una sessione Opus dedicata.
> Stato: ⏸️ piano pronto, codice non iniziato. **Dove verranno salvate le tab:** `app.getPath('userData')`
> (cartella dati utente di Electron, fuori dalla cartella del progetto) → sottocartella `drafts/` + indice
> `session.json`. Finché questo non esiste, il popup di chiusura **resta** (toglierlo ora = perdita dati).
>
> **DA VERIFICARE/DECIDERE PRIMA DI SCRIVERE CODICE (checklist bloccante):**
> 1. **Stabilità `tabId` tra sessioni** (grep `getUniqueId` in `store/help.js`): se l'id cambia ad ogni
>    avvio, il restore deve rimappare i draft per **ordine + pathname**, non per id. (Vedi rischio sotto.)
> 2. **Nome + default preferenze:** `restoreSession` (default ON?) e `silentClose` (decisione LOCKED:
>    default OFF finché testato, poi ON) → aggiungere a `src/main/preferences/schema.json` + UI prefs.
> 3. **Intervallo flush** draft (proposto ~30s) + flush sincrono di chiusura via `pre-save`.
> 4. **Scope multi-finestra:** prima iterazione solo finestra principale (shape `session.json` già pronta
>    per più finestre, ma non implementarle ora).
> 5. **Migrazione/cleanup draft orfani:** draft di tab chiuse/salvate vanno cancellati (simmetria
>    create/delete, `CLAUDE.md` §9) — censire TUTTI i punti di chiusura tab.
> 6. **Encoding/EOL/trim** nel payload draft = stesso shape del save (`getOptionsFromState`).

**Stato attuale (verificato):**
- ✅ Autosave salta gli untitled: `store/editor.js:1278` `if (pathname && autoSave)` — gli untitled
  non vengono mai scritti da nessuna parte.
- ✅ `os.tmpdir()` usato SOLO in `src/main/keyboard/index.js:65` (dump diagnostico tastiera, innocuo).
  Non c'è nessun salvataggio di contenuto utente in temp → il task TODO "spostare da temp" in realtà è
  "creare da zero lo storage drafts in `userData`".
- ✅ Flusso chiusura: `windows/editor.js:222` `win.on('close')` → `preventDefault()` →
  `mt::ask-for-close` → renderer `LISTEN_FOR_CLOSE` (`store/editor.js:516-548`) raccoglie unsaved →
  `mt::close-window-confirm` (dialog in `menu/actions/file.js:324`) oppure `mt::close-window` →
  `window-close-by-id`. **Punto d'intercetto pulito già esistente.**
- ✅ Apertura all'avvio: `app/index.js` `_openFilesCache` → `_openPathList` (riga 445). La pipeline
  tab nasce dal `rawDocument` di `loadMarkdownFile` → `mt::open-new-tab` → `createDocumentState`.

**Architettura proposta (main = IO, renderer = stato):**

*Fase (a) — Draft storage in `userData` (crash-safety inclusa):*
1. Directory `app.getPath('userData')/drafts/` gestita dal main. Un file per tab dirty:
   `<tabId>.md` + indice `session.json` (scrittura **atomica**: scrivi `session.json.tmp` → `fs.rename`).
2. Renderer: flush periodico (ogni ~30s, e solo se c'è almeno una tab dirty cambiata dall'ultimo flush)
   via nuovo canale `mt::session-flush` con payload `[{tabId, pathname|null, markdown, cursor,
   encoding, lineEnding, isSaved}]`. Riusa `getOptionsFromState` per le options (stesso shape del save).
   Per le tab dirty in **source mode** il payload legge `tab.markdown` che può essere stale ~1s
   (commit debounced, vedi `EASY-TASK.md` §A) → per il flush periodico va bene così (il prossimo flush
   recupera); per il flush di chiusura emettere PRIMA `bus.emit('pre-save')` (flush sincrono già
   esistente, INVARIANTE B8/B13: `handlePreSave` senza guardie).
3. Untitled: il draft È l'unico storage. File con pathname dirty: draft = bozza, il file su disco resta
   intatto finché l'utente non salva davvero.

*Fase (b) — Session restore:*
1. `session.json` contiene anche: ordine tab, tab attiva, e per le tab salvate solo il `pathname`.
2. All'avvio (`app/index.js`, dopo `_openPathList` dei file da CLI): se preferenza `restoreSession`
   attiva e `session.json` esiste → per tab salvate: ri-apertura normale da disco (contenuto fresco);
   per tab dirty/untitled: aprire tab col contenuto del draft e `isSaved:false`
   (`originalMarkdown` = contenuto disco se pathname esiste ancora, `null` per untitled).
3. **Conflitti**: se il file su disco è cambiato (mtime/contenuto ≠ baseline registrata) tra chiusura e
   riapertura → aprire col draft, baseline = disco nuovo, bollino acceso (= stesso pattern
   `markDivergedFromDisk` Opzione A di B12 — riusarlo, non inventare un dialog nuovo).
   File **eliminato/spostato**: tab si apre come untitled col contenuto del draft + notifica.
4. **Multi-finestra**: `session.json` con shape `{windows:[{id, tabs:[...]}]}`. Prima iterazione: 🟡
   ripristinare solo la finestra principale (le finestre multiple sono rare e H5 non esiste ancora);
   lasciare lo shape pronto per più finestre.
5. **Crash**: i draft+session scritti dal flush periodico sono già su disco → dopo crash il restore
   normale recupera (max ~30s di lavoro perso). Nessun codice speciale "crash detection" necessario.

*Fase (c) — Chiusura silenziosa (SOLO dopo a+b verificate):*
1. In `LISTEN_FOR_CLOSE` (renderer): se preferenza `silentClose` attiva → invece di
   `mt::close-window-confirm`, fare `bus.emit('pre-save')` → flush draft sincrono →
   `mt::session-flush-final` (main scrive atomico) → `mt::close-window`. Il dialog
   `showUnsavedFilesMessage` non viene più raggiunto da questo percorso.
2. La chiusura **singola tab** NON cambia (decisione utente): `ASK_FOR_CLOSE`/`CLOSE_TABS` invariati.
3. 🟡 Tenere il comportamento dietro **preferenza** (default ON una volta testato): rollback facile.

**Rischi / invarianti:**
- ⚠️ NON toccare `handlePreSave`/baseline/`pendingSavedMarkdown` (invarianti B8/B9/B13). Il flush draft
  è un canale NUOVO e parallelo, non deve passare da `FILE_SAVE`.
- ⚠️ Autosave esistente (`HANDLE_AUTO_SAVE`) continua a scrivere i file CON pathname: il draft per
  questi serve solo se `autoSave` è OFF o il save fallisce. Nessuna interazione da modificare.
- ⚠️ Cleanup: alla chiusura pulita di una tab (salvata o scartata esplicitamente dall'utente via dialog
  tab), il main deve cancellare `drafts/<tabId>.md` — simmetria create/delete (regola asimmetrie
  `CLAUDE.md` §9). Grep i punti: `CLOSE_TABS`, `FORCE_CLOSE_TAB`, `mt::window-tab-closed`.
- ⚠️ `tabId` è stabile dentro la sessione ma rigenerato alla prossima? Verificare come nasce `id`
  (grep `getUniqueId`/costruzione id in `store/help.js`): se cambia tra sessioni, il restore deve
  rimappare i draft per ordine/pathname, non per id. **Verifica obbligatoria prima di scrivere codice.**
- ⚠️ Watcher: le tab ripristinate con pathname devono ri-attivare il watch (il path di apertura normale
  lo fa già via `_doOpenTab` → `watcher-watch-file`; passare dal percorso standard, non crearne uno nuovo).

**Test:** chiusura con 3 untitled dirty + 2 file dirty + 2 salvati → riapertura: 7 tab, contenuti e
bollini giusti, tab attiva giusta; kill processo (Task Manager) → riapertura recupera ≤30s persi;
file modificato esternamente tra le sessioni → draft + bollino; file cancellato → untitled + notifica;
preferenza OFF → comportamento attuale identico (dialog).

---

### H3 — `Ctrl+K C` / `Ctrl+K U` commenta/decommenta per linguaggio (source only) — NUOVO

**Obiettivo.** Chord stile Visual Studio: `Ctrl+K C` commenta le righe selezionate (o la riga corrente),
`Ctrl+K U` decommenta, con la sintassi del linguaggio del file (`//`, `#`, `<!-- -->`, …). Solo source.

**Dipendenza dura: T-M1** (mode per estensione, `MEDIUM-TASK.md`). Senza T-M1 il mode è sempre
`markdown` → commento sempre `<!-- -->`. Implementare DOPO T-M1 (ed eventualmente insieme a T-M2
`Ctrl+/` toggle, che usa lo stesso addon).

**Come (riusa addon CM5 `comment`):**
1. `codeMirror/index.js`: `import 'codemirror/addon/comment/comment'` (stesso import previsto da T-M2).
   L'addon fornisce i metodi `cm.lineComment(from, to, opts)`, `cm.uncomment(from, to, opts)`,
   `cm.blockComment(...)` e il comando `toggleComment`. ⚠️ `lineComment`/`uncomment` sono **metodi con
   range**, non comandi → servono due piccoli handler che iterano `cm.listSelections()` e applicano
   il metodo a ogni range (`sel.from()`, `sel.to()`).
   Fonte: https://codemirror.net/5/doc/manual.html#addon_comment
2. Fallback linguaggi senza commento di riga (HTML/CSS/markdown): `lineComment` è no-op se il mode non
   definisce `lineComment` → in quel caso chiamare `blockComment`/`uncomment` block. L'opzione più
   semplice e robusta: provare `lineComment`, se il doc non cambia → `blockComment` (oppure leggere
   `cm.getModeAt(pos).lineComment` per decidere prima — preferibile, niente euristiche sul contenuto).
3. **Binding chord in `extraKeys`**: CM5 supporta nativamente i binding multi-stroke
   (nomi separati da spazio): bindare **sia** `'Ctrl-K C'` **sia** `'Ctrl-K Ctrl-C'` (VS accetta
   entrambe le seconde battute; costa una riga) e gli equivalenti U.
   Fonte (multi-stroke keymaps): https://codemirror.net/5/doc/manual.html#keymaps

**⚠️ BLOCCO da risolvere prima: `Ctrl+K` è OCCUPATO.** Grep fatto: `view.toggle-toc` =
`Ctrl+K`/`Cmd+K` su tutti e 3 gli OS (`keybindingsWindows.js:101`, `Darwin:98`, `Linux:102`).
Gli accelerator menu **precedono** gli `extraKeys` CM (invariante H di `EASY-TASK.md`) → il chord non
arriverebbe mai a CM. Soluzione coerente con la decisione "No IDE" (la sidebar TOC è stata rimossa con
T4A): azzerare l'accelerator `view.toggle-toc` → `''` nelle 3 mappe (stesso pattern usato per
`file.open-folder`), **lasciando la voce menu** (`visible:false` se serve, MAI rimuovere l'oggetto —
lezione `sideBarMenuItem`). ⚠️ Verificare prima con grep `toggle-toc` se la feature TOC è ancora
raggiungibile da qualche parte o è già morta di fatto.

**Test (post T-M1):** `.js` → `//`; `.py` → `#`; `.html`/`.css` → block comment; `.md` → `<!-- -->`;
multi-riga; `Ctrl+K U` su righe miste (alcune commentate) → decommenta solo le commentate;
in Muya → nessun effetto; `Ctrl+K` da solo → nessun toggle TOC fantasma.

---

### H4 — Pin tab

**Obiettivo.** Flag `pinned` per tab: le pinnate stanno sempre per prime, voce Pin/Unpin nel context
menu, drag limitato alla propria zona.

**🟡 Design: UNA sola `<ul>`, NON due.** Il TODO propone 2 zone `<ul>` separate, ma la lezione di
`MEDIUM-TASK.md` §7 (fix 1c FALLITO) dice che il layout tab bar è fragile e load-bearing:
`updateTabRowsLayout` misura `ul.querySelectorAll('li.v2-tab')` su UNA lista, il "+" inline è
posizionato sull'ultima tab di quella lista, dragula è configurato su quel container, e
`recomputePinnedTab` (il clone della tab attiva, concetto DIVERSO da questo "pin" utente) legge gli
`offsetTop` della stessa lista. Spezzare in 2 `<ul>` = riscrivere tutto questo. Con una sola `<ul>`:

1. **Store** (`store/help.js`): campo `pinned: false` in `defaultFileState` (+ `createDocumentState`,
   stesso percorso additivo documentato per `fileSize` in `MEDIUM-TASK.md` T-M6).
2. **Azione Pinia** `TOGGLE_PIN_TAB(id)`: flippa il flag e **riordina** `tabs` (pinnate prima,
   ordine relativo preservato). Vue v-for con `:key` riconcilia (NON manipolare il DOM — lezione dragula).
3. **`EXCHANGE_TABS_BY_ID`** (`store/editor.js:993`): clamp di zona — se `from` è pinnata, `toIndex`
   si clampa dentro [0, ultimaPinnata]; se non pinnata, dentro [primaNonPinnata, len-1]. ~6 righe.
4. **Dragula** (`tabs.vue`): opzione `accepts: (el, target, source, sibling)` che rifiuta drop
   cross-zona (leggere `data-id` di `el` e `sibling`, confrontare i `pinned` nello store). Il filtro
   `gu-mirror`/`realSibling` esistente resta invariato.
5. **UI**: icona pin nella tab (`.v2-tab` ha già icone close/dot — stesso pattern), voce in
   `TabContextMenu.vue` (pattern "copia percorso" già presente), separatore visivo via CSS
   `border-right` sull'ultima pinnata (selettore con classe `is-pinned` + `:not()` — niente JS).
6. **Persistenza**: `pinned` entra nel payload di H2 `session.json` (se H2 fatto prima; altrimenti
   campo pronto).

**Rischi:** la voce "pinnedTab" ESISTENTE in `tabs.vue` (riga 212) è il **clone temporaneo** della tab
attiva in riga 2+ — nome confondibile: chiamare il nuovo campo `pinned`/`isPinned` e NON toccare
`pinnedTab`/`recomputePinnedTab`. Chiudi-tutte/chiudi-altre (`TABS::close-others`/`close-all`):
**DECISO 2026-06-20 — le pinnate sono PROTETTE** (non si chiudono con "chiudi altre/tutte", solo
singolarmente). Filtrare le tab `pinned` in `CLOSE_OTHER_TABS`/`CLOSE_ALL_TABS` (`store/editor.js`),
~+5 righe.

**Test:** pin/unpin riordina; drag dentro zona ok, cross-zona rifiutato; wrap multi-row con pinnate
invariato; "+" posizionato giusto; nuova tab nasce non-pinnata dopo le pinnate; context menu su tab
pinnata; 0 pinnate = comportamento odierno identico.

---

### H5 — Tab drag fuori finestra (detach) — A FASI

**Complessità reale: la più alta del file** (~300+ righe cross-process). Implementare a fasi,
ognuna utile da sola; fermarsi dove il rapporto valore/rischio si esaurisce.

#### 🔄 MODELLO MULTI-FINESTRA / SESSIONE UNICA (NPP) — revisione 2026-06-25 (decisione utente)

**Spec utente (osservato in Notepad++).** Risolve la domanda aperta dell'handoff ("detach bypassa il gate o H5 solo
con feature OFF?"): **il detach BYPASSA il gate single-window**, e le finestre multiple sono pienamente integrate in
**UNA sola sessione**. Regole:
1. **Single-window di default** (già implementato in H2): apertura file / New Window / doppio-click NON aprono mai una 2ª finestra.
2. **UNICA eccezione → detach**: trascinare una tab fuori (H5-2) o "sposta in nuova finestra" (H5-1) crea una **nuova finestra reale**.
3. Generalizza a **N finestre**, nessun massimo.
4. **La sessione è UNICA** = unione di TUTTE le tab di TUTTE le finestre aperte (il "gruppo" di tab). Una tab vive in **una sola**
   finestra (non duplicata), ma fa parte dell'unico indice di sessione.
5. **Chiudere una tab** (X sulla tab) chiude **solo** quella, nella sua finestra (comportamento attuale, invariato).
6. **Aprire/nuova tab quando NESSUNA tab è aperta** (doppio-click / "Apri") → riapre **UNA sola** finestra con **tutte** le tab
   di tutte le finestre del gruppo, concatenate **nell'ordine di apertura delle finestre** (tab finestra 1, poi finestra 2, …).
7. Quindi: a runtime possono coesistere più finestre con sottoinsiemi di tab diversi; al riavvio collassano in **una** finestra. = NPP.

**Conseguenze architetturali vs H2 attuale (verificato sul codice 2026-06-25).** Questo modello ALZA la complessità/rischio di H5
oltre il piano detach originale: il pezzo grosso NON è il detach in sé, ma rendere la **sessione multi-finestra-aware**.

- **A. Bypass del gate (semplice).** Oggi `_createEditorWindow` (`app/index.js:443-462`), con `sessionSnapshotEnabled` ON,
  dirotta SEMPRE sulla finestra esistente. Il detach deve avere un percorso che crea una **nuova** `EditorWindow` anche a
  feature ON → param additivo `forceNewWindow` (salta il blocco di riuso) oppure handler dedicato `mt::detach-tab`. Rischio basso.
- **B. Aggregazione sessione multi-finestra (il cuore, rischio ALTO — lavoro NUOVO non previsto nel piano §H2/§H5 originale).**
  Oggi: il backup periodico gira **solo nell'owner** (`store/editor.js:951`, `isSessionOwner`); `COLLECT_SESSION`
  (`editor.js:870`) raccoglie le tab di **una** finestra, **senza** window-id; `writeSession` (`session.js:91`) **sovrascrive**
  l'intero `session.json` flat. → Con 2+ finestre, una seconda finestra che scrivesse sovrascriverebbe le tab dell'altra.
  Serve: il **main** tiene un registro in memoria `windowId → { order, tabs }`; **ogni** finestra (non solo l'owner) manda il suo
  `COLLECT_SESSION` (periodico + alla chiusura); il main aggiorna lo slice di quella finestra e **riscrive il `session.json` flat
  MERGIATO** ordinando per `order` di creazione finestra, poi ordine tab interno. L'ordine finestre = contatore incrementale
  assegnato in `_createEditorWindow`/`_restoreSessionWindow`. → Il gating `isSessionOwner` del tick va tolto/cambiato; la firma di
  `writeSession` cambia (riceve windowId+order, aggiorna slice, merge, write). ⚠️ Grep tutti i `mt::session-save*` prima di toccare.
- **C. Restore = singola finestra merge — GIÀ FUNZIONA.** `RESTORE_SESSION` (`editor.js:891`) ricostruisce TUTTE le tab in UNA
  finestra dalla lista flat, pinnate-prima, tab attiva. Se il main produce la lista flat già nell'ordine merge (B), il restore
  collassa correttamente in una finestra **senza modifiche**. Punto 6/7 dello spec = gratis.
- **D. Apri file / nuova tab con più finestre aperte (🟡 default).** Il gate oggi sceglie "la prima finestra trovata"
  (`_getExistingEditorWindow`, arbitraria). Con più finestre → indirizzare alla finestra **focalizzata**. Minore.
- **E. Detach dell'ultima tab di una finestra.** Disabilitare la voce/azione quando la finestra **sorgente ha 1 sola tab**
  (spostarla = no-op: chiuderebbe la sorgente vuota e ricreerebbe la stessa tab). Raffina lo step 5 di Fase 1.

**✅ Q1 RISOLTO (2026-06-25, decisione utente) — chiusura di UNA finestra mentre altre restano aperte → opzione (b): le tab
RESTANO nella sessione.** Chiudere una FINESTRA è **silenzioso** (niente popup) e **non scarta nulla**: le sue tab (ordine +
eventuali snapshot) **restano nell'indice di sessione unico** e riappaiono nel merge al prossimo riavvio completo. L'UNICO modo di
togliere una tab dalla sessione resta chiudere la **tab** (X sulla tab), che mantiene il dialog di salvataggio se dirty (decisione 0.3).
→ Nessuna perdita dati pur con `silentClose` ON.

**Conseguenze su B (registro main):** lo slice di una finestra **NON va cancellato alla sua chiusura** — resta "congelato" (non
riceve più `session-save`, ma partecipa al merge) finché non avviene un **riavvio completo**, dove `RESTORE_SESSION` collassa tutto
in UNA finestra e il registro riparte con quel solo slice. Mentre vivono più finestre, gli `order` di creazione (incl. quelli delle
finestre già chiuse) determinano l'ordine di concatenazione al restart (finestra 1, poi 2, poi 3…). Il gate single-window **resta**
per le aperture normali (doppio-click/menu → finestra esistente focalizzata, mai una nuova); **solo il detach** crea finestre nuove,
senza limite di numero (una 3ª/4ª finestra può nascere dal detach di una finestra già detachata). 🟡 Minori da definire in
implementazione: quale tab è attiva al restart (ultima finestra focalizzata vs prima); a quale finestra va un'apertura normale con
più finestre vive (default = focalizzata).

#### 🅱️ PIANO IMPLEMENTATIVO B — Sessione multi-finestra-aware (PREREQUISITO dei detach H5) — 2026-06-25

> **✅ IMPLEMENTATO 2026-06-26 (OPUS) — codice fatto nei 3 file, DA TESTARE a runtime (B1–B7 sotto).** File toccati:
> `src/main/filesystem/session.js` (writeSession → `mergedTabs` + snapshot namespacato `${winId}-${id}` + cleanup sul merge);
> `src/main/app/index.js` (campi `_sessionRegistry`/`_sessionWriteQueue`/`_sessionOrderSeq`; helper `_mergeSession`/`_enqueueSessionWrite`;
> `editor._sessionOrder` in `_createEditorWindow`+`_restoreSessionWindow`; handler `mt::session-save`/`mt::session-save-and-close`
> riscritti = registro per-finestra + merge serializzato); `src/renderer/src/store/editor.js` (FIX 6 close silenzioso ogni
> finestra; tick senza gate owner; FIX 5 `contentVersion++` in 6 azioni tab; var `isSessionOwner` rimossa = ora morta).
> ⚠️ **MAIN (session.js, app/index.js) = niente hot reload → riavviare `npm run dev`.** Nota runtime: il **primo tick** di ogni
> finestra scrive sempre (lastBackupVersion=-1) → ogni finestra registra il suo slice anche senza edit (risolve "finestra detachata
> mai editata"). Restano da fare i **detach** (H5-1/H5-2) per poter testare B2–B6 con 2 finestre reali.

> **Sessione pulita (anche Sonnet): questo blocco è AUTOSUFFICIENTE.** Anchor di riga verificati 2026-06-25 → i nomi-simbolo
> sono stabili, le **righe possono shiftare**: ri-grep prima di editare. File **MAIN = niente hot reload** → riavviare `npm run dev`.

**Ordine di esecuzione (LOCKED):** B **prima**, poi H5-1 (detach via menu), poi H5-2 (drag-out). Motivo: senza B una 2ª finestra
non è crash-safe e l'overwrite dell'owner **corrompe** `session.json`. 🔶 OPUS (rischio medio-alto, cross-process).

**Come funziona la sessione H2 OGGI (i 3 fatti che B modifica):**
1. `session.json` = `{version:1, tabs:[...]}` **FLAT** — una lista ordinata di tab, **nessun concetto di finestra** (`session.js:91`).
2. Cuscinetto `<id>.snapshot` scritto **solo** per le tab non al sicuro su disco (`tabNeedsBackup = !(isSaved && pathname)`,
   `session.js:51`). L'indice memorizza il `backupName` **esplicito** (`session.js:75-88`) → il restore (`loadSessionTabs`,
   `session.js:125-211`) lo rilegge da lì, **disaccoppiato** da come è generato.
3. Backup periodico: **solo l'owner** (`store/editor.js:951`, var `isSessionOwner`), gate su `contentVersion` (`:953`).
   `writeSession(preferences, payload)` **sovrascrive** tutto il file dal payload di UNA finestra.

**Le 6 criticità (verificate sul codice 2026-06-25) che B deve risolvere:**

| # | Sev | Falla | Anchor | Fix |
|---|-----|-------|--------|-----|
| 1 | 🔴 | id snapshot **collidono tra finestre**: `getUniqueId` = `` `${ID_PREFEX}${id++}` `` con `ID_PREFEX='mt-'`, `let id=0` a livello **modulo per-renderer** → ogni finestra riparte da `mt-0` → `<id>.snapshot` si sovrascrivono | `util/index.js:22-23,126` | `backupName` namespacato `${winId}-${tab.id}.snapshot` |
| 2 | 🔴 | il cleanup orfani cancella gli snapshot **delle altre finestre** (calcola `referenced` dal solo payload) | `session.js:93-103` | cleanup sull'**unione mergiata** |
| 3 | 🔴 | `writeSession` **sovrascrive** tutto `session.json` da un solo payload | `session.js:91` | registry per-finestra nel main + **merge** prima di scrivere |
| 4 | 🔴 | **race** + tmp a nome fisso `session.json.tmp` (`mt::session-save` è fire-and-forget) → scritture concorrenti collidono | `app/index.js:798` + `session.js:39-43` | **queue serializzata** nel main (risolve anche il merge consistente) |
| 5 | 🟠 | backup periodico **ignora i cambi struttura tab**: `contentVersion++` solo su contenuto digitato | `editor.js:1380` | bump `contentVersion` nelle 6 azioni che mutano l'array tab |
| 6 | 🟠 | chiusura silenziosa **solo nell'owner** → le altre finestre mostrano il popup | `editor.js:550` | gate = solo `sessionSnapshotEnabled` |

> **NON sono falle (corretti per design):** il renderer **non** deve conoscere il proprio `win.id` — il main lo ricava da
> `e.sender` nei 3 handler. `RESTORE_SESSION` resta invariato.

**Decisioni LOCKED (2026-06-25), non ridiscutere:**
- **Q1** — chiudere una FINESTRA NON scarta le sue tab: lo slice resta **congelato** nel registry, le tab restano nella sessione
  unica e riappaiono nel merge al riavvio. L'unico modo di togliere una tab è chiudere la **tab** (X sulla tab, mantiene il dialog).
- **Pin-first GLOBALE** al restore: `RESTORE_SESSION` (`editor.js:927-929`) **INVARIATO** (le pinnate in testa a tutta la lista).
- **Prima `isActive` trovata** al restore: `RESTORE_SESSION` (`editor.js:923`) **INVARIATO**.
- **Snapshot namespacato per finestra** (vedi falla 1).

##### IMPLEMENTAZIONE file-per-file

**File 1 — `src/main/filesystem/session.js`** (rischio medio)
- Cambiare firma: `writeSession(preferences, mergedTabs)` dove `mergedTabs` = array **già mergiato** (piatto, ordinato), ogni
  elemento = una tab con campo extra `_winId`.
- Nel loop: `backupName = \`${tab._winId}-${tab.id}${SNAPSHOT_EXT}\`` (**FIX 1**). Resto dell'entry invariato. L'indice scritto
  resta `{version:1, tabs:entries}` (stesso shape; ora contiene le tab di TUTTE le finestre in ordine).
- Cleanup (`:93-103`): `referenced` ora contiene i backupName di TUTTO il merge → cancella solo i veri orfani (**FIX 2**). Nessun'altra modifica.
- `atomicWrite` (`:39-48`): tmp a nome fisso → la serializzazione (File 2) garantisce nessuna scrittura concorrente (**FIX 4**). **NON** toccare atomicWrite.
- `loadSessionTabs` (`:125-211`) **INVARIATO**. *Migrazione vecchie sessioni:* `backupName` senza prefisso winId → rilette comunque
  (l'indice ha il nome esatto); al primo restore+write si passa allo schema nuovo e i vecchi orfani vengono puliti.

**File 2 — `src/main/app/index.js`** (cuore di B, rischio medio-alto)
- Campi nuovi sulla classe App:
  ```
  this._sessionRegistry  = new Map()        // win.id → { winId, order, tabs }
  this._sessionWriteQueue = Promise.resolve()
  this._sessionOrderSeq  = 0
  ```
- Assegnare l'ordine di creazione: in `_createEditorWindow` (`:443`, dopo `new EditorWindow`) e `_restoreSessionWindow` (`:483`):
  `editor._sessionOrder = this._sessionOrderSeq++`.
- Helper merge (ordine finestra, poi ordine tab interno):
  ```
  _mergeSession() {
    const slices = [...this._sessionRegistry.values()].sort((a, b) => a.order - b.order)
    const tabs = []
    for (const s of slices) for (const t of s.tabs) tabs.push({ ...t, _winId: s.winId })
    return tabs
  }
  ```
- Helper scrittura serializzata (FIX 4):
  ```
  _enqueueSessionWrite(preferences) {
    this._sessionWriteQueue = this._sessionWriteQueue
      .then(() => writeSession(preferences, this._mergeSession()))
      .catch((err) => log.error('[session] write failed:', err))
    return this._sessionWriteQueue
  }
  ```
- Handler `mt::session-save` (`:795`) — diventa:
  ```
  const win = BrowserWindow.fromWebContents(e.sender)
  const editorWin = win && this._windowManager.get(win.id)
  if (!preferences.getItem('sessionSnapshotEnabled') || !editorWin) return
  this._sessionRegistry.set(win.id, { winId: win.id, order: editorWin._sessionOrder ?? 0, tabs: payload.tabs })
  this._enqueueSessionWrite(preferences)   // fire-and-forget: la queue serializza
  ```
- Handler `mt::session-save-and-close` (`:802`): stesso update del registry, ma **`await this._enqueueSessionWrite(preferences)`**
  PRIMA di `ipcMain.emit('window-close-by-id', win.id)`. Lo slice **NON** si cancella (Q1, resta congelato).
- `mt::request-session-restore` (`:818`) **INVARIATO** (legge la flat da disco, ricostruisce 1 finestra).
- ⚠️ Il registry **non si svuota** alla chiusura finestra: si azzera da solo al riavvio (processo nuovo).

**File 3 — `src/renderer/src/store/editor.js`** (rischio basso)
- **FIX 6** — `LISTEN_FOR_CLOSE` (`:550`): `if (preferencesStore.sessionSnapshotEnabled && isSessionOwner)` → `if (preferencesStore.sessionSnapshotEnabled)`.
- **Tick** — `LISTEN_FOR_SESSION` (`:951`): togliere `isSessionOwner &&` dalla condizione del backup.
- **FIX 5** — `this.contentVersion++` in coda alle 6 azioni che mutano l'array tab: `NEW_UNTITLED_TAB` (`:1260`),
  `NEW_TAB_WITH_CONTENT` (`:1287`), `CLOSE_TABS` (`:1100`), `FORCE_CLOSE_TAB` (`:1009`), `TOGGLE_PIN_TAB` (`:1069`),
  `EXCHANGE_TABS_BY_ID` (`:1152`). (Effetto collaterale benigno: il content-watcher sidebar P-REV3 ricalcola anche su questi
  eventi — corretto per open/close, spreco trascurabile su reorder/pin, già debounced 250ms.)
- `COLLECT_SESSION` (`:870`) **INVARIATO** — manda già `id` + tutti i campi; il `win.id` lo ricava il main da `e.sender`.
- `isSessionOwner` (var modulo `:30`, ricezione bootstrap `:806/810`) diventa **inutilizzato** da B → lasciare con commento
  `// vestigiale dopo B; rimuovibile con H5`. Resta settato in `windows/editor.js:169` + `app/index.js:467,485`, innocuo.

##### Invarianti da NON rompere
- Canale sessione **parallelo**: non passa da `FILE_SAVE`/`handlePreSave`/baseline/`pendingSavedMarkdown` (invarianti B8/B9/B13).
- `RESTORE_SESSION` invariato → pin-first globale + prima-attiva come deciso.
- Feature **OFF**: gli handler escono subito (check `sessionSnapshotEnabled`) → multi-finestra storico, **zero regressioni**.
- Simmetria create/delete: gli snapshot orfani li pulisce `writeSession` sul merge; il registry si azzera al riavvio. **Nessun**
  delete manuale per-finestra (regola asimmetrie `CLAUDE.md §9`).

##### TEST (con `npm run dev`; File 1+2 = MAIN → riavviare)
- [ ] **B1** — 1 finestra, feature ON: backup+restore **identici** a H2 attuale (zero regressioni).
- [ ] **B2** — 2 finestre (serve H5-1; vedi nota): ognuna scrive il suo slice → `session.json` contiene le tab di **entrambe** in ordine di creazione finestra.
- [ ] **B3** — 2 finestre con untitled: in cartella backup 2 file `<winId>-<id>.snapshot` distinti, nessuna sovrascrittura (falla 1).
- [ ] **B4** — chiudi finestra A (B aperta): le tab di A **restano** in `session.json`; chiudi B; riapri → 1 finestra con A-tabs poi B-tabs (Q1).
- [ ] **B5** — cleanup: salva una tab dirty → al backup il suo snapshot sparisce; gli snapshot delle **altre** finestre restano (falla 2).
- [ ] **B6** — race: 2 finestre che editano insieme con intervallo 1s → `session.json` mai corrotto, contiene sempre entrambe (falla 4).
- [ ] **B7** — feature OFF: comportamento storico (multi-finestra, popup chiusura).
- ⚠️ **Nota:** B2–B6 richiedono 2 finestre con feature ON = il detach (H5-1). Finché H5 non esiste, validare B con un trigger
  temporaneo di debug (forzare una 2ª `_createEditorWindow` bypassando il gate) **oppure** unit test sul main per `_mergeSession`/queue.

---

*Fase 1 — "Sposta in nuova finestra" via context menu (NO drag) — ~80% del valore, rischio basso:*

> **✅ IMPLEMENTATO 2026-06-26 (OPUS).** Scelta finale (diversa dal punto 2 sotto, più semplice/robusta): invece di
> estendere `openTab` con `initialMarkdown`/`isDraft`, la nuova finestra **riusa il flusso restore** — `_createDetachWindow`
> (in `app/index.js`, bypassa il gate creando `EditorWindow` direttamente, `_isRestoreSession=true`, stash `_detachTab`/`_detachSource`);
> il renderer chiede restore → il branch detach in `mt::request-session-restore` invia `mt::restore-session` con la singola tab
> (gestisce **uniforme** saved/untitled/dirty via `RESTORE_SESSION`, niente nuovo campo rawDocument) → poi ack `mt::detach-tab-ack`
> alla sorgente → `FORCE_CLOSE_TAB`. Renderer: voce menu (`TabContextMenu.vue` + icona `newWindow` + i18n `moveToNewWindow`),
> action `DETACH_TAB` (`store/editor.js`, `bus.emit('pre-save')` + payload risolto), listener ack in `LISTEN_FOR_SESSION`.
> Punto 5 (disabilita su ultima tab) = `disabled: tabs.length <= 1` ✓. **Punto 4 (dedup file già aperto altrove) NON fatto**
> (come da nota "non risolvere qui": 2 finestre possono watchare lo stesso file, già possibile oggi).

1. Voce in `TabContextMenu.vue` → IPC `mt::detach-tab` con payload completo del tab:
   `{pathname, markdown, cursor, isSaved, originalMarkdown, options(getOptionsFromState)}`.
2. Main: handler che crea una nuova `EditorWindow` — riusare il percorso esistente
   `_createEditorWindow`/`openTabsFromPaths` (grep in `app/index.js`/`windowManager.js`):
   per tab **salvate** basta il pathname (apertura normale, watcher incluso); per tab **dirty/untitled**
   serve passare il contenuto: estendere il flusso `openTab` con un campo additivo
   `initialMarkdown`/`isDraft` nel rawDocument (additivo = nessun caller esistente si rompe).
3. Alla conferma di apertura nella nuova finestra (ack IPC), la finestra sorgente fa
   `FORCE_CLOSE_TAB` (senza dialog: il contenuto è già migrato). ⚠️ Ordine rigoroso:
   PRIMA ack della nuova finestra, POI chiusura nella vecchia — mai perdere il contenuto se la
   creazione finestra fallisce.
4. **File già aperto in altra finestra**: verificare se esiste già dedup (grep
   `normalizeAndResolvePath`/`fileWatcher` in `windowManager`): se il file è aperto altrove →
   focus su quella finestra invece di duplicare (il watcher su 2 finestre per lo stesso file è
   già teoricamente possibile oggi aprendo a mano — non peggiorare, ma non risolvere qui).
5. Disabilitare la voce se è **l'ultima tab dell'unica finestra** (no-op inutile).

*Fase 2 — Drag-out per attivare il detach:*

> **✅ IMPLEMENTATO 2026-06-26 (OPUS)** in `tabs.vue`: su `drag` registra `mousemove` su `window` (init al **centro finestra**
> per evitare detach spurio se il mouse non si muove); su `dragend` confronta l'ultima `screenX/Y` coi bounds finestra
> (`window.screenX/Y` + `outerWidth/Height`, **margine 0** = strettamente fuori) → se fuori e ≥2 tab → `DETACH_TAB(tab)` in
> `setTimeout(0)` (dopo dragula; `revertOnSpill:true` ha già rimesso la tab a posto → nessun conflitto). Listener rimosso su
> `dragend` e in `onBeforeUnmount`. Riusa tutto il percorso di Fase 1.

- Dragula NON supporta drop fuori container. Rilevazione manuale: su `drag` (dragula) registrare
  `mousemove` su `window`; su `dragend`, se le coordinate `screenX/Y` sono fuori dai bounds della
  finestra (`window.screenX/Y + outer size`, con margine ~40px) → chiamare il percorso Fase 1.
  Listener SEMPRE rimossi su dragend (anche su cancel).
- ⚠️ Interazione con `layoutLockUntil`/`tabsRenderKey` (post-drag): il detach chiude una tab durante
  il ciclo di vita del drop dragula → fare il detach in `setTimeout(0)`/`nextTick` DOPO che dragula ha
  finito (lezione: mai manipolare stato tab dentro i handler drop sincroni).

*Fase 2b — Re-attach in una finestra ESISTENTE (H5-RE) — richiesta utente 2026-06-26:*

> **✅ IMPLEMENTATO 2026-06-26 (OPUS).** Trascinare una tab e droparla **su un'altra finestra esistente**, alla **posizione**
> del drop (non solo creare una finestra nuova). Estende il drag-out riusando lo stesso canale `mt::detach-tab`:
> - `tabs.vue` dragend → `DETACH_TAB(tab, {x,y})` passa le **coord schermo** del drop (context menu = nessuna coord).
> - Main `mt::detach-tab`: se ci sono coord → `_findEditorWindowAt(x,y, sourceId)` (hit-test su `browserWindow.getBounds()`
>   di ogni editor window ≠ sorgente). Trovata B → `addToOpenedFiles` (watcher su B prima di chiudere la sorgente) +
>   `mt::receive-detached-tab` {tab, screenX, screenY} + `bringToFront` + ack alla sorgente (chiude la tab migrata).
>   Nessuna finestra sotto il puntatore → `_createDetachWindow` (nuova finestra, come prima).
> - B renderer `INSERT_DETACHED_TAB`: costruisce il docState (come RESTORE_SESSION), calcola l'**indice** da coord schermo→client
>   (`screenX - window.screenX`, confronto coi `getBoundingClientRect` delle `li.v2-tab` sulla riga del puntatore; fallback append),
>   `splice` all'indice, riordino **pin-first**, attiva la tab. `contentVersion++` (cambio struttura).
> - ⚠️ Conversione coord assume finestra **frameless** (custom titlebar, default v2): con titlebar **nativa** (`titleBarStyle:'native'`)
>   il bordo/titlebar OS sfasa l'indice (la tab si aggiunge comunque, posizione meno precisa). Multi-monitor con scaling diverso = idem.
> - ⚠️ **Limite (accettato):** il trigger drag-out scatta solo quando il puntatore esce dai bounds della finestra **sorgente**
>   (un drop dentro la sorgente = revert/riordino interno). Quindi NON si può droppare su una finestra B che **si sovrappone**
>   alla sorgente nel punto di drop (B coperta da A) → serve B con l'area di drop FUORI dal rettangolo di A (finestre affiancate,
>   caso comune). Topmost-window-at-point non è determinabile in modo affidabile in Electron → non risolto.
>
> **🔧 DA FIXARE (problemi noti H5-RE, segnalati utente 2026-06-26 — funziona ma da migliorare):**
> 1. **Due tab con lo STESSO nome** → il ri-drag per riportare una tab nella finestra originale **non funziona**. Root cause
>    **da investigare** a runtime (il `data-id` è univoco, quindi sospetto un match/dedup per **nome/pathname** anziché per id
>    in qualche punto del percorso re-attach o del drag-back, oppure due `Untitled` con lo stesso filename). Riprodurre con 2 tab
>    omonime, poi grep i punti che confrontano `filename`/`pathname` nel flusso detach/insert/close.
> 2. **Nessun feedback visivo durante il drag tra finestre** (manca polish, la Fase 3 "ghost window" copriva in parte):
>    - la finestra di **destinazione** sotto il mouse **non va in primo piano DURANTE** il drag (solo DOPO il drop) → l'utente
>      non vede dove sta per droppare. Servirebbe un `bringToFront` live al passaggio del puntatore (hit-test continuo lato main
>      su `mousemove`, non solo a `dragend`).
>    - manca un **"miraggio"/anteprima** della tab trascinata dentro la tab bar di destinazione (placeholder/insert-marker che
>      mostra la posizione di inserimento) → l'utente non ha conferma visiva che l'azione sta funzionando né dell'ordine finale.
>      Richiede comunicazione cross-finestra del drag in corso (es. main inoltra la posizione alla finestra sotto il puntatore,
>      che mostra un indicatore di drop) — costo medio, è il grosso di una vera "ghost window" (Fase 3).

*Fase 3 — Ghost window che segue il cursore: 🟡 RIMANDARE.* Costo alto (finestra trasparente
borderless + sync posizione via IPC a 60fps), valore estetico. Decidere solo dopo Fase 2 in uso.

---

### H6 — Cronologia undo persistente — ❌ SCARTATA (decisione utente 2026-06-09)

Motivazione tecnica (resta valida se si riconsidera): la history Muya è **snapshot full-document**
(`muya/lib/contentState/history.js`: `push` fa `deepCopy(state)` dell'intero albero `blocks`,
`UNDO_DEPTH=500` in `muya/lib/config:8`) → serializzarla = scrivere fino a 500 copie del documento
per tab. La history CM è ricostruibile via `cm.getHistory()/setHistory()` ma con `undoDepth:10000`
(`sourceCode.vue:652`) ha lo stesso problema di scala. Session restore (H2) ripristina contenuto+cursore;
undo riparte da zero. Spuntato in `TODO.md` come scartato.

### H7 — Numeri di riga — ✅ GIÀ FATTO (nessun lavoro)

Source: `lineNumbers: true` (`sourceCode.vue:646`). Muya: contatore **paragrafi** (Prg in status bar,
DOM-walk, vedi `DESIGN-TASK.md`). Decisione utente: va bene così. Spuntato in `TODO.md`.

---

### H8 — Undo/redo UNIFICATO Muya↔source (opzione B) — NUOVO (decisione utente 2026-06-14)

**Problema.** Oggi Muya e source hanno **due sistemi di undo separati** (vedi DESIGN-HISTORY-SPLIT): editando in
una modalità e poi nell'altra, `Ctrl+Z` non risale agli edit fatti nell'altra modalità → "come se Ctrl+Z non
esistesse" tra le modalità. **Decisione utente: opzione B** (undo davvero continuo), scartate A (accetta) e C
(bridge 1 gradino).

**Obiettivo.** Un'unica history undo/redo per tab, continua attraverso gli switch di modalità: `Ctrl+Z`/`Ctrl+Y`
annullano/ripristinano in ordine cronologico TUTTI gli edit, qualunque sia la modalità in cui sono stati fatti e
qualunque sia la modalità attiva al momento dell'undo.

**Perché NON è fragile: 4 fondamenta GIÀ esistenti (verificate sul codice) che B riusa così com'è.**
1. **Funnel unico di content-change.** `LISTEN_FOR_CONTENT_CHANGE` (`store/editor.js:1212`) riceve
   `{markdown, cursor, muyaIndexCursor, history, blocks}` da **entrambe** le modalità (Muya via `dispatchChange`;
   source via `getMarkdownAndCursor`→stesso action, vedi commento `editor.js:317`). UN punto solo dove intercettare
   ogni modifica committata.
2. **Routing undo già unico.** `Ctrl+Z`/`Ctrl+Y` sono intercettati dal **menu Electron** (non dal keymap CM) →
   IPC `mt::editor-edit-action` → `EDITOR_EDIT_ACTION` (`listenForMain.js:9`) → `bus.emit('undo'/'redo')`
   (`listenForMain.js:45`). Ascoltano `editor.vue:1133` (`handleUndo`, no-op in source) e `sourceCode.vue:696`
   (`handleUndo`→`execCommand('undo')`); agisce **solo l'editor attivo**. Un solo evento bus da deviare.
   (Grep negativo: nessun binding `'Ctrl-Z'` negli `extraKeys` di CM → niente doppio undo.)
3. **Cursore mode-agnostic già esistente.** `muyaIndexCursor` = `{anchor:{line,ch}, focus:{line,ch}}`, prodotto da
   **entrambe**: Muya `getMuyaIndexCursor()` (`muya/lib/index.js:129`), source `getMarkdownAndCursor` (`sourceCode.vue:83-105`).
4. **Path di restore già esistenti** per quel cursore: Muya `setMarkdown(md, undefined, true, muyaIndexCursor)`
   (`muya/lib/index.js:189`, usa `addCursorToMarkdown` `importMarkdown.js:523`); source `setValue(md)` + `setSelection({line,ch})`
   (già fatto al restore di tab, `sourceCode.vue:756-773`). **B non inventa restore nuovi.**

**Architettura proposta (semplice e solida).** Manager undo unificato a livello **tab**, unica fonte di verità per `Ctrl+Z/Y`.
- **Storage:** Map a livello modulo `undoPerTab: Map<tabId, { stack: [{markdown, muyaIndexCursor}], index }>` —
  **non** dentro il tab Pinia (evita overhead reattività su array di stringhe grandi; stesso pattern di `cmStatePerTab`).
- **Baseline:** al caricamento/apertura tab, push iniziale `{markdown caricato, cursore}` → `index = 0`.
- **Cattura (push):** dentro `LISTEN_FOR_CONTENT_CHANGE`, **solo nel ramo currentFile** (il funnel già isola le tab
  background a `editor.js:1240`), dopo aver aggiornato `currentFile.markdown`. Tronca il ramo redo (`stack.splice(index+1)`),
  push, `index++`, **cap depth** (es. 200–500, `shift` se eccede).
- **Undo/Redo:** nuove azioni store `UNIFIED_UNDO`/`UNIFIED_REDO`: bound-check, `index∓1`, leggi snapshot, **applica
  all'editor ATTIVO** via bus (Muya → `setMarkdown(md, undefined, true, muyaIndexCursor)`; source → `setValue(md)`+`setSelection`),
  aggiorna `currentFile.markdown` + stato dirty (riusa la logica `markdown` vs `originalMarkdown` già nel funnel).
- **Routing:** `bus 'undo'/'redo'` → `UNIFIED_UNDO/REDO` (sostituisce i due `handleUndo` nativi). Le history native
  (Muya block-tree, CM) restano in piedi ma **non guidano più** `Ctrl+Z` (opz.: ridurne la depth, vedi R1/R2 — risparmio RAM).

**Il gate anti-rottura (markdown-equality) — il cuore della solidità.** Pushare SOLO se
`markdown !== stack[index].markdown` (contenuto davvero cambiato). Questo UNICO gate risolve **senza flag fragili**
tre problemi insieme:
1. *Applicazione undo/redo:* `setMarkdown`/`setValue` rigenerano il funnel, ma il markdown applicato `===` `stack[index].markdown`
   → niente re-push → **niente loop**.
2. *Switch di modalità (re-import):* stesso markdown → niente push fantasma (sovrappone BUG-MUYA-UNDO-SWITCH già fixato).
3. *Cambi solo-cursore (click/cursorActivity):* markdown invariato → niente push.
È più robusto di un flag `isApplyingUndo` perché il `dispatchChange` di Muya è **async** (`setTimeout(0)`, `muya/lib/index.js:222-224`):
un flag potrebbe essere già resettato quando il funnel arriva; l'uguaglianza non ha race. (Tenere comunque il gate
`justLoaded`/settle già presente per saltare le normalizzazioni di caricamento.)

**Scenari di rottura previsti + mitigazione (tutti coperti):**
1. Loop re-push all'apply undo → gate equality.
2. Push fantasma allo switch modalità → gate equality.
3. Push da cambio tab / tab background → gate equality + ramo currentFile only (funnel separa già background a `:1240`).
4. Timing `dispatchChange` async → gate equality (no flag, no race).
5. **Granularità:** undo per-commit, non per-lettera in source → **DEGRADO atteso** vs il char-level nativo di CM (→ Q1).
6. **Reload esterno da disco:** decidere se **azzerare** `undoPerTab[tab]` (coerente con `clearHistory` esistente, niente
   undo oltre il reload) → Q2.
7. **Memoria doc enormi:** snapshot = stringa intera per commit → cap depth + (opz.) disabilita/riduci su doc grandi
   (lega a T-M6) → Q3.
8. Reattività Pinia su array grandi → storage in Map modulo non-reattiva (come `cmStatePerTab`).
9. Cursore non valido al restore (offset fuori range) → `muyaIndexCursor` è `{line,ch}`; **clamp** su `setSelection`;
   `addCursorToMarkdown` ha già guard `!anchorText` (`importMarkdown.js:531`).
10. Doppio undo (nativo + unificato) → escluso: `Ctrl+Z` passa dal menu Electron, non dal keymap CM; sostituendo i due
    `handleUndo` resta un solo path.
11. Dirty/isSaved dopo undo → riusare logica funnel (`markdown` vs `originalMarkdown`): undo a baseline → bollino off.
12. **Cleanup simmetrico:** `undoPerTab.delete(id)` negli stessi punti di `cmStatePerTab.delete` (`sourceCode.vue:874`) e
    chiusura tab nello store (asimmetria create/delete = leak, CLAUDE.md §9).
13. Save → non cambia contenuto → nessun push; nessuna interazione con baseline/`pendingSavedMarkdown` (invarianti B8/B9/B13).
14. Multi-finestra → `undoPerTab` è per-`tabId`; `tabId` unici per sessione (`getUniqueId`, `store/help.js`); finestre
    diverse = renderer diversi = Map separate. OK.

**File da toccare:** `store/editor.js` (azioni UNIFIED_UNDO/REDO + push nel funnel + cleanup + baseline);
`store/listenForMain.js` o i due `handleUndo` (deviare `bus 'undo'/'redo'`); `editor.vue`/`sourceCode.vue` (handler di
APPLICAZIONE snapshot via nuovo evento bus + modifica `handleUndo`); (opz.) `muya/lib/config` + `sourceCode.vue` (ridurre
depth native, R1/R2). **Nessuna modifica strutturale a Muya core** (riusa `setMarkdown` pubblico).

**Complessità:** media-alta (~120-180 righe, niente rewrite degli editor). **Rischio:** medio, contenuto dal gate
equality + riuso dei path esistenti. Non è forzato: undo già single-funnel + single-bus + cursore già mode-agnostic.

**Domande aperte (DA DECIDERE prima di implementare):**
- **Q1 (granularità):** accettabile che in source l'undo diventi **per-commit** invece che per-lettera/parola? (l'alternativa
  fine-grained cross-modale è molto più complessa e fragile). → vedi sezione DOMANDE in fondo.
- **Q2 (reload disco):** all'arrivo di un cambio file esterno applicato (reload), **azzerare** la history unificata di quella tab?
- **Q3 (doc grandi):** cap depth (quanti stati? 200/500?) e/o disattivare l'undo unificato sopra una soglia di dimensione
  (legandolo a T-M6 auto-source)?

#### ⚠️ REVISIONE design dopo risposte utente (2026-06-14) — l'approccio "snapshot grezzo" sopra è SUPERATO

- **Q1 → VINCOLO DURO:** in source l'undo deve restare **a parola come ora** (CM nativo: "devono essere cancellate
  le parole mentre le sto scrivendo"). **Verificato sul codice perché il piano grezzo non basta:** source committa al
  funnel con **debounce 1000ms** (`sourceCode.vue:617-635`) → uno stack di snapshot nutrito dal funnel avrebbe
  granularità ~1s (a chunk), **più grossa** del word-level nativo di CM. → **Non si può sostituire l'undo nativo di source
  con gli snapshot.** L'undo nativo di CM (e di Muya) va MANTENUTO attivo dentro ogni modalità.
- **Q3 → SCOPING:** H8 vale **solo per i file markdown** (default-Muya, che possono fare toggle Muya↔source). I file
  **source-by-default** (non-md: `.txt`/`.js`/…) **non cambiano nulla** — e sono già fuori scope per costruzione: non
  possono fare toggle modalità (`_applySourceCodeForFile`→`isMarkdownPath`, `store/editor.js:740-746`; M-REV11), quindi
  non hanno il problema cross-modale. Limite undo per i file md = **lo stesso di Muya** (`UNDO_DEPTH=500`, `muya/lib/config:8`)
  in entrambe le modalità.
- **Q2 → reload disco: AZZERA** la history undo di quella tab (coerente con `clearHistory`).
- **Conseguenza architetturale:** l'undo nativo (CM word-level in source, Muya nativo in Muya) resta la fonte DENTRO ogni
  modalità. Serve solo un **ponte tra modalità** (chain delle history native ai confini di switch), NON uno stack che
  rimpiazza tutto. Design più complesso del primo schizzo → vedi DECISIONE PIVOT sotto.
- **DECISIONE UTENTE (2026-06-14): undo SEAMLESS, niente cambio modalità, niente "gradoni".** `Ctrl+Z` (undo) /
  `Ctrl+Shift+Z` (redo) devono
  comportarsi come se ci fosse **un unico editor con un'unica history continua**: restando nella modalità corrente,
  ogni Ctrl+Z annulla l'edit più recente (chiunque l'abbia fatto, in qualunque modalità), a **granularità a parola**,
  mostrato nella modalità corrente, **senza che l'utente si accorga del confine**.

**ARCHITETTURA DEFINITIVA (locked) — "unified snapshot a granularità nativa, replay nell'editor attivo":**
- **Un'unica pila** per tab di snapshot `{markdown, muyaIndexCursor}` in ordine cronologico, fonte UNICA di Ctrl+Z/Y.
  Il routing `bus 'undo'/'redo'` viene deviato a questa pila; l'undo nativo dei due editor **non guida più** Ctrl+Z.
- **Cattura a granularità NATIVA (non al funnel 1s):** si pusha uno snapshot quando l'history nativa dell'editor attivo
  crea un nuovo passo, cioè quando la sua undo-depth **aumenta**:
  - Source: sull'evento CM `'change'`, se `cm.historySize().undo` è cresciuto dall'ultimo → push (granularità = word-level
    nativo di CM, **identica a oggi**). NB: bypassa il debounce 1s del funnel — la cattura è separata dal commit allo store.
  - Muya: al checkpoint nativo (commit della history Muya) → push markdown corrente. (Granularità = Muya nativa.)
  - Così la pila eredita ESATTAMENTE la granularità nativa di entrambi → il requisito "a parola in source" è rispettato.
- **Replay nell'editor ATTIVO (mai cambio modalità):** Ctrl+Z = `index--`, applica `stack[index]` all'editor corrente
  (Muya `setMarkdown(md,undefined,true,muyaIndexCursor)`; source `setValue(md)`+`setSelection`), restore cursore.
  Gli edit fatti nell'ALTRA modalità riappaiono come markdown nella modalità corrente, senza switch. Redo simmetrico.
- **Gate anti-loop:** la cattura usa il confronto undo-depth-cresciuta + markdown-equality → l'applicazione di un replay
  (che rigenera change/funnel) non ri-pusha.
- **Scope (Q3):** SOLO file markdown (default-Muya, toggle abilitato). File source-only (non-md) invariati, già fuori
  scope (no toggle). Cap pila = `UNDO_DEPTH` (500, `muya/lib/config:8`), uguale nelle 2 modalità.
- **Reload disco (Q2):** azzera la pila della tab.
- **Cleanup:** `delete` della pila negli stessi punti di `cmStatePerTab.delete` + chiusura tab (simmetria, CLAUDE.md §9).

**Rischi/aperti specifici di questa architettura (da chiudere in fase implementativa):**
- Detection del checkpoint **Muya**: la history Muya usa pending+commit a 800ms (`contentState/index.js:176-183`) →
  individuare il punto giusto dove leggere il markdown committato (hook su `commitPending` o su `dispatchChange` con
  confronto `history.index`). DA VERIFICARE leggendo meglio il flusso di commit Muya.
- `setValue`/`setMarkdown` ad ogni passo di undo = più pesante dell'undo-delta nativo: per passi word-level va bene; su
  doc enormi può laggare → cap + (opz.) disattivazione legata a T-M6.
- Scroll/cursore dopo replay: ripristino da `muyaIndexCursor`; possibili micro-differenze vs nativo (clamp range).
- Le history native diventano inutilizzate per Ctrl+Z → si possono ridurre (R1/R2) ma vanno lasciate coerenti per non
  rompere logiche dirty/`clearHistory`/`cmStatePerTab` esistenti (BUG-CTRLZ): rivedere quelle interazioni con cura.
- **Ancora da leggere prima di implementare:** flusso commit Muya (`commitPending`/checkpoint), API CM `historySize`/
  `changeGeneration` nel config CM, menu Edit (accelerator), `store/help.js` (aggancio stato per-tab), `preferences SET_MODE`
  (non più necessario per il cambio-modalità, escluso dalla decisione).
- **File analizzati finora (rilevanti per H8):** `store/editor.js` (funnel, lifecycle tab, `_applySourceCodeForFile`),
  `store/listenForMain.js` (routing undo), `editor.vue` (handleUndo/handleFileChange/bus), `sourceCode.vue`
  (commitTimer 1s, cursorActivity, cmStatePerTab, getMarkdownAndCursor, mount/unmount), `muya/lib/index.js`
  (setMarkdown/dispatchChange/getHistory), `contentState/{index,history}.js`, `utils/importMarkdown.js`,
  `selection/cursor.js`. **Ancora da leggere prima dell'implementazione:** menu Edit main-process (accelerator
  undo/redo, conferma routing), `preferences` SET_MODE (toggle modalità programmatico per l'opzione (i)),
  `codeMirror` config/keymap completo, `store/help.js` (defaultFileState, dove agganciare lo stato per-tab).

#### 🔖 RIPRENDERE DOMANI — H8 (handoff, 2026-06-14)

**Stato (2026-06-14):** architettura **LOCKED** + **letture mirate COMPLETATE** (esiti sotto) + **piano implementativo
passo-passo VERIFICATO e PRONTO** (vedi "PIANO IMPLEMENTATIVO VERIFICATO"). **Nessun codice scritto.** Prossimo passo
unico: conferma utente → codice (CLAUDE.md regola 2).

**Decisioni utente bloccate (NON richiedere di nuovo):**
1. Opzione **B** (undo continuo tra modalità). A/C scartate.
2. **Seamless**: Ctrl+Z **non** cambia modalità; nessun "gradone"; l'utente non si accorge del confine.
3. **Granularità a parola** preservata in source come ora (CM nativo) → cattura snapshot a granularità nativa, NON al funnel 1s.
4. **Scope**: solo file markdown (default-Muya). File source-only (non-md) invariati.
5. **Cap** pila = `UNDO_DEPTH` (500), uguale nelle 2 modalità. **Reload disco** → azzera la pila.
6. Tasti: **undo = Ctrl+Z**, **redo = Ctrl+Shift+Z**.

**Letture mirate — COMPLETATE (2026-06-14). Esiti VERIFICATI sul codice reale (ri-grep l'anchor prima di editare: le righe shiftano):**

- [x] **Flusso commit/checkpoint Muya** — `contentState/index.js:146-185` (setter `cursor`): push history **immediato**
  se cambia la key del cursore (`prevCursor.start/end.key !== cursor.start/end.key`), altrimenti `pushPending` +
  commit ritardato a **800ms** (`historyTimer`). `inputCtrl.js:355-371`: `this.history.commitPending()` è chiamato
  **esplicitamente** su word-boundary (spazio / `.,;:!?)]}"'`), su Enter (`insertParagraph`/`insertLineBreak`) e su
  `compositionend` → **la granularità nativa di Muya è già a-parola**. `history.js`: `push` incrementa `this.index`;
  `muya/lib/index.js:155 getHistory()` ritorna `{stack, index}`. **PUNTO dove leggere il markdown committato:** il
  listener `editor.value.on('change', changes => …)` in `editor.vue:1164` riceve `changes =
  {markdown, muyaIndexCursor, history:{stack,index}, …}` (da `dispatchChange`, `muya/lib/index.js:124-134`). Quindi il
  checkpoint Muya si rileva da **`changes.history.index` cresciuto** rispetto all'ultimo visto → push di
  `{markdown: changes.markdown, muyaIndexCursor: changes.muyaIndexCursor}`. ⚠️ Il commit via timer 800ms NON emette un
  `change` → la "coda" non committata viene catturata al `change` successivo o al boundary di switch (funnel): uno step
  di ritardo al massimo, accettabile.
- [x] **API history CodeMirror** — VERIFICATE sul **sorgente reale patchato** (`node_modules/codemirror/lib/codemirror.js`):
  `historySize()` (riga 6359) ritorna `{undo, redo}` (conteggio item NON-selezione in `history.done/undone`);
  `changeGeneration(forceSplit)` (riga 6375) ritorna `history.generation`. Rilevazione "nuovo passo di undo creato":
  tracciare `cm.historySize().undo` per-istanza, su `'change'` se è cresciuto → push. Esiste GIÀ un handler `'change'`
  (`sourceCode.vue:736-740`) che azzera `cm.doc.history.lastModTime` sui word-boundary per forzare la granularità
  a-parola → **stesso handler dove agganciare la cattura unificata**.
- [x] **Routing undo/redo — CORREZIONE al piano precedente: DUE sorgenti, non una.**
  (1) menu/accelerator → `editorUndo/Redo` (`menu/actions/edit.js:33-39`) → `mt::editor-edit-action` type `'undo'/'redo'`
  → renderer `EDITOR_EDIT_ACTION` (`listenForMain.js:9`) → `bus.emit('undo'/'redo')` (riga 45);
  (2) **command palette** → `commands/index.js:148-158` → `bus.emit('undo'/'redo')` **diretto** (BYPASSA
  `EDITOR_EDIT_ACTION`). → **Entrambe convergono su `bus 'undo'/'redo'`**, ascoltato da `editor.vue:1133` (`handleUndo`,
  Muya) e `sourceCode.vue:696` (`handleUndo`, CM). ⇒ **Il chokepoint unico corretto sono i due `handleUndo/Redo`, NON
  `EDITOR_EDIT_ACTION`** (deviare lì coprirebbe solo il menu, non la palette). Nessun binding `Ctrl-Z` negli `extraKeys`
  CM (`sourceCode.vue:664-667` = solo `Alt-Up/Down`) → niente terzo path. Accelerator (verificati
  `keybindings{Windows,Linux,Darwin}.js`): Win/Linux `Ctrl+Z` / `Ctrl+Shift+Z`, mac `Command+Z` / `Command+Shift+Z`.
- [x] **`store/help.js` + cleanup tab** — `defaultFileState` (riga 9-43) NON ha campo undo → la pila vive in una **Map a
  livello modulo** (pattern `cmStatePerTab`, `sourceCode.vue:11`). `getUniqueId()` genera id **random per sessione**
  (`help.js:61,97,116,149`) → la pila si chiave per `tabId` valido solo nella sessione (coerente con H8, no persistenza).
  **Cleanup unico:** `FORCE_CLOSE_TAB` (`store/editor.js:883-887`) fa `tabs.splice` + `autoSaveTimers.delete`
  (riga 890-894) → aggiungere lì `undoPerTab.delete(file.id)` (simmetria create/delete, CLAUDE.md §9). Lo snapshot CM
  `cmStatePerTab.delete` sta invece a `sourceCode.vue:874` (a unmount, solo se la tab non esiste più).
- [x] **Routing redo simmetrico** — confermato: `bus 'redo'` → `handleRedo` Muya (`editor.vue:668`) /
  CM (`sourceCode.vue:302`, `execCommand('redo')`).
- [x] **Funnel dirty (bonus)** — `LISTEN_FOR_CONTENT_CHANGE` (`store/editor.js:1212`): branch tab-background isolato a
  riga 1240 (`id !== 'muya' && currentId !== id`), branch tab-attiva da 1259 (aggiorna `currentFile.markdown` + logica
  dirty `markdown` vs `originalMarkdown`). ⇒ **l'applicazione di un undo (replay con `setValue`/`setMarkdown`) ri-passa
  dal funnel e aggiorna il bollino da sola**: nessun codice dirty dedicato in H8.

#### PIANO IMPLEMENTATIVO VERIFICATO (2026-06-14) — pronto per conferma utente, poi codice

> **In una frase:** una **pila di snapshot markdown per tab** (Map a livello modulo) alimentata alla **granularità
> nativa** dei due editor, fonte UNICA di Ctrl+Z/Ctrl+Shift+Z **per i soli file markdown**; ogni undo fa **replay del
> markdown nell'editor ATTIVO** (mai cambio modalità). **Anti-loop = uguaglianza markdown.** Tutti gli anchor e le API
> sotto sono verificati sul codice (vedi "Letture mirate" qui sopra).

**✅ VERIFICA RUNTIME (2026-06-14, probe `console.log` temporanei poi rimossi). Confermato col log:**
- **Muya**: `history.index` cresce monotòno, **+2 per parola** sul word-boundary → la detection `idx > lastMuyaIndex`
  cattura word-level (lo step-by-2 non incide: 1 push per ogni `change` con `idx` cresciuto).
- **Source**: `historySize().undo` cresce **per-parola**, `origin=+input`; lo `setValue` allo switch dà
  `undo=1 origin=setValue`, ma il **gate uguaglianza** lo blocca (contenuto === cima pila) → conferma che il gate è load-bearing.
- **Edge commit-800ms** (parola lunga senza spazi + pausa): il commit Muya **NON emette `change`** → la coda digitata NON
  è in pila finché non arriva il `change` successivo. ⇒ **CONSEGUENZA (recepita nel Passo 4):** prima di ogni undo si deve
  **flushare lo stato live** nella pila (mima `history.undo()` Muya che chiama `commitPending()` per primo). Senza flush,
  il PRIMO Ctrl+Z dopo una digitazione non ancora catturata (coda 800ms o intra-parola) salterebbe uno step.

**CONTESTO PRONTO-USO H8 (refs/anchor già verificati 2026-06-14 — NON serve ri-grep per questi; le righe shiftano →
usali come orientamento e conferma col nome funzione/handler prima di editare):**

| File | Cosa c'è già (riga) |
|------|---------------------|
| `sourceCode.vue` | `const { currentFile: currentTab } = storeToRefs` (62) · `tabId` ref · `editor.value` = istanza **CM5** · `getMarkdownAndCursor(cm)` → `{cursor:{anchor,focus} con {line,ch}, markdown}` (83) · handler `on('change')` (736) · `handleUndo` (296)/`handleRedo` (302) · `onMounted` restore contenuto (756-786) + setValue 150ms (794) · ramo reload `forceReload` con `clearHistory()` (163-176) · `cmStatePerTab.delete` (874) · blocco `bus.off` in `onBeforeUnmount` (842-856) · guard `sourceCode.value` |
| `editor.vue` | `const { currentFile } = storeToRefs` (201) — **NO `currentTab`** · `currentMuyaTabId` ref (204) · `editor.value` = istanza **Muya** · listener `editor.value.on('change', changes => …)` (1164): `changes = {markdown, muyaIndexCursor, history:{stack,index}}` · `handleUndo` (660)/`handleRedo` (668) con guard `sourceCode.value` · `setMarkdownToEditor` (943, evento `file-loaded`) · `handleFileChange` (set `currentMuyaTabId` 948/973, `setMarkdown` 983) · `bus.on` (1131-1162)/`bus.off` (1279+) |
| `store/editor.js` | `LISTEN_FOR_CONTENT_CHANGE` (1212) · `FORCE_CLOSE_TAB` (883: `tabs.splice` + `autoSaveTimers.delete` 887-894) · ramo reload con `forceReload:true` (193-209, dentro `if (pathname === currentFile.pathname)`) |
| `muya/lib/index.js` | `setMarkdown(markdown, cursor, isRenderCursor=true, muyaIndexCursor, blocks)` (189) · `getHistory()` → `{stack,index}` (155) |
| `node_modules/codemirror/lib/codemirror.js` | `cm.historySize()` → `{undo,redo}` (6359) · API standard CM5: `setValue/getValue/setSelection/setHistory/getHistory/clearHistory/lineCount/getLine` |
| `@/util` | `isMarkdownPath(pathname)` → true se `ext===''` (untitled) o estensione markdown |

**Passo 0 — NUOVO modulo condiviso `store/unifiedHistory.js`** (renderer; importato da `editor.vue`, `sourceCode.vue`,
`store/editor.js`). Map non-reattiva + helper puri (no Pinia → niente overhead reattività su stringhe grandi, stesso
pattern di `cmStatePerTab`):
- `undoPerTab = new Map()` → `Map<tabId, { stack: [{markdown, muyaIndexCursor}], index }>`.
- `seedUnified(tabId, markdown, cursor)` — se la tab non ha entry crea `{stack:[{markdown, muyaIndexCursor:cursor}], index:0}` (baseline).
- `pushUnified(tabId, markdown, cursor)` — **GATE anti-loop**: se non c'è entry → seed e return; se
  `markdown === stack[index].markdown` → return (nessun cambiamento reale). Altrimenti `stack.splice(index+1)` (tronca
  redo) → `push` → `index++` → **cap `UNDO_DEPTH`=500** (`shift` + `index--` se eccede). Identico a `history.js push`.
- `unifiedUndo(tabId)` → se `index>0`: `index--`, ritorna `stack[index]`; altrimenti `null`.
- `unifiedRedo(tabId)` → se `index<stack.length-1`: `index++`, ritorna `stack[index]`; altrimenti `null`.
- `clearUnified(tabId)` → `undoPerTab.delete(tabId)` (reload disco + chiusura tab).
- `isUnifiedTarget(pathname)` → `isMarkdownPath(pathname || '')` (untitled = md = true). Definisce lo scope (solo md).

**Passo 1 — Cattura SOURCE** (`sourceCode.vue`). NB: `currentTab` = alias di `currentFile` (`:62`), `tabId.value` = id
della tab montata in CM.
- Variabile per-istanza `let lastUndoSize = 0` (NON serve init preciso: il gate uguaglianza in `pushUnified` annulla
  ogni push spurio finché la baseline è già seedata all'attivazione — vedi Passo 5).
- Nell'handler **già esistente** `codeMirrorInstance.on('change', (cm, change) => {…})` (riga 736), DOPO il tweak `lastModTime`:
  ```js
  if (isUnifiedTarget(currentTab.value?.pathname)) {
    const size = cm.historySize().undo
    if (size > lastUndoSize) {
      const { cursor, markdown } = getMarkdownAndCursor(cm)
      pushUnified(tabId.value, markdown, cursor)   // gate uguaglianza dentro pushUnified
    }
    lastUndoSize = size   // risincronizza SEMPRE (anche su replay/setValue) → niente doppi push
  }
  ```
  Granularità a-parola garantita dal `lastModTime=0` già presente (nuovo passo undo CM per parola).
- ⚠️ Il replay (`setValue`) fa crescere `historySize().undo`: `lastUndoSize = size` lo riallinea e il gate
  `markdown===top` evita comunque la ri-cattura.

**Passo 2 — Cattura MUYA** (`editor.vue`). ⚠️ `editor.vue` NON ha `currentTab` → usa `currentFile` (`:201`);
`currentMuyaTabId` (`:204`) = id della tab caricata in Muya.
- Variabile per-istanza `let lastMuyaIndex = -1` (Muya è UNA istanza riusata fra le tab md → va resettata al cambio `currentMuyaTabId`).
- Nel listener `editor.value.on('change', changes => {…})` (riga 1164), accanto a `LISTEN_FOR_CONTENT_CHANGE`:
  ```js
  const muyaTab = currentMuyaTabId.value
  if (muyaTab && isUnifiedTarget(currentFile.value?.pathname)) {
    const idx = changes.history?.index ?? -1
    if (idx > lastMuyaIndex) pushUnified(muyaTab, changes.markdown, changes.muyaIndexCursor)
    lastMuyaIndex = idx
  }
  ```
- Dove si aggiorna `currentMuyaTabId` (cambio tab, in `handleFileChange`), reimpostare
  `lastMuyaIndex = editor.value.getHistory().index` per non pushare uno snapshot fantasma allo switch.

**Passo 3 — Replay nell'editor ATTIVO** (nuovo evento bus `unified-replay`, simmetria `bus.on`⇒`bus.off`):
- `editor.vue` (applica solo se Muya attivo):
  ```js
  bus.on('unified-replay', ({ markdown, muyaIndexCursor }) => {
    if (sourceCode.value || !editor.value) return
    editor.value.setMarkdown(markdown, undefined, true, muyaIndexCursor)
  })
  ```
- `sourceCode.vue` (applica solo se source attivo):
  ```js
  bus.on('unified-replay', ({ markdown, muyaIndexCursor }) => {
    if (!sourceCode.value || !editor.value) return
    const cm = editor.value
    cm.setValue(markdown)
    if (muyaIndexCursor?.anchor && muyaIndexCursor?.focus) {
      cm.setSelection(clampPos(cm, muyaIndexCursor.anchor), clampPos(cm, muyaIndexCursor.focus))
    }
  })
  // Helper clampPos (il cursore da snapshot può eccedere il doc) — stesso pattern già usato a sourceCode.vue:255:
  const clampPos = (cm, p) => {
    const line = Math.max(0, Math.min(p?.line ?? 0, cm.lineCount() - 1))
    const ch = Math.max(0, Math.min(p?.ch ?? 0, cm.getLine(line).length))
    return { line, ch }
  }
  ```
- Guardie speculari = stesso pattern dei `handleUndo` esistenti (uno solo dei due editor è attivo → un solo replay).
  ⚠️ In source mode Muya resta MONTATO dietro CM (M-REV14) → entrambi gli `bus.on('unified-replay')` sono registrati:
  la guardia `sourceCode.value` è quindi obbligatoria, non opzionale.
- ⚠️ Definire l'handler come funzione **NOMINATA** (es. `handleUnifiedReplay`) e registrarla con `bus.on('unified-replay',
  handleUnifiedReplay)` / rimuoverla con `bus.off('unified-replay', handleUnifiedReplay)` in `onBeforeUnmount` (gli snippet
  sopra usano arrow inline solo per brevità: un'arrow inline NON è rimovibile → listener orfano, CLAUDE.md §5).
- Dopo il replay il funnel aggiorna `currentFile.markdown` + dirty da solo (finding "Funnel dirty").

**Passo 4 — Routing (deviare i bus handler, NON `EDITOR_EDIT_ACTION`).** Anteporre il branch unificato ai 4 handler
esistenti, usando il ref/id corretto PER COMPONENTE (sono diversi!):
- `sourceCode.vue handleUndo` (296) / `handleRedo` (302):
  ```js
  if (isUnifiedTarget(currentTab.value?.pathname)) {
    // FLUSH TAIL (come Muya history.undo() che chiama commitPending PRIMA di annullare): cattura lo stato
    // live se è avanti rispetto alla pila. In CM il contenuto è più fresco dello store (debounce 1s) → leggi da CM.
    const live = getMarkdownAndCursor(editor.value)
    pushUnified(tabId.value, live.markdown, live.cursor)   // gate uguaglianza: no-op se già in cima
    const snap = unifiedUndo(tabId.value)                  // unifiedRedo(tabId.value) nel handleRedo
    if (snap) bus.emit('unified-replay', snap)
    return
  }
  // sotto: ramo nativo esistente per file non-md → editor.value.execCommand('undo')
  ```
- `editor.vue handleUndo` (660) / `handleRedo` (668):
  ```js
  if (isUnifiedTarget(currentFile.value?.pathname)) {
    // FLUSH TAIL: Muya committa al funnel in modo SINCRONO → currentFile.markdown/muyaIndexCursor sono già correnti.
    pushUnified(currentFile.value.id, currentFile.value.markdown, currentFile.value.muyaIndexCursor)
    const snap = unifiedUndo(currentFile.value.id)   // unifiedRedo nel handleRedo
    if (snap) bus.emit('unified-replay', snap)
    return
  }
  // sotto: ramo nativo esistente → editor.value.undo() (già preceduto da `if (sourceCode.value) return`)
  ```
- **NB flush solo prima di UNDO** (mima `commitPending`); prima di REDO il flush è comunque innocuo (se c'è coda nuova,
  la cattura tronca il ramo redo → redo no-op, coerente: non si può redo dopo aver ridigitato).
- Così menu/accelerator E command palette (entrambi `bus.emit('undo')`) passano di qui; solo l'editor attivo applica il
  replay (Passo 3). File non-md: ramo nativo invariato (CM word-level), già fuori scope (no toggle modalità).

**Passo 5 — Baseline, reload, cleanup (⚠️ il seed lazy NON basta come baseline):**
- **Baseline (OBBLIGATORIA all'attivazione tab, PRIMA del primo edit):** chiamare `seedUnified(id, contenutoCaricato, cursore)`
  subito dopo OGNI punto in cui il contenuto della tab viene caricato/ripristinato nell'editor. `seedUnified` è
  **idempotente** (no-op se la tab ha già una entry) → chiamarlo in più punti è sicuro e NON azzera la pila esistente
  (switch modalità/tab non la perdono). Punti concreti:
  - source `onMounted` dopo `editor.value = codeMirrorInstance` (~785): `const s = getMarkdownAndCursor(editor.value); seedUnified(id, s.markdown, s.cursor)`;
  - source `handleFileChange` ramo tab-switch, dopo il restore history (~276);
  - Muya `setMarkdownToEditor` (~952/954) e `handleFileChange` (~983), dopo `setMarkdown`, con `newMarkdown` + cursore.
  ⚠️ NON affidarsi al seed lazy dentro `pushUnified`: seederebbe con il markdown GIÀ modificato → si perde l'undo del
  PRIMO edit. Il ramo lazy in `pushUnified` resta solo fallback difensivo.
- **Reload disco (Q2 → AZZERA) — UN SOLO hook a livello store (copre Muya E source):** nel ramo reload che emette
  `file-changed` con `forceReload:true` (`store/editor.js:193-209`, dentro `if (pathname === currentFile.pathname)`),
  PRIMA del `bus.emit('file-changed', …)` aggiungere `clearUnified(id)` poi `seedUnified(id, markdown, cursor)`. Mitt è
  sincrono → quando il componente fa `setValue`/`setMarkdown` la baseline è già reseedata e il gate blocca la
  ri-cattura. (Non serve toccare i singoli componenti per il reload.)
- **Cleanup tab**: in `FORCE_CLOSE_TAB` (`store/editor.js:887`, accanto a `autoSaveTimers.delete`) → `clearUnified(file.id)`.

**Passo 6 (opzionale) — R1/R2.** Le history native non guidano più Ctrl+Z per i file md → si possono ridurre
(`UNDO_DEPTH` Muya, `undoDepth` CM 10000→1000) per risparmiare RAM, MA lasciandole COERENTI con
`clearHistory`/`cmStatePerTab`/BUG-CTRLZ (NON rimuoverle: servono ai file non-md e alle logiche dirty). A parte, non bloccante.

**Scenari di rottura → mitigazione (tutti coperti da: gate uguaglianza + scope md + risincronizzazione depth):**
1. Loop re-push all'apply → `markdown===stack[index]` blocca + `lastUndoSize`/`lastMuyaIndex` risincronizzati.
2. Push fantasma allo switch modalità → stesso markdown → gate blocca; `lastMuyaIndex` resettato allo switch.
3. Tab background / cambio tab → cattura solo su editor attivo + `tabId` corretto; funnel isola già il background (riga 1240).
4. Coda non catturata (commit Muya 800ms senza `change`, o digitazione intra-parola prima del boundary) → **FLUSH TAIL
   prima dell'undo** (Passo 4) la cattura → nessuno step saltato (mima `commitPending` nativo). VERIFICATO a runtime 2026-06-14.
5. Granularità → ereditata nativa (CM `lastModTime` a-parola; Muya `commitPending` a-parola) = requisito Q1 rispettato.
6. Reload disco → `clearUnified` + reseed.
7. Doc enormi → cap `UNDO_DEPTH` 500; (opz.) disattivare sopra soglia legata a T-M6.
8. Reattività → Map a livello modulo (come `cmStatePerTab`).
9. Cursore fuori range al replay → `clampPos`; `addCursorToMarkdown` ha già guard (`importMarkdown.js:531`).
10. Doppio undo (nativo+unificato) → escluso: i due `handleUndo` ritornano subito per i file md.
11. Dirty/isSaved → gestito dal funnel (replay → `change` → confronto `markdown` vs `originalMarkdown`).
12. Cleanup simmetrico → `clearUnified` in `FORCE_CLOSE_TAB` + reload.

**File da toccare:** NUOVO `store/unifiedHistory.js`; `sourceCode.vue` (cattura su `change`, replay, `handleUndo/Redo`,
init `lastUndoSize`, reload, `bus.off`); `editor.vue` (cattura su `change`, replay, `handleUndo/Redo`, `lastMuyaIndex`,
`bus.off`); `store/editor.js` (`clearUnified` in `FORCE_CLOSE_TAB`). **Nessuna modifica a Muya core** (riusa
`setMarkdown` pubblico). (Opz.) `muya/lib/config` + `sourceCode.vue` per R1/R2.

**Complessità:** media-alta (~140-180 righe, niente rewrite editor). **Rischio:** medio, contenuto da: gate uguaglianza,
scope md, riuso dei path esistenti (`setMarkdown`/`setValue`/funnel), chokepoint unico sui bus handler.

**TEST RUNTIME — ⚠️ Sonnet DEVE, a implementazione FINITA, RIPRESENTARE questa lista all'utente.** Li esegue l'UTENTE
con `npm run dev` (toccando renderer + store → **full reload finestra** Ctrl+R; **riavviare dev** se si modifica
`muya/lib/config`). Sonnet poi annota l'esito nella sezione **TESTING in cima al file** (stesso pattern delle voci
"verificato dall'utente" già presenti). Lista:
- [ ] **T1 cross-modale Muya→source**: in Muya scrivi `alfa`, switch source, scrivi `beta`; `Ctrl+Z` → annulla `beta`
  restando in source; `Ctrl+Z` di nuovo → annulla `alfa` (mostrato come markdown in source, **nessun cambio modalità**).
- [ ] **T2 simmetrico source→Muya**: come T1 partendo da source, finendo in Muya.
- [ ] **T3 granularità parola (source)**: scrivi `uno due tre`, `Ctrl+Z` ripetuti → cancella **una parola alla volta**.
- [ ] **T4 granularità Muya**: stesso test in Muya → undo a parola.
- [ ] **T5 redo**: dopo gli undo, `Ctrl+Shift+Z` ripristina in ordine simmetrico.
- [ ] **T6 flush tail**: scrivi una parola lunga senza spazi (`abcdefgh`) e **subito** `Ctrl+Z` (senza pause) → annulla
  la parola, **senza over-jump** allo stato precedente (verifica il FLUSH TAIL del Passo 4).
- [ ] **T7 file non-md**: apri un `.txt` → undo/redo nativi CM invariati (fuori scope unificato).
- [ ] **T8 reload disco**: modifica il file da un'altra app → reload → `Ctrl+Z` **non** risale oltre il reload.
- [ ] **T9 dirty flag**: undo fino alla baseline → bollino "non salvato" si **spegne**; un nuovo edit lo riaccende.
- [ ] **T10 no leak/crash**: alterna rapidamente modalità + `Ctrl+Z`/`Ctrl+Shift+Z` molte volte → nessun crash/loop in
  console (riusa scenari BUG-MUYA-*); chiudi le tab → nessun residuo (la Map si svuota).

**Regola operativa:** prima del codice → completare le letture sopra, scrivere il piano passo-passo dettagliato qui,
ottenere conferma utente. (CLAUDE.md regola 2.)

**Nota tecnica file:** `HARD-TASK.md` contiene un **byte NUL** (verificato 2026-06-14: byte 83143, ~riga 962, dentro la
descrizione di M-REV1) → `grep`/`Grep` lo trattano come binario e falliscono silenziosamente; usare `Read` per navigare.
(Pulizia opzionale: riscrivere il file senza il NUL.)

---

## 3. Audit robustezza / casi limite (trovati analizzando il codice)

> Ordinati per gravità. Ogni voce: problema → scenario limite reale → mitigazione proposta (minima).

### R1 — Muya history: snapshot full-document in RAM (GRAVE su doc grandi)
- **Fatto (verificato):** ogni stato undo = `deepCopy` dell'INTERO albero blocks (`history.js:43-53`),
  fino a 500 stati. Inoltre `LISTEN_FOR_CONTENT_CHANGE` salva `history` e `blocks` **dentro il tab
  Pinia** (`store/editor.js:1252-1253`) → la history vive anche nello store, per OGNI tab Muya visitata.
- **Scenario:** doc .md da 1-2MB editato a lungo → centinaia di MB di RAM; degrado progressivo
  (il `deepCopy` a ogni checkpoint costa CPU → lag digitazione crescente).
- **Mitigazione proposta:** (1) `UNDO_DEPTH` dinamico in Muya: se `markdown.length` > soglia
  (es. 300KB) → depth ridotta (es. 50). ~10 righe in `history.js push()` (shift extra). (2) T-M6
  (auto-source per file grandi, già pianificato) taglia il problema alla radice per i file enormi:
  **alzare la priorità di T-M6**. (3) Verificare se `tab.history` serve davvero nello store per le tab
  in background o può essere droppato all'uscita dalla tab (study: serve per ripristinare undo al
  rientro — allora va bene, ma è il motivo per cui 30 tab pesano, vedi R3).

### R2 — `cmStatePerTab` e history CM senza limiti
- **Fatto:** `cmStatePerTab` (Map modulo, `sourceCode.vue`) tiene `{content, history}` per ogni tab
  source visitata; pulita solo alla CHIUSURA della tab. `undoDepth: 10000`.
- **Scenario:** sessione lunga, 30 tab aperte, editing pesante → 30 history CM complete in RAM;
  "10000 ctrl+z" su file grande = history singola enorme.
- **Mitigazione:** cap LRU sulla Map (es. 10 entry: alla 11ª si butta la più vecchia — chi rientra su
  una tab evicted perde solo l'undo, il contenuto sta nello store); `undoDepth` da 10000 → 1000
  (nessun utente reale fa 10000 undo; 1000 = già larghissimo, memoria /10).

### R3 — 30+ tab aperte
- **Fatti:** ogni tab nello store porta `markdown` + (se Muya) `blocks` + `history`; il
  content-watcher della ricerca sidebar (`MEDIUM-EASY-TASK.md` T4B) osserva `tabs.map(t=>t.markdown)`
  e ri-esegue la ricerca su TUTTE le tab a ogni modifica; `updateTabRowsLayout` fa querySelectorAll +
  misure DOM a ogni resize/observer tick (ok fino a ~50 tab, è O(n) leggero).
- **Scenario:** 30 tab di cui 5 grandi + sidebar ricerca aperta + digitazione → ricerca completa
  ri-eseguita a ogni keystroke (già notato come follow-up in `MEDIUM-EASY-TASK.md`).
- **Mitigazione:** debounce ~250ms sul content-watcher della sidebar (follow-up già suggerito lì,
  farlo davvero); R1.3/R2 riducono il peso per-tab. Niente cap artificiale sul numero tab (UX peggiore
  del problema); la tab bar regge (wrap multi-row già progettato per questo).

### R4 — File enormi / righe lunghissime in source
- **Fatti:** T-M6 (auto-source >2MB) pianificato ma NON implementato; in source restano attivi
  `styleActiveLine`, `matchHighlighter`, `lineWrapping` — su righe singole da MB (minified js/json)
  CM5 soffre comunque.
- **Mitigazione:** implementare T-M6 presto (è la guardia principale); in `sourceCode.vue`, se
  `markdown.length` > soglia alta (es. 10MB) disattivare `highlightSelectionMatches` e
  `styleActiveLine` al volo (`setOption`) — degradare con grazia invece di freezare.

### R5 — Schermi piccoli / DPI / multi-monitor
- **Fatto:** `minWidth: 820` (fix BUG-1) + `win.setMinimumSize` enforcement. `electron-window-state`
  gestisce posizione/size (`mainWindowState.manage(win)`, `windows/editor.js:244`).
- **Scenari limite:** (1) schermo con workArea **< 820px** logici: netbook 1024×600 con scaling 125%
  → workArea ~819px → finestra più larga dello schermo, controlli irraggiungibili; (2) monitor
  staccato (laptop+dock): ✅ **già coperto** — `ensureWindowPosition` (`windows/utils.js:22-50`)
  verifica che x/y cadano su un display reale e altrimenti ri-centra sul primario (verificato §6.6);
  resta SOLO il clamp di minWidth; (3) scaling 150/200%: layout CSS px-based regge, ma il wrap tab
  dipende da misure reali → già coperto da ResizeObserver.
- **Mitigazione:** al boot, clamp: `minWidth = Math.min(820, screen.workAreaSize.width)` (main,
  `screen` API Electron, ~3 righe in `windows/editor.js` prima di `setMinimumSize`) — sotto 820 il
  layout tab degrada (clipping possibile) ma l'app resta usabile: meglio di una finestra fuori schermo.
  Test consigliato: impostare scaling Windows 150% e 200% e ripetere le verifiche BUG-1 §7.

### R6 — Piattaforme non testate
- **macOS:** T-ME + BUG-2 implementati ma MAI verificati su Mac (taratura `trafficLightPosition`,
  `padding-left:78`, `minWidth:780`). Restano i task "da tarare su Mac" già tracciati in `MEDIUM-TASK.md`.
- **Linux:** il ramo `if (!isOsx)` include Linux → titlebar custom + Alt-toggle menu attivi anche lì.
  ⚠️ Mai testato: `-webkit-app-region: drag` su Linux/Wayland ha bug storici Electron (drag che non
  parte, doppio click maximize) — non risolvibile alla cieca: segnare come "richiede smoke test su
  Linux X11 e Wayland" prima di distribuire. `installer.nsh`/registry è Windows-only (ok, gated).
- **Windows ARM / vecchie GPU:** moduli nativi (`native-keymap` patchato, vedi S4) →
  `npx electron-rebuild` documentato; rendering: niente assunzioni GPU-specifiche trovate.

### R7 — Scritture su disco non atomiche (perdita dati su crash/power loss) — ✅ CONFERMATO (§6.6)
- **Verificato:** `writeMarkdownFile` (`main/filesystem/markdown.js:58-71`) → `writeFile`
  (`main/filesystem/index.js:25-32`) → `outputFile` (fs-extra) = **write diretto**. C'è perfino il
  TODO upstream mai fatto, riga 69: `// TODO(@fxha): "safeSaveDocuments" using temporary file and
  rename syscall.` Un power loss / crash a metà scrittura tronca il file dell'utente.
- **Mitigazione:** pattern write-temp-then-rename (`<file>.tmp` + `fs.rename`, atomico sullo stesso
  volume) dentro `writeFile` (punto unico, tutti i caller beneficiano: save, save-as, export).
  Stesso pattern OBBLIGATORIO per `session.json`/drafts di H2. Nota: su volumi di rete il rename può
  non essere atomico — accettabile (best effort). Ricordare `ignoreChangedEvent` del watcher: il
  rename finale genera comunque UN evento sul path finale → il meccanismo esistente
  (`window-file-saved` → ignore) continua a funzionare invariato.

### R8 — Watcher su drive di rete / cloud / USB
- **Fatti:** chokidar su file aperti; unlink → `pushTabNotification`; dialog reload per tab attiva.
- **Scenari:** OneDrive/Dropbox generano change burst (download placeholder, sync a blocchi) → dialog
  reload ripetuti; USB rimossa → unlink di massa; drive di rete: inotify non disponibile → chokidar
  può richiedere polling.
- **Mitigazione minima:** debounce/coalescing dei change per lo stesso path nel watcher (se non già
  presente — ⚠️ grep `awaitWriteFinish` in `watcher.js`: chokidar ce l'ha built-in, attivarlo con
  `stabilityThreshold` ~300ms se assente). USB/unlink: il flusso notifica esistente basta.

### R9 — Encoding/EOL edge
- **Fatti:** B3 ha sistemato ASCII/ANSI; CR legacy supportato; BOM deterministico.
- **Scenari residui:** file con EOL **misti** (CRLF+LF nello stesso file): `getLineEnding` ne sceglie
  uno → al save light-touch la formattazione è preservata, ma a save "pieno" normalizza — comportamento
  accettabile, da documentare; `ced` su file ENORMI non-UTF8: l'euristica gira sul buffer intero →
  con T-M6 va comunque in source, costo una tantum all'apertura, ok.

### R10 — Minori (censiti, nessuna azione subito)
- `os.tmpdir()` usato solo per il dump diagnostico tastiera (`keyboard/index.js:65`) — innocuo.
- `justLoaded`/`LOAD_SETTLE_MS` usano `Date.now()` → un cambio orologio di sistema nel ~400ms di
  settle è irrilevante in pratica.
- `autoSaveTimers`: già puliti su chiusura tab (`store/editor.js:871-874`) — nessun leak.
- File monstre del progetto: `store/editor.js` = **1778 righe**, `tabs.vue` = **1057** — sotto la
  soglia critica ma in crescita: quando H2/H4 li toccano, valutare estrazione moduli
  (es. `store/session.js` per H2 invece di gonfiare `editor.js`).

---

## 4. Ordine consigliato

### Ordine AGGIORNATO (2026-06-20, post-H8) — usare questo

0. **BUILD-1** (patch-package) — PRIMA di tutto ciò che tocca dipendenze: il prossimo `npm install`
   cancella le patch CM5/native-keymap esistenti (crash di ritorno). Serve `npm`.
1. **Testare i 🧪 già fatti** (B-REV3/4/8/10, M-REV8/11, BUG-MUYA-UNDO-SWITCH) + checklist runtime
   §6.8 (R-1..R-11). Verificare la base prima di costruirci sopra.
2. **BUG-1** tab bar (§1, ~15 min) + rimozione log `[TABDBG]`.
3. **Quick-win robustezza:** R2 + R5 + R7 (piccoli, indipendenti, alto valore; R3 già fatto = P-REV3).
4. **Decisioni** B-REV5 / B-REV7 / B-REV11 → applicare (validazioni codice nel blocco sotto la tabella).
5. **T-M1** (`MEDIUM-TASK.md`) → **H3** (`Ctrl+K`, libera `toggle-toc`).
6. **H1** multi-selez additiva (guard solo Ctrl+D, vedi validazione).
7. **H2** persistenza: (a) → (b) → solo dopo verifica completa → (c).
8. **H4** pin tab.
9. **R1 + R4 + T-M6** (depth dinamico Muya, degrade CM, auto-source file grandi).
10. **P-REV2 + P-REV5** (changeGeneration, cap risultati ricerca).
11. **H5** detach: Fase 1; Fase 2 solo se la 1 convince; Fase 3 rimandata.
12. **Refactor M-REV** (commit dedicati) + M-REV10 (solo con test drag).
13. **BUG-CP1 / BUG-CP2** (prima verificare la root cause: oggi solo "probabile").

### Ordine originale (2026-06-09, pre-H8) — storico, lasciato come riferimento

1. **Fix BUG-1** (`tabs.vue`, §1 — pronto, 15 min + verifiche runtime) + rimozione log `[TABDBG]`.
2. **R2 + R3-debounce** (cap LRU `cmStatePerTab`, `undoDepth` 1000, debounce content-watcher) —
   piccoli, indipendenti, alto valore.
3. **T-M1** (da `MEDIUM-TASK.md`) — prerequisito di H3.
4. **H3** `Ctrl+K C/U` (post T-M1, libera `Ctrl+K` da toggle-toc).
5. **H1** multi-selezione additiva.
6. **H2** persistenza sessione: fase (a) → (b) → solo dopo verifica completa → (c).
7. **H4** pin tab.
8. **R1** (depth dinamico Muya) + **T-M6** (auto-source file grandi) + **R5/R7/R8** (clamp minWidth,
   write atomico, awaitWriteFinish).
9. **H5** detach: Fase 1; Fase 2 solo se la 1 convince; Fase 3 rimandata.

## 5. Verifiche obbligatorie pre-codice (residue, per chi implementa)

- [ ] H1: Ctrl+drag multi-selezione nativa funziona già? (test runtime, prima di scrivere codice)
- [x] H2: come nasce `tab.id` — **VERIFICATO (review §6)**: `getUniqueId()` random per sessione (`store/help.js:61,96`) → il restore H2 deve rimappare i draft per **pathname** (file salvati) e per nome-file-draft (untitled), MAI per id.
- [ ] H2: grep `writeFile` in `src/main/filesystem/` per il punto unico di scrittura (R7)
- [ ] H3: grep `toggle-toc` — la feature TOC è ancora viva da qualche path?
- [ ] H5: grep dedup file-già-aperto (`normalizeAndResolvePath` in `windowManager.js`)
- [x] R8: **VERIFICATO (review §6)**: `awaitWriteFinish` GIÀ attivo in `watcher.js:193-196` (`stabilityThreshold:1000`, `pollInterval:150`) + gestione cloud-drive via `stat` mtime (`_shouldIgnoreEvent`, GH#3044) già presente → R8 ridimensionato: nessuna azione, solo smoke test su OneDrive/rete.
- [ ] Ogni keybinding nuovo: grep nelle 3 mappe `keybindings*.js` (regola H di `EASY-TASK.md`)

---

## 6. Review critica dei fix/feature esistenti (2026-06-09) — bug trovati + migliorie

> Review riga-per-riga dei file toccati dai task di `DESIGN/EASY/MEDIUM-EASY/MEDIUM-TASK`:
> `store/editor.js` (intero), `sourceCode.vue` (intero), `editor.vue` (intero), `tabs.vue`,
> `watcher.js`, `encoding.js`, `store/help.js`, `listenForMain.js`, `sideBar/search.vue`,
> `muya/lib/contentState/{history,index}.js`. Anchor verificati il 2026-06-09.
> Classificazione: **B-REV** = bug di correttezza · **P-REV** = performance/scalabilità ·
> **M-REV** = manutenibilità/semplicità. In fondo: cosa è risultato SOLIDO (non toccare).

### 6.1 Bug di correttezza (in ordine di priorità)

**B-REV1 — Regex `[\r?\n]` errata: tronca i `?` a fine documento (PRIORITÀ MASSIMA, fix da 2 caratteri ×2)**
- Dove: `store/editor.js:1674` (`trimTrailingNewlines`) e `sourceCode.vue:316` (`normalizeMarkdown`→`trimEnd`).
- `[\r?\n]` è una **character class**: dentro le quadre `?` è un carattere letterale, non un quantificatore.
  La regex `/[\r?\n]+$/` quindi rimuove dalla fine qualsiasi sequenza di `\r`, `\n` **e `?`**.
- Impatti reali: con opzione trailing-newline **0** (trim) o **1** (singola): (a) `adjustTrailingNewlines`
  passa per `trimTrailingNewlines` → un documento che finisce con `"Come stai?"` viene **salvato come
  `"Come stai"`** (corruzione dati); (b) N12 (`cursorActivity`): digitare `?` a fine documento → entrambi
  i lati normalizzati lo strippano → considerato uguale alla baseline → bollino spento e **autosave
  saltato** (`HANDLE_AUTO_SAVE` controlla `!tab.isSaved`).
- **⚠️ ESCALATION (secondo giro, §6.6):** il default NON protegge. `loadMarkdownFile`
  (`main/filesystem/markdown.js:125-142`) con preferenza `trimTrailingNewline=2` fa **auto-detect per
  file**: file che NON termina con newline → opzione **0** (trim) → la regex bacata è ATTIVA con la
  configurazione di default per qualsiasi file senza newline finale. Un file che finisce con `?`
  (es. una nota "Da fare?") viene corrotto al primo salvataggio.
- Fix: `/[\r\n]+$/` in entrambi i punti. Vedi anche M-REV6 (de-duplicare la funzione → un solo punto da fixare).

**B-REV2 — Cambio opzione final-newline marca la tab come SALVATA (`isSaved = true`)**
- Dove: `store/editor.js:1466` (`LINTEN_FOR_SET_FINAL_NEWLINE`).
- Incoerente con EOL (`SET_LINE_ENDING:1433` → `isSaved = false`, N14) ed encoding (`:1456` → `false`).
  Cambiare l'opzione dalla status bar su una tab **dirty** spegne il bollino senza che nulla sia stato
  salvato → l'utente può chiudere perdendo modifiche. Quasi certamente typo copy-paste: dev'essere `false`.

**B-REV3 — Chiusura finestra/tab legge `tab.markdown` stale (finestra di perdita dati ~1s in source)**
- Dove: `store/editor.js` — `LISTEN_FOR_CLOSE` (519), `ASK_FOR_SAVE_ALL` (558), `CLOSE_UNSAVED_TAB` (911).
- In source mode il commit allo store è debounced 1s (invariante A di `EASY-TASK.md`). `FILE_SAVE` emette
  `pre-save` per flushare (B8), ma **i tre percorsi di chiusura NO**: digitando e chiudendo entro 1s
  (X finestra, `Ctrl+W` su tab dirty, Save All) il contenuto raccolto per dialog/salvataggio è quello
  di 1s fa → si salvano dati vecchi confermando "Salva".
- Fix: `bus.emit('pre-save')` come **prima riga** dei tre handler (mitt è sincrono; `handlePreSave` è
  volutamente senza guardie, B13 → sicuro; se non ci sono modifiche è no-op).

**B-REV4 — Guard-order: deref prima del null-check in `editor.vue handleFileChange`**
- Dove: `editor.vue:974` `const { container } = editor.value` PRIMA di `if (editor.value)` (976).
- Se l'evento arriva con `editor.value` null (teardown/race al cambio modalità) → TypeError. Spostare la
  destrutturazione dentro l'`if`. Difensivo, 1 riga.

**B-REV5 — lightTouch "mangia" gli hard line break markdown (modifiche solo-whitespace mai salvate)**
- Dove: `normalizeBlock` (`store/editor.js:1684`) usata da `getMarkdownForSave`.
- `normalizeBlock` rimuove i trailing spaces e collassa gli spazi multipli → aggiungere un **hard break
  markdown (2 spazi a fine riga)**, o qualsiasi modifica di soli spazi, risulta "semanticamente uguale"
  → `getMarkdownForSave` ritorna `originalMarkdown` → **la modifica non viene mai scritta su disco**
  (con lightTouch ON, default). I 2 spazi finali sono sintassi markdown significativa, non rumore.
- Fix proposto: in `normalizeBlock` preservare il pattern hard-break (es. sostituire `/ {2,}$/gm` con un
  token sentinella prima delle altre normalizzazioni). In alternativa minimal: documentare il limite e
  valutare se il caso d'uso reale lo giustifica. Decidere prima di toccare: `normalizeBlock` è usata
  anche nei check post-save B9 (`mt::tab-saved`/`set-pathname`) → stessa modifica vale ovunque, coerente.

**B-REV6 — `FILE_SAVE_AS` non registra `pendingSavedMarkdown` → baseline potenzialmente sbagliata**
- Dove: `store/editor.js:358-379`; il ramo `mt::set-pathname` (416-441) trova sempre `savedMarkdown`
  undefined e finisce nel fallback commentato "shouldn't happen" → baseline = contenuto corrente **al
  momento della risposta**. Se l'utente edita mentre il dialog Save As è aperto, la baseline include
  modifiche NON scritte su disco → bollino spento su contenuto divergente dal file.
- Fix: in `FILE_SAVE_AS` fare `pendingSavedMarkdown.set(id, markdown)` (come `FILE_SAVE`); il race-check
  esistente in `set-pathname` poi funziona da solo. ~2 righe.

**B-REV7 (minore) — `ASK_FOR_SAVE_ALL` filtro anomalo**
- `filter((file) => !(file.isSaved && /[^\n]/.test(file.markdown)))` include tra gli "unsaved" anche le
  tab **salvate ma vuote** → un Save All le ri-processa inutilmente (possibile dialog per untitled vuote).
  Verificare l'intento; il filtro simmetrico a `LISTEN_FOR_CLOSE` sarebbe `!file.isSaved`.

**B-REV8 (minore) — `getBlankFileState` può produrre "Untitled-NaN"**
- `store/help.js:88` `+f.filename.split('-')[1]` → `NaN` se una tab senza pathname ha filename senza `-`
  → `Math.max(NaN,…)` = NaN. Guard: `Number(...) || 0`.

### 6.2 Performance / scalabilità (si sommano a R1-R4 di §3)

**P-REV1 — `mergeWithOriginal`: LCS O(n×m) con matrice piena (freeze/OOM su file grandi) — GRAVE**
- Dove: `store/editor.js:1717` (`computeLcs`) — `dp` = matrice (n+1)×(m+1) di array JS.
- File da 10k righe modificato → ~100M celle → secondi di freeze + centinaia di MB. Chiamato da
  `getMarkdownForSave` su **ogni save E ogni autosave** (lightTouch ON + contenuto semanticamente diverso)
  → con autosave attivo il costo si paga a ogni `autoSaveDelay`.
- Fix minimo (~4 righe): size-guard in `getMarkdownForSave` — se `origLines + regenLines > soglia`
  (es. 3000 righe totali) saltare il merge e ritornare `currentMarkdown` (lightTouch degrada con grazia:
  meglio perdere la preservazione formato che freezare). L'alternativa (Myers/Hirschberg diff
  memory-efficient) è complessità non giustificata.

**P-REV2 — `cursorActivity` fa O(n) ×4 a ogni movimento cursore (source)**
- Dove: `sourceCode.vue:577-628` — ogni click/freccia esegue `cm.getValue()` (copia intera del documento),
  `getWordCount` (scan completo), e N12 fa 2× `normalizeMarkdown` (altre 2 copie). Su file da MB ogni
  spostamento cursore costa svariati ms → input lag percepibile.
- Migliorie: (a) spostare `getValue`/`wordCount` su `cm.on('change')` + dentro il commitTimer (il contenuto
  cambia solo lì; cursorActivity resta per selezione/status bar/N12); (b) N12 via API native CM:
  `cm.changeGeneration()` salvata a load/save/reload + `cm.isClean(gen)` = check O(1) senza stringhe.
  Il confronto stringhe resta solo come fallback dove la baseline cambia esternamente (reload, B12).

**P-REV3 — Content-watcher sidebar: concatena TUTTO il contenuto di tutte le tab a ogni flush — GRAVE con molte tab**
- Dove: `sideBar/search.vue:231` `watch(() => tabs.value.map(t => t.markdown).join('\n\x00\n'), …)`.
- Il getter ricostruisce una stringa = somma di tutti i documenti **a ogni modifica di qualsiasi tab**
  (in Muya il commit è sincrono → ogni keystroke). Il componente resta montato anche a sidebar nascosta
  (`v-show`) → il costo si paga sempre dopo la prima apertura. 30 tab × file grandi = MB copiati per battito.
- Fix pulito: contatore `contentVersion` nello store (incrementato in `LISTEN_FOR_CONTENT_CHANGE`, O(1))
  → `watch(() => editorStore.contentVersion, …)` + early-exit `if (!keyword.value || !showSideBar.value)`
  + debounce ~250ms (il follow-up già suggerito in `MEDIUM-EASY-TASK.md`). Elimina anche il NUL (M-REV1).

**P-REV4 — Doppia esecuzione `search()` per keystroke**
- `watch(keyword)` (211) e `onInput` (215-219) chiamano entrambi `search()` → 2× costo per battito
  nell'input sidebar. Tenere il watch; `onInput` deve solo riallineare `keyword` (il watch poi scatta).

**P-REV5 — Ricerca e highlight senza cap risultati**
- `search()` accumula TUTTI i match senza limite e la lista è `v-for` non virtualizzato: cercare "e" su
  30 tab → 10⁵+ oggetti + nodi DOM → freeze. Idem `highlightSourceMatches` (`sourceCode.vue:448`):
  un `markText` per occorrenza, nessun cap.
- Fix: cap per tab (~500) + totale (~2000) con messaggio "troppi risultati, raffina la ricerca";
  cap mark editor (~1000). Nota: regex utente patologiche (backtracking catastrofico) possono comunque
  freezare il renderer — rischio accettato (comune a tutti gli editor JS), il cap riduce la superficie.

### 6.3 Manutenibilità / semplicità

**M-REV1 — Byte NUL letterale nel sorgente di `search.vue` (riga 231)**
- Il separatore del `join` contiene un U+0000 **grezzo** nel file → ripgrep/grep trattano l'INTERO file
  come binario (questa review l'ha scoperto perché `Grep` non matchava nulla), i diff possono comportarsi
  male. Sostituire con l'escape `' '` — o meglio, P-REV3 elimina del tutto il join.

**M-REV2 — Logica pinnedTab triplicata in `tabs.vue`**
- L'helper `recomputePinnedTab()` (468) esiste, ma `watch(currentFile.id)` (632-657) e `watch(hasMultiRow)`
  (662-693) reimplementano lo stesso calcolo inline (3 copie con micro-differenze). Sostituire i corpi
  con chiamate all'helper, lasciando ai watch solo ciò che hanno in più (lock 150ms, nextTick/rAF).
  Meno superficie per il prossimo bug di desincronizzazione clone/pinned.

**M-REV3 — Duplicazione restore snapshot CM in `sourceCode.vue`**
- La logica `cmStatePerTab` restore (confronto snapshot vs store, setValue, setHistory-dopo-cursore) è
  duplicata tra `onMounted` (748-775) e `handleFileChange` (206-220, 264-268) con varianti sottili.
  Estrarre helper `restoreCmStateForTab(cm, id, storeMarkdown)` → un solo punto per la regola
  "setHistory DOPO il cursore" (già causa di bug sottili, vedi commenti 199-203).

**M-REV4 — `normalizeMarkdown` (sourceCode) = replica dichiarata di `adjustTrailingNewlines` (store)**
- Due copie della stessa semantica in due file (con lo stesso bug B-REV1 in entrambe — dimostrazione
  pratica del costo della duplicazione). Estrarre in `util/index.js` e importare da entrambi.

**M-REV5 — ~35 watcher fotocopia in `editor.vue` (245-469)**
- Tutti della forma `watch(x, (v,o) => { if (v!==o && editor.value) editor.value.setOptions({k:v}) })`.
  Tabella `[[ref, optionKey, needsRender?]]` + un loop = −150 righe a semantica identica. Tenere fuori
  i casi speciali (theme/mermaid, spellchecker, font). Riduce `editor.vue` sotto le 1200 righe.

**M-REV6 — Typo sistematico `LINTEN_FOR_*`**
- `LINTEN_FOR_EXPORT_SUCCESS`, `LINTEN_FOR_PRINT_SERVICE_CLEARUP`, `LINTEN_FOR_SET_LINE_ENDING`,
  `LINTEN_FOR_SET_ENCODING`, `LINTEN_FOR_SET_FINAL_NEWLINE` (store/editor.js). Rinomina con grep
  call-site (sono chiamate al bootstrap, pochi siti). Solo leggibilità — farlo in un commit dedicato.

**M-REV7 — Shape tab implicita**
- `justLoaded` e `pendingExternalChange` non esistono in `defaultFileState` (`store/help.js:9`) e vengono
  aggiunti dinamicamente. Funziona (proxy Vue3), ma chi legge `help.js` non vede la shape reale.
  Aggiungere `justLoaded: 0, pendingExternalChange: null` ai default. Propedeutico a H2 (serializzazione).

**M-REV8 — `encoding.js:124` `replace(/-_/g,'')`**
- Già censito in `EASY-TASK.md` come finding minore, ancora presente. Dovrebbe essere `/[-_]/g`.
  Impatto basso (iconv-lite tollera i nomi con trattino) ma fix da 4 caratteri.

**M-REV9 — Due `watch(showSideBar)` separati in `search.vue` (243 e 281)** — fonderli in uno.

**M-REV10 — `resyncDomToStore` + `tabsRenderKey++` insieme (`tabs.vue:344-365, 547-553`)**
- Su dragend si fa SIA il riordino DOM manuale (insertBefore/removeChild — ciò che le lezioni dragula
  dicono di evitare) SIA la ricreazione completa via `:key`. La seconda rende la prima quasi sempre
  superflua. Da verificare a runtime se `resyncDomToStore` sia ancora necessaria (probabile residuo di
  un fix intermedio); se sì documentare PERCHÉ, se no rimuoverla. Non toccare senza test drag completi.

### 6.4 Verificato SOLIDO (lasciare com'è)

- **pre-save flush B8/B13**: `handlePreSave` senza guardie ✓, `FILE_SAVE` emette prima di leggere ✓.
- **Race-handling salvataggio**: `pendingSavedMarkdown` con triplo check (exact / normalizeBlock / divergente)
  in `mt::tab-saved` e `mt::set-pathname` — ben fatto e commentato.
- **Watcher**: `awaitWriteFinish` già configurato (1000/150), gestione cloud-drive via `stat` mtime
  (GH#3044), gestione ENOSPC inotify, rewatch su rename Linux, `closeFn` con cleanup completo ✓.
- **Guard B6 simmetrici**: `editor.vue` esce se `sourceCode`, `sourceCode.vue` esce se `!sourceCode` ✓;
  `bus.on`/`bus.off` simmetrici 1:1 in entrambi i componenti (verificati elenco contro elenco) ✓.
- **Ricerca**: guard zero-length match ✓, replace-all in ordine inverso ✓, regex try/catch ✓,
  clamp cursore NB11 con try/catch+fallback ✓.
- **encoding.js**: BOM-first ✓, `isValidUtf8` single-pass corretto ✓, fallback ced→utf8 ✓.
- **Muya history debounce 800ms + pushPending/commitPending**: coerente con word-boundary (S6) ✓.

### 6.5 Ordine consigliato per gli interventi di questa sezione

1. **Subito (fix <10 righe, rischio ~zero):** B-REV1 (regex ×2) · B-REV2 (`isSaved=false`) ·
   B-REV4 (guard-order) · B-REV6 (`pendingSavedMarkdown` in Save As) · M-REV8 (`/[-_]/g`) · B-REV8 (NaN guard).
2. **Priorità alta (perdita dati / freeze):** B-REV3 (pre-save nei 3 path di chiusura) ·
   P-REV1 (size-guard LCS) · P-REV3+M-REV1 (contentVersion, elimina join+NUL).
3. **Seconda passata:** P-REV2 (changeGeneration) · P-REV4/P-REV5 (cap ricerca) · B-REV5 (hard-break,
   decidere prima) · B-REV7 (filtro Save All, verificare intento).
4. **Refactor a freddo (commit dedicati, zero feature insieme):** M-REV2/3/4/5/7/9 · M-REV6 (rename) ·
   M-REV10 (solo con sessione di test drag).

---

### 6.6 Secondo giro (2026-06-09) — main process + componenti restanti

> File analizzati: `main/filesystem/markdown.js` + `index.js` (writeFile), `main/config.js`,
> `main/windows/editor.js` (intero) + `utils.js` (ensureWindowPosition), `main/menu/actions/file.js`
> (save/close handlers), `main/app/windowManager.js` (handler senza prefisso), `editorWithTabs/index.vue`,
> `statusBar/index.vue`, `sideBar/searchResultItem.vue`, `muya/lib/contentState/{arrowCtrl,inputCtrl}.js`,
> `codeMirror/index.js`, `store/preferences.js` (SET_MODE/toggle). Esiti: 1 bug alto, 2 minori,
> 4 voci manutenibilità, 1 nota security, più le CONFERME già integrate sopra (escalation B-REV1,
> R7 confermato, R5 ridimensionato).

**B-REV9 — Chiusura finestra procede anche se il salvataggio FALLISCE (perdita dati) — ALTO**
- Dove: `menu/actions/file.js:324-369` (`mt::close-window-confirm`) + `handleResponseForSave` (114-165).
- `handleResponseForSave` ha un `.catch` interno (161-164: log + `mt::tab-save-failure`) → **non
  rigetta mai** → la `Promise.all` in `close-window-confirm` risolve sempre → `window-close-by-id`
  viene emesso **anche con scrittura fallita** (disco pieno, file readonly, path di rete caduto).
  La finestra si chiude, le modifiche non sono su disco. Il dialog di recupero "saveFailure/keepOpen"
  (353-364) è **codice irraggiungibile** (il `.catch` esterno non scatta mai).
- Confronto: `mt::save-and-close-tabs` (238-271) è CORRETTO — usa il valore di ritorno (`id` solo in
  successo, `undefined` su errore) e chiude solo le tab con `id != null`.
- Fix: `close-window-confirm` deve applicare lo stesso pattern: `Promise.all(...).then((arr) => {
  const failed = unsavedFiles.length - arr.filter((id) => id != null).length; if (failed === 0)
  { ipcMain.emit('window-close-by-id', win.id) } else { /* dialog saveFailure/keepOpen, ora
  raggiungibile */ } })`. Nessun cambio a `handleResponseForSave` (gli altri caller dipendono dal
  comportamento attuale).

**B-REV10 — B10 (`arrowCtrl.js` ~136-160): `sel.extend()` senza guard su `rangeCount`**
- Se la `Selection` non ha range attivi (`sel.rangeCount === 0`) `extend()` lancia. Il guard attuale
  (`if (!sel) return`) non basta (`getSelection()` non è mai null). Aggiungere
  `if (!sel || sel.rangeCount === 0) return`. Difensivo, 1 riga.

**M-REV11 — `canToggleMode` duplica la lista estensioni markdown (`statusBar/index.vue:162-167`)**
- Lista `['.md','.markdown',…]` copiata inline invece di usare `isMarkdownPath` (`util/index.js`),
  che `MEDIUM-EASY-TASK.md` dichiara "fonte di verità UNICA". Se si aggiunge un'estensione lì, il
  bottone della status bar diverge silenziosamente da `_applySourceCodeForFile`. Fix: import + 1 riga.

**M-REV12 — Stringhe italiane hardcoded nella status bar (bypass i18n)**
- `statusBar/index.vue`: tooltip `'Solo source: file non-markdown'`, `'Wrap non disponibile…'`,
  voce `'Altri set di caratteri'`, etichette gruppi encoding (`'Arabo'`, `'Cirillico'`, …).
  L'app ha 9 locales e `en.json` è la base (non esiste `it.json`, vedi `EASY-TASK.md`): un utente
  inglese vede UI mista. Estrarre chiavi `statusBar.*` in `en.json` (fallback inglese) e usare `t()`.

**M-REV13 — `isCollapsed` invertito e morto (`searchResultItem.vue:138`)**
- `isCollapsed: range[0][0] !== range[1][0]` = true quando il match è multi-riga — l'OPPOSTO della
  semantica del nome. Grep su tutto `src/`: nessun consumer del campo nel flusso cursore (gli altri
  `isCollapsed` sono dei folder del tree, non correlati). Campo morto e fuorviante → rimuoverlo
  (o correggerlo se servirà al jump preciso futuro).

**M-REV14 — Muya resta montato e renderizzato dietro CodeMirror (nota architetturale)**
- `editorWithTabs/index.vue:7-18`: `<editor>` (Muya) NON ha `v-if` — in source mode resta montato,
  nascosto via CSS (`.editor-wrapper.source { z-index:-1 }`, `editor.vue:1337`). Tiene vivo il DOM
  dell'ULTIMO documento markdown renderizzato + spellchecker + listener. Scelta deliberata (evita
  remount costosi e i bug B6 da rimonte), il sistema di guardie ci si appoggia → NON cambiarla alla
  leggera. Costo: memoria del DOM fantasma su documenti grandi. Solo da sapere; eventuale ottimizzazione
  (svuotare Muya quando si entra in source su tab non-markdown) va progettata CONTRO le guardie B6.

**S-REV1 — Nota security (censimento, fuori scopo fix immediato)**
- `config.js:15-23`: `nodeIntegration:true`, `contextIsolation:false`, `webSecurity:false` — assetto
  ereditato da MarkText upstream. Conseguenza: qualsiasi XSS nel renderer (es. via rendering di
  markdown/HTML malevolo) = accesso Node completo (RCE). Muya ha `disableHtml` e sanitizzazione
  upstream, ma per "adozione su larga scala" con file non fidati questo è IL rischio architetturale
  principale. Migrare a contextIsolation è un progetto a sé (preload bridge, tutti gli accessi
  `window.electron/path/fileUtils` da rifare) → censito qui, non pianificato.

**Verificato SOLIDO (aggiunte del secondo giro):**
- `swapLineUp/Down` (`codeMirror/index.js:28-83`): copia fedele dell'implementazione sublime,
  multi-selezione inclusa, edge prima/ultima riga gestiti come l'originale ✓ (già compatibile col
  futuro H1 multi-cursore).
- `ensureWindowPosition` (`windows/utils.js`): clamp size primo avvio + re-center se la posizione
  salvata non cade su nessun display ✓ (monitor scollegato coperto).
- BUG-1/BUG-2 di MEDIUM-TASK: `minWidth 820/780` + `win.setMinimumSize` (editor.js:85) +
  `trafficLightPosition` gated `isOsx` — tutti effettivamente applicati nel codice ✓.
- Alt-toggle menu bar con reset su `blur` (editor.js:96-111) ✓; fallback `zoom-changed` nativo ✓.
- `mt::save-and-close-tabs`: gli id falliti non vengono chiusi ✓ (è `close-window-confirm` l'anomalo,
  vedi B-REV9).
- Watcher self-save: `window-file-saved` → `ignoreChangedEvent` con durata = stability threshold ✓.
- `loadMarkdownFile`: detection EOL completa (LF/CRLF/CR puro/misti) + conversione interna a LF ✓.
- `inputCtrl` word-boundary: IME-safe (`isComposing` + `compositionend`) ✓.
- `searchResultItem`: paginazione "show more" (10+15) già presente ✓ → il rendering dei risultati è
  già mitigato; P-REV5 resta valido per l'ACCUMULO di match objects e per i mark nell'editor.

**Aggiornamento priorità (sostituisce l'ordine di §6.5 dove confligge):**
- Tier 1 (immediati) += **B-REV10** (1 riga) · **M-REV11** (2 righe).
- Tier 2 (perdita dati/freeze) += **B-REV9** (è il più grave del secondo giro) · **R7** (ora confermato,
  promosso da §3: write atomico in `writeFile`).
- Tier 3 += **M-REV12** (i18n status bar) · **M-REV13**.
- Invariato: B-REV1 resta il primo in assoluto (l'escalation lo rende attivo con config default).

---

### 6.7 Terzo giro (2026-06-10) — verifiche residue statiche

**🔴 BUILD-1 — `patches/` NON ESISTE + patch-package NON installato (CRITICO, perdita fix al prossimo `npm install`)**
- Verificato: `node_modules/codemirror/lib/codemirror.js` È attualmente patchato (`cmStaleLineView`
  presente ×2 — i crash-guard P-DF8 di `DESIGN-TASK.md` §12: `mapFromLineView`,
  `prepareMeasureForLine`, `posFromMouse`), ma: cartella `patches/` assente, `patch-package` non in
  `package.json`, nessuno script `postinstall`. **Il prossimo `npm install` (o CI/build pulita)
  cancella silenziosamente le patch** → ritorno dei crash su click in source mode (tiny line,
  cursore che non si setta) e del crash `native-keymap` (S4). È esattamente il punto S3 di
  `DESIGN-TASK.md`, mai completato — e `MEDIUM-EASY-TASK.md` lo sospettava già per il crash build.
- Fix (15 min): `npm i -D patch-package` → `npx patch-package codemirror native-keymap` →
  `"postinstall": "patch-package"` in scripts → committare `patches/*.patch`. Poi runtime check R-7 (§6.8).
- **Da fare PRIMA di qualsiasi altro lavoro che tocchi le dipendenze.**

**B-REV11 — Accelerator duplicati nei menu (comportamento ambiguo)**
- Verificato con scan delle 3 mappe (`keybindings*.js`):
  - **Windows**: `Ctrl+P` = `file.print` (riga 21) E `file.quick-open` (122); `Ctrl+Plus` =
    `paragraph.upgrade-heading` (59) E `window.zoomIn` (91); `Ctrl+-` = `paragraph.degrade-heading`
    (60) E `window.zoomOut` (92).
  - **Linux**: stessi duplicati `Ctrl+Plus`/`Ctrl+-`. **Darwin**: zero duplicati.
- I duplicati zoom sono stati introdotti dal fix B5 (`EASY-TASK.md`) senza liberare gli accelerator
  heading. Con due MenuItem sullo stesso accelerator Electron ne attiva di fatto uno solo (dipende
  dall'ordine di registrazione) → uno dei due comandi è silenziosamente morto, e QUALE dipende
  dall'ordine dei template menu. Decidere l'assegnazione (proposta: zoom vince — heading
  upgrade/degrade hanno alternative col menu; quick-open vince su print — print ha File>Print) e
  azzerare l'altro accelerator. Runtime check R-6 prima di scegliere (vedere chi vince oggi).

**B-REV12 — Race nel fileChangedDialog: evento esterno durante il fade-out si auto-annulla**
- `fileChangedDialog.vue:63-81`: `handleExternalChange` resetta `visible/closing` ma **non cancella
  `closeTimer`**. Sequenza: utente chiude il dialog → fade-out 220ms → nel frattempo arriva un nuovo
  `file-changed-externally` (cloud sync, salvataggi ravvicinati) → il timer pendente scatta →
  `visible=false` + `onClosed()` col **nuovo** `pendingChange` e `confirmed=false` → il nuovo evento
  viene auto-trattato come "Annulla" (`markDivergedFromDisk`) senza che l'utente abbia visto nulla.
- Fix: in `handleExternalChange`, `if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }`. 2 righe.

**M-REV12 (conferma)** — `en.json` ha SOLO `statusBar.toggleWrap` e `statusBar.resetZoom` (riga 1388-1390):
le altre stringhe della status bar (toggleSource, gruppi encoding, 'Altri set di caratteri') sono
hardcoded in italiano nel componente. Conferma definitiva del finding.

**Verificato SOLIDO (terzo giro):**
- `searchCtrl.js:152-157`: guard `if (value && !options.highlightOnly) setCursorToHighlight()` —
  fix round5 presente e corretto ✓.
- `search/index.vue` (find flottante): `bus.on`⇒`bus.off` simmetrici 1:1 ✓, `debounce 150ms`
  sull'input ✓ — nessun finding.
- `util/index.js adjustCursor` (49-87): pura, lavora solo su 3 righe di testo (preline/line/nextline),
  costo trascurabile → il peso di P-REV2 è tutto in `getValue()`/`getWordCount`, confermato.
- `fileChangedDialog.vue` (a parte B-REV12): ESC in capture, cleanup listener+timer in unmount,
  Opzione A implementata come documentato ✓.

### 6.8 Checklist verifiche RUNTIME (prossima sessione, app accesa con `npm run dev`)

> Le statiche sono esaurite (§6.1-6.7). Queste richiedono l'app in esecuzione. In ordine.

- [ ] **R-1 — Fix BUG-1 tab bar**: applicare il fix §1 (Edit 1+2 di `MEDIUM-TASK.md` §7 + guard
  `row1Count > 1`), poi eseguire le verifiche runtime 1-10 elencate in `MEDIUM-TASK.md` §7
  (wrap a 7/6 tab, re-wrap su espansione, no oscillazioni, lock, topright expanded, minimo 820,
  tab singola) e infine rimuovere TUTTI i log `[TABDBG]` da `tabs.vue`.
- [ ] **R-2 — Repro B-REV1** (PRIMA del fix, per conferma; poi regression DOPO): creare file `test.md`
  con contenuto `Da fare?` SENZA newline finale → aprire → modificare una parola → Ctrl+S →
  riaprire il file fuori da MarkText: il `?` finale deve esserci (pre-fix: sparisce).
- [ ] **R-3 — Repro B-REV2**: tab dirty (bollino acceso) → status bar → cambiare opzione final-newline
  → il bollino DEVE restare acceso (pre-fix: si spegne).
- [ ] **R-4 — Repro B-REV3**: in source mode digitare testo e chiudere la finestra ENTRO 1 secondo →
  "Salva" → riaprire: le ultime battute devono esserci (pre-fix: perse).
- [ ] **R-5 — Repro B-REV9**: aprire un file, renderlo readonly da Explorer (Proprietà → Sola lettura),
  modificarlo in MarkText, chiudere la finestra → "Salva" → pre-fix: la finestra si chiude e le
  modifiche sono perse; post-fix: dialog di errore e finestra ancora aperta.
- [ ] **R-6 — Accelerator duplicati (B-REV11)**: su Windows provare `Ctrl+P` (apre print o quick-open?)
  e `Ctrl+Plus`/`Ctrl+-` sia in Muya (heading cambia livello?) sia in source (zoom cambia?).
  Annotare chi vince → decidere assegnazione → azzerare l'accelerator perdente nelle mappe.
- [ ] **R-7 — patch-package (BUILD-1)**: dopo il setup patch-package, fare `npm install` pulito →
  grep `cmStaleLineView` in `node_modules/codemirror/lib/codemirror.js` (deve esserci) → avviare
  l'app e cliccare ripetutamente in source mode su file medio (nessun crash tiny-line).
- [ ] **R-8 — H1 prerequisito**: in source mode, Ctrl+click in due punti diversi e Ctrl+drag su due
  selezioni → CM5 crea multi-cursori/selezioni nativi? (Determina quanto resta da fare in H1.)
- [ ] **R-9 — Repro B-REV12**: con un file aperto, da un'altra app salvarlo 2 volte a ~200ms di
  distanza subito dopo aver chiuso il dialog di reload → il secondo dialog non deve auto-chiudersi.
- [ ] **R-10 — P-REV3 baseline**: sidebar ricerca aperta con keyword attiva + file .md grande (>500KB)
  → digitare in Muya e valutare il lag (baseline per misurare il miglioramento post-contentVersion).
- [ ] **R-11 — T-M1 modeURL in prod** (da `MEDIUM-TASK.md`): build di produzione → aprire .md con
  code-fence ```js → highlight presente? (Decide il fallback bundling dei mode.)

---

## 7. PRONTO-USO — contesto minimo + edit esatti (per sessione pulita)

> Questa sezione rende il file autosufficiente: contesto architetturale minimo e, per ogni fix di
> §6, il codice ATTUALE (verificato 2026-06-09/10) e il codice NUOVO. ⚠️ I numeri riga possono
> shiftare: prima di ogni edit, grep la stringa "PRIMA" — è unica nel file salvo dove indicato.

### 7.0 Contesto minimo (tutto ciò che serve sapere, senza rileggere gli altri doc)

1. **Due editor**: Muya (WYSIWYG, `editorWithTabs/editor.vue`) per .md/untitled; CodeMirror 5
   (`sourceCode.vue`) per il resto. Decide `_applySourceCodeForFile` via `isMarkdownPath`
   (`util/index.js`). Comunicazione store↔editor via `bus` (mitt, **sincrono**).
2. **Commit contenuto**: Muya → store **sincrono** a ogni change; CodeMirror → **debounced 1s**
   (`commitTimer` in `sourceCode.vue`). Quindi `tab.markdown` in source può essere stale ~1s:
   chi legge `tab.markdown` "adesso" deve PRIMA fare `bus.emit('pre-save')` (flush sincrono,
   listener `handlePreSave` in `sourceCode.vue`, volutamente senza guardie).
3. **Dirty flag**: `tab.isSaved` = confronto contenuto vs `tab.originalMarkdown` (baseline = ultima
   versione salvata/caricata; `null` per untitled mai salvati). `LISTEN_FOR_CONTENT_CHANGE`
   (store/editor.js) è il punto centrale; N12 in `cursorActivity` (sourceCode.vue) fa il check
   immediato post-Ctrl+Z.
4. **Salvataggio**: `FILE_SAVE` → `pre-save` → `getMarkdownForSave(markdown, originalMarkdown,
   lightTouch)` → IPC `mt::response-file-save` → main `handleResponseForSave`
   (`menu/actions/file.js`) → `writeMarkdownFile` (`main/filesystem/markdown.js`). Risposte:
   `mt::tab-saved` (path esistente) o `mt::set-pathname` (path nuovo). `pendingSavedMarkdown`
   (Map in store/editor.js) ricorda cosa si è chiesto di scrivere, per aggiornare la baseline.
5. **lightTouch** (default ON): se `normalizeBlock(corrente) === normalizeBlock(originale)` salva
   l'originale identico; altrimenti `mergeWithOriginal` (LCS riga-per-riga).
6. **Chiusura finestra**: `win.on('close')` → `preventDefault` → `mt::ask-for-close` → renderer
   `LISTEN_FOR_CLOSE` raccoglie i dirty → `mt::close-window-confirm` (dialog main) → save →
   `window-close-by-id`.
7. **File chiave**: store = `src/renderer/src/store/editor.js` · source editor =
   `src/renderer/src/components/editorWithTabs/sourceCode.vue` · Muya wrapper = `.../editor.vue` ·
   tab bar = `.../tabs.vue` · save main = `src/main/menu/actions/file.js` · IO file =
   `src/main/filesystem/{markdown,encoding,index}.js` · keybinding =
   `src/main/keyboard/keybindings{Windows,Linux,Darwin}.js`.
8. **Regole obbligatorie**: grep TUTTI i call-site prima di cambiare firme; `bus.on`⇒`bus.off`
   simmetrici; keybinding → grep nelle 3 mappe; Muya modificato → restart `npm run dev`.

### 7.1 BUILD-1 — patch-package (FARE PER PRIMO)

```bash
cd C:\Projects\MarkText\marktext
npm i -D patch-package
npx patch-package codemirror native-keymap
# in package.json → "scripts": aggiungere  "postinstall": "patch-package"
# committare la cartella patches/ (2 file .patch)
```
Verifica: `patches/codemirror+5.65.20.patch` esiste e contiene `cmStaleLineView`. Poi runtime R-7.

### 7.2 B-REV1 — regex `[\r?\n]` (2 file, stesso edit)

**File 1: `store/editor.js`** (helper `trimTrailingNewlines`, ~riga 1673) — PRIMA:
```js
const trimTrailingNewlines = (text) => {
  return text.replace(/[\r?\n]+$/, '')
}
```
DOPO: `text.replace(/[\r\n]+$/, '')` (solo rimosso `?`).

**File 2: `sourceCode.vue`** (dentro `normalizeMarkdown`, ~riga 316) — PRIMA:
```js
  const trimEnd = (s) => s.replace(/[\r?\n]+$/, '')
```
DOPO: `s.replace(/[\r\n]+$/, '')`.

Test: R-2 (§6.8). Nessun altro punto usa questa regex (grep `\[\\r\?` per conferma).

### 7.3 B-REV2 — final-newline marca saved

**`store/editor.js`** (`LINTEN_FOR_SET_FINAL_NEWLINE`, ~riga 1461) — PRIMA:
```js
        if (trimTrailingNewline !== value) {
          this.currentFile.trimTrailingNewline = value
          this.currentFile.isSaved = true
        }
```
DOPO: `this.currentFile.isSaved = false` (coerente con `SET_LINE_ENDING` e set-encoding, N14).

### 7.4 B-REV3 — pre-save nei 3 path di chiusura

**`store/editor.js`**, tre punti. `bus` è già importato (riga 2). In ciascuno, la PRIMA istruzione
del corpo deve diventare `bus.emit('pre-save')`:

1. `LISTEN_FOR_CLOSE` — dentro il callback di `ipcRenderer.on('mt::ask-for-close', () => {`,
   prima di `const { lightTouch } = preferencesStore`.
2. `ASK_FOR_SAVE_ALL(closeTabs)` — prima di `const { tabs } = this`.
3. `CLOSE_UNSAVED_TAB(file)` — prima di `const { id, pathname, filename, markdown } = file`.
   ⚠️ qui il flush aggiorna `tab.markdown` ma la destrutturazione legge `file` (stesso oggetto del
   tab nello store → ok, è un riferimento; verificare che il caller `CLOSE_TAB` passi proprio
   l'oggetto tab dello store — sì, verificato).

`pre-save` è idempotente e no-op se non ci sono modifiche (vedi 7.0 punto 2).

### 7.5 B-REV4 — guard-order editor.vue

**`editor.vue` `handleFileChange`** (~riga 971) — PRIMA:
```js
  if (sourceCode.value) return
  // Aggiorna prima del setMarkdown → il listener 'change' usa già l'id corretto.
  if (id) currentMuyaTabId.value = id
  const { container } = editor.value

  if (editor.value) {
```
DOPO:
```js
  if (sourceCode.value) return
  // Aggiorna prima del setMarkdown → il listener 'change' usa già l'id corretto.
  if (id) currentMuyaTabId.value = id

  if (editor.value) {
    const { container } = editor.value
```
(`container` è usato solo dentro l'if, righe successive — nessun altro uso fuori.)

### 7.6 B-REV6 — baseline Save As ⚠️ FIX RIVISTO (quello descritto in §6.1 era incompleto)

**Problema scoperto preparando l'edit:** il main, quando l'utente ANNULLA il dialog Save As, manda
comunque `mt::tab-saved` (hack per spegnere lo spinner — `menu/actions/file.js`, ramo `else` di
`response-file-save-as` e riga ~139 di `handleResponseForSave`). Se `FILE_SAVE_AS` registrasse
`pendingSavedMarkdown` (il fix "2 righe" di §6.1), l'annulla troverebbe il record e marcherebbe la
tab COME SALVATA senza scrittura. Fix corretto in 3 punti:

1. **main `menu/actions/file.js`** — nei DUE punti che inviano `tab-saved` per annullamento
   (grep `User canceled save dialog`): `win.webContents.send('mt::tab-saved', id)` →
   `win.webContents.send('mt::tab-saved', id, true)` (terzo arg = canceled).
2. **renderer `store/editor.js`** — handler `mt::tab-saved` (dentro `LISTEN_FOR_SET_PATHNAME`):
   firma `(_, tabId)` → `(_, tabId, canceled)`; come prima cosa nel corpo:
   ```js
   if (canceled) {
     pendingSavedMarkdown.delete(tabId)
     this._clearSavingSpinner()
     return // la tab resta nello stato in cui era (il save non è avvenuto)
   }
   ```
3. **renderer `FILE_SAVE_AS`** — dopo `if (id) {` aggiungere:
   ```js
   pendingSavedMarkdown.set(id, markdown)
   ```
Grep di sicurezza prima: `ipcRenderer.send('mt::tab-saved'` non deve esistere (solo il main lo manda) ✓.

### 7.7 B-REV8 / B-REV10 / M-REV8 / M-REV11 — micro-fix

- **B-REV8 `store/help.js`** (~riga 88): `return +f.filename.split('-')[1]` →
  `return Number(f.filename.split('-')[1]) || 0`.
- **B-REV10 `muya/lib/contentState/arrowCtrl.js`** (~riga 137, dentro il branch
  `ctrlKey && shiftKey && Arrow`): `if (!sel) return` → `if (!sel || sel.rangeCount === 0) return`.
  ⚠️ Muya → serve restart `npm run dev`.
- **M-REV8 `main/filesystem/encoding.js`** (~riga 124):
  `encoding = raw.toLowerCase().replace(/-_/g, '')` → `.replace(/[-_]/g, '')`.
- **M-REV11 `statusBar/index.vue`** (~righe 162-167): sostituire l'intero computed con:
  ```js
  import { isMarkdownPath } from '@/util'   // aggiungere agli import
  const canToggleMode = computed(() => isMarkdownPath(currentFile.value?.pathname || ''))
  ```
  ⚠️ verificare prima con grep che `isMarkdownPath('')` ritorni true (untitled → Muya): la firma
  attesa è `ext === '' || MARKDOWN_EXTENSIONS.includes(ext)`.

### 7.8 B-REV9 — chiusura su save fallito

**`main/menu/actions/file.js`**, handler `mt::close-window-confirm` (~riga 324). PRIMA (struttura):
```js
    Promise.all(
      unsavedFiles.map((file) => handleResponseForSave(...))
    )
      .then(() => {
        ipcMain.emit('window-close-by-id', win.id)
      })
      .catch((err) => {
        // dialog saveFailure/keepOpen — OGGI IRRAGGIUNGIBILE
      })
```
DOPO — usare il valore risolto (`handleResponseForSave` risolve con `id` in successo, `undefined`
su errore — NON modificarne il comportamento, altri caller vi dipendono):
```js
    Promise.all(
      unsavedFiles.map((file) =>
        handleResponseForSave(e, file.id, file.filename, file.pathname, file.markdown, file.options, file.defaultPath)
      )
    ).then((arr) => {
      const okCount = arr.filter((id) => id != null).length
      if (okCount === unsavedFiles.length) {
        ipcMain.emit('window-close-by-id', win.id)
        return
      }
      // Almeno un salvataggio è fallito: il dialog di recupero ora è raggiungibile.
      dialog
        .showMessageBox(win, {
          type: 'error',
          buttons: [t('dialog.close'), t('dialog.keepOpen')],
          message: t('dialog.saveFailure'),
          detail: t('dialog.changesWillBeLost')
        })
        .then(({ response }) => {
          if (win.id && response === 0) {
            ipcMain.emit('window-close-by-id', win.id)
          }
        })
    })
```
(Il vecchio `.catch` può restare come safety-net con `log.error`.) Test: R-5.

### 7.9 P-REV1 — size-guard LCS

**`store/editor.js` `getMarkdownForSave`** (~riga 1849), PRIMA del `return mergeWithOriginal(...)`:
```js
  // LCS O(n×m) con matrice piena: sopra soglia il merge freezerebbe il renderer.
  // lightTouch degrada con grazia: si salva il rigenerato (formato non preservato, contenuto sì).
  const totalLines =
    (currentMarkdown.match(/\n/g) || []).length + (originalMarkdown.match(/\n/g) || []).length
  if (totalLines > 3000) {
    return currentMarkdown
  }
```

### 7.10 P-REV3 + M-REV1 — contentVersion (elimina join con NUL)

1. **`store/editor.js` state** (~riga 38): aggiungere `contentVersion: 0,` accanto a `tabs: []`.
2. **`LISTEN_FOR_CONTENT_CHANGE`**: prima riga del corpo → `this.contentVersion++`
   (scatta anche su no-op: accettabile, il consumer è debounced).
3. **`sideBar/search.vue`** (~riga 230) — PRIMA (⚠️ il separatore del join contiene un byte NUL
   grezzo, il file risulta "binario" a grep):
```js
watch(
  () => tabs.value.map((tab) => tab.markdown).join('…NUL…'),
  () => {
    if (keyword.value) {
      search(true, true)
    }
  }
)
```
DOPO:
```js
let contentDebounce = null
watch(
  () => editorStore.contentVersion,
  () => {
    if (!keyword.value || !showSideBar.value) return
    clearTimeout(contentDebounce)
    contentDebounce = setTimeout(() => search(true, true), 250)
  }
)
```
(+ `clearTimeout(contentDebounce)` in `onBeforeUnmount`.) Test: R-10 prima/dopo.

### 7.11 B-REV12 — race fileChangedDialog

**`fileChangedDialog.vue` `handleExternalChange`** (~riga 63), prima riga del corpo:
```js
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
```

### 7.12 P-REV4 — onInput senza search doppia

**`sideBar/search.vue`** (~riga 215) — PRIMA:
```js
const onInput = (event) => {
  if (keyword.value !== event.target.value) keyword.value = event.target.value
  search()
}
```
DOPO: rimuovere la riga `search()` (l'assegnazione a `keyword` fa scattare `watch(keyword)`;
se il valore era già allineato la ricerca è già partita dal watch).

### 7.14 BUG-CP1 — Command palette non inserisce testo in source mode

Azioni della command palette che inseriscono markdown (es. `# titolo`) non hanno effetto se
l'editor è in source mode (CodeMirror). Funzionano solo in Muya. Il canale/bus usato probabilmente
chiama API Muya direttamente ignorando CM.

**ROOT CAUSE VERIFICATA SUL CODICE (2026-06-20):** non è "API Muya diretta" — è un **routing bus
incompleto verso il source editor**:
- Palette (`commands/index.js:231-431`) e menu (`store/listenForMain.js:68,71`) emettono
  `bus.emit('paragraph', tipo)` (heading/list/blockquote/table/code/hr/…) e `bus.emit('format', tipo)`
  (strong/em/link/image/…).
- `editor.vue` (Muya) ascolta ENTRAMBI: `bus.on('paragraph', handleEditParagraph)` (`:1262`) e
  `bus.on('format', handleInlineFormat)` (`:1263`) → in Muya tutto funziona.
- `sourceCode.vue` (CM) ascolta **solo `'format'`** (`:758`, `handleFormatInSource`) e **MAI `'paragraph'`**.
  Inoltre `handleFormatInSource` (`:419`) gestisce **solo** `type==='del'` (→ duplica riga, Ctrl+D) e
  `type==='link'` (→ elimina riga, Ctrl+L): NON inserisce markdown reale.
- ⇒ In source mode: tutti i comandi `'paragraph'` = **no-op**; tutti i `'format'` = no-op **TRANNE**
  `'del'`/`'link'` che hanno una **collisione latente** (la palette "Strikethrough" e "Link" in source
  farebbero rispettivamente duplica-riga / elimina-riga invece del formato). Vale anche per il MENU
  Paragraph/Format, non solo per la palette.
- **Fix (da decidere):** (A) minimo/sicuro = in source disabilitare/nascondere le voci paragraph/format
  e risolvere la collisione `'del'`/`'link'` (rinominare gli eventi delle line-op source, es. `'src-dup'`/
  `'src-delline'`); (B) completo = scrivere handler CM che inseriscono davvero la sintassi markdown
  (heading/list/bold/… via `replaceRange`/`wrapSelection`) — feature più grande, simile a H3.
  **DECISO 2026-06-20: opzione (B)** — implementare l'inserimento markdown reale in source. Conviene farlo
  insieme/dopo **H3** (stessa infrastruttura CM-insert: H3 importa l'addon comment, CP1-B aggiunge gli
  altri inserimenti). La collisione `del`/`link` va comunque risolta come parte del lavoro (rinominare gli
  eventi line-op source, es. `del`→`src-dup`, `link`→`src-delline`, aggiornando palette/menu/keybinding).

### 7.15 BUG-CP2 — Switch source↔Muya non ri-renderizza markdown inserito via palette

> ✔️ **CHIUSO 2026-07-04 — ramo A confermato dalla repro utente**: duplicato di BUG-MUYA-HEADING-DNA.
> Scatta solo con il cursore subito prima del simbolo di blocco (qualunque riga); spostando il cursore
> e rifacendo lo switch la riga torna renderizzata. Nessun fix (decisione A). Sezione lasciata come storico.

Se si inserisce testo markdown via command palette in Muya (es. `# ciao`), si passa in source mode
e si torna in Muya, il testo rimane come stringa letterale invece di essere interpretato. Aggiungere
uno spazio extra forza il re-parse ma il problema si ripresenta ad ogni successivo switch. Root cause
probabile: il documento non viene ri-parsato al cambio modalità quando il contenuto non risulta
"dirty" per il sistema di change detection.

**INDAGINE (2026-06-20) — probabile DUPLICATO di BUG-MUYA-HEADING-DNA, NON confermato senza runtime:**
- Inserendo un heading via palette in Muya, `handleEditParagraph` (`editor.vue:984`) chiama
  `editor.value.updateParagraph(type)` → Muya crea un **vero blocco heading** (testo `"ciao"`, tipo
  heading), non la stringa `"# ciao"`. Serializzato = `"# ciao"`.
- Tornando in Muya, lo switch chiama `setMarkdown` con `muyaIndexCursor`: se il cursore è a inizio riga
  (`ch=0`) di una riga heading, il meccanismo cursor-DNA antepone un marcatore → la riga viene parsata
  come **paragrafo** non heading (esattamente **BUG-MUYA-HEADING-DNA**, §TESTING). Il "si auto-corregge
  digitando uno spazio" e "torna ad ogni switch" coincidono con quel bug.
- ⇒ **Ipotesi forte: CP2 è una manifestazione di BUG-MUYA-HEADING-DNA** (cursor-DNA `ch=0`), già
  documentato e **deciso opzione A** (cosmetico, self-healing, contenuto salvato corretto, no fix).
- ⚠️ **NON confermato staticamente**: serve repro a runtime per escludere la seconda ipotesi (re-parse
  saltato al cambio modalità quando non-dirty).

**➡️ AZIONE PER CHI IMPLEMENTA (Sonnet/Opus): NON scrivere codice per CP2 prima della repro.** Presenta
questi passi all'utente, chiedi l'esito, poi segui il ramo A o B e annota il risultato nella sezione
**TESTING** in cima al file (stesso pattern delle voci "verificato dall'utente").

**REPRO RUNTIME (passi):**
1. `npm run dev`; crea/apri un `.md` (parte in Muya).
2. Su una riga, scrivi un heading: `# ciao` (a mano, oppure via palette/menu "Heading 1" + testo). Aggiungi
   anche una **seconda** riga heading `# ciao2`.
3. Toggle a **source mode** (status bar) → vedi il markdown `# ciao` / `# ciao2`.
4. Toggle di nuovo a **Muya**. Osserva le righe heading. Ripeti il doppio switch 2-3 volte.

**COSA OSSERVARE → quale ramo:**
- **Ramo A (= BUG-MUYA-HEADING-DNA, già deciso "no fix"):** appare come testo semplice **solo la riga dov'è
  il cursore** (es. `# ciao`), **NON** la seconda; e si **auto-corregge** alla prima lettera digitata.
  → CP2 è un **duplicato**: chiudere come ✔️ (peso 0), decisione A, nessun codice. (Contenuto salvato resta
  corretto: `getMarkdown` legge `# ciao` comunque.)
- **Ramo B (bug distinto, re-parse saltato allo switch):** appaiono come testo **anche righe senza cursore**,
  oppure **non** si auto-corregge digitando, oppure serve uno spazio extra ad **ogni** switch a prescindere
  dalla posizione del cursore. → **fix nello switch source→Muya**: forzare la ri-riconoscizione block-level
  del/dei blocchi (riusare `checkInlineUpdate`) dopo `setMarkdown`, oppure marcare `dirty` artificiale per
  innescare il re-render. File: `editor.vue` (`setMarkdownToEditor`/`handleFileChange`), Muya `importMarkdown.js`.

### 7.16 Non procedere alla cieca (decisioni/verifiche prima del codice)

- **B-REV5** (hard-break vs lightTouch): decidere con l'utente PRIMA (vedi §6.1).
- **B-REV7** (filtro `ASK_FOR_SAVE_ALL`): capire l'intento del filtro attuale prima di toccarlo.
- **B-REV11** (accelerator duplicati): serve R-6 per sapere chi vince oggi; POI azzerare il perdente.
- **P-REV2** (changeGeneration): refactor con test manuali su N12/bollino — non è un micro-fix.
- **M-REV2/3/4/5** (refactor): commit dedicati, mai insieme ai fix.
- **BUG-CP2**: NON scrivere codice; eseguire/far eseguire la **REPRO §7.15**, poi seguire ramo A (duplicato
  HEADING-DNA → chiudere, no fix) o ramo B (fix switch). Annotare l'esito nella sezione TESTING.
- I task H1-H5 hanno già il loro dettaglio in §2; le decisioni utente vincolanti sono in §0.
