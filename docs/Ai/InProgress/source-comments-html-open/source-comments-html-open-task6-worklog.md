# source-comments-html-open-task6 — worklog

## Avanzamento

- [x] Confermare fonti locali su `before-input-event`, `electron-localshortcut`, CodeMirror chord e shortcut globali.
- [x] Tracciare focus source CodeMirror verso main senza impatto su Muya.
- [x] Gestire prefix `Ctrl/Cmd+K` nel main solo quando source focus è attivo.
- [x] Inviare azioni source comment/uncomment al renderer per `Ctrl/Cmd+K Ctrl/Cmd+C/U`.
- [x] Gestire azioni source comment/uncomment in `sourceCode.vue` usando `applyLineCommentAction`.
- [x] Aggiungere fallback macOS `Cmd-K Cmd-C/U` negli `extraKeys` CodeMirror.
- [x] Verificare staticamente e riportare esito.

## Stato task

- DA TESTARE

## Verifiche eseguite

- Fonti locali confermate: `src/main/windows/editor.js` (hook `before-input-event`), `src/main/keyboard/shortcutHandler.js` (`electron-localshortcut.register(... return true)`), `node_modules/codemirror/lib/codemirror.js` (`normalizeKeyMap` multi-stroke), `node_modules/codemirror/keymap/sublime.js` (binding `Ctrl/Cmd-K Ctrl/Cmd-C/U`).
- Verifica statica JS: `node --check src/main/windows/editor.js` completato senza errori.
- Verifica parse SFC: `@vue/compiler-sfc` su `src/renderer/src/components/editorWithTabs/sourceCode.vue` completato (`SFC parse ok`).
- Controllo statico comportamento: consumo `preventDefault()` limitato al solo source focus + prefix attivo (`Ctrl/Cmd+K`, poi `Ctrl/Cmd+C/U`), reset su blur/timeout/altri tasti; `Ctrl+C` e `Ctrl+U` normali restano non consumati senza prefix.

## Test

DA TESTARE lato utente: `Ctrl+K Ctrl+C`, `Ctrl+K Ctrl+U`, `Ctrl+/` in source mode su `.js`, `.html`, `.py`; `Ctrl+C`/`Ctrl+U` normali fuori chord; `Ctrl+K` solo non deve aprire TOC/sidebar né bloccare shortcut successivi.

Risultato test utente 2026-07-01: Task6 funziona; `Ctrl+K Ctrl+C/U` ora commenta/decommenta come atteso.
