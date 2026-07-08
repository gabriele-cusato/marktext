# renderer-no-node-integration — task8 — plan: builtin Node in muya e common raggiunti dal renderer

## Obiettivo
Eliminare gli ultimi builtin Node che, importati da muya o da moduli `common/` condivisi, finiscono nel
bundle renderer e si romperebbero sotto `nodeIntegration:false`:
- muya `path` (`muya/lib/utils/index.js`), muya `zlib` (`muya/lib/parser/render/plantuml.js`);
- `common/envPaths` (`path`), `common/keybinding` (`process.platform` bare).
`common/` è **condiviso main+renderer** → NIENTE `window.*` lì: fix cross-env che funzionino in entrambi.

## Prerequisiti bloccanti
- `common/envPaths` importato da `main/app/paths.js:2` E `renderer/node/paths.js:1`; `common/keybinding`
  importato da `main/keyboard/shortcutHandler.js:8` E `renderer/.../KeybindingConfigurator.js:1` (verificato).
  Le modifiche a `common/` devono restare corrette anche lato MAIN (dove `process`/Node esistono).
- `pako` NON è dipendenza → per il deflate si usa Node `zlib` nel PRELOAD (processo Node), esposto al renderer.
- muya gira nel renderer con `window.path`/`window.marktextEnv` disponibili (già esposti dal preload).
- NON toccare config/vite (task9). NON buildare né avviare l'app. VIETATO git. Skill: `coding-standard`.

## File da toccare
1. `src/preload/index.js` — `import zlib from 'zlib'` + `deflateSync` in `processExtraAPI` (window.marktextEnv).
2. `src/muya/lib/parser/render/plantuml.js` — rimuovere `import zlib`, usare `window.marktextEnv.deflateSync` + helper base64.
3. `src/muya/lib/utils/index.js` — rimuovere `import path from 'path'`, usare `window.path.resolve` (riga ~290).
4. `src/common/envPaths.js` — rimuovere `import path from 'path'`, join cross-env manuale (righe 16, 25).
5. `src/common/keybinding/index.js` — `isOsx` cross-env (riga 1).

## Decisioni di design (già prese)

### preload — deflate
Aggiungere `import zlib from 'zlib'` e in `processExtraAPI`:
```js
deflateSync: (data) => zlib.deflateSync(data, { level: 3 })
```
(zlib.deflateSync accetta la stringa e la codifica utf8, identico a oggi. Ritorna Buffer → sul bridge
diventa Uint8Array; funziona anche nel branch `else` attuale dove è un Buffer reale.)

### muya plantuml.js
- Rimuovere `import zlib from 'zlib'`.
- In `Diagram.encode` (righe 35-43): sostituire
  ```js
  const compressedValue = zlib.deflateSync(utf8Value, { level: 3 })
  const base64Value = compressedValue.toString('base64')
  ```
  con
  ```js
  const compressedValue = window.marktextEnv.deflateSync(utf8Value)
  const base64Value = uint8ToBase64(compressedValue)
  ```
  e definire in cima al file l'helper (funziona sia su Buffer sia su Uint8Array):
  ```js
  function uint8ToBase64(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    return btoa(binary)
  }
  ```
  (byte identici a `zlib.deflateSync(...).toString('base64')`: stesso zlib, stesso base64.)

### muya utils/index.js
- Rimuovere `import path from 'path'`.
- Riga ~290: `src: 'safe-file://' + window.path.resolve(baseUrl, src)` (unico uso di `path` nel file, verificato).

### common/envPaths.js (cross-env, no Node, no window)
- Rimuovere `import path from 'path'`.
- Aggiungere in testa un helper e usarlo alle righe 16 e 25:
  ```js
  const joinPath = (...parts) => {
    const sep = parts[0] && parts[0].includes('\\') ? '\\' : '/'
    return parts.join(sep)
  }
  ```
  `this._logPath = joinPath(this._userDataPath, 'logs', \`${...}\`)` e
  `this._preferencesFilePath = joinPath(this._preferencesPath, 'preference.json')`.
  (I join sono semplici concatenazioni sotto userDataPath: nessuna normalizzazione necessaria. Corretto
  sia in main sia in renderer.)

### common/keybinding/index.js (cross-env)
- Riga 1: sostituire `const isOsx = process.platform === 'darwin'` con
  ```js
  const isOsx = typeof process !== 'undefined' && process.platform
    ? process.platform === 'darwin'
    : typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
  ```
  (main: usa `process.platform`; renderer sotto flip: `navigator.userAgent` contiene "Macintosh" su macOS.)

## Sottoproblemi (in quest'ordine)
1. preload: import zlib + `deflateSync` in marktextEnv.
2. plantuml.js: rimosso import zlib, deflate via preload + `uint8ToBase64`.
3. muya utils/index.js: rimosso `import path`, `window.path.resolve` a riga ~290.
4. common/envPaths.js: rimosso `import path`, `joinPath` cross-env.
5. common/keybinding/index.js: `isOsx` cross-env.
6. Verifica statica: `grep -rn "from 'zlib'\|from 'path'\|import path\|process\.platform" src/muya src/common` → i soli residui ammessi sono usi NON raggiunti dal renderer o già cross-env; elencarli nel worklog. In `src/renderer` e nei moduli common toccati NON devono restare `import path/zlib` diretti o `process.platform` bare.

## Fatti già verificati (2026-07-07)
- muya `path` usato solo a `utils/index.js:290`; muya `zlib` solo a `plantuml.js:40` (poi `.toString('base64')`).
- `common/envPaths` join solo a righe 16,25; `common/keybinding` usa `isOsx` per normalizzare acceleratori.
- Entrambi i common sono importati anche dal main → fix devono restare validi lato Node.
- Vendored UMD (snap.svg, sequence-diagram) e `require()` statici (snabbdom/turndown) NON vanno toccati (guardati/risolti dal bundler).
