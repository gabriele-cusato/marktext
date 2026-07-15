# preferences-refinement — task2 (bug combo box) — plan — 2026-07-12

Origine: TODO.md: nelle Preferences, espandendo una combo senza aver scrollato, le sotto-voci
escono dal riquadro dal lato ALTO e restano nascoste (visibili solo scrollando). Bug di
overflow/posizionamento del dropdown.

## Diagnosi (Agent-Explorer 2026-07-12, verificata su sorgente Element Plus 2.13)
- Ipotesi (a) teleport clippato e (b) teleport disattivato: **SMENTITE** — `teleported` default
  `true`, popper appeso a un div su `document.body` fuori da ogni overflow; nessun
  `teleported:false`/override boundary in `src/renderer/src`.
- Ipotesi (c) **SUPPORTATA** (causa più probabile): el-select ha `fallbackPlacements`
  `['bottom-start','top-start','right','left']` (select.mjs:256-270) e il modifier `flip` usa i
  default popper.js (`boundary:'clippingParents'` calcolato dagli ANTENATI DEL TRIGGER, cioè
  `.pref-setting`). `.pref-setting` è l'unico scrollabile (`preference.vue:97-103`,
  `overflow:auto`, alto `calc(100vh - titleBar)`); `.pref-container` è `position:fixed;100vh` →
  NON esiste scroll di pagina. Trigger verso il fondo della porzione visibile pre-scroll → flip a
  `top-start` → popper posizionato sopra il bordo alto della finestra (y negativa) → invisibile.
  Dopo lo scroll il popper si ricalcola e ricompare — combacia col sintomo.
- Componenti: wrapper `CurSelect` (`prefComponents/common/select/index.vue:19-30`, nessuna prop
  popper) e `fontTextBox` (`el-autocomplete`, solo `popper-class`).
- Conferma runtime consigliata (PC principale, 1 minuto): ispezionare `data-popper-placement`
  su `.el-select-dropdown` al primo open di una combo in basso.

## Prerequisiti bloccanti
- Conferma runtime della diagnosi (sopra) prima del fix.
- Regola DECISIONS 2026-07-07: fix alla radice, non pezze z-index/margini.
- Direzione fix da valutare in implementazione (nel wrapper `CurSelect`, punto unico): vincolare
  i `fallback-placements` a soli bottom/top con `rootBoundary: 'viewport'` via `popper-options`,
  oppure `placement` esplicito — scegliere col dato runtime.

## Obiettivo
Il dropdown si apre sempre completamente visibile (verso il basso se c'è spazio, altrimenti
riposizionato correttamente), senza dover scrollare prima.

## File da toccare
- Da confermare con l'indagine (atteso: componente/i in `src/renderer/src/prefComponents/` e/o
  CSS del contenitore in `preference.vue`).

## Skill di codice
`coding-standard`.

## Test
PC principale: aprire ogni combo di ogni pannello SENZA scroll preventivo → voci tutte visibili;
ripetere dopo scroll parziale.
