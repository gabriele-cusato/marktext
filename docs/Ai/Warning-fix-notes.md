# Warning-fix-notes — registro warning build/dev/console e decisioni

Registro di tutti i warning rilevati (2026-07-05) in `npm run dev`, `npm run build` e console F12,
con causa individuata, decisioni dell'utente e stato. Feature collegata: `InProgress/warning-fix/`.

## Regole decise dall'utente (valide per tutta la feature)

- **Mai sopprimere i warning**: ogni warning va risolto alla radice, non silenziato tramite
  configurazioni che disattivano il controllo (vale per vue-i18n, Vite, Vue, ecc.).
- Punto 7 (security): task separato, da fare per ultimo, con test runtime accurato.
- Punto 11 (normalizeHeaderText): task dedicato di indagine; le verifiche runtime le esegue l'utente.
- Punto 1 (.npmrc): prima verifica online (Agent-Search) del modo attuale corretto di passare le opzioni a node-gyp.

## Elenco warning, cause e stato

### 1. npm warn "Unknown project config msvs_version / clang" (dev + build)

- Causa: `marktext/.npmrc` contiene `msvs_version=2022` e `clang=0` (righe 1-2). Sono opzioni per
  node-gyp/@electron/rebuild (compilazione moduli nativi), non per npm: npm non le riconosce più
  e avvisa che nel prossimo major smetteranno di funzionare. Le varianti "env config" del warning
  derivano dalle stesse voci propagate come variabili d'ambiente `npm_config_*` ai processi figli.
