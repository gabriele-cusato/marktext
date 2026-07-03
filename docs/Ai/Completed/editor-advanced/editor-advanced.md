# Editor Advanced — Multi-Selezione, Commenti, Undo Unificato, Bug Editor

**Scopo:** documenta le feature difficili dell'editor — multi-selezione additiva con Ctrl in source (H1), commenti `Ctrl+K C/U` per linguaggio (H3), undo unificato tra Muya↔source (H8), bug inserimento markdown da palette (BUG-CP1/CP2).

**Origine:** `HARD-TASK.md` sezioni H1, H3, H8, BUG-CP*, BUG-CTRLZ, BUG-MUYA-* (2026-06-09 onward).

**Quando leggerlo:** multi-selezione / commenti / undo non funziona cross-modale / markdown non inserito / switch Muya↔source rotto / cursore fantasma Muya.

**Stato:** H1 pianificato, H3 bloccato da T-M1, H8 ✅ implementato e verificato (2026-06-15), BUG-CP1 ✅ implementato, BUG-CP2 aperto.

---

## H1 — Multi-Selezione Additiva con Ctrl (Source Only, Pianificato)

**Obiettivo (spec utente):** In source mode, con **Ctrl premuto**: ogni nuova selezione (mouse drag, Ctrl+click, Shift+frecce) si **aggiunge** alle precedenti invece di sostituirle. Rilasciato Ctrl, il comportamento torna standard. Digitare con N selezioni attive scrive su tutte (già nativo CM5).

**Complessità:** Media-alta (~60-100 righe).

**Cosa c'è già (CM5 nativo — base solida):**
- ✅ CM5 supporta multi-selezione nel core: `listSelections()`, `setSelections()`, `addSelection()`.
- ⚠️ **Mouse**: default CM5 aggiunge selezione con **Ctrl+click/drag** (Cmd su mac). NON è overridato → dovrebbe **già funzionare**: VERIFICARE a runtime.
- ❌ **Tastiera**: NON nativo. Con più selezioni attive, un movimento freccia le collassa a 1.

**Design Proposto (Parte Tastiera):**

1. **Tracking Ctrl**: flag modulo `ctrlHeld` aggiornato da `keydown`/`keyup` su wrapper CM + **reset su `window` blur e `editor.on('blur')`** (stuck-modifier fix).
2. **Hook `beforeSelectionChange`** (evento CM5): se `ctrlHeld` **e** ≥1 selezione non vuota **e** movimento tastiera (`origin` `*move`/`+move`) **e** nuovo set < vecchio (CM collassa), allora `update([...vecchie, nuovaRangePrimaria])`.
3. **Uscita:** `Esc` → comando CM `singleSelection` (built-in), con guardia su find panel aperto.
4. **Attivazione stretta:** SOLO con `ctrlHeld && ≥1 selezione`. Singolo cursore vuoto → word-jump standard → zero cambi.

**Rischi / Invarianti:**
- ⚠️ `beforeSelectionChange` fire anche per API (search, sidebar jump, `handleFormatInSource`): filtro su `origin` + `ctrlHeld` li esclude.
- ⚠️ **N12 / `cursorActivity`**: fa dirty-check e arma `commitTimer`. Multi-selezione genera più fire → idempotente, ma verificare flickering bollino.
- ⚠️ Operazioni riga custom (`Ctrl+D` duplica, `Ctrl+L` elimina): guardare se multi-selezione attiva (decidere al momento: solo primaria o no-op).
- ⚠️ IME/composizione: durante composition gli eventi cambiano — condizione `origin` li esclude, testare.
- Pattern `bus.on`⇒`bus.off` non serve, ma listener `keydown/keyup/blur` vanno rimossi in `onBeforeUnmount`.

**Test:** Ctrl+drag 2 selezioni → digita → scrive su entrambe; Ctrl+Shift+frecce aggiunge senza perdere prima; rilascio Ctrl → collassa a singolo; Esc → singola; Alt+Tab con Ctrl premuto → niente stuck.

---

## H3 — `Ctrl+K C` / `Ctrl+K U` Commenta/Decommenta per Linguaggio (Source, Pianificato)

