# renderer-no-node-integration — task7 — plan: `global.marktext` → `window.marktext`

## Obiettivo
Sostituire ogni uso di `global.marktext` (Node global, non disponibile sotto `nodeIntegration:false`)
con `window.marktext` nel renderer e in muya. Cambio meccanico e sicuro: sotto la config attuale
(`nodeIntegration:true`) sia `global` sia `window` esistono, quindi non cambia comportamento; diventa
necessario al flip (task9).

## Prerequisiti bloccanti
- La lista dei punti sotto è l'audit completo 2026-07-07: 2 scritture + 18 letture (17 renderer + 1 muya).
  Se il grep ne trova altri, aggiungerli e segnalarli.
- Escludere i FALSI POSITIVI `i18n.global.*` (property `global` di Vue-I18n) e le stringhe di debug: NON
  sono `global.marktext`, non toccarli. Sostituire SOLO il token `global.marktext`.
- NON toccare altro (config, vite, builtin muya/common: task8/9). NON buildare né avviare l'app.
- VIETATO qualsiasi comando git. Skill: `coding-standard`.

## Modifica (identica ovunque)
`global.marktext` → `window.marktext`. Nelle 2 scritture:
- `src/renderer/src/main.js:28` — `global.marktext = {}` → `window.marktext = {}`.
- `src/renderer/src/bootstrap.js:78` — `global.marktext = marktext` → `window.marktext = marktext`.
Nel guard muya:
- `src/muya/lib/eventHandler/clickEvent.js:17` — `if (!global || !global.marktext)` → `if (!window.marktext)`.

## File e righe (letture da convertire)
- `src/renderer/src/main.js` — 28 (write), 46 (read `.env.type`)
- `src/renderer/src/bootstrap.js` — 78 (write)
- `src/renderer/src/util/pdf.js` — 62
- `src/renderer/src/commands/quickOpen.js` — 72
- `src/renderer/src/components/editorWithTabs/sourceCode.vue` — 417
- `src/renderer/src/pages/preference.vue` — 52
- `src/renderer/src/pages/app.vue` — 217, 218, 265
- `src/renderer/src/components/exportSettings/index.vue` — 468
- `src/renderer/src/store/preferences.js` — 196
- `src/renderer/src/store/editor.js` — 308, 1672, 1681
- `src/renderer/src/store/layout.js` — 17, 51, 59
- `src/renderer/src/prefComponents/keybindings/index.vue` — 153
- `src/muya/lib/eventHandler/clickEvent.js` — 17

## Sottoproblemi
1. Sostituire tutte le occorrenze `global.marktext` → `window.marktext` nei file elencati (comprese le 2 scritture e il guard muya).
2. Verifica statica: `grep -rn "global\.marktext" src/renderer src/muya` → ZERO. E `grep -rn "\bglobal\b" src/renderer/src src/muya/lib` per confermare che i residui `global.` siano solo `i18n.global`/falsi positivi noti (elencarli nel worklog).

## Fatti già verificati (audit 2026-07-07)
- `window.marktext` funziona nel main world del renderer (dove gira anche muya); contextIsolation isola
  solo il preload, non i moduli renderer tra loro → la scrittura in bootstrap è leggibile ovunque.
- Falsi positivi `global` da NON toccare: `i18n/index.js:59,73,76,80`, `prefComponents/sideBar/config.js:342,399,400,402`, e le `i18n.global.t(...)` in `store/help.js` ed `editor.js`.
