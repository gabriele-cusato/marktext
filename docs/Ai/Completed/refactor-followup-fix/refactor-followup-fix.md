# Refactor Followup Fix — Quick Open, Element Plus Deprecations, Font Display

**Scopo:** raccogliere 4 fix pre-esistenti (non causati dal refactor, scoperti durante il test della feature renderer-no-node-integration). Crash Quick Open, 3 warning Element Plus v2→API, font-display swap Chromium.

**Origine:** test task1-8 della feature renderer-no-node-integration (config attuale `nodeIntegration:true`), verificati a runtime in questa sessione (2026-07-08).

**Quando leggerlo:** se il comando Quick Open crasha (null projectTree), o se hai warning Element Plus su el-radio/el-button, o se vedi log Chromium "slow network" su font in dev/preview.

**Stato:** ✅ Tutti i fix implementati e testati. Commit: ⏳ in attesa verifica utente (git default = NO).

---

## Fix Implementati

### A — Quick Open Crash (src/renderer/src/commands/quickOpen.js)

**Sintomo:** comando Quick Open crashava con `Cannot read properties of null (reading 'pathname')` appena c'era almeno un tab aperto.

**Root cause:** metodo `_getPath()` accedeva a `this._folderState.projectTree.pathname` senza guardia. Con il file-tree deprecato, `projectTree` **sempre** `null` → crash istantaneo.

**Fix:** guardia `if (!projectTree) return { title: pathname, description: pathname }` prima di leggere `projectTree.pathname`. Pattern coerente con `_doSearch()` che già gestiva `isRootDirOpened` con `null`.

**Natura:** bug latente pre-esistente, non introdotto dal refactor (riga non usava `window.*`).

---

### B — el-radio: `label` act-as-value deprecato (src/renderer/src/prefComponents/general/index.vue)

**Warning:** `[el-radio] label act as value is about to be deprecated in v3.0.0, use value`

**Origine:** Element Plus v2 ha rinominato l'API. `label` come valore era pattern v1, rimosso in v3.

**Fix:** due righe (113, 128):
- `<el-radio label="folder">` → `<el-radio value="folder">`
- `<el-radio label="blank">` → `<el-radio value="blank">`

Il testo mostrato dall'utente rimane nello slot (non cambia UX).

**Nota:** riga 110 `label="lastState"` è commentata → lasciata invariata.

---

### C — el-button: `size="medium"` non valido (src/renderer/src/prefComponents/keybindings/index.vue)

**Warning:** `Invalid prop: size... Expected ["", "default", "small", "large"], got "medium"`

**Root cause:** Element Plus v2 rinominò le taglie; `"medium"` non è più valido.

**Fix:** tre righe (70, 76, 91 — footer/debug bottoni):
- `size="medium"` → `size="default"`

`"default"` è il valore più prossimo al "medium" originale di EP1.

---

### D — el-button: `type="text"` deprecato (keybindings/spellchecker/index.vue)

**Warning (massivo):** `[props] type.text is about to be deprecated in v3.0.0, use link` (291 warning su 3 bottoni × ~97 righe tabella keybindings; 1 warning in spellchecker).

**⚠️ Avvertenza:** il warning suggerisce `type="link"` ma è **fuorviante**. In EP 2.14.2 `"link"` NON è valore di `type`, è una **prop boolean separata**. Usare `type="link"` fallisce il validator.

**Fix corretto:** `type="text"` → `text` (prop boolean, sintassi `<el-button text>`):
- `src/renderer/src/prefComponents/keybindings/index.vue` righe 31, 42, 53 (3 bottoni tabella)
- `src/renderer/src/prefComponents/spellchecker/index.vue` riga 67 (bottone delete)

`text` come prop boolean replica l'aspetto borderless originale e passa il validator EP2.14.2.

**Avvertenza editoriale:** altri `type="text"` nel codebase sono su `<input>` HTML nativi (validi, non EP) → NON toccarli.

---

### E — Font-display: Swap Dichiarato (src/muya/themes/default.css)

**Sintomo (dev):** Chromium logga intervention "Slow network resource: font-display not set, using fallback font" per i font `@font-face`.

**Root cause:** 14 blocchi `@font-face` (Open Sans + DejaVu Sans Mono) non dichiaravano `font-display` → su dev/rete/disco lento Chromium applica override "slow network" e logga.

**Fix:** aggiunto `font-display: swap;` a tutti e 14 i `@font-face`:
```css
@font-face {
  ...
  font-display: swap;
}
```

**Effetto:** dichiarando la strategia, il font non è più render-blocking → Chromium non deve intervenire → **niente log**. UX: fallback immediato poi swap al font reale (impercettibile con rete veloce; era già di fatto il comportamento).

**Ambito:** solo dev (font via localhost:5173/@fs/...); nel packaged non compare. Basso rischio: nessun path, no 404, vale sia dev che build.

---

## Scoperte Importanti

1. **Quick Open crash era latente** — `_folderState.projectTree` SEMPRE `null` con file-tree deprecato, crash ad ogni uso. Bug pre-esistente, senza relazione al refactor task1-8.

2. **Element Plus v2 rinominò le API** — `label="value"` per el-radio, `size="medium"` scomparso, `type="text"` deprecato. Warnings non sconsigliati (regola: fixare se fixabile).

3. **Warning EP el-button type.text fuorviante** — suggerisce `type="link"` che NON è valido in EP 2.14.2. Soluzione corretta è prop boolean `text` (separata da `type`). Prime prove `type="link"` causavano validator failure → corrette.

4. **Font-display swap è non-breaking** — fallback temporaneo su caricamento lento, poi swap al vero font (UX OK per dev+build).

---

## Test Runtime (Verificati Questa Sessione)

- ✅ **A (Quick Open):** aprire uno o più tab (senza cartella), command palette → "quick open" → digitare: compaiono file per nome, nessun crash.
- ✅ **B (el-radio):** Preferences → General → sezione startup: radio funzionano, nessun warning el-radio.
- ✅ **C/D (el-button):** Preferences → Keybindings: nessun warning size/type.text in console; bottoni edit/reset/unbind/save/restore/dump/delete funzionano.
- ✅ **E (font-display):** dev/preview: console senza log "Slow network resource: font-display…"

---

## Ambito Out-of-Scope (Tracker Separati)

- **font-registry-fallback** (`InProgress/font-registry-fallback/`): fallback font-list dal registro Windows (ambiente gestito, ConstrainedLanguage PowerShell)
- **image-drag-in-doc** (`InProgress/image-drag-in-doc/`): drag immagini già nel documento → spostamento (volutamente disabilitato, feature futura muya)

---

## Mappa File

| Fix | File |
|---|---|
| A — Quick Open null guard | `src/renderer/src/commands/quickOpen.js` |
| B — el-radio label→value | `src/renderer/src/prefComponents/general/index.vue` |
| C — el-button size medium | `src/renderer/src/prefComponents/keybindings/index.vue` |
| D — el-button type text | `src/renderer/src/prefComponents/keybindings/index.vue`, `spellchecker/index.vue` |
| E — font-display swap | `src/muya/themes/default.css` |

---

## Cross-Link

- **renderer-no-node-integration** (`Completed/renderer-no-node-integration/`): feature durante cui questi fix sono stati scoperti e risolti
