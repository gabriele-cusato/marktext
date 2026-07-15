# window-minwidth-hamburger

## Scopo
Abbassare la width minima della finestra a 550px su tutte le piattaforme. Sotto 700px di larghezza effettiva della tab bar, nascondere le tre icone della sezione destra (command palette, cartella, recent files) e mostrare un'icona hamburger che raccoglie le tre azioni in un popover.

## Modifiche

### File modificati
1. **src/main/config.js**
   - Abbassato `minWidth` da `isOsx ? 780 : 820` a `550` (tutte le piattaforme)
   - Commento aggiornato con la nuova formula

2. **src/renderer/src/components/editorWithTabs/tabs.vue**
   - Aggiunto `isToprightCollapsed` (ref), aggiornato dentro `updateTabRowsLayout()` basato su `tabbarClientW < 700`
   - Avvolti i 3 bottoni (palette, cartella, recent) in `<template v-if="!isToprightCollapsed">`
   - Aggiunto hamburger button (SVG 3 linee, `stroke="currentColor"`) dentro `.v2-tr-hamburger-wrap` nel ramo `v-else`
   - Popover `.v2-tr-popover` teleportato a `<body>` (pattern `Teleport`) per evitare clipping da `overflow:hidden` della tab bar
   - Posizionamento popover calcolato in `positionPopover()`: ancoraggio sotto il bottone, allineamento destra, clampaggio viewport (margine 8px)
   - Chiusura popover su click-fuori/Esc tramite `mousedown`/`keydown` listener su window (pattern BaseContextMenu)
   - CSS scoped: token `--v2-*` esistenti riusati, z-index 4000 (sopra il backdrop settings 3500, sotto context menu v2 4000)
   - Costanti JS↔CSS enumerate nel plan invariate (DYN_SLOT_W, HOVER_BUFFER, GAP, ecc.)

## Da tenere a mente

**Soglia hamburger 700px**: Il trigger `isToprightCollapsed` è deciso come `tabbarClientW < 700`. Se la tab bar si ridimensiona (resize finestra) sopra/sotto questa soglia, l'hamburger appare/scompare di conseguenza. NON sono usati listener window nuovi (sfrutta ResizeObserver preesistente su `.v2-topright`).

**Teleport e clipping**: Il popover è teleportato a `<body>` per evitare il clipping da `overflow:hidden` della tab bar. L'ancoramento è calcolato via JS (`getBoundingClientRect()` al click). Se si restringe la finestra mentre il popover è aperto, il popover si chiude (riposo semplice accettato dal plan).

**Invarianti tab-bar-layout**: Questa zona (tab-bar v2) ha storia di bug delicati (BUG-1 risolto in 6 round, documentato in `Completed/tab-bar-layout/`). Le costanti enumerate nel plan (DYN_SLOT_W, TOPRIGHT_RIGHT_OFFSET, ecc.) rimangono invariate — nessuno è stato modificato né desincronizzato dal CSS.

**Pattern ResizeObserver existente**: La decisione `isToprightCollapsed` si aggancia allo stesso ResizeObserver già presente per lo slot dinamico (topRightResizeObs), evitando listener window duplicati.

**Test esito**: Utente (2026-07-12/13, PC principale) OK — minWidth 550px, soglia 700px hamburger funzionante, multi-row tab bar intatta, resize continuo senza flicker. Feature chiusa.
