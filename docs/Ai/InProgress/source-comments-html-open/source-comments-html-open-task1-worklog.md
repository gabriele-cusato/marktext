# source-comments-html-open-task1 — worklog

## Avanzamento

- [x] Aggiungere helper `setModeForFile` in `codeMirror/index.js`.
- [x] Usare `findModeByFileName` + `autoLoadMode` con fallback markdown.
- [x] Importare e usare `setModeForFile` al mount di `sourceCode.vue`.
- [x] Riapplicare il mode corretto in `handleFileChange` su cambio tab/file.
- [x] Verificare staticamente/buildare e riportare esito.

## Test

DA TESTARE: test manuale su .js/.html/.py/.md/.txt in source mode.

Risultato test utente 2026-07-01:
- Apertura `.js`, `.html`, `.py`, `.md`, `.txt` in source mode eseguita.
- Cambio tab tra estensioni diverse eseguito senza crash.
- Scrittura nei file dopo cambio tab senza nuovi errori runtime.
- File sconosciuto/untitled da ricontrollare se serve, ma nessun crash osservato.
- Problema osservato: highlight JavaScript povero/errato, esempio `.js` quasi tutto verde; Python mostra più differenze ma resta molto inferiore a VS Code/Notepad++.
- Errore console F12 all'apertura: `504 (Outdated Optimize Dep)` su dynamic import Prism `prismjs_plugins_keep-markup_prism-keep-markup.js`.
- Verifica console utente su `.js`: primo comando ha restituito `undefined`, secondo comando ha restituito `'text/javascript'`; il mode CodeMirror del file `.js` risulta quindi impostato a JavaScript.
- Dopo pulizia cache Vite con rimozione `node_modules/.vite` e riavvio `npm run dev -- --force`, l'errore F12 `504 (Outdated Optimize Dep)` non compare più.

Verifica eseguita:
- `npm run build` bloccato da Criteri di gruppo nell'ambiente.
- `node .\node_modules\eslint\bin\eslint.js src/renderer/src/codeMirror/index.js` ok.
- `node --check src/renderer/src/codeMirror/index.js` ok.
- `node .\node_modules\eslint\bin\eslint.js src/renderer/src/components/editorWithTabs/sourceCode.vue` mostra errori lint pre-esistenti nel file.
