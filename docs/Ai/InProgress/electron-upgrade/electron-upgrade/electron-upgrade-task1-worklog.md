# electron-upgrade — task1 — worklog: Electron 39 → 40

Stato: **NON INIZIATO**. Da eseguire sul PC principale (build bloccato sul secondario).

## Checklist
- [ ] Ambiente VS2022 v143 attivo, `nvm use 22.21.1`, `$env:VCINSTALLDIR` = ...\2022\...\VC\
- [ ] Breaking changes Electron 40 lette (link nel plan)
- [ ] Grep API Node 24 nel main process (esito: ...)
- [ ] `npm install -D electron@40`
- [ ] `npm run rebuild-native` OK (no MSB8040)
- [ ] `npm run build` exit 0
- [ ] `npm run dev` app parte, console pulita
- [ ] Retest manuale drag tab (reorder/detach/cross-window/taskbar) — DA TESTARE
- [ ] Retest dialog — DA TESTARE
- [ ] Retest export HTML/PDF — DA TESTARE
- [ ] Retest source mode — DA TESTARE
- [ ] Retest scorciatoie/keychain/ricerca file — DA TESTARE
- [ ] electron#42252: fixato? (sì/no + comportamento drop) — annotare in DECISIONS.md
- [ ] `npm run build:win` app pacchettizzata parte
- [ ] Commit dedicato `update: electron 39 → 40`

## Note esecuzione

### 2026-07-07 — tentativo gradino 1, BLOCCATO su rebuild nativi
- `npm install -D electron@40`: OK dopo aver risolto due intoppi d'ambiente:
  - download binario Electron falliva (`TypeError: fetch failed` in `@electron/get`) = SSL
    inspection aziendale → risolto con `NODE_OPTIONS=--use-system-ca`.
  - warn EPERM in cleanup (undici-types, @electron/get) = handle bloccati/esecuzione elevata,
    secondari, non fatali.
- `npm run rebuild-native`: **FALLITO**.
  - Primo errore: `TRK0005 CL.exe non trovato` + `MSB8003 VCToolsInstallDir non definita` =
    ambiente VS mescolato (`VCINSTALLDIR`=BuildTools, `VCToolsInstallDir`=Community; la shell era
    la Developer PowerShell della **BuildTools**, che NON ha il compilatore C++). Risolto entrando
    da shell pulita nell'istanza **Community** via `Enter-VsDevShell` (l'istanza col v143).
  - Errore reale poi emerso: **`native-keymap@3.3.9` (latest) non compila su V8 di Electron 40**:
    `error C4996: v8::Object::GetAlignedPointerFromInternalField ... use ... EmbedderDataTypeTag`.
    `native-keymap@latest` = 3.3.9 (uscita ~gen 2026), usa ancora l'API V8 senza tag → deprecata
    a errore sulla V8 nuova. `/wd4996` (soppressione) proposto solo come test/stampella, non fix.
- **Lo spazio nel path** (`A PROGETTI PERSONALI`) è **scagionato**: node-gyp lo warna ma ha
  compilato oltre (arrivato a errori C++ reali). Non è la causa.
- **Conseguenza**: il gradino 1 è bloccato dal debito moduli nativi, non dalle breaking changes
  Electron. Creato `electron-upgrade-native-deps-plan.md` (task N1 keytar→safeStorage,
  N2 native-keymap fix sorgente). task1 riparte DOPO N2.

## Esito
Blocco native-keymap RISOLTO (N2: napi escluso da electron-rebuild). Poi, per tempo, l'utente ha
**saltato diretto a Electron 43** (non gradualmente 40→41→42→43). Vedi sezione "STATO 2026-07-07"
nell'index `electron-upgrade.md`: `npm run dev` su E43 parte pulito. Restano da fare retest manuale
funzionale + build:win + commit. Questo worklog task1 (39→40) è di fatto superato dal salto unico;
il tracciamento prosegue nell'index.