**Obiettivo:** Chord stile Visual Studio: `Ctrl+K C` commenta le righe selezionate, `Ctrl+K U` decommenta, con la sintassi del linguaggio (`//`, `#`, `<!-- -->`, …).

**Dipendenza Dura: T-M1** (`tab-bar-layout.md` T-M1 — mode per estensione). Senza T-M1 il mode è sempre `markdown` → commento sempre `<!-- -->`.

**Come (Riusa Addon CM5 `comment`):**

1. `codeMirror/index.js`: `import 'codemirror/addon/comment/comment'`.
2. L'addon fornisce `cm.lineComment(from, to, opts)`, `cm.uncomment(from, to, opts)`, `cm.blockComment(...)` e comando `toggleComment`.
   ⚠️ Sono **metodi con range**, NON comandi → servono due handler che iterano `cm.listSelections()` e applicano il metodo a ogni range.
3. Fallback per linguaggi senza commento di riga (HTML/CSS): se `lineComment` no-op → `blockComment`/`uncomment` block. Soluzione robusta: leggere `cm.getModeAt(pos).lineComment` prima (no euristiche).
4. **Binding chord in `extraKeys`**: CM5 supporta multi-stroke (nomi separati da spazio). Bindare `'Ctrl-K C'` **e** `'Ctrl-K Ctrl-C'` (VS accetta entrambe).

**⚠️ BLOCCO: `Ctrl+K` OCCUPATO** — grep fatto: `view.toggle-toc` = `Ctrl+K`/`Cmd+K` su tutti gli OS. Gli accelerator menu precedono `extraKeys` CM → il chord non arriverebbe.

Soluzione: azzerare l'accelerator `view.toggle-toc` → `''` nelle 3 mappe (pattern già usato per `file.open-folder`), **lasciando la voce menu** (MAI rimuovere l'oggetto — lezione `sideBarMenuItem`).

**Test (post T-M1):** `.js` → `//`; `.py` → `#`; `.html` → block; `.md` → `<!-- -->`; multi-riga; `Ctrl+K U` su righe miste; in Muya nessun effetto.

---

## H8 — Undo/Redo Unificato Muya↔Source (✅ IMPLEMENTATO, Verificato Runtime 2026-06-15)

**Obiettivo:** Stack di undo **condiviso** tra modalità (finora erano 2 separati). Edit in Muya, passa a source, `Ctrl+Z` torna all'edit Muya. Cross-modale fluido.

**Complessità:** Alta (~300 righe cross-process, 6 file).

**⚠️ Tocca Muya core** (`importMarkdown.js`, `lexer.js`) → **restart `npm run dev`** (no hot reload).

**File Toccati (6):**

