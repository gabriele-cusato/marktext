# refactor-followup-fix — 2026-07-08

Fix fuori scope emersi durante il test di `renderer-no-node-integration` (task1-8, config attuale
`nodeIntegration:true`). Sono **pre-esistenti**, non introdotti dal refactor renderer. Raccolti qui e
chiusi in **un commit dedicato**, separato dal commit della feature renderer.

## Contesto
Testando i task1-8 sono emersi: un crash reale del comando Quick Open + tre warning di deprecazione
Element Plus (v2 → API cambiate). Vanno risolti (regola: i warning non si ignorano se fixabili).

## Fix applicati (tutti fatti, NON ancora committati)

### A — Quick Open: crash `Cannot read properties of null (reading 'pathname')`
- **File**: `src/renderer/src/commands/quickOpen.js` — metodo `_getPath`.
- **Causa**: `_getPath` accedeva a `this._folderState.projectTree.pathname` senza guardia. Con il
  file-tree deprecato (nessun entry point per aprire cartelle) `projectTree` è **sempre** `null`, quindi
  Quick Open crashava sempre appena c'era almeno un tab aperto (superata la guardia in `run()`).
- **Fix**: guardia `if (!projectTree) return { title: pathname, description: pathname }` prima di leggere
  `projectTree.pathname`. Coerente con `_doSearch` che già gestiva `isRootDirOpened` con `null`.
- **Natura**: bug latente pre-esistente, non toccato dai task (la riga non usava `window.*`).

### B — el-radio: `label` (as value) deprecato → `value`
- **File**: `src/renderer/src/prefComponents/general/index.vue` (righe 113, 128).
- Warning: `[el-radio] label act as value is about to be deprecated in v3.0.0, use value`.
- **Fix**: `<el-radio label="folder">` → `value="folder"`; `label="blank"` → `value="blank"`. Il
  testo mostrato resta lo slot. Riga 110 (`label="lastState"`) è **commentata** → lasciata invariata.

### C — el-button: `size="medium"` non valido → `size="default"`
- **File**: `src/renderer/src/prefComponents/keybindings/index.vue` (righe 70, 76, 91 — footer/debug).
- Warning: `Invalid prop: size... Expected ["", "default", "small", "large"], got "medium"`.
- **Fix**: `size="medium"` → `size="default"` (EP2 rinominò le taglie; "medium" ≈ "default").

### D — el-button: `type="text"` deprecato → prop boolean `text`
- **File**: `src/renderer/src/prefComponents/keybindings/index.vue` (righe 31, 42, 53) — i **291**
  warning (3 bottoni × ~97 righe della tabella keybindings).
- **File**: `src/renderer/src/prefComponents/spellchecker/index.vue` (riga 67) — stesso pattern (non
  emerso nel test perché la sezione non era aperta, ma stessa deprecazione).
- Warning: `[props] type.text is about to be deprecated in v3.0.0, use link`.
- **ATTENZIONE — il warning è fuorviante**: in Element Plus 2.14.2 `link` (e `text`) NON sono valori di
  `type`, sono **prop boolean separate**. `type="link"` fallisce il validator
  (`Expected one of [..., "text", ""], got "link"`). Il fix corretto è la prop boolean.
- **Fix**: `type="text"` → `text` (prop boolean, `<el-button text>`) **solo sugli `<el-button>`**.
  `text` replica l'aspetto borderless originale e passa il validator. Tutti gli altri `type="text"`
  nel renderer sono `<input>` HTML nativi (validi) → **non toccati**.
- Primo tentativo `type="link"` era errato (nuovo warning validator) → corretto in `text`.

### E-warn — Intervention "Slow network / Fallback font" (dev)
- **File**: `src/muya/themes/default.css` — 14 blocchi `@font-face` (Open Sans + DejaVu Sans Mono).
- **Causa**: i `@font-face` non dichiaravano `font-display` → su rete/disco lento Chromium applica il
  proprio override "slow network" e **logga** l'intervention (font di fallback temporaneo). Solo dev
  (font serviti via `localhost:5173/@fs/...`); nel packaged non compare.
- **Fix**: aggiunto `font-display: swap;` a tutti e 14 i `@font-face`. Dichiarando esplicitamente la
  strategia, il font non è più render-blocking → Chromium non deve intervenire → **niente log**.
  Comportamento: fallback immediato poi swap al font reale (impercettibile a caricamento veloce; era già
  di fatto ciò che l'intervention faceva). Basso rischio: nessun path, no 404, vale dev+build.

## Fuori da questo commit (feature separate, plan dedicati)
- **E — font-registry-fallback**: `font-list` fallisce su PC gestito (PowerShell ConstrainedLanguage
  blocca `Add-Type`; fallback `cscript` bloccato) → combo font vuota. Non è un bug del codice, è
  ambiente. Fix = enumerare i font dal registro Windows nel main. Vedi
  `docs/Ai/InProgress/font-registry-fallback/`.
- **F — image-drag-in-doc**: drag di un'immagine già nel documento la seleziona invece di spostarla.
  È **volutamente disabilitato** (`muya/eventHandler/dragDrop.js` `preventDefault` su IMG +
  `muya/ui/transformer/index.js:61`). Mai stata una feature. Implementarlo = nuova feature muya. Vedi
  `docs/Ai/InProgress/image-drag-in-doc/`.

## Test da rifare dopo i fix
- **A**: aprire uno o più tab (senza cartella), command palette → "quick open" → digitare: compaiono i
  file per nome, nessun crash in console F12.
- **B**: Preferences → General → sezione "startup": i radio funzionano, nessun warning `el-radio`.
- **C/D**: Preferences → Keybindings: nessun warning `size`/`type.text` in console; i bottoni
  edit/reset/unbind e save/restore/dump funzionano. Preferences → Spellchecker: bottone delete OK.

## Stato
- Codice: **fatto**. Commit: **in attesa di OK utente** (git default = NO).
