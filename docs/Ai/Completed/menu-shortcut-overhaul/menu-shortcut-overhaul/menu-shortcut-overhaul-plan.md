# menu-shortcut-overhaul — plan — 2026-07-09

Riordino di: menu "P" (front menu), command palette, menu "@" (quick insert), shortcut e loro label.
Più due bug scoperti in corsa. Ogni parte ha un **verdetto di fattibilità**.

## Prerequisiti bloccanti
- Tutte le decisioni utente sono chiuse (vedi "Decisioni confermate" in fondo). Nessun unknown bloccante.
- VINCOLO AMBIENTE: build/preview BLOCCATI su questo PC (Group Policy). Gli agenti NON eseguono build/dev/preview; la verifica runtime la fa l'utente sul PC principale. Questo NON blocca le edit statiche.
- Ogni batch ha un worklog dedicato con checklist "Avanzamento" preparato dall'orchestratore. Batch 1 (D+A+B) → `worklog-batch1.md` in questa cartella.

Fonti verificate:
- Front menu: `src/muya/lib/ui/frontMenu/{config,index}.js`
- Menu "@": `src/muya/lib/ui/quickInsert/{config,index}.js` + trigger `src/muya/lib/contentState/inputCtrl.js:36,323,343`
- Format picker (menu su selezione): `src/muya/lib/ui/formatPicker/config.js`
- Command palette: `src/renderer/src/commands/{index,descriptions}.js` + `store/commandCenter.js`
- Shortcut reali: `src/main/keyboard/keybindings{Windows,Linux,Darwin}.js`
- Conversione paragrafi: `src/muya/lib/contentState/paragraphCtrl.js:470` (`updateParagraph`)

---

## Parte A — Front menu "P": rimuovere sezione Style + investigazione conversione

**Stato attuale.** `createMenu` (`frontMenu/config.js:24`) ha 4 voci: `turnInto` (= **Style**), `new`,
`duplicate`, `delete`. `turnInto` apre un submenu di conversione costruito da `createGetSubMenu`
(`config.js:140`) che gestisce SOLO i tipi `p`, `h1..h6`, `ul`, `ol`. Per `pre` (code), `blockquote`,
`figure` (table/math/html) → ramo `default` → `[]` → in `index.js:149` l'item `turnInto` prende classe
`.disabled` → **il divieto che vedi sul blocco di codice è by-design**, non un bug: la conversione DA
un blocco di codice non è offerta dal front menu.

Nota: `updateParagraph('reset-to-paragraph')` (`paragraphCtrl.js:482`) SA riconvertire diversi blocchi a
paragrafo, ma il front menu non espone quel percorso per code/quote/table.

**Le voci Style sono già nel menu "@" — nessuno spostamento necessario.** Il submenu Style è costruito da
`createWholeSubMenu` (`frontMenu/config.js:9-15`) che **appiattisce esattamente `createQuickInsertObj`**,
cioè la STESSA sorgente del menu "@". Quindi ogni voce dello Style è già presente in "@": rimuovere Style
non perde nulla e non crea duplicati. (Le conversioni relative `upgrade/degrade heading`,
`loose-list-item`, `reset-paragraph` NON sono nel submenu Style né in "@": stanno solo nel command palette
— vedi Parte B — e non hanno senso come "inserimento" in "@".)

**Azione (richiesta utente): rimuovere del tutto la sezione Style.**
- `frontMenu/config.js`: togliere l'oggetto `turnInto` da `createMenu`; rimuovere import `turnIcon`;
  si possono eliminare `createWholeSubMenu`, `createGetSubMenu`, `getSubMenu` e l'import di
  `createQuickInsertObj` se non usati altrove (grep `getSubMenu` prima di cancellare).
- `frontMenu/index.js`: rimuovere `getSubMenu`/`renderSubMenu` e i rami `label === 'turnInto'`
  (righe ~124, 146-151, 202-204). Il `render` resta solo su new/duplicate/delete.
- Verificare `getLabel` (usato per la classe `.active`): resta utile? Con turnInto rimosso il concetto di
  "blocco attivo" non serve più → si può semplificare, ma non è obbligatorio.

**Verdetto:** fattibile, pulito, basso rischio. La conversione blocco resta via command palette /
shortcut (se mantieni quei comandi — vedi Parte B). ⚠️ Se vuoi POTER convertire un code block a
paragrafo dall'editor, va aggiunto esplicitamente (oggi non c'è dal menu "@" né dal front menu per i
code block): è un lavoro a parte, da decidere.

