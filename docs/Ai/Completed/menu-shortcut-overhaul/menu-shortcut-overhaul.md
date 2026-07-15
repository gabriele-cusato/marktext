# menu-shortcut-overhaul

## Scopo
Riordino strutturale di menu (front menu "P", command palette, menu "@"), shortcut (riassegnazioni keybindings), e label shortcut derivati dai binding reali. Inclusi due bug risolti (Ctrl+Backspace in code block, crash Source↔MD) che emersi in fase di test.

## Modifiche

### Parte A — Front menu Style (rimosso)
- **src/muya/lib/ui/frontMenu/config.js**: rimosso `turnInto` (sezione Style), relativi helper (`createWholeSubMenu`, `createGetSubMenu`, `getSubMenu`) e import `turnIcon`
- **src/muya/lib/ui/frontMenu/index.js**: rimossi `getSubMenu`/`renderSubMenu`, rami per `turnInto`, dead code `MAX_SUBMENU_HEIGHT`/`ITEM_HEIGHT`/`PADDING`
- **src/muya/lib/ui/frontMenu/index.css**: rimosse regole esclusive del submenu (`.submenu`, `li.turnInto`, `.item.active`)

### Parte B — Command palette cleanup
- **src/renderer/src/commands/index.js**: rimossi tutti i `paragraph.*` (tranne `reset-paragraph`) e tutti i `format.*`, più `edit.create-paragraph`/`edit.delete-paragraph`
- **src/renderer/src/commands/descriptions.js**: rimosse le rispettive descrizioni, mantenuto `paragraph.reset-paragraph`

### Parte D — Keybindings riassegnazione (dati)
- **src/main/keyboard/keybindings{Windows,Linux,Darwin}.js**:
  - D1: `edit.duplicate` → Ctrl/Cmd+Shift+P; `view.command-palette` → Ctrl/Cmd+Shift+A (con toggle apertura/chiusura)
  - D2: `paragraph.heading-{1..6}` → Ctrl+{1..6}; `paragraph.paragraph` → Ctrl+0; svuotate `tabs.switchToFirst/Sixth` e `switchToTenth`, svuotate `switchToSeventh/Eighth/Ninth`
  - D3: code/math/html/quote/order/bullet → Ctrl+Alt+{C,M,J,Q,O,U}

### Parte E — Label ↔ Shortcut refactor
- **src/renderer/src/store/commandCenter.js**: aggiunto state `keybindingMap` per i binding reali, formatter `formatShortcutForDisplay`
- **src/renderer/src/pages/editor.vue**: passato `getShortcut(commandId)` a Muya via `muya.options`
- **src/muya/lib/ui/{frontMenu,quickInsert,formatPicker}/config.js**: aggiunti field `commandId`, sostituiti hardcoded `shortCut` con `getShortcut(...)`

### Parte C — Menu "@" posizione-aware
- **src/muya/lib/contentState/inputCtrl.js**: `checkQuickInsert` ora riconosce `@` a metà paragrafo, propaga flag `atLineStart` nell'evento
- **src/muya/lib/ui/quickInsert/config.js**: aggiunta sezione `inlineFormat` con 9 item (strong, em, u, del, mark, inline_code, inline_math, link, image), ciascuno con `scope: 'inline'`
- **src/muya/lib/ui/quickInsert/index.js**: filtro render per scope, branch `selectItem` per inline (rimuove token `@parola`, applica format al cursore)

### Parte F — Bug: Ctrl+Backspace in code block
- **src/muya/lib/eventHandler/keyboard.js + src/muya/lib/contentState/backspaceCtrl.js**
  - Aggiunto ramo `isWordDelete` nel codeContent: calcola `deleteLen` con regex `/(^|\s)@(\S*)$/` + cancella per parola
  - Log temporanei `[PARTE-F-DEBUG]` (rimossi da feature `debug-log-cleanup` 2026-07-16)

### Parte G — Bug: Ctrl+K Ctrl+C (commenta Source) → crash MD
- **src/muya/lib/selection/index.js**
  - Aggiunto helper `clampOffset(node, offset)`: clampaggio difensivo offset prima di `Range.setStart/End` per evitare `IndexSizeError` con offset stale

## Da tenere a mente

**Caution: front menu senza Style**: La conversione blocco resta disponibile via command palette (`paragraph.reset-paragraph`) e shortcut. Per convertire code/quote a paragrafo **DAL FRONT MENU** (click destro), oggi non è offerto — la UI blocca col `.disabled`. Se l'utente richiede di convertire questi blocchi dal menu, va aggiunto esplicitamente.

**Inline format "@" a metà riga**: Il menu "@" a metà paragrafo filtra via i controlli blocco e mostra solo format inline. Il token `@parola` viene rimosso prima di applicare il formato — non è un vero "inserimento" a inizio blocco come le voci standard. Comportamento corretto, non è un bug.

**Shortcut Ctrl+Alt su Windows**: D3 ha riassegnato code/math/quote/list a `Ctrl+Alt+{lettera}`. Su Windows `Ctrl+Alt` = AltGr può generare caratteri alternativi. È stato testato runtime dall'utente (2026-07-09) senza problemi AltGr riportati; se emerge un problema, la soluzione sarà allineare i LABEL ai binding reali (non ridefinirli).

**Log rimossi**: I log `[PARTE-F-DEBUG]` e `[FMT-TOGGLE-DEBUG]` sono già stati rimossi dalla feature `debug-log-cleanup` (2026-07-16) — non ancora presenti nei file attuali.

**Test esito**: Utente (2026-07-09/13, PC principale) OK — Batch 1+1b+Parte E+C+G chiusi e funzionanti; Parte F (Ctrl+Backspace word-delete nel code block) fix verificato; Parte G (crash Source→MD) clamp difensivo risolve. Feature chiusa.