- NUOVO `src/renderer/src/store/unifiedHistory.js` — Map non-reattiva per-tab: `seedUnified`, `pushUnified(…, origin)`, `unifiedUndo`, `unifiedRedo`, `clearUnified`, `isUnifiedTarget`. Anti-loop su uguaglianza markdown. Flag `DEBUG=false` + log `[H8]`.
- `sourceCode.vue` — cattura in `on('change')` (boundary CM); `handleUndo/Redo` deviati; `handleUnifiedReplay`; seed mount/tab-switch/reload; **flush tail allo switch source→Muya** in onBeforeUnmount (#1); `bus.on/off` simmetrico.
- `editor.vue` — cattura in `on('change')` Muya; `handleUndo/Redo` deviati; flag `replaying`/`dirtySince` (push SOLO su edit utente); **flush Muya→source** in `watch(sourceCode)` gated su `dirtySince` (#1).
- `store/editor.js` — `clearUnified` in `FORCE_CLOSE_TAB` e reload-da-disco.
- `muya/lib/utils/importMarkdown.js` — guard `importCursor` (cursore vuoto → fallback firstBlock); clamp riga/ch (#2-B); ricrea paragrafi vuoti (fix C).
- `muya/lib/parser/marked/lexer.js` — token `space` porta `lines` per fix C.

**Limite Noto (Accettato 2026-06-15):** conteggio righe vuote source↔Muya non 1:1. Blocco righe vuote in markdown è ambiguo; nessuna mappa perfetta. Inoltre Muya esporta **2 `\n` per paragrafo vuoto** → la mappa `k=(gap-2)/2` dimezza. **Zero perdita dati:** round-trip markdown preservato; differisce solo il conteggio visivo in Muya.

**Test (Verificati 2026-06-15):**
- ✅ Cross-modale, granularità parola, redo simmetrico, flush-tail, reload, dirty flag, no-crash.
- Bug runtime trovati e risolti durante testing iterativo (Muya `getMarkdown` NON idempotente — re-parse normalizza):
  - (1) CRASH `getActiveBlocks` → guard in `importCursor` (no anchor/focus fallback).
  - (2) Barriera undo morta → stato live+sincrono (`replaying`/`dirtySince` gate).
  - (3) Tail perso allo switch → flush live al confine di switch.
  - (4) Cursore fuori range → clamp riga/colonna.
  - (5) Righe vuote compattate → `lexer.js` conserva `lines`; `markdownToState` ricrea vuoti.
  - (6) Stack troncato a idx=0 allo switch → gate su `dirtySince`.

---

## BUG-CP1 — Inserimento Markdown Reale in Source da Palette/Menu (✅ Implementato, 🧪 Da Testare)

**Problema:** quando inserisci un comando markdown (heading, lista, blockquote, strong, em, …) via palette/menu in source mode, viene inserito il **testo letterale** (es. `#` per heading) anziché il markdown effettivo.

**Root Cause (Verificata):** il routing bus incompleto + collisione di azioni. **Fix (B)**: inserimento markdown reale in source via CodeMirror.

**Implementazione:** helper `handleParagraphInSource` + `handleFormatInSource` espanso — heading/list/blockquote/block + strong/em/u/mark/etc.

Selection-aware per del/link: selezione→formato; cursore→line-op legacy. Pattern identico al T-M5 template.

**Test:** palette "Heading 1" in source → `# ` inserito; "Strong" su selezione → `**testo**`; "Delete" → `~~testo~~`.

---

## BUG-CP2 — Switch Source↔Muya Non Ri-Renderizza Md Inserito da Palette (⬜ Aperto)

**Problema:** dopo inserimento markdown via palette in source, switchare a Muya non mostra il markdown formattato (rimane il testo letterale).

**Status:** serve REPRO runtime dall'utente. Opzioni analizzate:

- (A) **Duplicato HEADING-DNA** — cursore al `ch=0` per switching e il DNA cursor inserito prima di sintassi blocco → block parsing fallisce (vedi sezione BUG-MUYA-HEADING-DNA sotto per il fenomeno).
- (B) **Fix switch** — forzare ri-riconoscimento block-level dopo `setMarkdown` (riusare `checkInlineUpdate`).

---

## BUG-CP1b — Comando "Table" in Source Apre Dialog Muya (✅ Risolto)

**Problema:** "Table" da palette in source mode apre il dialog Muya (rows/columns) oltre a inserire il markdown.

**Fix:** guard `if (sourceCode.value) return` in `editor.vue:902` `handleEditParagraph`.

---

## BUG-CTRLZ — Ctrl+Z Cross-Tab (✅ Risolto, Verificato Runtime)

**Problema:** in una tab source, `Ctrl+Z` ripristina il contenuto di un'ALTRA tab.

**Root Cause:** `setValue()` NON azzera l'undo CM5 (aggiunge un change `origin:"setValue"` annullabile). **Molte note davano per scontato il contrario** → bleed cross-tab e snapshot stale.

**Fix:** `sourceCode.vue handleFileChange`, ramo tab-switch: `editor.value.clearHistory()` dopo il posizionamento cursore. Copre sia tab nuova sia snapshot stale (entrambi `historyToRestore=null`).

**Nota:** le note errate su `setValue` sono state corrette (`EASY-TASK`, `MEDIUM-EASY-TASK`).

---

## BUG-MUYA-INPUT — Cursore Stale Muya → `getBlock` Null (✅ Risolto, 3 Siti)

**Problema:** switch rapidi Muya↔source + click/scrittura veloce → eccezioni `TypeError: Cannot read properties of null`.

**Root Cause (Sistemica):** una key di cursore punta a un blocco non più esistente (desync DOM/content-state dopo rebuild/`setMarkdown`) → `getBlock(key)` → `null` → deref su null. **3 funzioni diverse** fanno questo deref:

| # | File:riga | Deref | Trigger | Fix |
|---|-----------|-------|---------|-----|
| 1 | `inputCtrl.js:108→116` | `block.text` | scrittura in Muya | guard `if(!block)return` |
| 2 | `updateCtrl.js:27/33` | `startBlock.text`/`endBlock.text` | da `inputCtrl.js:389` | guard `if(!startBlock\|\|!endBlock)return false` |
| 3 | `index.js:628` | `block.parent` in `findOutMostBlock` | path undo | guard `if(!startBlock\|\|!endBlock){renderRange=[null,null];return}` |

**Pre-esistente, NON regressione:** fragilità Muya esposta dai test rapidi. ⚠️ **Restart `npm run dev`** (Muya no hot reload).

---

## BUG-MUYA-UNDO-SWITCH — Dopo Switch Muya↔Source, Primi Ctrl+Z "Non Fanno Nulla" (✅ Risolto)

**Problema:** fatti switch, i primi N `Ctrl+Z` non annullano nulla di visibile; dopo qualche pressione iniziano i "veri" undo.

**Root Cause:** switch source→Muya passa `muyaIndexCursor` → `setMarkdown` chiama `addCursorToMarkdown` che inserisce **stringhe-marcatore `CURSOR_*_DNA` nel markdown grezzo PRIMA del parsing**. Se cursore a `ch=0` su heading, il DNA viene anteposto: `<DNA>#` → il `#` non è più a inizio riga → parser classifica come paragrafo.

**Pre-esistente, NON regressione:** bug Muya storico. Contenuto NON corrotto: `getMarkdown` legge il vero testo. È puramente visivo e si auto-corregge alla prima digitazione.

**Fix APPLICATO (Core, ~1 riga):** in `importCursor` (`utils/importMarkdown.js`), prima di `this.cursor = cursor`, `cursor.noHistory = true` → set di cursore "programmatico" non crea checkpoint. Flag verificato: conservato da `Cursor` ctor.

**Rischio:** BASSO (un solo chiamante `setMarkdown`; digitazione normale NON passa). **Restart `npm run dev`**.

---

## BUG-MUYA-HEADING-DNA — 1ª Riga Heading Appare Come Testo Dopo Switch (⏸️ Documentato)

**Problema:** scrivi `# ciao`, vai in source, torna in Muya → appare come **testo semplice** (non H1); alla prima lettera torna H1.

**Root Cause:** DNA cursor anteposto a sintassi blocco rompe il parsing (vedi BUG-MUYA-UNDO-SWITCH).

**DECISIONE Utente: Opzione (A)** — documentare come minore (cosmetico, self-healing, contenuto salvato corretto), no fix. Se fastidiose in futuro → riconsiderare.

---

## Decisioni Utente (LOCKED 2026-06-09, Non Richiedere Ancora)

1. **H1 Multi-selezione:** solo source mode. Comportamento: Ctrl tenuto = additivo.
2. **H3 Commenti:** APPENA T-M1 fatto + permesso esplicito.
3. **H8 Undo:** **IMPLEMENTATO 2026-06-15**, funziona (cross-modale, granularità parola, tutto ok).
4. **BUG-CP1:** **IMPLEMENTATO**, fix (B) markdown reale in source via CM.
5. **BUG-CP2:** aperto, serve REPRO runtime.

---

## Mappa File

| Cosa | File |
|---|---|
| Multi-selezione tracking Ctrl | `sourceCode.vue` (hook beforeSelectionChange) |
| H3 commenti binding chord | `codeMirror/index.js` (import), `extraKeys` in `sourceCode.vue` |
| H8 unified history | `store/unifiedHistory.js` (NUOVO), `sourceCode.vue`, `editor.vue`, `store/editor.js`, `muya/lib/utils/importMarkdown.js`, `muya/lib/parser/marked/lexer.js` |
| BUG-CP1 markdown reale | `sourceCode.vue` (handleFormatInSource espanso), `store/editor.js` (EDITOR_EDIT_ACTION) |
| BUG-MUYA-INPUT guard | `muya/lib/contentState/{inputCtrl,updateCtrl,index}.js` |
| BUG-MUYA-UNDO-SWITCH noHistory | `muya/lib/utils/importMarkdown.js` (importCursor) |