---

## Parte B — Command palette: rimozione voci markdown

Decisioni utente recepite:
- Rimuovere **tutti i `paragraph.*` di inserimento** ECCETTO `paragraph.reset-paragraph` (tenere).
- Rimuovere **tutti i `format.*` inline** (sono già disponibili nel menu su selezione, vedi sotto).
- `paragraph.loose-list-item`: vedi spiegazione, NON serve nel palette.

### Cos'è `loose-list-item` (spiegazione richiesta)
`updateParagraph('loose-list-item')` → `handleLooseListItem()`. Trasforma una lista **tight** (voci senza
spaziatura, un `<li>` con testo diretto) in **loose** (ogni voce avvolta in `<p>`, con spaziatura
verticale) — è la differenza Markdown tra lista compatta e lista "spaziata". Funziona SOLO se il cursore
è dentro una voce di lista (altrimenti `isAllowedTransformation` blocca → "non fa nulla" fuori da liste,
che è ciò che hai osservato). È una rifinitura di nicchia: giusto toglierla dal palette.

### File da toccare
`src/renderer/src/commands/index.js`: rimuovere gli oggetti comando nel blocco `// Paragraph`
(righe ~236-361) TRANNE `paragraph.reset-paragraph` (righe ~344-349); rimuovere il blocco `// Format`
(righe ~368-439).
`src/renderer/src/commands/descriptions.js`: rimuovere le voci corrispondenti dalla mappa (righe ~96-151)
tenendo `paragraph.reset-paragraph`.

### Perché rimuovere i format.* è sicuro
`formatPicker/config.js` offre GIÀ come menu in sovraimpressione su testo selezionato: `strong, em, u,
del, mark, inline_code, inline_math, link, image, clear`. Quindi restano accessibili senza il palette.

### B-bis — Completare il menu su selezione (richiesta utente)
Muya supporta come inline format (`config/index.js:339` `FORMAT_MARKER_MAP`): `em, inline_code, strong,
del, inline_math, u, sub, sup, mark` (+ `link`, `image` gestiti a parte). Confronto col formatPicker:
**mancano solo `sub` (subscript) e `sup` (superscript)**. Aggiungerli a `formatPicker/config.js`.
⚠️ **Verificato: le icone `format_sub`/`format_sup` NON esistono** in `muya/lib/assets/pngicon/` (presenti:
format_clear, format_emphasis, format_image, format_link, format_math, format_strike, format_strong,
format_underline). Quindi va **creata/aggiunta l'icona** per sub e sup (o riusata una generica come
ripiego). Set finale: strong, em, u, del, mark, **sub, sup**, inline_code, inline_math, link, image, clear.
Nessun altro inline format esiste in Muya → niente altro da aggiungere.

### B-ter — Rimuovere i label shortcut NON assegnati (richiesta utente)
Per evitare incongruenze, dove il binding reale è vuoto NON mostrare alcun label shortcut.
- **Command palette:** già dinamico — `commandCenter.js:46` imposta `entry.shortcut` solo se il
  keybindings map ha un valore → i non assegnati non mostrano nulla. Nessuna azione, ma verificare che non
  resti un default hardcoded a video.
- **Menu "@" e front menu:** oggi hardcoded → dopo la Parte E (label derivati dai binding reali) i non
  assegnati mostrano automaticamente vuoto. Se la Parte E slitta, come misura minima togliere dai config le
  stringhe `shortCut` che corrispondono a comandi senza binding reale.

**Grep obbligatori** prima di cancellare (i comandi potrebbero essere referenziati altrove):
```
'paragraph.heading-1'  ... 'format.clear-format'   → menu templates, keybindings, test
bus.emit('paragraph'   e  bus.emit('format'        → restano usati da menu app + shortcut main
```
⚠️ Importante: il MENU APPLICAZIONE (barra in alto, `src/main/menu/templates/`) e le SHORTCUT usano
percorsi loro (comandi main `paragraph.*` / `format.*` via `menu/actions/`), **non** i comandi renderer del
palette. Rimuovere dal palette NON rimuove le voci dal menu app né rompe le shortcut. Verificare con grep
che nessun test si aspetti quei comandi nel command center.

**Verdetto:** fattibile, basso rischio. Solo cancellazione di voci dal palette.

