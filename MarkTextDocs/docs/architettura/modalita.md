# Modalità editor

Il concetto che spiega la maggior parte dei bug. Una tab è renderizzata da **uno**
dei due editor, in base a `preferences.sourceCode`.

=== "Markdown / WYSIWYG"
    Engine **Muya** (`components/editorWithTabs/editor.vue`, `src/muya/`).

    Il listener `on('change')` chiama `LISTEN_FOR_CONTENT_CHANGE` **in modo sincrono**
    → lo store (`tab.markdown`) è **sempre aggiornato**.

=== "Source / testo grezzo"
    **CodeMirror 5** (`components/editorWithTabs/sourceCode.vue`).

    Il commit allo store è **debounced 1s** → per ~1s dopo aver digitato `tab.markdown`
    può essere **stale**. Radice di B8 e B13.

!!! info "Chi decide la modalità"
    `_applySourceCodeForFile(file)` (in `store/editor.js`) decide dall'estensione:
    `.md/.markdown/.mdown/.mkd` o senza estensione → Muya; tutto il resto → source.
    **Va chiamato PRIMA di `bus.emit('file-changed')`** ad ogni cambio tab.

!!! note "Nota sulle schede qui sopra"
    Qui le **schede** sono corrette: Muya e CodeMirror sono **alternative allo stesso
    livello**, non gradini di profondità. La gerarchia di profondità è invece l'albero
    a sinistra (Architettura → Invarianti → …).
