# source-comments-html-open-task5 — Migliorare colori source CodeMirror

## Obiettivo

Migliorare la resa cromatica del source mode collegata a Task1: il mode JavaScript risulta impostato (`text/javascript`), ma il tema attuale mostra evidenziazione povera/quasi tutta verde. Intervenire sui CSS dei temi CodeMirror usati dal progetto, non sulla scelta mode, per aumentare differenziazione di keyword, stringhe, commenti, numeri, proprietà, operatori e variabili.

## Prerequisiti bloccanti

- Plan precedente richiesto e leggibile: `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task1-plan.md`.
- Worklog precedente richiesto e leggibile: `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task1-worklog.md`.
- Fonte locale mode loader richiesta e leggibile: `src/renderer/src/codeMirror/index.js` e `src/renderer/src/codeMirror/loadmode.js`.
- Fonte locale temi richiesta e leggibile: `src/renderer/src/codeMirror/index.css`, `src/renderer/src/assets/themes/codemirror/one-dark.css`, `node_modules/codemirror/lib/codemirror.css`, `node_modules/codemirror/theme/railscasts.css`.
- Fonte locale selezione tema richiesta e leggibile: `src/renderer/src/components/editorWithTabs/sourceCode.vue`.
- File sensibili/vietati: non modificare `node_modules`; usarlo solo come fonte read-only. Non leggere né modificare segreti esterni al repo.
- Target verifica: controllo CSS/statico; test runtime manuale su temi e linguaggi.
- Comandi version control: `Docs/Ai/DECISIONS.md` è vuoto; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control salvo autorizzazione esplicita successiva dell'utente.
- Se uno dei prerequisiti è mancante o ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/codeMirror/index.css`
- `src/renderer/src/assets/themes/codemirror/one-dark.css` solo se necessario per completare classi mancanti del tema one-dark già locale al progetto
- `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task5-worklog.md`

Non toccare `src/renderer/src/codeMirror/index.js`, `src/renderer/src/codeMirror/loadmode.js`, `src/renderer/src/components/editorWithTabs/sourceCode.vue`, `node_modules`, keybindings, menu, command palette, IPC, drag/tabbar.

## Regole e invarianti rilevanti

- Non cambiare mode loader se `cm.getOption('mode')` è già `text/javascript` per `.js`.
- Non importare nuove librerie e non migrare editor.
- Non modificare file in `node_modules`; eventuali CSS di `node_modules` servono solo come fonte.
- Preferire override CSS scoped su CodeMirror/source mode, non modifiche globali Muya/Prism.
- Evitare colori uguali per classi semantiche diverse dove possibile, soprattutto in `railscasts` usato da `dark/material-dark`.
- Conservare selezione source già resa evidente in `src/renderer/src/codeMirror/index.css`.
- Non promettere parità con VS Code/Notepad++: CodeMirror 5 e i suoi tokenizer restano meno ricchi.

## Fatti già verificati

- Test utente 2026-07-01: su `.js`, `cm.getOption('mode')` restituisce `'text/javascript'`; il problema non sembra fallback markdown.
- Dopo pulizia `node_modules/.vite` e `npm run dev -- --force`, errore F12 `504 (Outdated Optimize Dep)` sparito; non serve fix runtime per cache Vite.
- `sourceCode.vue` seleziona tema `railscasts` per temi `dark/material-dark` e `one-dark` per tema `one-dark`.
- `node_modules/codemirror/lib/codemirror.css` lascia alcune classi default poco differenziate, inclusi `cm-variable`, `cm-property`, `cm-operator`.
- `node_modules/codemirror/theme/railscasts.css` tende a rendere variabili/proprietà verdi, compatibile con osservazione “JS quasi tutto verde”.
- `src/renderer/src/assets/themes/codemirror/one-dark.css` è più ricco ma può non coprire tutte le classi (`cm-variable-2`, `cm-variable-3`, `cm-type` ecc.).

## Sottoproblemi in ordine

1. Confermare quali temi source sono effettivamente applicati da `sourceCode.vue` e quali CSS locali sono importati.
2. In `src/renderer/src/codeMirror/index.css`, aggiungere override scoped per `.source-code .CodeMirror.cm-s-railscasts` che differenzino almeno `cm-keyword`, `cm-def`, `cm-number`, `cm-property`, `cm-variable`, `cm-variable-2`, `cm-variable-3`, `cm-string`, `cm-operator`, `cm-comment`, `cm-type`, `cm-builtin`.
3. In `src/renderer/src/codeMirror/index.css`, aggiungere override scoped per `.source-code .CodeMirror.cm-s-default` solo per classi lasciate neutre dal default (`cm-variable`, `cm-property`, `cm-operator`, eventuali `cm-type`/`cm-builtin`) mantenendo coerenza con tema light.
4. Valutare se `src/renderer/src/assets/themes/codemirror/one-dark.css` necessita solo di classi mancanti; se sì, aggiungere classi mancanti lì o in override scoped, senza duplicare inutilmente regole già presenti.
5. Non modificare `setModeForFile` salvo evidenza nuova contraria durante verifica.
6. Aggiornare worklog task5 con `[x]`, verifiche eseguite e note `DA TESTARE` runtime.

## Verifica richiesta

- Controllo statico CSS: override scoped a `.source-code`/`.CodeMirror` e nessuna modifica Muya/Prism.
- Test manuale atteso:
  - Aprire `.js` in source mode con tema usato dall'utente: keyword, stringhe, commenti, numeri, proprietà/operatori devono avere colori più distinguibili.
  - Ripetere su `.py`, `.html`, `.css`.
  - Cambiare tra temi `light`, `dark`, `material-dark`, `one-dark` e verificare contrasto leggibile.
  - Confermare che `cm.getOption('mode')` resta `text/javascript` su `.js`.
  - Confermare nessun ritorno errore F12 `504 (Outdated Optimize Dep)` dopo cache già pulita.
