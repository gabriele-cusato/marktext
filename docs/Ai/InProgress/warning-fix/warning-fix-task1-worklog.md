# warning-fix — task1 — worklog

## Avanzamento
- [x] Verifica invocazione rebuild nativo via npm scripts in package.json (`rebuild-native`, `build:win`: tutti npm scripts → canale `config.node_gyp` valido)
- [x] Aggiunta blocco config.node_gyp in package.json (msvs_version 2022, clang 0)
- [x] Rimozione righe msvs_version/clang da .npmrc (file eliminato: conteneva solo quelle)
- [x] Verifica rebuild OK + nessun warning npm — DA TESTARE dall'utente in dev/build completi

Note 2026-07-05:
- `npm ls` senza più i warning "Unknown project config".
- `npm run rebuild-native` completato (ced, keytar, native-keymap) dopo lo spostamento.
  Primo tentativo fallito con EPERM su ced.node: era il dev server aperto che bloccava il file,
  non un problema di compilazione — chiuse le finestre e riprovato con successo.
- Rischio residuo dichiarato nel plan: il rebuild ora può dipendere dall'auto-detect vswhere di
  node-gyp più che dal blocco config (non distinguibile finché l'auto-detect funziona). Se in
  futuro node-gyp non trovasse VS2022, passare il flag diretto `--msvs_version=2022` nello script.

## Test
(da compilare dopo il test dell'utente: `npm run dev` e `npm run build:win` senza warning "Unknown project/env config")
