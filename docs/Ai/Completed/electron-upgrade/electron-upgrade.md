# electron-upgrade — Electron 39 → 43 (2026-07-07)

## Scopo

Aggiornare Electron da **v39** (EOL 2026-05-05, nessun fix di sicurezza) a **v43** (latest, EOL ~2027-01-05). Salto diretto unico in un colpo (non graduale). Completato e testato.

## Modifiche

| File | Cosa |
|------|------|
| `package.json` | `electron@43.0.0` + script `@electron/rebuild` con flag `--only ced,keytar` (native-keymap N-API escluso) |
| `src/main/app/index.js` | **FIX #1**: safe-file handler per parsing URL Windows (triplo slash vs Chromium E43 host parsing su `safe-file://C:/...`) |
| `src/renderer/src/components/exportSettings/index.vue` | **FIX #2**: 6 occorrenze `size="mini"` → `size="small"` (Element Plus 2.x) |
| `src/renderer/src/components/editorWithTabs/editor.vue` | **FIX #2**: 2 occorrenze `size="mini"` → `size="small"` |
| Native modules | ced, keytar ricompilati per ABI Electron 43; native-keymap (N-API) carica su E43 senza ricompilazione |

**Binario Electron**: scaricato a mano con `node node_modules/electron/install.js --use-system-ca` (da E42 postinstall non lo scarica più).

## Test esito

- ✅ dev `npm run dev` parte pulito (2 warning deprecati preesistenti innocui: crypto.fips, fs.F_OK)
- ✅ **build:win** `npm run build:win` completato
- ✅ **App pacchettizzata** si avvia, immagini/export/drag OK
- ✅ **Commit + push** fatti dall'utente
- ✅ Immagini locali con path spazi/OneDrive renderizzate (FIX #1 testato in dev e packaged)
- ✅ Dialog Export senza warning size prop (FIX #2 testato in dev e packaged)

## Ambiente build

- **VS2022 Community** + componente MSVC v143 Spectre-mitigated
- **nvm 22.21.1** (Node interno di E40+ sarà 24, ma dev rimane 22)
- `npm ci --use-system-ca` (blocco SSL inspection aziendale)

## Da tenere a mente

**FIX #1 — safe-file parsing**: Chromium E43 parsa URL `safe-file://C:/...` (doppio slash) assegnando `C:` come **host** ("c"), perdendo i due punti. Handler nel main ora gestisce entrambe le forme (triple slash e host parsing) con `if (url.host =~ /^[a-zA-Z]$/)` su Windows. Non toccare `correctImageSrc` (task10 invariante).

**FIX #2 — size prop**: Element Plus 2.x ha rimosso `size="mini"`. Verificate statiche concluse con grep su entrambi i file.

**Native-keymap (N-API)**: escluso da `@electron/rebuild --only ced,keytar` perché la build è N-API → usa Node, non V8 → carica nativo. Risolve il blocco compilazione su E40+.

**Binario E43**: postinstall fallisce, va scaricato manualmente o via script postinstall custom (rimandato).

## Aperti/rimandati (NON bloccanti)

- **FIX #3** (candidato): due warning `Not allowed to load local resource: file:///...` in console per path spazi+parentesi. Immagini si vedono (fallback safe-file OK). Valutare se sopprimere tentativo `file://` a monte.
- **Dialog "apri"**: si apre su Download (breaking change UX E43). Decidere se passare `defaultPath` tracciando ultima cartella.
- **N1** (keytar → safeStorage): API nativa Electron, rimandato.
- **N3** (ced → detector JS): charset detection JS, non urgente.
- **postinstall auto-download**: script per scaricare binario E43+ automaticamente.
- **keychain**: keytar/token uploader non testato (utente non usa l'uploader).
- **Warning crypto.fips/fs.F_OK**: feature separata `renderer-no-node-integration` (vite-plugin-electron-renderer).
