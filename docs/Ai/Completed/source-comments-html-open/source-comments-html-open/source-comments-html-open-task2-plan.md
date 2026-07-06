# source-comments-html-open-task2 — T-M2/H3 Commenti source

## Obiettivo

Implementare T-M2/H3: aggiungere comment/uncomment in source mode usando CodeMirror e mode per linguaggio, con `Ctrl+/`, `Ctrl+K C`, `Ctrl+K U`.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/codeMirror/index.js`
- `src/renderer/src/components/editorWithTabs/sourceCode.vue`
- `src/main/keyboard/keybindingsWindows.js`
- `src/main/keyboard/keybindingsLinux.js`
- `src/main/keyboard/keybindingsDarwin.js`
- `Docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task2-worklog.md`

Non toccare menu/templates, command palette, IPC, T-M5, drag/tabbar.

## Regole e invarianti rilevanti

- Dipende da Task1/T-M1: mode per estensione deve esistere o essere implementato prima.
- Non implementare manualmente sintassi linguaggi: usare infrastruttura CodeMirror/addon.
- Menu Electron precede CodeMirror: se `Ctrl+K` è assegnato a menu, la sequenza non arriva a CM.
- Liberare solo accelerator di `view.toggle-toc`; non rimuovere comando/menu.
- I commenti devono essere source-only: nessun impatto su Muya.
- Non usare `Ctrl+Alt` su Windows/Linux per evitare problemi AltGr.
- Non toccare drag/HTML5 DnD/taskbar/raise/marker.

## Fatti già verificati

- `sourceCode.vue` `extraKeys` contiene solo `Alt-Up`, `Alt-Down`, `Escape`; mancano `Ctrl-/`, `Ctrl-K C`, `Ctrl-K U`.
- Nessun import addon comment CodeMirror in `codeMirror/index.js`.
- `Ctrl+K` è assegnato a `view.toggle-toc` nelle tre keymap.
- La sidebar reale monta solo search; `view.toggle-toc` non è UI attiva, ma comando/menu vanno lasciati.
- `Ctrl+/` risulta libero dal menu e può arrivare a CodeMirror.

## Sottoproblemi in ordine

1. Verificare in `node_modules/codemirror/addon/comment/comment.js` i nomi API/comandi esatti disponibili; non inventare nomi.
2. In `codeMirror/index.js`, importare `codemirror/addon/comment/comment`.
3. In `sourceCode.vue`, aggiungere `Ctrl-/` negli `extraKeys` per toggle comment (`toggleComment` o comando/API locale verificata).
4. In `sourceCode.vue`, aggiungere `Ctrl-K C` per commentare selezione/linee in source mode.
5. In `sourceCode.vue`, aggiungere `Ctrl-K U` per decommentare selezione/linee in source mode.
6. Se servono helper custom, collocarli vicino agli helper source-only esistenti e usare API CodeMirror addon verificata.
7. Nelle tre keymap main, liberare accelerator `Ctrl+K`/equivalente da `view.toggle-toc`, senza rimuovere id/voce/comando.
8. Aggiornare worklog task2 con `[x]`, eventuali `DA TESTARE`, comandi eseguiti o note.

## Verifica richiesta

- Controllare staticamente che `Ctrl+K` non resti catturato da keybinding menu.
- Eseguire build/test ragionevoli se possibile.

## Test manuale atteso

- In file `.js`, `Ctrl+/`, `Ctrl+K C`, `Ctrl+K U` devono usare `//`.
- In file `.html`, commento deve usare `<!-- -->`.
- In file `.py`, commento deve usare `#`.
- In markdown/Muya, questi shortcut non devono attivare commenti source né rompere funzioni esistenti.
- `Ctrl+K` da solo non deve aprire TOC/sidebar.
