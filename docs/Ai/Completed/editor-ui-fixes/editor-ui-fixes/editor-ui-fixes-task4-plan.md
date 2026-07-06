# editor-ui-fixes — task4 — plan: front menu "style" — etichette lunghe sovrapposte nel sottomenu

## Obiettivo
Nel sottomenu "turn into" del front menu (icona P a sinistra del paragrafo), le etichette lunghe (es. "Math Formula") non devono andare a capo sovrapponendosi: ogni voce su una riga, con ellipsis se non ci sta.

## Prerequisiti bloccanti
- Questo plan e il worklog `editor-ui-fixes-task4-worklog.md` esistenti e leggibili.
- File richiesti: `src/muya/lib/ui/frontMenu/index.css` e `src/muya/lib/ui/frontMenu/index.js` (sola lettura per la struttura DOM).
- Target di verifica: `npm run build` exit 0; test visivo utente su menu principale E sottomenu, anche con lingua non-en.
- Version control: solo `git status`/`git diff`; vietati commit (DECISIONS.md 2026-07-01).

## Fatti verificati (Agent-Explorer 2026-07-06)
- Il sottomenu è `div.submenu > ul > li.item` (frontMenu/index.js:71-118, larghezza .submenu 190px): l'`ul` NON è figlio diretto di `.ag-front-menu`, quindi le regole di layout `.ag-front-menu > ul li` (index.css:18-26: flex, height 28px, align-items) e `.ag-front-menu > ul li > span` (index.css:60-64: flex:1) NON si applicano alle voci del sottomenu.
- Risultato: icon-wrapper/span/short-cut senza layout orizzontale vincolato, testo lungo va a capo senza altezza riga fissa → sovrapposizione visiva.
- Non esistono altri `ul`/`li` dentro `.ag-front-menu` oltre menu principale e sottomenu: allargare lo scope è sicuro (da riverificare visivamente).

## File da toccare
- `src/muya/lib/ui/frontMenu/index.css`

## Regole rilevanti
- Muya engine: solo CSS in questo task, nessun cambio a index.js.
- Fix minimo: estendere lo scope dei selettori e anti-wrap, non ridisegnare il menu.

## Sottoproblemi in ordine
1. `.ag-front-menu > ul li` → `.ag-front-menu ul li` (layout flex/height per entrambi i livelli).
2. `.ag-front-menu > ul li > span` → `.ag-front-menu ul li > span` aggiungendo `min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`.
3. Controllare le altre regole scoped con `>` nello stesso file per coerenza (es. `.short-cut`): adattare SOLO se il layout del sottomenu risultasse ancora rotto dai punti 1-2 (valutare dal CSS, riportare nel worklog).
4. Build `npm run build`.
5. Worklog (checkbox + DA TESTARE, indicando che serve verifica visiva su entrambi i livelli di menu).

## Esecutore e skill
- Agent-Code. Skill: coding-standard.