---

## Parte C — Menu "@": estensione a metà paragrafo + inline formats

**Perché oggi funziona solo a inizio paragrafo.** Trigger in `inputCtrl.js:36`:
```js
checkQuickInsert = (block) => type==='span' && functionType==='paragraphContent'
                              && /^@\S*$/.test(text)
```
La regex `^@\S*$` pretende che **l'intero testo del blocco** sia `@...`. A metà paragrafo il testo ha
altro prima della `@` → non scatta. Alla selezione, `quickInsert/index.js:167` fa `this.block.text = ''`
e poi `updateParagraph(label)` → **converte l'intero blocco** in un tipo di blocco. Questo è il motivo per
cui "@" è pensato per inserire BLOCCHI, non format inline.

**Design scelto dall'utente: un unico menu, due modalità in base alla posizione della `@`.**
- `@` a **inizio blocco** (comportamento attuale, testo = `@...`) → menu **completo**: sezione blocchi +
  sezione inline (tutto abilitato).
- `@` a **metà paragrafo** (testo prima della `@`) → menu che mostra **solo i controlli inline**,
  disabilitando/nascondendo tutto ciò che è pensato per inizio-blocco (heading, table, liste, code, ecc.).

**Implementazione (senza forzature):**
1. **Trigger posizione-aware** (`inputCtrl.js:36` `checkQuickInsert`): oltre a `^@\S*$` (inizio blocco),
   riconoscere `@parola` **al cursore** con una regex sul testo fino a `cursor.offset`
   (es. `/(^|\s)@(\S*)$/`). Distinguere i due casi e propagare un flag `atLineStart` nell'evento
   `muya-quick-insert` (oggi passa `reference, block, status` — aggiungere il flag).
2. **Config**: aggiungere a `createQuickInsertObj` una **sezione "inline"** con gli item format
   (strong, em, u, del, mark, sub, sup, inline_code, inline_math, link, image) — riusando i `type` di
   `formatCtrl`/`formatPicker`. Marcare ogni item come `scope: 'block' | 'inline'`.
3. **Render/filtro** (`quickInsert/index.js`): se `atLineStart === false` → renderizzare solo gli item
   `scope: 'inline'` (le sezioni blocco vuote sono già saltate dal `render` esistente, `index.js:50`).
4. **selectItem** (`quickInsert/index.js:159`): branch per `scope`:
   - `block` → comportamento attuale (`updateParagraph(label)`), consentito solo se `atLineStart`.
   - `inline` → NON convertire il blocco: rimuovere il token `@parola` digitato e applicare il format
     inline al testo/cursore (riuso `contentState` format API / `bus.emit('format', type)`). Gestire il
     caso "nessuna selezione" (inserire i marker vuoti col cursore in mezzo, come fa il toggle format).

**Verdetto:** possibile e coerente col design richiesto, **lavoro medio** (tocca `inputCtrl.js` caldo +
`quickInsert` config/render/selectItem + percorso inline separato). Rischio medio → verifica runtime
obbligatoria (PC principale). Da fare **per ultimo**, dopo A/B/D/E a basso rischio.

---

## Parte D — Shortcut: riassegnazioni richieste

Tutte le modifiche nei 3 file `keybindings{Windows,Linux,Darwin}.js` (dati). Già fatte in questa sessione:
quick-open Ctrl+P → rimossa; upgrade/degrade heading Ctrl++ /Ctrl+- → rimosse (zoom mantenuto).

### D1 — Duplicate ⇄ Command palette (tua richiesta #3) — VERIFICATO
- `edit.duplicate`: da `Ctrl+Alt+D` → **`Ctrl+Shift+P`** (win/linux); darwin coerente → `Command+Shift+P`.
- `view.command-palette`: da `Ctrl+Shift+P` → **`Ctrl+Shift+A`** (win/linux, verificato LIBERA); darwin da
  `Command+Shift+P` → `Command+Shift+A`.
- **Catena verificata (nessun hardcode):** il binding `view.command-palette` (keybindings) alimenta sia il
  menu (`menu/templates/view.js:10` via `getAccelerator`, si aggiorna da solo) sia il comando
  `showCommandPalette` (`menu/actions/view.js:39`) → `mt::show-command-palette` → `preferences.js:178` →
  `bus.emit('show-command-palette')`. Il componente `components/commandPalette/index.vue` ascolta solo il
  bus, **nessun `Ctrl+Shift+P` hardcoded**. Quindi basta cambiare i 3 file keybindings. `edit.duplicate`:
  verificare che non ci siano altri caller del vecchio `Ctrl+Alt+D` (grep) prima del cambio.

