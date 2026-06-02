# Colori selezione (non confonderli)

Due variabili CSS distinte, una per editor. Scambiarle rompe i temi.

- **`--selectionColor`** (per tema, in `assets/themes/*`): usata da **Muya** (WYSIWYG).
  NON toccarla per cambiare la source.
- **`--cmSelectionColor`** (B4-bis): dedicata a **CodeMirror**, default `rgba(56,139,253,0.6)`.
  Disaccoppia la selezione source da Muya.

!!! note "Perché due variabili"
    Alcuni temi (railscasts su `dark`/`material-dark`) forzano
    `div.CodeMirror-selected { #272935 !important }` da `node_modules` → selezione quasi
    invisibile. La variabile dedicata con override ad alta specificità risolve (B4-bis).
