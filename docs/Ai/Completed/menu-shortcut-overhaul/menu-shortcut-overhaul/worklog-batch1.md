# Worklog — Batch 1 (Parti D + A + B) — menu-shortcut-overhaul

Task: riassegnazioni keybindings (D), rimozione sezione Style dal front menu (A),
cleanup command palette + sub/sup nel formatPicker (B / B-bis).

Fonte autorevole: `menu-shortcut-overhaul-plan.md` (Parti D, A, B). Istruzioni operative
dettagliate + esiti grep di verifica: fornite dall'orchestratore nel prompt di lancio.

## Prerequisiti bloccanti
- Decisioni utente chiuse (D1..D4, A, B, B-bis con placeholder icona sub/sup deciso).
- Build/preview bloccati su questo PC: NESSUN build/dev/preview. Verifica solo statica.

## Avanzamento

### Parte D — keybindings (3 file dati)
- [x] D1 — `edit.duplicate` → Ctrl/Command+Shift+P; `view.command-palette` → Ctrl/Command+Shift+A (win/linux/darwin)
- [x] D2 — heading-1..6 → Ctrl+1..6; paragraph → Ctrl+0; svuotare tabs.switchToFirst..Sixth + switchToTenth (win/linux; darwin già ok)
- [x] D3 — code/math/html/quote/order/bullet → Ctrl+Alt+C/M/J/Q/O/U (win/linux; darwin già ok)
- [x] Grep post: nessun caller dipende dal vecchio accelerator di duplicate

### Parte A — front menu Style
- [x] `frontMenu/config.js` — rimosso turnInto, import turnIcon, createWholeSubMenu/createGetSubMenu/getSubMenu, import createQuickInsertObj
- [x] `frontMenu/index.js` — rimossi getSubMenu/renderSubMenu + rami turnInto
- [x] `frontMenu/index.css` — rimosse solo regole esclusive del submenu (.submenu, li.turnInto, .item.active — dead dopo rimozione renderSubMenu); tenuto .item.disabled
- [x] getLabel: RIMOSSO (grep confermato: unico uso era in renderSubMenu, ora rimosso → dead code)

### Parte B — command palette
- [x] `commands/index.js` — rimossi paragraph.* (tranne reset-paragraph) + intero blocco format.*
- [x] `descriptions.js` — rimosse voci corrispondenti, tenuto reset-paragraph
- [x] Non toccato `listenForMain.js` (percorso menu app + shortcut) — grep confermato: bus.emit('paragraph'/'format') restano lì

### Parte B-bis — formatPicker sub/sup
- [x] Aggiunti item sub/sup (ordine finale: strong, em, u, del, mark, sub, sup, inline_code, inline_math, link, image, clear) con placeholder icona esistente (emphasisIcon/strongIcon) + TODO swap
- [x] Nessuna shortcut label per sub/sup (binding reali vuoti su format.superscript/subscript in tutti i keybindings*.js — nessun campo `shortcut` impostato)
- [x] Verificato sub/sup in FORMAT_MARKER_MAP (config/index.js:349-356); render shortcut assente gestito in formatPicker/index.js (title condizionale, niente "undefined")

## Note esecuzione

Tutte le caselle completate. Nessun build/dev/preview eseguito (ambiente bloccato) — solo verifica statica
(lettura file + grep). Verifica runtime demandata al PC principale.

### Divergenze vs istruzioni / decisioni prese
- `getLabel`/`createGetLabel` in `frontMenu/config.js`: RIMOSSI. Grep ha confermato l'unico uso in
  `frontMenu/index.js` era dentro `renderSubMenu` (già rimosso per turnInto) — dead code, coerente con
  l'istruzione "se diventano dead code... rimuoverli".
- `frontMenu/index.css`: rimosse tutte le regole `.submenu`, `li.turnInto`, `.item.active` (erano
  esclusive del submenu rimosso — `.active` era assegnata solo dentro `renderSubMenu`, ora inesistente).
  Tenuta `li.item.disabled` (condivisa, usata anche per `duplicate` su front-matter).
- `frontMenu/index.js`: rimossi anche `MAX_SUBMENU_HEIGHT`/`ITEM_HEIGHT`/`PADDING` (costanti usate solo
  in `renderSubMenu`, ora dead code) — non esplicitamente richiesto ma conseguenza diretta della rimozione.
  NON toccati `this.startBlock`/`this.endBlock` (assegnati ma ora non più letti in `render`): fuori scope
  della Parte A, lasciati come sono per non eccedere l'istruzione.
- `formatPicker/config.js`: l'ordine indicato nel prompt di lancio ("tra u e del, oppure in coda prima di
  clear") era ambiguo rispetto al "set finale" del plan (strong, em, u, del, mark, sub, sup, inline_code...).
  Ho seguito il set finale esplicito del plan: sub/sup posizionati dopo `mark`, prima di `inline_code`.
  Icone placeholder: `sub` → format_emphasis/2.png, `sup` → format_strong/2.png (nessuno shortcut assegnato,
  coerente coi binding reali vuoti).
- `formatPicker/index.js`: reso il render del title difensivo (`i.shortcut ? ... : i.tooltip`) per evitare
  "undefined" nel tooltip quando manca la shortcut (sub/sup, ma anche eventuali item futuri senza binding).
