# Architettura — panoramica

MarkText è un'app **Electron** con tre processi e un engine editor dedicato.
Questa sezione è organizzata come un albero esplorabile: parti da qui, poi scendi
nei rami a sinistra.

<div class="grid cards" markdown>

-   :material-cog-outline: **Processi e IPC**

    I tre processi (main/renderer/preload) e come comunicano. → [Vai](processi.md)

-   :material-toggle-switch: **Modalità editor**

    Le due modalità (Muya WYSIWYG vs CodeMirror source). → [Vai](modalita.md)

-   :material-shield-alert: **Invarianti critiche**

    Decisioni da non rompere: dirty flag, salvataggio, colori. → [Vai](invarianti/index.md)

</div>

## In breve

- **Main** (`src/main/`) — sistema, finestre, I/O file.
- **Renderer** (`src/renderer/`) — UI Vue 3.
- **Preload** (`src/preload/`) — ponte IPC sicuro.
- Una tab usa **uno** dei due editor in base a `preferences.sourceCode`.

Scendi nei sotto-rami per il dettaglio.
