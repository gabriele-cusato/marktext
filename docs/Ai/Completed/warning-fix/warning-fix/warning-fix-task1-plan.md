# warning-fix — task1 — plan: npm warn "Unknown project config msvs_version / clang" (.npmrc)

## Obiettivo
Eliminare i warning npm `Unknown project config "msvs_version"/"clang"` (e le varianti "Unknown env config") senza rompere il rebuild dei moduli nativi.

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task1-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 1, con esito ricerca online 2026-07-05).
- File richiesti: `marktext/.npmrc`, `marktext/package.json` (sezione scripts, per capire come viene invocato il rebuild).
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: rilanciare il rebuild dei moduli nativi (`npm run dev` o lo script che stampa "Rebuild Complete") e `npm run build`: rebuild OK e nessun warning npm.
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).

## Fatti verificati (ricerca Agent-Search 2026-07-05, fonti nel file note)
- Da npm 11.2.0 le chiavi non-npm in `.npmrc` generano il warning; da npm 12 il canale `npm_config_*` per node-gyp sparisce (npm/cli#8153, node-gyp#3260).
- Metodo raccomandato dal README node-gyp: blocco in `package.json` → `"config": { "node_gyp": { "msvs_version": "2022", "clang": "0" } }` (esposto come env `npm_package_config_node_gyp_*`). Funziona SOLO quando node-gyp è invocato via npm scripts.
- `GYP_MSVS_VERSION` NON è documentata nel README node-gyp attuale: non usarla come soluzione.
- node-gyp recente auto-rileva VS2022 via vswhere nella maggior parte dei casi; `msvs_version` resta utile solo come fallback.
- `clang=0` è una variabile GYP per forzare gcc su Linux; il valore non è deprecato, lo è solo il trasporto via chiave libera `.npmrc`.

## File da toccare
- `marktext/.npmrc` (rimozione delle due righe; se il file resta vuoto, eliminarlo)
- `marktext/package.json` (aggiunta blocco `config.node_gyp`)

## Sottoproblemi in ordine
1. Verificare in `package.json` come viene invocato il rebuild nativo (script postinstall/electron-rebuild): confermare che passa da npm scripts (condizione per cui `config.node_gyp` funziona).
2. Aggiungere il blocco `"config": { "node_gyp": { "msvs_version": "2022", "clang": "0" } }` in `package.json`.
3. Rimuovere le due righe da `.npmrc` (conservare il commento esplicativo spostandolo accanto al blocco config o nel README dev se esiste).
4. Verifica: rebuild moduli nativi OK ("Rebuild Complete"), nessun warning npm in `npm run dev` e `npm run build`.
5. Se il rebuild su Windows fallisse senza `msvs_version` (caso raro, auto-detect vswhere), ripristinare e fermarsi segnalando: servirà passare il flag direttamente al comando node-gyp nello script.
6. Aggiornare il worklog (checkbox + tag DA TESTARE).

## Esecutore e skill
- Esecutore: orchestratore direttamente (poche righe di config, fatti già verificati) — conferma utente già richiesta nel riepilogo feature.
- Skill: nessuna skill di codice (solo config npm).

## Rischio residuo dichiarato
- Se `@electron/rebuild` invocasse node-gyp fuori dagli npm scripts, il blocco `config.node_gyp` potrebbe non essere propagato (non documentato ufficialmente): il punto 4 (verifica rebuild) è il gate del task.
