# window-minwidth-hamburger — plan — 2026-07-12

Origine: TODO.md: ridurre la width minima della finestra; sotto una soglia, mostrare un'icona
hamburger che raccoglie le icone della sezione destra della tab bar (command palette, cartella,
file recenti).

## Prerequisiti bloccanti
- Da fare DOPO `recent-files-icon` (stessi file della sezione destra tab bar; l'hamburger deve
  raccogliere anche quella icona).
- Leggere `Completed/tab-bar-layout/tab-bar-layout.md` PRIMA (absolute design load-bearing).
- Decisioni utente da chiudere prima dell'implementazione: nuova width minima (px) e soglia di
  collasso hamburger.

## Fatti verificati (Agent-Explorer 2026-07-12)
- minWidth: `src/main/config.js:13-14` → `minWidth: isOsx ? 780 : 820` (era 550), `minHeight: 350`,
  in `editorWinOptions`. Applicata a runtime in `src/main/windows/editor.js:93-97` via
  `win.setMinimumSize(...)` con clamp alla workArea (con `useContentSize:true` + `frame:false` il
  minWidth del costruttore non è affidabile → NON basta cambiare config.js, verificare il clamp).
- Il valore 820/780 deriva da una formula empirica commentata in `config.js:7-13`
  (5×tab min 88px + gap + sezione destra): abbassare la minima implica gestire il collasso della
  sezione destra — è esattamente il ruolo dell'hamburger.
- Nessuna @media query in `tabs.vue`: il responsive è tutto JS con 3 ResizeObserver già attivi
  (`tabs.vue:1019-1036` → `scheduleUpdate()` → `updateTabRowsLayout()` 809-937). L'hamburger può
  agganciarsi allo stesso meccanismo (nessun listener window nuovo).
- Costanti JS↔CSS da NON desincronizzare (elenco completo): `DYN_SLOT_W=158`+`HOVER_BUFFER=12`
  (tabs.vue:845-846) ↔ `translateX(calc(-50% + 85px))` (1272, nota sync esplicita a 1271);
  `GAP=3` (836) ↔ `gap:3px` (1364); `26` (891) ↔ `.v2-tab-new-li width/height 26px` (1514-1515);
  `DYN_SLOT_W` ↔ `.v2-topright-dynamic width:158px` (1630); `TOPRIGHT_RIGHT_OFFSET=10` (844) ↔
  `.v2-topright right:10px` (1591); `min-width:88px` `.v2-tab` (1394) ↔ formula minWidth config.js.

## Obiettivo
1. Abbassare `minWidth` della finestra al valore deciso.
2. Sotto soglia: nascondere le icone singole e mostrare l'hamburger; click → menu/popover con le
   tre voci (palette, cartella, recenti). Sopra soglia: comportamento attuale.
3. Nessuna rottura del layout multi-row tab bar alle width ridotte.

## Rischi
- Tab bar v2 = zona con invarianti delicate (BUG-1 risolto in 6 round). Ogni modifica CSS va
  verificata contro `Completed/tab-bar-layout`.
- Rilevamento soglia: preferire container query/resize observer sul componente, non listener
  window sparsi (verificare pattern già presenti nel progetto).

## File da toccare
- Config finestra main (minWidth) + componente sezione destra tab bar + CSS (da confermare).

## Skill di codice
`coding-standard` (Vue 3 + CSS).

## Test
PC principale: restringere fino alla nuova minima → hamburger appare, voci funzionano; allargare →
icone tornano; multi-row tab bar intatta; resize continuo senza flicker.

## Decisioni (orchestratore su delega utente, 2026-07-12)
- Nuova `minWidth` finestra: **550px su TUTTE le piattaforme** (sostituisce `isOsx ? 780 : 820`),
  `minHeight` invariato (350).
- Soglia collasso hamburger: **700px** di larghezza finestra/container tab bar. Sotto 700 le tre
  icone della sezione destra (command palette, cartella, recent files) spariscono e appare un
  bottone hamburger; click → popover con le tre voci (stessi handler esistenti). Sopra 700
  comportamento identico a oggi.