- Esito ricerca online (Agent-Search 2026-07-05):
  - Da npm 11.2.0 le chiavi non-npm in `.npmrc` generano il warning; npm 12 rimuove il canale
    `npm_config_*` per node-gyp (npm/cli#8153, nodejs/node-gyp#3260).
  - Metodo raccomandato (README node-gyp): blocco `"config": { "node_gyp": { ... } }` in
    `package.json` → esposto come env `npm_package_config_node_gyp_*`; funziona solo se node-gyp
    è invocato via npm scripts. In alternativa flag diretto `node-gyp configure --msvs_version=2022`
    (node-gyp#2698).
  - `GYP_MSVS_VERSION` NON documentata nel README node-gyp attuale: da non usare.
  - node-gyp recente auto-rileva VS2022 via vswhere; `msvs_version` resta utile solo come
    fallback (casi di detection fallita: node-gyp#2952, #3251, #2754).
  - `clang=0` (variabile GYP, forza gcc su Linux): non deprecato in sé, solo il trasporto
    via `.npmrc`.
- Stato: task1.

### 2. Browserslist: caniuse-lite is 7 months old (dev)

- Causa: database `caniuse-lite` nel lockfile vecchio di 7 mesi. Nessuna config browserslist
  in `package.json` (verificato).
- Fix: `npx update-browserslist-db@latest` (tocca solo il lockfile).
- Stato: task2.

### 3. Vite: meta.js dynamically imported ma anche statically imported (build)

- Causa: `src/renderer/src/codeMirror/loadmode.js:4` carica via `import.meta.glob` TUTTI i mode di
  CodeMirror (incluso `mode/meta.js`) per il lazy-load (`CodeMirror.requireMode`, righe 34-69);
  `src/renderer/src/codeMirror/index.js:9` importa `codemirror/mode/meta` anche staticamente
  (tabella metadati estensione→mode necessaria a startup). Warning innocuo (chunking non ottimale).
- Fix: escludere `meta.js` dal glob dinamico in loadmode.js.
- Stato: task3.

### 4. electron-builder: "cannot find path for dependency name=undefined reference=undefined" (build)

- Fatti verificati: `package.json` non contiene più `dragula` né `dom-autoscroller`;
  `package-lock.json:27-29` li dichiara ancora come dipendenze dirette della root (lockfile mai
  rigenerato dopo la rimozione, item aperto della feature `drag-html5-dnd`); `node_modules/dragula/`
  esiste ancora su disco; `electron-builder.yml:15` ha la riga stale `!node_modules/dragula/resources`.
- **Nota utente (2026-07-05): il warning esisteva GIÀ prima della rimozione di dragula** → il
  lockfile disallineato non è (o non è l'unica) causa.
- Esito ricerca online (Agent-Search 2026-07-05): messaggio letterale esatto non trovato nelle
  issue; famiglia più vicina su electron-builder 26.x: #9011 ("dependency path is undefined",
  regressione v26, workaround `metadataDirectories`), #9129 (bundler senza node_modules fisico),
  #9259 (optional deps platform-specific escluse da npm ma attese da electron-builder — candidato
  più probabile per name=undefined), #9208 (26.0.17+yarn, caso GRAVE con asar incompleto).
  Meccanismo comune: nodo dell'albero logico dipendenze (da lockfile/npm ls) senza corrispettivo
  fisico risolvibile → campi name/reference letti da un package.json inesistente. NON garantito
  innocuo: verificare integrità output build. `ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES`
  esiste ma è soppressione: vietata. Se il warning persiste dopo il lockfile pulito, individuare
  la riga sorgente in `node_modules/app-builder-lib` per la diagnosi certa.
- Da fare comunque: `npm install` per rigenerare il lockfile (item aperto pre-esistente) e
  rimozione riga stale in electron-builder.yml; poi verificare se il warning persiste.
- Stato: task4.

### 5. Terminale dev: "Request Autofill.enable failed" (dev)

- Causa: rumore noto del protocollo DevTools di Chromium in Electron (Autofill non implementato).
  Nessun codice del progetto coinvolto (grep confermato: zero match per "Autofill" in src/).
- Decisione: non azionabile lato codice, da ignorare. NESSUN task.

### 6. ElementPlusError: el-dialog slot "title" deprecato (F12)

- Causa: 4 file usano `<template #title>` dentro `<el-dialog>`:
  `src/renderer/src/prefComponents/keybindings/key-input-dialog.vue:7-16`,
  `src/renderer/src/components/tweet/index.vue:3-10`,
  `src/renderer/src/components/rename/index.vue:3-10`,
  `src/renderer/src/components/editorWithTabs/editor.vue:39` (dialog tabella).
  (exportSettings/import/about usano el-dialog senza slot title: non coinvolti.)
- Fix: rinominare lo slot in `#header`; verificare CSS legato a `.el-dialog__title`.
- Stato: task5.

### 7. Electron security warnings: webSecurity / CSP unsafe-eval (F12)

- Causa: `src/main/config.js:22` e `:51` impostano `webSecurity: false` incondizionatamente
  (editor e preferences window), nessun branch dev/prod. CSP in `src/renderer/index.html:9-18`
  con `unsafe-inline`/`unsafe-eval` (il commento a riga 7 dice che serve a Vite in dev, ma il tag
  vale anche in build). `allowRunningInsecureContent` non impostato esplicitamente da nessuna
  parte (warning derivato). I warning compaiono solo in dev (Electron li tace su app packaged),
  ma la configurazione insicura resta anche in produzione.
- Rischio: capire se `webSecurity:false` serve davvero in prod (probabile: caricamento immagini
  locali `file://`) prima di condizionarlo; CSP da rendere dinamica dev/prod.
- Decisione utente: task separato, per ultimo, con test runtime accurato.
- Stato: task10.

### 8. [intlify] Not found 'sideBar.search.searchInTabs' / 'common.close' (F12)

- Causa: `src/renderer/src/components/sideBar/search.vue` righe 4, 7, 22 usa
  `t('sideBar.search.searchInTabs', ...)` e `t('common.close', ...)`; le chiavi mancano in TUTTI
  i 9 file locale (`static/locales/`: en, de, es, fr, ja, ko, pt, zh-CN, zh-TW).
  `sideBar.search.*` esiste (en.json:239-247) ma senza `searchInTabs`; `common.*` (en.json:1046-1049)
  ha solo `cancel`/`ok`.
- Bug aggiuntivo: la stessa chiave `searchInTabs` è usata per due testi diversi (riga 4 titolo,
  riga 22 placeholder) → servono due chiavi distinte.
- Fix: aggiungere le chiavi ai 9 JSON e sdoppiare la chiave in search.vue.
- Stato: task6.

### 9. [intlify] Detected HTML in message (F12, anche a ogni nuovo paragrafo)

- Causa: falso positivo del detector HTML di vue-i18n su stringhe tradotte che contengono
  bracket decorativi: `static/locales/en.json:1368-1373` — `emptyHtmlBlock: "< Empty HTML Block >"`,
  più `emptyMathFormula`, `invalidMathFormula`, `emptyMermaidBlock`, `emptyDiagramBlock`
  (e `"<div> HTML </div>"` per il placeholder del blocco HTML). Il warning a ogni paragrafo
  arriva dal render Muya: `parser/render/index.js` passa `t` (da `editor.vue:132/1136`, opzione
  `options.t`) a `renderLeafBlock.js:137` che traduce `editor.emptyHtmlBlock`.
  Il codice Muya è corretto (usa `t()` con chiave); è il CONTENUTO della stringa che triggera.
- Decisione utente: MAI sopprimere il warning → riformulare le stringhe (es. `[ Empty HTML Block ]`)
  in tutti i 9 locale.
- Stato: task7.

### 10. [Vue warn] Invalid prop: custom validator failed for prop "cursor" (F12, source mode)

- Causa: `src/renderer/src/components/editorWithTabs/index.vue:48-53` — prop `cursor` con
  `validator: typeof value === 'object'` e `required: true`, senza `type`/`default` →
  con `undefined` il validator fallisce (con `null` passerebbe). Il valore arriva da
  `pages/app.vue:142` (`currentFile.value?.cursor`). In source mode `handlePreSave`
  (`sourceCode.vue:440-458`) chiama `LISTEN_FOR_CONTENT_CHANGE` passando solo `muyaIndexCursor`,
  mai `cursor` → `store/editor.js:1566` (`if (cursor)`) non popola mai la chiave → resta undefined.
- Perché si ripete ogni ~7s: `store/editor.js:961-976` — `tick` con setTimeout ricorsivo del
  backup sessione (feature session-persistence, intervallo `sessionBackupInterval` default 7s)
  emette `pre-save` → `handlePreSave` → warn.
- Fix: normalizzare prop (`type: Object, default: null`, coerente con editor.vue:140-142) e
  normalizzare `cursor` a `null` (mai chiave assente) nello store/flusso source.
- Stato: task8.

### 11. normalizeHeaderText: ATX heading regex did not match: ag-0-...### (F12, export/pre-save)

- Causa: `console.warn` custom in `src/muya/lib/utils/exportMarkdown.js:182-198`
  (`normalizeHeaderText`), fallback quando `/^ {0,3}(#{1,6})(.*)$/` non matcha il testo di un
  heading ATX. Il prefisso `ag-0-1jsprhq9r` ha il formato esatto di `getLongUniqueId()`
  (`src/muya/lib/utils/random.js:1-6`), usato per `CURSOR_ANCHOR_DNA`/`CURSOR_FOCUS_DNA`
  (`src/muya/lib/config/index.js:313-314`): marcatori cursore inseriti nel markdown durante il
  parsing (`importMarkdown.js:480-509,562-568`) e normalmente rimossi (`importMarkdown.js:529,593-606`).
  Ipotesi ad alta plausibilità (NON confermata al 100%): il marcatore sfugge alla rimozione sulle
  righe heading e arriva incollato a `###` senza spazio.
- **Possibile bug reale**: se il marcatore resta nel testo, può finire nel markdown esportato/salvato
  (corruzione dati), non è solo rumore.
- Decisione utente: task dedicato di indagine; verifiche runtime eseguite dall'utente quando servono.
- Stato: task9.

## Mappa warning → task

| # | Warning | Task | Difficoltà |
|---|---------|------|-----------|
| 1 | npm .npmrc msvs_version/clang | task1 | banale (dopo ricerca) |
| 2 | browserslist caniuse-lite | task2 | banale |
| 3 | Vite meta.js doppio import | task3 | media |
| 4 | electron-builder dependency undefined | task4 | indagine + banale |
| 5 | DevTools Autofill | — (ignorare) | non azionabile |
| 6 | el-dialog #title deprecato | task5 | banale |
| 7 | security warnings webSecurity/CSP | task10 (ultimo) | media-alta |
| 8 | i18n chiavi mancanti | task6 | banale |
| 9 | i18n Detected HTML | task7 | media |
| 10 | prop cursor undefined | task8 | media |
| 11 | normalizeHeaderText DNA cursore | task9 | complessa (indagine) |