- Nessun'altra divergenza: numeri di riga del plan/prompt erano indicativi, localizzazione fatta per
  contenuto in tutti i file.

### Esiti grep di verifica
- `Ctrl+Alt+D|Command+Option+D|Ctrl+Shift+E` (vecchi accelerator duplicate) → nessun match residuo nei 3
  file keybindings dopo l'edit.
- `getSubMenu|createGetSubMenu|createWholeSubMenu|createQuickInsertObj` → uso residuo solo dentro
  `frontMenu/config.js`/`index.js` prima della rimozione; dopo la rimozione nessun altro file li referenzia
  (quickInsert/config.js resta indipendente, non importato più da frontMenu).
- `paragraph.reset-paragraph` → presente in `commands/index.js` (comando) e `descriptions.js`
  (descrizione): mantenuto come richiesto.
- `bus.emit('paragraph'|bus.emit('format'` → residuo in `commands/index.js` (comando `reset-paragraph`) e
  in `store/listenForMain.js` (percorso menu app + shortcut, non toccato).
- Comandi rimossi (`paragraph.heading-1`, `paragraph.code-fence`, `format.strong`, `format.clear-format`,
  ecc.) → nessun residuo in `src/renderer/`; residui solo in `src/main/keyboard/keybindings*.js`,
  `src/main/menu/templates/{paragraph,format}.js`, `src/common/commands/constants.js` — tutti percorsi
  main-process (menu app + shortcut), NON il command palette renderer: corretto per plan.
- `sub`/`sup` in `FORMAT_MARKER_MAP` (`muya/lib/config/index.js:349-356`) → confermati presenti come tipi
  inline validi prima di aggiungerli al formatPicker.
- Render shortcut in `formatPicker/index.js` → il campo `title` usava `${i.tooltip} ${i.shortcut}` senza
  guardia; corretto con espressione condizionale.

### Confermato: NESSUN build/dev/preview eseguito (ambiente bloccato su questo PC).

## Test Batch 1 — esiti (PC principale, 2026-07-09)
Riportati dall'utente: OK tranne i punti corretti in Batch 1b sotto.
- [x] D3 `Ctrl+Alt+C/Q/M/J/O/U` — OK (nessun problema AltGr)
- [x] D1 `Ctrl+Shift+P` = duplicate, `Ctrl+Shift+A` = apre palette — OK (toggle chiusura aggiunto in 1b)
- [x] D2 heading `Ctrl+1..6`, paragraph `Ctrl+0` — OK (Ctrl+0 su non-heading corretto in 1b)
- [~] sub/sup — RIMOSSI su richiesta utente (non servono) — vedi 1b
- [x] Front menu "P" senza Style — OK
- [x] Command palette senza voci markdown, reset-paragraph presente — OK
- Resto non citato dall'utente: funziona.

## Batch 1b — correzioni post-test (applicate dall'orchestratore, edit minime dirette)
Modifiche piccole e localizzate (no build, no esplorazione) fatte direttamente. File:
1. `renderer/.../commandPalette/index.vue` — `handleShow`: se palette già aperta, la stessa scorciatoia (`Ctrl+Shift+A`) la CHIUDE (toggle).
2. `main/keyboard/keybindings{Windows,Linux,Darwin}.js` — `tabs.switchToSeventh/Eighth/Ninth` svuotati: `Ctrl+7/8/9` non fanno più nulla.
3. `muya/.../formatPicker/config.js` — RIMOSSI item `sub`/`sup` (placeholder). Import `strongIcon`/`emphasisIcon` restano (usati da strong/em).
4. `renderer/.../commands/index.js` + `descriptions.js` — RIMOSSI dal palette `edit.create-paragraph` e `edit.delete-paragraph` (tenuto `paragraph.reset-paragraph`). Handler bus in `editor.vue` + shortcut/menu (Ctrl+Shift+N/D) intatti.
5. `main/menu/actions/paragraph.js` — `paragraph` action rimappata da `'paragraph'` a `'reset-to-paragraph'`: Ctrl+0 e voce menu Paragraph ora convertono a testo normale QUALSIASI blocco (lista/code/quote/heading), non solo heading. Stesso percorso bus già usato dalla voce palette Reset Paragraph.

Chiarimento su Ctrl+0 (domanda utente): NON era un bug. `paragraph.paragraph` mandava tipo `'paragraph'` che in `updateParagraph` gestisce solo heading/hr; il reset "pieno" (`reset-to-paragraph`) gestisce anche lista/code/quote. Rimappato in 1b come deciso.

### Test Batch 1b (PC principale, 2026-07-09) — tutti OK (confermato utente)
- [x] `Ctrl+Shift+A` con palette aperta → la CHIUDE; con palette chiusa → la apre
- [x] `Ctrl+7/8/9` non cambiano più tab (nessun effetto)
- [x] Menu selezione: NON compaiono più sub/sup
- [x] Palette: NON compaiono più Create Paragraph / Delete Paragraph; Reset Paragraph resta; Ctrl+Shift+N/D funzionano ancora
- [x] `Ctrl+0` (e menu Paragraph) converte a testo normale: heading, lista, code block, quote
