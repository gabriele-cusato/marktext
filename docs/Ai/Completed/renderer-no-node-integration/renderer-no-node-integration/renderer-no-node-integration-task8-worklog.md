# renderer-no-node-integration — task8 — worklog: builtin Node in muya e common

Stato: DA TESTARE (implementazione completa, nessun build/avvio eseguito per vincolo di plan)

## Avanzamento
- [x] preload: import zlib + `deflateSync` in marktextEnv
- [x] plantuml.js: rimosso import zlib, deflate via preload + `uint8ToBase64`
- [x] muya utils/index.js: rimosso `import path`, `window.path.resolve` a riga ~290
- [x] common/envPaths.js: rimosso `import path`, `joinPath` cross-env (righe 16,25)
- [x] common/keybinding/index.js: `isOsx` cross-env (riga 1)
- [x] Verifica statica: nessun `import path/zlib` diretto o `process.platform` bare raggiungibile dal renderer

## Verifica statica (sottoproblema 6)
Comando: `grep -rn "from 'zlib'\|from 'path'\|import path\|process\.platform" src/muya src/common`

- `src/muya`: nessun residuo (zero match). `zlib` e `path` rimossi completamente.
- `src/common/keybinding/index.js`: residuo atteso, è l'`isOsx` cross-env appena introdotto
  (`typeof process !== 'undefined' && process.platform ? ... : ...`) — corretto sia in main
  (usa `process.platform`) sia in renderer (fallback su `navigator.userAgent`).
- `src/common/envPaths.js`: nessun residuo (import `path` rimosso, `joinPath` non usa builtin).
- Residui FUORI SCOPE task8 (non tra i 5 file da toccare, non richiesti dal plan):
  - `src/common/i18n.js:2` — `import path from 'path'`.
  - `src/common/filesystem/paths.js:2` — `import path from 'path'`; riga 6 — `process.platform` bare.
  - `src/common/filesystem/index.js:3` — `import { resolve, dirname } from 'path'`.
  Verificato con grep che NESSUNO di questi 3 file è importato da `src/renderer/**` né da
  `src/muya/**` (zero match su `common/i18n` e `common/filesystem` in entrambe le cartelle):
  quindi non sono raggiunti dal bundle renderer e restano fuori dal perimetro di questo task.

## Test
(Da compilare dall'orchestratore dopo il test utente.)