### D2 — Heading su Ctrl+1..6, Paragraph su Ctrl+0 (tua richiesta #7)
Oggi Ctrl+1..6 = `tabs.switchToFirst..Sixth`, Ctrl+0 = `tabs.switchToTenth`; heading-1..6 = non assegnate;
paragraph = Ctrl+Shift+0 (che dici non fa nulla).
- Rimuovere i binding tab su Ctrl+1..6 e Ctrl+0 (il ciclo tab resta su Ctrl+Tab / Ctrl+Shift+Tab /
  Ctrl+PageUp / Ctrl+PageDown).
- `paragraph.heading-1..6` → `Ctrl+1..6`.
- `paragraph.paragraph` → `Ctrl+0` (togliere il vecchio Ctrl+Shift+0).
- Decidere Ctrl+7/8/9 (`switchToSeventh..Ninth`): lasciarli come switch-tab o liberarli. Proposta:
  lasciarli (non chiesto il contrario).
- ⚠️ Nota storica in `keybindingsWindows.js:52-53`: evitare `Ctrl+Shift+<numero>` perché mappa a
  caratteri. `Ctrl+<numero>` semplice è OK.

### D3 — Allineare code..quote alla shortcut del label (tua richiesta #7)
Portare il binding REALE a combaciare col label mostrato in "@":
| Comando | Nuovo binding (= label "@") |
|---|---|
| `paragraph.code-fence` | `Ctrl+Alt+C` |
| `paragraph.math-formula` | `Ctrl+Alt+M` |
| `paragraph.html-block` | `Ctrl+Alt+J` |
| `paragraph.quote-block` | `Ctrl+Alt+Q` |
| `paragraph.order-list` | `Ctrl+Alt+O` |
| `paragraph.bullet-list` | `Ctrl+Alt+U` |
**DECISO (utente): procedere con `Ctrl+Alt+<lettera>`.** Nota: `Ctrl+Alt` su Windows = AltGr → può produrre
caratteri alternativi; però `Ctrl+Alt+X/Y/N/H` sono GIÀ usati oggi (task-list, front-matter, math, html) →
il progetto già accetta `Ctrl+Alt`. **Verifica runtime obbligatoria su questi 6** (PC principale). Ripiego
SE emergono problemi AltGr: allineare al contrario (LABEL derivato dal binding via Parte E) — non
ridefinire questi 6 finché la verifica non conferma il problema.

### D4 — Front menu new/duplicate/delete: display
Con D1, `duplicate` = Ctrl+Shift+P → il label ⇧⌃P diventa corretto. `new` (Ctrl+Shift+N) e `delete`
(Ctrl+Shift+D) sono già corretti come binding: il problema era solo il **glyph** `⇧⌃` illeggibile sul tuo
font (reso "î^"). Con la Parte E (label derivati dai binding reali + formato leggibile) si sistema alla
radice; in alternativa minima, sostituire nel display `⇧⌃` con testo `Ctrl+Shift+` (come fa già
`quickInsert/config.js` che usa `'Ctrl'`/`'Shift'` a parole).

**Verdetto D:** fattibile, basso rischio (dati). Da fare insieme in un unico passaggio coerente.

---

## Parte E — Refactor: label derivati dalle shortcut reali (tua richiesta #6)

**La tua osservazione è corretta.** Oggi i label shortcut in `frontMenu/config.js`, `quickInsert/config.js`
e `formatPicker/config.js` sono **stringhe hardcoded** slegate dai binding reali (`keybindings*.js`) →
doppio punto di modifica e disallineamento (le tabelle nella tua chat lo dimostrano).

**C'è un motivo legittimo del hardcoding?** In parte sì: i menu vivono in **Muya**, che per contratto è un
engine isolato (no Electron/Node, solo JS/DOM) e **non conosce** il keybindings map del main. Per questo i
label sono statici. NON è però una barriera insormontabile: il renderer PUÒ iniettare i binding reali in
Muya come opzione, senza rompere l'isolamento.

