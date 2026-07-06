# source-comments-html-open-task4 — worklog

## Avanzamento

- [x] Verificare fonti locali CodeMirror su chord multi-stroke.
- [x] Aggiungere `Ctrl-K Ctrl-C` source-only in `sourceCode.vue`.
- [x] Aggiungere `Ctrl-K Ctrl-U` source-only in `sourceCode.vue`.
- [x] Conservare `Ctrl-/`, `Ctrl-K C`, `Ctrl-K U` senza regressioni.
- [x] Verificare staticamente e riportare esito.

## Stato task

- DA TESTARE

## Verifiche eseguite

- Fonte locale CodeMirror `node_modules/codemirror/src/input/keymap.js`: `normalizeKeyMap` supporta key multipli separati da spazio (`keyname.split(" ")`) e lookup multi-stroke (`"..."`/`"multi"`).
- Fonte locale esempio chord `node_modules/codemirror/keymap/sublime.js`: presenti binding `Ctrl-K Ctrl-C` e `Ctrl-K Ctrl-U`.
- Fonte locale addon comment `node_modules/codemirror/addon/comment/comment.js`: disponibili `lineComment`/`uncomment` usati via helper locale `applyLineCommentAction`.
- Verifica statica SFC: parse riuscito con `@vue/compiler-sfc` su `sourceCode.vue`.
- Verifica scope patch: controllato `git status --short` (working tree già sporco su file fuori scope preesistenti) e `git diff -- src/renderer/src/components/editorWithTabs/sourceCode.vue Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task4-worklog.md` per isolare patch di questo task ai soli file consentiti.
- Build-loop: `npm run build` fallito per vincolo ambiente (`Il programma è bloccato dai Criteri di gruppo`); non risolvibile da codice nel task.

## Test

DA TESTARE lato utente: `Ctrl+K Ctrl+C`, `Ctrl+K Ctrl+U`, `Ctrl+/` in source mode su `.js`, `.html`, `.py`; `Ctrl+K` solo non deve aprire TOC/sidebar.

Risultato test utente 2026-07-01: Task4 non ha risolto il bug; `Ctrl+K Ctrl+C/U` resta non funzionante come atteso. Indagine successiva indica probabile intercetto del secondo stroke da shortcut globali main (`Ctrl+C` copy, `Ctrl+U` lowercase) tramite `electron-localshortcut`.
