# warning-fix — Risoluzione alla radice di 11 warning build/dev/console

## Scopo

Risolvere alla radice (mai sopprimere) tutti i warning rilevati il 2026-07-05 in `npm run dev`, `npm run build` e console F12. Applicata regola universale: zero soppressioni, pieno fix alla causa.

## Riepilogo warning e stato

| # | Warning | Causa | Task | Esito |
|---|---------|-------|------|-------|
| 1 | npm "Unknown project config msvs_version/clang" | .npmrc non-npm per node-gyp | task1 | RISOLTO: config.node_gyp in package.json, .npmrc eliminato |
| 2 | browserslist caniuse-lite 7 mesi vecchio | lockfile arretrato | task2 | RISOLTO: update-browserslist-db, caniuse-lite aggiornato |
| 3 | Vite meta.js static+dynamic import | loadmode.js glob troppo ampio | task3 | RISOLTO: meta.js escluso da import.meta.glob |
| 4 | electron-builder dependency undefined | dipendenze orfane (dragula) + stale electron-builder.yml | task4 | RISOLTO: npm install (lockfile pulito) + riga rimossa |
| 5 | DevTools Autofill.enable failed | protocollo Chrome non implementato in Electron | — | IGNORATO: non azionabile lato codice, rumore permanente |
| 6 | el-dialog slot "title" deprecato | slot `#title` da Element Plus | task5 | RISOLTO: slot rinominato `#header` in 4 componenti |
| 7 | webSecurity warnings + CSP unsafe-eval | hardcoded `webSecurity:false` | task10 | RISOLTO: custom protocol `safe-file`, webSecurity:true, CSP dinamica dev/prod |
| 8 | i18n chiavi mancanti (searchInTabs, close) | assenti in 9 locale | task6 | RISOLTO: chiavi aggiunte e sdoppiate (titolo vs placeholder) |
| 9 | i18n "Detected HTML" in stringhe tradotte | bracket `<...>` nei valori | task7 | RISOLTO: riformulate a `[...]` in 9 locale (9 file .min rigenerati) |
| 10 | prop cursor undefined validator | source mode non popola cursor in store | task8 | RISOLTO: normalizzato a null (type Object, default null) |
| 11 | normalizeHeaderText DNA cursore (ATX heading) | marcatore cursore sfugge a rimozione in heading | task9 | INDAGINE CONCLUSA: causa trovata, fix rimandato (out-of-scope) |

## Decisioni chiave per il futuro

### Regola universale: mai sopprimere warning
Applicata rigorosamente a tutti i 10 warning risolti. Nessuna configurazione silenziante (es. `eslintIgnore`, `vite.define`, CSP indebolita). Ogni warning è stato eliminato risolvendo il difetto di fondo.

### Task 10 (webSecurity / CSP) — Strategia adottata: custom protocol
**Problema**: immagini locali (`file://`) richiedono `webSecurity:false` (insicuro in produzione). **Soluzione**: schema custom `safe-file://` interno all'app, webSecurity elevato a `true`, CSP adattato.

**Invarianti permanenti**:
1. **`correctImageSrc` in `getImageInfo.js` — NON toccare**: il suo output è persistito nel markdown su disco (block.text) → modificarlo corrompe i file salvati. Il markdown su disco resta `file://`, mai `safe-file://`.
2. **`getImageInfo` (src/muya/lib/utils/index.js) — unico chokepoint di rendering**: genera `src` per `<img>` inline in editor. Modifiche qui propagano a tutti i render e devono essere idempotenti (printService.js/export PDF ri-processa gli src già renderizzati).
3. **Drag tab→Explorer (tabs.vue:453)**: il `DownloadURL` contiene path `file://` reale del documento, Explorer non risolve `safe-file://` → questa riga NON va toccata.
4. **CSP dinamica dev/prod**: `unsafe-eval` e `ws:/wss:` servono solo a Vite/HMR in dev; rimossi in prod (plugin `cspEnvPlugin` in electron.vite.config.mjs trasforma token placeholder in index.html al build-time).

**Implementazione task10 (3 incrementi)**:
- Inc.1: registrazione scheme `safe-file` con `protocol.handle`, `getImageInfo` emette `safe-file://` per path locali (+ riscrittura `file://` → `safe-file://` nel ramo isUrl per HTML salvo), `webSecurity:true` su entrambe le finestre, CSP aggiunta `safe-file:` in img-src.
- Inc.2: idempotenza `getImageInfo` (riconosce `safe-file://` come URL), adattamento copia immagine (copyCutCtrl.js: stripping `safe-file://` prima di `file://`).
- Inc.3: plugin Vite per CSP variabile: dev `unsafe-eval`/`ws:` presenti, prod rimossi.

**Testato**: dev, preview (build prod senza pacchettizzazione), app packaged. Nessun warning webSecurity/allowRunningInsecureContent/CSP in prod.

### Bug collaterale trovato durante test task10 e RISOLTO separatamente
Race condition pre-esistente in `src/muya/lib/ui/transformer/index.js` (`update`/`render`): il `setTimeout` differito per il render partiva dopo che `this.reference` (immagine selezionata) era stato azzerato dalla cancellazione → crash "Cannot read properties of null (reading 'getBoundingClientRect')". I tempi della build prod (caricamento immagini via `safe-file` + async) hanno reso visibile la race latente. **Fix**: guard `if (this.reference)` nel callback e early-return in `update()`. Commit separato dal task10 per chiarezza logica.

### Ambiente ristretto documentato
Il build del progetto è bloccato su PC secondario da Group Policy (SSL inspection aziendale, CA nel Windows store). Build/test eseguiti su PC principale con flag `--use-system-ca` (vedi CLAUDE.md sezione "Ambiente ristretto"). **Nota per agenti futuri**: su questo PC non eseguire `npm run build` né test Playwright — blocca immediatamente; verificare disponibilità PC principale oppure rimuovere il vincolo di policy (out-of-scope).

## Point di attenzione e implicazioni

1. **Task 9 (normalizeHeaderText/DNA cursore)**: solo indagine conclusa. La race di mutazione è stata locata (confidenza alta) ma il fix rimanda a valutazione architetturale più ampia (comportamento corretto di `getMuyaIndexCursor` durante export). Testare periodicamente se il warn ricompare in nuovi scenari di copy/paste/save.
2. **Idempotenza `getImageInfo`**: adottata come regola permanente per la catena export PDF. Qualsiasi modifica futura agli src immagine deve preservare questa proprietà.
3. **CSP in dev vs prod**: il plugin Vite `cspEnvPlugin` è il nuovo owner della CSP. Modifiche di policy devono passare da lì (token in index.html + hook `transformIndexHtml`), non da config.js o altrove.
4. **Nessun `unsafe-eval` rilevato in codice del progetto**: la scelta di rimuoverlo in prod è state verificata con grep, ma confermata definitivamente solo dal test app packaged.
