# window-minwidth-hamburger — worklog

Plan: `window-minwidth-hamburger-plan.md`.

## Avanzamento
- [x] Indagine: minWidth attuale + layout tabbar a width ridotte
- [x] Decisioni utente: nuova minWidth + soglia hamburger (decisione orchestratore su delega
      utente 2026-07-12: minWidth 550px tutte le piattaforme, soglia collasso 700px)
- [x] minWidth abbassata (main): `config.js:13` → 550 (tutte le piattaforme), commento
      aggiornato con la nuova formula. `windows/editor.js:93-97` legge `editorWinOptions.minWidth`
      da config.js (nessuna costante cablata) → eredita 550 senza altre modifiche.
- [x] Hamburger + popover con palette/cartella/recenti sotto soglia (`tabs.vue`)
- [x] Verifica invarianti tab-bar-layout (nessuna delle costanti JS↔CSS elencate nel plan
      toccata; build passata)

DA TESTARE

## Note implementazione
- `isToprightCollapsed` (ref) aggiornato dentro `updateTabRowsLayout()` (tabs.vue), subito dopo
  il calcolo di `tabbarClientW` (già clampato al viewport, invariante 2): decisione PURA funzione
  di `tabbarClientW < 700`, indipendente da `baseTopRight`/`tre.offsetWidth` per non introdurre un
  loop auto-referenziale (la larghezza del topright dipenderebbe dallo stato che la sta
  decidendo). Nessun listener window nuovo, nessuna @media: sfrutta lo stesso ResizeObserver già
  attivo su `.v2-topright` (`topRightResizeObs`, onMounted) che rifira quando il DOM cambia
  (3 bottoni → hamburger) e ricalcola `baseTopRight`/padding con la misura corretta — stesso
  pattern già usato per lo slot dinamico 0↔158 (invariante 3), nessuna costante JS↔CSS nuova da
  sincronizzare perché `baseTopRight` è sempre misurato a runtime (mai hardcoded).
- Template: i 3 bottoni singoli (⌘, recenti, cartella) sono avvolti in `<template v-if=
  "!isToprightCollapsed">`; `v-else` mostra `.v2-tr-hamburger-wrap` con bottone hamburger SVG
  (3 linee, `stroke="currentColor"`, stessa classe `v2-tr-btn`) + popover `.v2-tr-popover`
  (v-if su `hamburgerMenuOpen`) con 3 voci che chiamano wrapper (`hamburgerCommandPalette`,
  `hamburgerOpenFile`, `hamburgerRecentFiles`) che invocano gli handler esistenti
  (`openCommandPalette`, `openFileDialog`, `openRecentFiles`) e chiudono il popover.
- Chiusura popover: `watch(hamburgerMenuOpen)` aggiunge/rimuove `mousedown`/`keydown` su
  `window` solo mentre aperto (pattern di `BaseContextMenu.vue`); cleanup anche in
  `onBeforeUnmount`. CSS scoped dentro `tabs.vue`, token `--v2-*` esistenti (`--v2-surface`,
  `--v2-border`, `--v2-shadow-lg`, `--v2-accent-dim`, `--v2-t-fast`), nessuna modifica a
  `v2-tokens.css`.
- Costanti JS↔CSS elencate nel plan (DYN_SLOT_W/HOVER_BUFFER, GAP, 26px, TOPRIGHT_RIGHT_OFFSET,
  min-width 88px) invariate: non toccate né desincronizzate.

## Test
Bug riportato dall'utente (test manuale, sotto 700px): il popover dell'hamburger
(`.v2-tr-popover`) restava TAGLIATO dentro la tab bar — `.v2-tabbar` ha
`overflow: hidden` (invariante drag/multi-row, riga ~1385) e clippava il popover
ancorato con `position: absolute` dentro `.v2-tr-hamburger-wrap` (discendente della
tab bar), mostrandone solo una piccola porzione.

Fix (tabs.vue): popover portato fuori dal flusso clippato con `<Teleport to="body">`
(stesso pattern di `folderSearchOverlay/index.vue` e `BaseContextMenu.vue`),
`position: fixed` con `top`/`left` calcolati in JS (`positionPopover`, nuova funzione)
dal `getBoundingClientRect()` del bottone hamburger (`hamburgerBtnEl`, nuovo ref):
ancorato sotto il bottone, allineato a destra, clampato dentro il viewport (margine
8px) se sborda — stesso principio di `adjustPosition` in `BaseContextMenu.vue`.
Ricalcolato ad ogni apertura (`watch(hamburgerMenuOpen)` → `nextTick` → misura
`popoverEl.offsetWidth/Height`, disponibili solo a nodo montato). Resize finestra a
popover aperto: si chiude (via più semplice accettata dal plan) invece di
riposizionare — riancora alla riapertura successiva.

Chiusura su click-fuori/Esc: il popover teleportato non è più discendente DOM di
`hamburgerWrapEl` → `handleHamburgerOutside` adattato per controllare ANCHE
`popoverEl.value.contains(e.target)` (nuovo ref sul nodo teleportato), non solo
`hamburgerWrapEl`. `@mousedown.stop`/`@click.stop` sul popover restano come difesa
aggiuntiva (pattern folderSearchOverlay).

CSS: `.v2-tr-popover` da `position: absolute` (ancorato al wrapper `relative`,
`top: calc(100% + 4px); right: 0`) a `position: fixed` (top/left ora inline via
`:style="popoverStyle"`); `z-index` da 30 a 4000, allineato a `.v2-ctx` di
`BaseContextMenu.vue` (stesso layer "popover su body"). Nessuna migrazione da
`<style scoped>`: verificato che `folderSearchOverlay/index.vue` e
`BaseContextMenu.vue` usano già `<style scoped>` + `Teleport to="body"` insieme —
Vue applica l'attributo scope (`data-v-xxxx`) al render, indipendentemente da dove il
nodo viene teleportato nel DOM, quindi lo stile scoped esistente resta valido.

Non toccate: soglia 700px/`isToprightCollapsed`, le 4 voci del popover, nessun altro
file oltre `tabs.vue`.
