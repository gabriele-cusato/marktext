# Worklog — Parte C — menu-shortcut-overhaul

Task: menu "@" posizione-aware — a inizio blocco menu completo (blocchi+inline), a metà
paragrafo solo controlli inline. Fonte autorevole: `menu-shortcut-overhaul-plan.md`, Parte C.
Lavoro medio su editor caldo: da fare per ULTIMO tra i batch della feature.

## Prerequisiti bloccanti
- Batch precedenti (D/A/B fatti, E, G, F) conclusi e testati.
- Verifica runtime obbligatoria sul PC principale.

## Avanzamento
- [x] Trigger posizione-aware in `inputCtrl.js` (`checkQuickInsert` + flag `atLineStart`
  nell'evento `muya-quick-insert`)
- [x] Config: sezione "inline" in `createQuickInsertObj` con `scope: 'block' | 'inline'`
- [x] Render/filtro in `quickInsert/index.js`: solo inline se `atLineStart === false`
- [x] `selectItem`: branch per scope (block = attuale; inline = rimozione token `@parola` +
  format inline, gestendo il caso senza selezione)

DA TESTARE

## Dettagli implementazione

**Trigger** (`inputCtrl.js`, `checkQuickInsert(block, offset)`): ora restituisce `false` o un
oggetto `{ atLineStart, tokenStart, tokenEnd }` invece di un booleano.
- Inizio blocco (comportamento storico invariato): `^@\S*$` sull'intero testo →
  `{ atLineStart: true, tokenStart: 0, tokenEnd: text.length }`.
- Metà paragrafo: regex `/(^|\s)@(\S*)$/` applicata a `text.substring(0, offset)` (testo fino al
  cursore, non tutto il blocco) → `@` deve essere a inizio riga o preceduta da spazio (evita
  falsi trigger dentro "user@example"). `tokenStart` = indice dell'`@`, `tokenEnd` = offset
  cursore.
- Guard `functionType === 'paragraphContent'` invariato: `@` dentro code block/math (functionType
  diverso, es. `codeContent`/`languageInput`) non fa scattare il menu.

**Propagazione evento**: `dispatch('muya-quick-insert', reference, block, !!checkQuickInsert,
checkQuickInsert || null)`. Quarto argomento aggiunto in coda (non rompe consumer esistenti — solo
`quickInsert/index.js` ascolta l'evento, verificato via grep). Si è passato l'intero oggetto match
(non solo il booleano `atLineStart` come nel testo del plan) perché `selectItem` deve conoscere
`tokenStart`/`tokenEnd` per rimuovere il token; ricalcolarli al momento della selezione con
`contentState.cursor` sarebbe stato inaffidabile (il cursore contentState viene aggiornato *dopo*
il dispatch in `inputHandler`, quindi al momento della subscribe è ancora quello precedente).

**Config** (`quickInsert/config.js`): aggiunto `scope: 'block'` a tutte le voci esistenti (nessun
comportamento cambiato) e una nuova sezione `quickInsert.inlineFormat` con 9 voci `scope: 'inline'`,
ognuna con `type` = valore passato a `contentState.format(type)`:
strong, em, u, del, mark, inline_code, inline_math, link, image.
`sub`/`sup` NON aggiunti: il motore li supporta (`formatCtrl.js` li gestisce come html_tag
`<sub>`/`<sup>`, stesso percorso di `u`/`mark`, verificato leggendo `addFormat`/
`checkTokenIsInlineFormat`), ma non esiste in `assets/pngicon` un'icona dedicata e questo task non
può aggiungere nuovi asset binari (fuori scope file, solo inputCtrl.js/config.js/index.js/worklog).
Riusare un'icona non pertinente sarebbe fuorviante — da fare in un task successivo con l'asset
giusto.
`commandId` per le nuove voci verificati in `src/main/keyboard/keybindingsWindows.js`: format.strong,
format.emphasis, format.underline, format.strike, format.highlight, format.inline-code,
format.inline-math, format.hyperlink, format.image (ereditano la label shortcut via
`getShortcut(commandId)`, stesso meccanismo già in uso per le voci block).

**Render/filtro** (`quickInsert/index.js`): `this.matchInfo` (l'oggetto match dell'evento) salvato
in `listen()`. `search()` filtra `obj[key]` a soli item `scope==='inline'` quando
`matchInfo.atLineStart === false`; le sezioni risultanti vuote sono già scartate dal `render()`
esistente (filtro su `length !== 0`). Testo di ricerca ora calcolato da
`block.text.substring(tokenStart + 1, tokenEnd)` invece del vecchio `substring(1)` fisso — a inizio
blocco è equivalente (tokenStart=0, tokenEnd=text.length), a metà paragrafo estrae solo la parola
digitata dopo `@`, non l'intero testo del blocco.

**selectItem**: branch per `item.scope`.
- `block`: comportamento invariato, con guard difensivo che nasconde il menu se selezionato mentre
  `matchInfo.atLineStart === false` (non dovrebbe accadere, le voci block sono già filtrate fuori
  dal render in quel caso).
- `inline` → nuovo metodo `selectInlineItem`: rimuove il token `@parola` da `block.text` tramite
  `tokenStart`/`tokenEnd`, posiziona `contentState.cursor` collassato a `tokenStart`, chiama
  `contentState.partialRender()` (che ri-renderizza il blocco e sincronizza la selezione DOM sul
  nuovo cursore — stesso pattern già usato dal ramo `block`), poi `contentState.format(item.type)`
  (stessa API chiamata da `formatPicker.selectItem`). Con selezione collassata `formatCtrl.addFormat`
  inserisce i marker vuoti col cursore in mezzo (verificato in `formatCtrl.js`: comportamento già
  esistente per il toggle da toolbar/scorciatoia su selezione vuota, non introdotto da questo task).

**Casi limite**:
- `@` a metà riga con testo già presente dopo il cursore: `tokenEnd` è l'offset del cursore, non
  la fine del blocco — solo il token `@parola` viene rimosso, il testo successivo resta intatto.
- `@` dentro code block/math: guard `functionType === 'paragraphContent'` invariato, non scatta.
- Undo: sia la rimozione del token sia `format()` impostano `contentState.cursor` sullo stesso
  `block.key` della digitazione in corso → il setter di `cursor` (vedi `contentState/index.js`)
  usa il percorso "pending" (merge/estende il timer 800ms) invece di un push immediato, quindi le
  due operazioni tendono a confluire in una singola entry di history al prossimo commit — riuso del
  meccanismo esistente, non introdotta logica nuova.

## Scostamenti dal plan
- Evento `muya-quick-insert` propaga l'intero oggetto match (`{atLineStart, tokenStart, tokenEnd}`)
  invece del solo flag booleano `atLineStart` indicato letteralmente nel plan — motivazione sopra
  (affidabilità di `tokenStart`/`tokenEnd` al momento della selezione). Resta additivo, non rompe
  consumer esistenti.
- `sub`/`sup` non aggiunti alla sezione inline per assenza di icona dedicata (asset fuori scope),
  pur essendo supportati dal motore format.

## Incertezze
- Le nuove chiavi di traduzione (`quickInsert.inlineFormat`, `quickInsert.bold.*`, ecc.) non sono
  presenti in `static/locales/*.json` (fuori scope: file non elencati tra quelli modificabili da
  questo task). Con la funzione `t` di vue-i18n una chiave mancante viene tipicamente mostrata come
  il path della chiave stesso invece del testo tradotto — non è un errore bloccante ma richiede un
  task di follow-up per aggiungere le voci locale (EN come minimo, poi le altre lingue).

## Test
Esito utente (2026-07-12/13, PC principale): OK — menu "@" inline funzionante,
nessuna anomalia riportata. Parte C chiusa.
