# source-comments-html-open-task11 — worklog

## Avanzamento

- [x] Verificare prerequisiti e decisioni progetto prima di modificare codice.
- [x] Confermare root cause CodeMirror `blockComment()` e mode HTML/Markdown block-comment-only.
- [x] Aggiungere helper mode/comment in `sourceCode.vue` senza patchare `node_modules`.
- [x] Implementare inserimento block-comment indent-aware per mode senza `lineComment`.
- [x] Conservare invariato ramo `lineComment` nativo (`.js`, `.py`, ecc.).
- [x] Aggiornare `Ctrl-/` per usare toggle indent-aware su block-comment-only.
- [x] Verificare `Ctrl+K Ctrl+U`/uncomment su block comment indentato.
- [x] Verificare staticamente e riportare esito.

Stato task: FUNZIONANTE (confermato dall'utente).

## Prerequisiti bloccanti — verifica

- FATTO: verificata presenza/leggibilità di tutti i prerequisiti bloccanti con `Test-Path`.
- FATTO: lette decisioni progetto in `docs/Ai/DECISIONS.md` (vincolo VCS rispettato: nessun comando git/ss/svn usato).
- FATTO: lette fonti richieste Task8/Task9 (`plan`/`worklog`) e fonti locali CodeMirror (`comment.js`, `xml.js`, `markdown.js`).

## Modifiche applicate

- FATTO: implementato fix locale in `sourceCode.vue` (nessuna patch in `node_modules`).
- FATTO: `handleSourceCommentActionFromMain()` ora usa `applySourceCommentAction()`, quindi anche lo shortcut intercettato dal main (`Ctrl+K Ctrl+C` / `Ctrl+K Ctrl+U`) passa dal nuovo helper.
- FATTO: aggiunti helper locali:
  - `NON_WS_RE` per riconoscere righe non vuote.
  - `getModeAtPosition()` per usare `cm.getModeAt(pos)` quando disponibile e fallback a `cm.getMode()`.
  - `isBlockCommentOnlyMode()` per distinguere mode con `blockCommentStart`/`blockCommentEnd` ma senza `lineComment`.
  - `getBlockCommentEndLine()` per replicare il comportamento full-lines CodeMirror quando la selezione termina a `ch === 0`.
  - `getCommonIndentForRange()` per calcolare l'indent comune minimo delle righe non vuote.
  - `insertIndentAwareBlockComment()` per inserire chiusura a fine ultima riga e apertura dopo indent comune della prima riga.
  - `toggleIndentAwareBlockComment()` per provare prima `cm.uncomment()` e commentare solo se non è stato rimosso nulla.
  - `applyLineCommentToggleForRange()` per mantenere toggle per mode con `lineComment` quando serve gestire range singoli.
- FATTO: `applySourceCommentAction()` conserva iterazione dal basso verso l'alto dentro `cm.operation()`.
- FATTO: per mode con `lineComment`, `comment` e `uncomment` continuano a usare `cm.lineComment(..., { indent: true })` / `cm.uncomment(..., { indent: true })`.
- FATTO: per `Ctrl-/`, se nessuna selezione è block-comment-only, resta `cm.toggleComment({ indent: true })`; se almeno una selezione è block-comment-only, il toggle viene gestito per range dal nuovo helper.
- FATTO: binding source aggiornati da `applyLineCommentAction()` a `applySourceCommentAction()` per `Ctrl-/`, `Ctrl-K C`, `Ctrl-K Ctrl-C`, `Cmd-K Cmd-C`, `Ctrl-K U`, `Ctrl-K Ctrl-U`, `Cmd-K Cmd-U`.

## Decisioni implementative

- FATTO: confermata root cause da fonte locale (`node_modules/codemirror/addon/comment/comment.js:63-69`, `:120-123`): per mode senza `lineComment`, `lineComment()` delega a `blockComment()` che inserisce apertura a colonna 0 e ignora `indent`.
- FATTO: confermato da fonte locale (`mode/xml/xml.js:388-389`, `mode/markdown/markdown.js:874-875`) che HTML/XML/Markdown espongono `blockCommentStart`/`blockCommentEnd` senza `lineComment`.
- Scelta: non patchare `node_modules`; fix locale in `sourceCode.vue` perché il problema riguarda solo source mode e patchare addon CodeMirror cambierebbe comportamento globale.
- Scelta: per `uncomment` block-comment-only usare `cm.uncomment(from, to, { indent: true })`, perché `comment.js:173-200` cerca `blockCommentStart` con `indexOf` e rimuove padding vicino ai marker, senza assumere colonna 0.
- Scelta: inserire prima la chiusura e poi l'apertura; su selezione singola questo evita che l'inserimento dell'apertura sposti la posizione dove mettere la chiusura.

## Verifiche eseguite

- `npx eslint "src/renderer/src/components/editorWithTabs/sourceCode.vue"` → BLOCCATO da policy sistema: `Il programma è bloccato dai Criteri di gruppo. Per ulteriori informazioni, contattare l'amministratore del sistema.`
- `node "node_modules/eslint/bin/eslint.js" "src/renderer/src/components/editorWithTabs/sourceCode.vue"` → eseguito, ma fallisce per errori già presenti/non correlati al fix:
  - `import-x/first` righe 28-37.
  - `@stylistic/multiline-ternary` riga 340.
  - `@stylistic/no-multiple-empty-lines` riga 435.
  - `@stylistic/quote-props` riga 1060.
  Questi errori non sono stati corretti perché fuori scope Task11.
- `node --input-type=module -e "import fs from 'node:fs'; import { parse } from '@vue/compiler-sfc'; const file='src/renderer/src/components/editorWithTabs/sourceCode.vue'; const result=parse(fs.readFileSync(file,'utf8'), { filename:file }); if (result.errors.length) { console.error(result.errors); process.exit(1); } console.log('SFC parse OK');"` → `SFC parse OK`.
- Verifica statica diff: `sourceCode.vue` è l'unico file sorgente modificato; nessuna patch in `node_modules`.

## Test

Testato dall'utente: OK. Confermato funzionante dopo implementazione Task11.

Checklist scenario coperti dalla conferma utente:

- `.html`: `Ctrl+K Ctrl+C` su riga indentata deve produrre `    <!-- testo -->`, non marker a colonna 0.
- `.html`: `Ctrl+K Ctrl+U` deve rimuovere quel commento.
- `.html`: `Ctrl+/` deve fare toggle corretto rispettando indent.
- `.md`: stesso comportamento su riga indentata.
- `.js`/`.py`: nessuna regressione su commenti `//`/`#` dopo indent.
