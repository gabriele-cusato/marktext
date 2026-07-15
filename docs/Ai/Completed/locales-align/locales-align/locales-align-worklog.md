# locales-align — worklog

Plan: `locales-align-plan.md`.

## Avanzamento
- [x] Censimento chiavi orfane (comandi/voci rimossi) — grep chiave→uso reale
- [x] Censimento chiavi mancanti/da aggiornare (Recent Files, nuove voci)
- [x] Allineamento coerente delle 9 lingue
- [x] Verifica statica: nessun riferimento a chiavi rimosse nel codice

## Metodo
Script Node temporaneo nello scratchpad (non committato):
`compare-locales.mjs` (confronto strutturale chiavi tra i 9 file) e `apply-locales.mjs`
(applica rimozioni/aggiunte/aggiornamenti preservando indentazione 2 spazi, CRLF e newline
finale come i file originali).

## 1. Chiavi orfane rimosse (verificate via grep su `src\` e `static\`: zero riferimenti)
Rimosse identicamente da **tutte le 9 lingue** (incluso `en.json`, che le conteneva ancora
nonostante l'overhaul palette/front-menu):
- `commands.paragraph.*` tranne `resetParagraph` (22 chiavi: heading1-6, upgradeHeading,
  degradeHeading, table, codeFence, quoteBlock, mathFormula, htmlBlock, orderList, bulletList,
  taskList, looseListItem, paragraph, horizontalLine, frontMatter, mathBlock, horizontalRule).
  Verificato: solo `commands.paragraph.resetParagraph` è ancora referenziato
  (`src/renderer/src/commands/descriptions.js:94`, comando palette `paragraph.reset-paragraph`).
- `commands.format.*` (intero gruppo, 12 chiavi: strong, emphasis, underline, superscript,
  subscript, highlight, inlineCode, inlineMath, strike, hyperlink, image, clearFormat). Il
  gruppo `commands.format` risultava vuoto dopo la rimozione → oggetto genitore eliminato.
  Verificato: il tooltip del formatPicker (`src/muya/lib/ui/formatPicker/config.js`) usa
  stringhe hardcoded ('Bold', 'Italic', ecc.), non `t('commands.format.*')`.
- `commands.edit.createParagraph`, `commands.edit.deleteParagraph` (2 chiavi: voci palette
  renderer rimosse). NOTA: le chiavi omonime `menu.edit.createParagraph` / `menu.edit.deleteParagraph`
  sono usate dal menu app (`src/main/menu/templates/edit.js:110,117`) e sono state **conservate**.
- `frontMenu.turnInto` + le sue 13 voci di conversione blocco (paragraph, table, html,
  mathblock, pre, frontMatter, ulTask, ulBullet, olOrder, blockquote, heading1-6, hr) = 18
  chiavi totali. Il front menu editor (`src/muya/lib/ui/frontMenu/config.js`) espone oggi solo
  `newParagraph`, `duplicate`, `delete` — confermato via grep (`frontMenu.` in tutto `src\`).

Totale rimosso da ogni lingua (incluso en): **54 chiavi**.

Rimosse **solo dalle lingue che le avevano** (assenti in `en.json`, rinominate/sostituite nel
codice — verificato via grep, zero riferimenti):
- `search.searchResultCount` → sostituita da `search.searchResultInfo` (già presente in tutte
  le lingue). Rimossa da: fr, ja, ko, pt, zh-CN, zh-TW.
- `preferences.image.uploader.brewInstallCommand` → nessun riferimento in `src\`, assente anche
  in en. Rimossa da: fr, ja, ko, pt, zh-TW.
- `quickInsert.sequenceDiagram.title/subtitle` → sostituita da `quickInsert.sequenceChart.*`
  (`src/muya/lib/ui/quickInsert/config.js:174-175`). Rimossa da: zh-TW.
- `quickInsert.plantumlDiagram.title/subtitle` → sostituita da `quickInsert.plantUMLChart.*`
  (`src/muya/lib/ui/quickInsert/config.js:180-181`). Rimossa da: zh-TW.

## 2. Chiavi aggiunte (51 per lingua, identiche in tutte le 8 lingue non-en)
Confronto strutturale con `en.json` (script `compare-locales.mjs`): oltre alle 7 chiavi
esplicitamente segnalate dall'orchestratore (sessionSnapshot.*, sidebar.watcherUsePolling),
sono emerse **44 chiavi mancanti aggiuntive**, preesistenti all'overhaul e mai propagate alle
8 lingue non-en (`menu.edit.toUpperCase/toLowerCase/openInBrowser`, `menu.theme.tufte`,
`contextMenu.tabs.pin/unpin/moveToNewWindow/reload`, `preferences.editor.writingBehavior.
surroundSelection(Notes)`, `commands.edit.toUpperCase/toLowerCase/openInBrowser`, tutto
`store.editor.fileChanged*` + `tooManyTabs*` (6 chiavi), tutto `statusBar.*` (19 chiavi,
gruppo intero mancante), tutto `theme.*` top-level (6 chiavi, nomi tema usati da
`src/renderer/src/commands/index.js:504-514`). Trattandosi di allineamento strutturale
richiesto esplicitamente dal plan (obiettivo 3: "nessuna chiave assente in una lingua"), sono
state tradotte e aggiunte anch'esse, non solo le 7 segnalate.

Per lingua: de, es, fr, ja, ko, pt, zh-CN, zh-TW → **51 chiavi aggiunte ciascuna**.

Traduzioni:
- `menu.theme.tufte` / nomi tema (`theme.*`): riusate le traduzioni già esistenti in
  `menu.theme.*` per gli stessi temi (cadmiumLight, dark, graphiteLight, materialDark, oneDark,
  ulyssesLight — stesso significato, verificato via `src/renderer/src/commands/index.js`).
  "Tufte" è nome proprio (tema ispirato a Edward Tufte): mantenuto invariato in de/es/fr/pt/
  zh-CN/zh-TW (come già avviene per "One Dark"/"Ulysses"), traslitterato in ja ("タフト") e ko
  ("터프트") seguendo lo stesso pattern di oneDark in quelle lingue — traslitterazione non
  verificata su fonte terza, segnalata come incertezza.
- `contextMenu.tabs.*` (pin/unpin/moveToNewWindow/reload): terminologia per "tab" riusata da
  `contextMenu.tabs.close/closeOthers/...` già presenti in ciascuna lingua (es. de "Tab",
  pt "aba", es/fr "pestaña"/"onglet", ja/ko/zh "タブ"/"탭"/"标签页").
- `commands.file.quickOpen`: aggiornata in tutte le 8 lingue da "Quick Open" (traduzione
  vecchia) al valore già presente in `menu.file.recent` (stesso significato "Recent Files",
  già tradotto in ogni lingua) — nessuna nuova traduzione necessaria, solo riuso.
- Le restanti chiavi (statusBar.*, store.editor.*, preferences.editor.writingBehavior.*,
  preferences.general.sessionSnapshot.*, preferences.general.sidebar.watcherUsePolling,
  menu.edit/commands.edit toUpperCase/toLowerCase/openInBrowser): traduzioni originali,
  nessuna fonte precedente nel file da riusare. Non segnalata alcuna incertezza linguistica
  oltre a "Tufte" in ja/ko.

## 3. Aggiornamenti
- `commands.file.quickOpen` in tutte le 8 lingue non-en, valore preso da `menu.file.recent`
  della stessa lingua (vedi sopra).

## 4. Verifica parità strutturale (script `compare-locales.mjs`)
Esito dopo le modifiche: per tutte le 8 lingue non-en, `missing (0)` e `extra (0)` rispetto a
`en.json`. Parità completa raggiunta sulle 9 lingue.

## 5. Chiavi tenute nel dubbio
Nessuna. Ogni chiave con zero riferimenti in `src\`/`static\` è stata rimossa; ogni chiave con
almeno un riferimento (anche solo nel menu app) è stata conservata.

## Riepilogo per file (aggiunte / rimosse / aggiornate)
- de.json: 51 / 54 / 1
- en.json: 0 / 54 / 0 (solo rimozione orfane comuni; già completo/autorevole per il resto)
- es.json: 51 / 54 / 1
- fr.json: 51 / 56 / 1
- ja.json: 51 / 56 / 1
- ko.json: 51 / 56 / 1
- pt.json: 51 / 56 / 1
- zh-CN.json: 51 / 55 / 1
- zh-TW.json: 51 / 60 / 1

## Build
`node scripts/minify-locales.mjs` → OK (9 file minimizzati senza errori).
`node node_modules/electron-vite/bin/electron-vite.js build` → OK, nessun errore né warning
(build completa main/preload/renderer).

## Test
Esito utente (2026-07-12/13, PC principale): OK — dopo la rigenerazione dei `.min.json`
(`npm run minify-locales`: il runtime preferisce i `.min.json` ai `.json`, e `npm run build`
NON esegue minify-locales) le lingue risultano corrette, console senza warning i18n.
Feature chiusa. Regola operativa: dopo ogni modifica alle locale eseguire SEMPRE
`npm run minify-locales`.

## Follow-up (2026-07-12) — nuova sezione quickInsert "inline format"
Un task successivo ha aggiunto in `src\muya\lib\ui\quickInsert\config.js` una nuova sezione
"inline format" nel menu quick-insert (righe 226-315): applica un format al testo selezionato
invece di convertire il blocco. Elenco ESATTO delle chiavi verificato via Grep di tutte le
chiamate `translate('quickInsert.*')` nel file (nessuna era presente in nessuna delle 9 lingue,
`en.json` incluso):
- `quickInsert.inlineFormat` (etichetta categoria, stesso pattern di `basicBlock`/`listBlock`/
  `diagram`)
- `quickInsert.bold.title` / `.subtitle`
- `quickInsert.italic.title` / `.subtitle`
- `quickInsert.underline.title` / `.subtitle`
- `quickInsert.strikethrough.title` / `.subtitle`
- `quickInsert.highlight.title` / `.subtitle`
- `quickInsert.inlineCode.title` / `.subtitle`
- `quickInsert.inlineMath.title` / `.subtitle`
- `quickInsert.inlineLink.title` / `.subtitle`
- `quickInsert.inlineImage.title` / `.subtitle`

Totale: **19 chiavi**, aggiunte a **tutte le 9 lingue** (inglese incluso, poiché mancavano
anche lì). Pattern seguito coerente con le voci quickInsert già esistenti: `title` = nome
breve della funzione, `subtitle` = esempio di sintassi Markdown/HTML (es. `**Bold**`,
`<u>Underline</u>`, `` `Code` ``, `$Formula$`, `[Link](url)`, `![Image](url)`). Terminologia
per lingua riusata dalle voci quickInsert/store.editor già presenti nello stesso file per
mantenere coerenza (es. "highlight" → de "Hervorhebung", es "resaltado", fr "surbrillance",
ja "ハイライト", ko "하이라이트", pt "destaque", zh-CN/zh-TW "高亮"; "code" → de "Code",
es "Código", fr "code", ja "コード", ko "코드", pt "Código", zh-CN "代码", zh-TW "程式碼").
Nessuna incertezza linguistica segnalata (termini standard di formattazione testo, senza nomi
propri).

Script di parità (`compare-locales.mjs`, stesso usato per il resto del task) rieseguito dopo
l'aggiunta: **missing (0) / extra (0)** per tutte le 8 lingue non-en rispetto a `en.json` —
parità confermata sulle 9 lingue. JSON di tutti i 9 file validato (`JSON.parse` OK).

Come da richiesta del follow-up: nessuna build eseguita, nessuna operazione di version control.
