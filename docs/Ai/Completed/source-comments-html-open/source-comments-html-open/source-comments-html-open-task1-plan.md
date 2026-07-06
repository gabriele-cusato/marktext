# source-comments-html-open-task1 — T-M1 Mode CodeMirror per estensione

## Obiettivo

Implementare T-M1: in source mode, CodeMirror deve usare il mode corretto in base a filename/path invece di forzare sempre markdown.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/codeMirror/index.js`
- `src/renderer/src/components/editorWithTabs/sourceCode.vue`
- `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task1-worklog.md`

Non toccare keybindings, menu, command palette, IPC, drag/tabbar.

## Regole e invarianti rilevanti

- Non toccare drag/HTML5 DnD/taskbar/raise/marker.
- Non toccare `tabs.vue`.
- Conservare `markRaw` sull'istanza CodeMirror in `sourceCode.vue`.
- L'istanza CodeMirror è riusata tra tab: il mode va riapplicato a ogni cambio tab/file, non solo al mount.
- Non modificare flussi dirty/save/pre-save.
- Non usare `setValue` per motivi non necessari: `setValue` non resetta undo CM5.

## Fatti già verificati

- `src/renderer/src/codeMirror/index.js` importa già `codemirror/mode/meta` e `codemirror/addon/mode/loadmode`.
- `src/renderer/src/codeMirror/index.js` configura già `CodeMirror.modeURL` e ha `setMode(cm, name)`, ma non `setModeForFile`.
- `src/renderer/src/components/editorWithTabs/sourceCode.vue` importa `setMode` e al mount forza `setMode(codeMirrorInstance, 'markdown')`.
- `sourceCode.vue` `handleFileChange` non riapplica il mode per file/tab.
- L'evento `file-changed` non porta sempre `pathname`; serve lookup in `editorStore.tabs.find(t => t.id === id)`.

## Sottoproblemi in ordine

1. In `codeMirror/index.js`, aggiungere helper esportato `setModeForFile(cm, filename)` accanto a `setMode`.
2. Usare `findModeByFileName(filename || '')`.
3. Se info valida esiste, impostare mode con `info.mime || info.mode` e chiamare `autoLoadMode(cm, info.mode)` quando possibile.
4. Se info manca o input non valido, fallback markdown usando helper esistente o equivalente robusto.
5. In `sourceCode.vue`, importare `setModeForFile` senza rompere import esistenti.
6. Al mount, sostituire force markdown con mode del file corrente, ricavato dalla tab corrente (`pathname` preferito, poi `filename`).
7. In `handleFileChange`, dopo aver identificato la tab/evento, riapplicare mode usando lookup tab per `id`, fallback su `filename`/`pathname` disponibili.
8. Aggiornare worklog task1 con `[x]`, eventuali `DA TESTARE`, comandi eseguiti o note.

## Verifica richiesta

- Controllare che build/lint/test disponibili non falliscano per questa modifica, se ragionevole.
- Se build completa non è praticabile, eseguire almeno verifica statica/import e riportare motivazione.

## Test manuale atteso

- Aprire `.js`, `.html`, `.py`, `.md`, `.txt` in source mode.
- Cambiare tab tra estensioni diverse: il mode/highlight non deve restare bloccato su markdown.
- File sconosciuto/untitled deve restare gestito senza crash, fallback markdown accettato.
