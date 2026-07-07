# electron-upgrade — istruzioni PC principale (passi manuali NON coperti dal git pull)

Stato di riferimento: **Electron 43.0.0** (salto 39→43 fatto in un colpo, scelta utente per tempo).

## Cosa arriva col git pull (già nel codice, NON rifare a mano)
- `package.json`: `electron@43`, e gli script `@electron/rebuild` con `--only ced,keytar`
  (rebuild-native, build:win, build:mac, build:linux).
- `package-lock.json` allineato.
- Eventuali fix di codice per breaking change 41/42/43 (quando saranno fatti).

## Cosa NON è nel git (da fare a mano sul PC principale)
Git versiona `package.json` + lockfile, **non** `node_modules/` né il binario Electron. Questi passi
riportano la macchina allo stato funzionante. Il PC principale è su path **senza spazi**
(`C:\Projects\MarkText`), quindi niente warning node-gyp da spazi.

### 0. Ambiente (ogni sessione)
1. Chiudere app MarkText e ogni dev server (electron/node residui bloccano `node_modules`, EBUSY su `ced`).
2. Aprire una **PowerShell normale pulita** (NON una già-Developer, altrimenti `Enter-VsDevShell` fallisce).
3. Entrare nell'istanza VS2022 **Community** (ha MSVC v143 + Spectre; la BuildTools NON ha il compilatore):
   ```
   $vs = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -products * -version "[17.0,18.0)" -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1
   Import-Module (Join-Path $vs "Common7\Tools\Microsoft.VisualStudio.DevShell.dll")
   Enter-VsDevShell -VsInstallPath $vs -DevCmdArguments "-arch=x64" -SkipAutomaticLocation
   ```
4. `nvm use 22.21.1` → verificare `node -v` = v22.21.1.
5. Verificare `$env:VCINSTALLDIR` = `...\2022\Community\VC\` (NON BuildTools).
   NON eseguire elevato (amministratore) → causa EPERM su node_modules.

### 1. Installare le dipendenze dal lockfile
```
$env:NODE_OPTIONS="--use-system-ca"; npm ci; Remove-Item Env:NODE_OPTIONS
```
- `--use-system-ca`: la rete aziendale fa SSL inspection; senza, i download falliscono
  (`unable to get local issuer certificate`).
- `npm ci` compila i moduli nativi contro **Node** (napi): native-keymap e keytar (napi) restano
  ABI-stabili e funzionano su Electron; ced verrà ricompilato al passo 3.

### 2. Scaricare il binario Electron (OBBLIGATORIO da Electron 42+)
Da Electron 42 il binario **non si scarica più** nel postinstall → va scaricato a mano, altrimenti
`npm run dev`/`electron-vite` danno `Error: Electron uninstall` (`getElectronPath`).
```
$env:NODE_OPTIONS="--use-system-ca"; node node_modules/electron/install.js; Remove-Item Env:NODE_OPTIONS
```
Verifica: `node -e "console.log(require('electron'))"` → deve stampare il path a `electron.exe`.
(Alternative: `npx install-electron`.)

### 3. Ricompilare i nativi V8-ABI per Electron (escluso native-keymap)
```
node node_modules/@electron/rebuild/lib/cli.js -f --only ced,keytar
```
- `--only ced,keytar`: ricompila i moduli che servono contro l'ABI di Electron. **native-keymap è
  N-API** (ABI-stabile) e **non va ricompilato** contro la V8 di Electron (darebbe `C4996` sugli
  header V8) → si esclude e resta il suo binario napi buildato al passo 1.
- Se manca `node_modules/native-keymap/build/Release/keymapping.node` (es. cancellato da un rebuild
  forzato precedente): `npm rebuild native-keymap` (lo ricostruisce contro Node → napi).

### 4. Verifica finale
```
node -e "console.log(require('electron'))"     # path electron.exe presente
npm run dev                                     # app parte
```
Warning attesi/innocui (NON bloccanti, NON sopprimere): `crypto.fips` (DEP0093) e `fs.F_OK`
(DEP0176) dagli shim di `vite-plugin-electron-renderer` — pre-esistenti, di terze parti. Il fix
pulito è la feature `renderer-no-node-integration` (separata).

## Riepilogo lezioni d'ambiente (perché questi passi esistono)
- **SSL inspection**: `NODE_OPTIONS=--use-system-ca` su ogni comando che scarica.
- **VS2022 Community, non BuildTools**: `VCINSTALLDIR` deve puntare a Community, altrimenti `CL.exe`
  non si trova (MSB8003/TRK0005).
- **Electron 42+**: binario on-demand, non più postinstall → passo 2 sempre necessario dopo install.
- **native-keymap napi**: mai passarlo a `@electron/rebuild` → `--only ced,keytar` in tutti gli script.
- **Non elevato**: evitare amministratore (EPERM in cleanup node_modules).