**Prova che è già fattibile:** il **command palette** lo fa GIÀ. `store/commandCenter.js:46-54` riceve
`mt::keybindings-response` e imposta `entry.shortcut = normalizeAccelerator(value)` dai binding reali del
main. Quindi il palette mostra sempre le shortcut vere. Il problema è **solo** nei menu Muya.

**Proposta (senza forzature):**
1. Il main già invia i binding al renderer (`mt::keybindings-response`). Costruire nel renderer una mappa
   `commandId → accelerator` (già disponibile lì).
2. Passare questa mappa a Muya via `muya.options` (come già si fa per `t`, la funzione di traduzione:
   `frontMenu/index.js:35`, `quickInsert/index.js:21`). Aggiungere `muya.options.getShortcut(commandId)`.
3. In `createMenu`/`createQuickInsertObj`/formatPicker sostituire le stringhe hardcoded con
   `getShortcut('edit.duplicate')` ecc., più un piccolo formatter per il display leggibile
   (`Ctrl+Shift+P`).
4. Mappare ogni voce menu → commandId (associazione oggi implicita, va resa esplicita una volta).

**Difficoltà:** media, ma **strutturale e giusta** — elimina la classe di bug "label ≠ shortcut". Il
grosso del lavoro è il mapping voce→commandId e il passaggio dell'opzione; il pattern (opzioni Muya) esiste
già per `t`. **Consiglio: farlo**, perché altrimenti ogni riassegnazione della Parte D va tenuta manualmente
allineata in 2 posti. Se si vuole spezzare: prima Parte D (binding corretti, label ancora manuali), poi
Parte E come follow-up che rende i label automatici.

---

## Parte F — Bug: Ctrl+Backspace non cancella in blocco di codice/html

**Osservazione utente:** in un code block (e probabilmente altri blocchi "diversi"), Ctrl+Backspace
(cancella-parola-indietro) non funziona; nel testo normale sì; Ctrl+Del (avanti) funziona.

**Analisi preliminare.** L'handler tastiera Muya (`eventHandler/keyboard.js:177`) intercetta `Backspace`
→ `contentState.backspaceHandler`; `Delete` → `deleteHandler`. NON c'è gestione esplicita di
`Ctrl+Backspace` (parola) vs `Backspace` (carattere): la cancellazione-parola dipende dal comportamento
nativo del contentEditable, che Muya può bloccare con `preventDefault` in certi rami. L'asimmetria
Backspace-vs-Delete suggerisce che `backspaceHandler` tratta il caso "inizio/blocco codice" diversamente da
`deleteHandler` (es. preventDefault che impedisce la word-delete nativa). Nessun keymap CodeMirror per
Ctrl-Backspace trovato in `muya/lib` (i code block WYSIWYG non usano CodeMirror; CodeMirror è solo la
modalità Source).

**Verdetto:** **non un one-liner sicuro**. Root cause NON individuata da lettura statica. Da trattare come
task-bug dedicato con verifica runtime (bloccato su questo PC → PC principale). Possibile feature separata.

**Istruzione (richiesta utente): strumentare con log prima di fixare.** Aggiungere `console.log`/log
temporanei per capire a runtime:
- in `eventHandler/keyboard.js` (handler `Backspace`, ~riga 178): loggare `event.ctrlKey`,
  `event.metaKey`, tipo/`functionType` del blocco corrente, e se si sta per chiamare `backspaceHandler`.
- in `contentState/backspaceCtrl.js` (`backspaceHandler`, riga 119): loggare quale ramo scatta dentro un
  code block e se viene chiamato `event.preventDefault()`.
- confrontare col percorso `Delete`/`deleteHandler` (che funziona) per isolare l'asimmetria.
Con i log dal PC principale si individua se è Muya a bloccare la word-delete nativa o se manca proprio la
gestione `Ctrl+Backspace`. Poi decidere il fix. I log vanno rimossi a fix chiuso.

---

## Parte G — Bug: Ctrl+K Ctrl+C (commenta) in code block → crash modalità Source

**Osservazione utente:** provando a commentare codice (Ctrl+K Ctrl+C) in modalità Source, il commento
viene inserito ma poi non si torna in modalità MD; generati molti warning/errori:
- `katex.js: LaTeX-incompatible input ... Accented Unicode text character "ì" used in math mode`
- `IndexSizeError: Failed to execute 'setStart' on 'Range': There is no child at offset 35`
  in `Selection.setCursorRange` → `setCursor` → `render` → `setMarkdown` → `handleFileChange`
  (`editor.vue:1037`) ← emesso da `sourceCode.vue:1333`
