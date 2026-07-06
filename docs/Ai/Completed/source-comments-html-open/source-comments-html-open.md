# source-comments-html-open — Commenti source mode, apri HTML nel browser, fix save/watcher

## Scopo
Portare in source mode (CodeMirror) le funzioni di editing "da IDE": riconoscimento del linguaggio per estensione, commenti riga/blocco stile VS Code (anche indent-aware), apertura del file HTML nel browser, colori source migliori. In più chiude alcuni bug di contorno emersi lavorandoci: chord `Ctrl+K` catturato dal main, falso "file changed on disk" dopo salvataggio, e una race non atomica nella scrittura file.

Feature conclusa e testata (11 task, ultimo confermato dall'utente 2026-07-06). I plan/worklog di dettaglio stanno nella sottocartella `source-comments-html-open/`.

## Modifiche (per task)
- **task1** — Mode CodeMirror scelto per estensione del file (source mode conosce il linguaggio).
- **task2** — Commenti in source mode: `Ctrl+/`, `Ctrl+K C` / `Ctrl+K U` (line/block toggle) per i linguaggi supportati.
- **task3** — "Apri nel browser" per file `.html`/`.htm` (comando + shortcut dedicati).
- **task4** — Fix del chord dei commenti source (secondo stroke non gestito correttamente).
- **task5** — Colori dei token in source mode migliorati (CSS scoped CodeMirror).
- **task6** — Fix chord commenti intercettato dal **main process** (il secondo stroke del chord `Ctrl+K …` veniva consumato lato main): tracking del focus source e consumo/inoltro corretto.
- **task7** — Fix del falso avviso "file changed on disk" dopo save/open (watcher che scambiava il self-save per modifica esterna).
- **task8** — Commenti inseriti **dopo l'indent** (non a colonna 0) per i mode con `lineComment` (`.js`, `.py`): `{ indent: true }`.
- **task9 / task11** — Stesso comportamento indent-aware per i mode **block-comment-only** (HTML/XML, Markdown, `<!-- -->`), dove CodeMirror ignora `options.indent`: helper custom in `sourceCode.vue` (rileva il mode, calcola l'indent comune, inserisce `blockCommentStart/End` dopo l'indent).
- **task10** — Fix race non atomica nella scrittura file: usare una `rename` (singola syscall) invece di move = remove+rename.

## Da tenere a mente (per il futuro)
- **Indent block-comment HTML/MD** (task9/11): CodeMirror `blockComment()` **non** implementa `options.indent`, inserisce sempre a colonna 0. Il fix è un helper custom in `sourceCode.vue` (`getModeAtPosition` / `isBlockCommentOnlyMode` + calcolo `commonIndent` + `replaceRange`), NON una patch a `node_modules/codemirror`. Non reintrodurre marker a colonna 0.
- **Chord `Ctrl+K …`** (task4/task6): il secondo stroke può essere catturato dal main; serve il tracking del focus source. Non rimuovere questa logica pensando che il chord sia solo renderer-side.
- **Watcher self-save** (task7): il fix distingue il salvataggio proprio dalla modifica esterna con una finestra temporale non-consuming. Toccando il watcher, non far ricomparire il falso "file changed".
- **Scrittura atomica** (task10): mantenere `rename` (atomica). Non tornare a `move`/remove+rename, riapre la race su Windows.
- **Ramo `lineComment` nativo** (task8): per `.js`/`.py` il comportamento passa da `cm.lineComment/uncomment(..., { indent: true })`; il ramo block-comment-only è separato. Tenere i due rami distinti.
- Dettaglio implementativo puntuale (file/righe esatte, root cause complete): vedere i plan/worklog nella sottocartella `source-comments-html-open/`.
