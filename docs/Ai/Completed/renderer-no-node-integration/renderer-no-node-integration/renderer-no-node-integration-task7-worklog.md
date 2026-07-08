# renderer-no-node-integration — task7 — worklog: `global.marktext` → `window.marktext`

## Avanzamento
- [x] Sostituite tutte le occorrenze `global.marktext` → `window.marktext` (2 scritture + 18 letture, incl. muya clickEvent.js:17)
- [x] Verifica statica: `global.marktext` = ZERO in src/renderer e src/muya; residui `global.` solo falsi positivi noti (i18n.global)

## Esito verifica statica finale
- `grep -rn "global\.marktext" src/renderer src/muya` → ZERO occorrenze (confermato).
- Residui `\bglobal\b` in `src/renderer/src` (tutti falsi positivi, non toccati):
  - `i18n/index.js:54,55,59,73,76,80` — `i18n.global.*` (property Vue-I18n)
  - `store/index.js:5` — commento "Main store for global states"
  - `store/editor.js:69,75,100,146,147,189,294,295,522,534,1478,1722,1723,1802` — `i18n.global.t(...)`
  - `store/help.js:201` — `i18n.global.t(...)`
  - `prefComponents/sideBar/config.js:172,173,174,194,208,209,210,226,227,228,340,341,342,343,389,394,395,396,399,400,402` — `i18n.global`/`window.__VUE_I18N__.global`/stringhe di debug
- Residui `\bglobal\b` in `src/muya/lib` (tutti falsi positivi, non toccati):
  - `ui/emojis/emojisJson.json:5738` — tag emoji "global"
  - `contentState/pasteCtrl.js:244` — commento "Handle global events."
  - `assets/libs/snap.svg-min.js:1537` — libreria terza parte (snap.svg), non toccare
  - `assets/libs/sequence-diagram-snap.js:1053,1558,1843` — direttive eslint `/* global ... */`, libreria terza parte

## Test
(Da compilare dall'orchestratore dopo il test utente.)