- a cascata: errori Vue `patch`/`nextSibling`/`subTree` null (albero vnode incoerente dopo il crash).

**Analisi preliminare.** La catena parte da `sourceCode.vue:1333` che emette un file-change →
`handleFileChange` (`editor.vue:1037`) → Muya `setMarkdown` → `setCursor` con un **offset (35) oltre la
lunghezza** del nodo → `Range.setStart` lancia `IndexSizeError`. Il markdown prodotto dal "commenta" in
Source (probabilmente `<!-- ... -->` o un commento che contiene il carattere accentato `ì`) fa sì che al
rientro in MODE MD il ricalcolo del cursore punti a un offset non più valido nel nuovo albero. Il warning
katex è collaterale (interpreta `ì` in un contesto math). Il crash vero è il **cursor/offset non
clampato** in `setCursorRange`.

**Direzione di fix (da confermare a runtime):** in `Selection.setCursorRange`/`setCursor`
(`muya/lib/selection/index.js` righe ~371, 533, 216) **clampare** l'offset alla lunghezza effettiva del
nodo prima di `setStart`/`setEnd` (difensivo), così un offset stale non fa crashare tutto il render. La
causa a monte (perché l'offset resta 35 dopo il cambio modalità/commento) va tracciata separatamente.

**Verdetto:** bug reale e serio (rompe lo switch di modalità). Il clamp difensivo è probabilmente
**semplice e ad alto valore** (evita il crash a cascata Vue). La causa radice (commento Source che desincro-
nizza il cursore) richiede più indagine. Da trattare come task-bug dedicato con runtime. **Probabile
feature separata** (`source-mode-comment-crash`).

---

## Ordine consigliato di esecuzione
1. **D** (shortcut, dati, basso rischio) + **A** (front menu Style) + **B** (palette cleanup) — insieme,
   un passaggio Agent-Code, verifica runtime sul PC principale.
2. **E** (label ↔ shortcut reali) — follow-up che rende automatici i label toccati in D.
3. **G** (clamp cursore) — fix difensivo ad alto valore, feature a sé.
4. **F** (Ctrl+Backspace code block) — richiede reproduce+trace, feature a sé.
5. **C** (@ inline mid-paragraph) — lavoro medio sull'editor caldo, per ultimo.

## Vincolo ambientale
Build/preview bloccati su QUESTO PC (Group Policy — vedi memory `build-bloccato-su-pc-secondario`).
Ogni verifica runtime va fatta sul PC principale. Le edit di soli dati (keybindings) sono a rischio basso;
le modifiche a Muya (C, F, G) VANNO verificate runtime prima di considerarle chiuse.

## Decisioni confermate (utente)
- Aggiungere inline `sub`/`sup` al formatPicker (icone da creare). ✔
- D1 duplicate→Ctrl+Shift+P, palette→Ctrl+Shift+A (+ varianti darwin). ✔
- D2 heading su Ctrl+1..6, paragraph su Ctrl+0 (rimuovere tab-switch su quei numeri; Ctrl+7/8/9 restano). ✔
- D3 code..quote su `Ctrl+Alt+<lettera>` con verifica runtime AltGr. ✔
- E refactor label ↔ binding reali. ✔
- F Ctrl+Backspace: task-bug con log runtime prima del fix. ✔
- Menu "@" a metà paragrafo = menu unico posizione-aware (solo inline a metà). ✔

## Worklog
- 2026-07-09 — Applicate a mano (dati, rischio nullo) le rimozioni conflitto in
  `keybindings{Windows,Linux,Darwin}.js`: `file.quick-open` (Ctrl+P/Command+P) svuotato;
  `paragraph.upgrade-heading` + `paragraph.degrade-heading` svuotati (win/linux; darwin usava `Cmd+[`/`Cmd+]`,
  non toccato). **Verificato runtime dall'utente sul PC principale: Ctrl+P = print/export, Ctrl++/Ctrl+- =
  solo zoom. OK.** Resto del piano NON ancora implementato.

## Stato
Plan **completo e pronto**, tutti gli unknown risolti (D1 catena verificata, appMenu non pertinente qui).
Parte già applicata e verificata: vedi Worklog. Resto: attende il via per Agent-Code, spezzato nei task
dell'ordine sopra (batch 1 = D+A+B). **Nessun Agent-Code ancora lanciato.**
