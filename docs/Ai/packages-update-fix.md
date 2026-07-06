# packages-update-fix — stato dipendenze, vulnerabilità e piano di aggiornamento

Analisi del 2026-07-05. Comandi usati: `npm outdated --long`, `npm audit`, `npx npm-check-updates`,
`npm view <pkg>@<versione> deprecated` (loop su tutte le 95 dipendenze dirette installate),
`npm ls form-data js-yaml protobufjs`, API endoflife.date (electron.json, nodejs.json).
Nessuna modifica applicata: solo diagnosi.

## Riepilogo

- **30 vulnerabilità** da `npm audit`: 1 low, 24 moderate, **5 high**.
- **Electron 39 è FUORI SUPPORTO** (EOL 2026-05-05, da endoflife.date): nessun fix di sicurezza. Aggiornamento major = priorità principale.
- **Zero pacchetti deprecati** tra le dipendenze dirette installate (verificate tutte e 95).
- **`languine` è inutilizzato** e da solo trascina la maggior parte delle vulnerabilità (incluse le high su `ws`).
- 39 pacchetti hanno aggiornamenti disponibili: 28 minor/patch (rischio basso), 11 major (da valutare uno a uno).

## Azioni in ordine di priorità

### 1. Rimuovere `languine` (inutilizzato) — elimina gran parte delle vulnerabilità

- Verificato: dichiarato in `dependencies` (`package.json:64`) ma ZERO usi in `src/`, `scripts/`,
  config (nessun `languine.json`, nessun riferimento negli script npm).
- Verifica storica (git, 2026-07-05): presente fin dal commit iniziale del fork clonato (riga 58
  del package.json originale); nessun file di config languine è MAI esistito nella history
  (`git log --all -- "*languine*"` vuoto). Ereditato dal fork upstream, mai messo in funzione.
- Cos'è: CLI di traduzione i18n basato su AI (midday-ai/languine, servizio cloud): richiede un
  `languine.json` e autenticazione al servizio per funzionare. Senza config non fa nulla — nello
  stato attuale è peso morto.
- Se in futuro si vorranno tradurre i locale automaticamente: NON serve tenerlo in dependencies —
  si usa al momento con `npx languine@latest` (init config + login al servizio, da verificare
  nella doc ufficiale al momento dell'uso), o si valuta un'alternativa.
- Trascina l'intero albero vulnerabile: `@trigger.dev/sdk` → `@opentelemetry/*` (moderate),
  `socket.io-client` → `engine.io-client` → **`ws` (2 advisory HIGH: GHSA-58qx-3vcg-4xpx,
  GHSA-96hv-2xvq-fx4p)**, `uuid` (moderate), `fast-xml-parser` (moderate), `protobufjs` (moderate),
  `js-yaml` vecchio via `preferred-pm`/`which-pm`/`load-yaml-file` (moderate).
- Come: `npm uninstall languine`. Il residuo `npm audit fix --force` proposto da npm
  ("Will install languine@1.0.2, breaking change") diventa irrilevante — NON usare mai `--force`.
- **Rischi per MarkText: nessuno a runtime** (nessun processo lo importa, verificato). Beneficio
  extra: essendo in `dependencies`, oggi viene IMPACCHETTATO nell'app da electron-builder —
  rimuoverlo riduce dimensione installer e superficie di attacco dell'app distribuita.

### 2. `npm audit fix` (senza --force) — vulnerabilità restanti

Risolve entro i range semver correnti:
- **`dompurify` <=3.4.10 (moderate, dipendenza DIRETTA)** — 2 advisory (GHSA-vxr8-fq34-vvx9,
  GHSA-cmwh-pvxp-8882): aggiorna a 3.4.11. Pacchetto usato per sanitizzare HTML nell'editor:
  aggiornamento importante.
- **`form-data` 4.0.0-4.0.5 (HIGH, GHSA-hmw2-7cc7-3qxx)** — via `axios` ed `electron-publish`:
  il fix rientra nel semver.
- **`esbuild` 0.27.3-0.28.0** (dev, via vite/vitest, GHSA-g7r4-m6w7-qqqr: lettura file arbitraria
  dal dev server su Windows) — fix in semver.
- `js-yaml`, `protobufjs` residui.
- Come: `npm audit fix`, poi `npm audit` per verificare il residuo; diff del lockfile con `git diff`.
- **Rischi per MarkText**: bassi ma non nulli. `dompurify` 3.3.1 → 3.4.11 è il punto da testare:
  sanitizza l'HTML nell'editor/preview — una versione più severa può cambiare cosa viene tenuto
  o rimosso nei blocchi HTML. Test dopo il fix: blocco HTML nel documento, preview, export HTML.
  `esbuild` tocca solo il dev server/test (nessun impatto sull'app). `form-data` usato da axios
  solo per upload multipart (uploader immagini): rischio trascurabile.

### 3. Minor/patch (rischio basso, 28 pacchetti)

`npm update` li porta tutti alla colonna "Wanted" di `npm outdated` (già dentro i range `^`):
axios 1.18.1, dompurify 3.4.11, element-plus 2.14.2, mermaid 11.16.0, katex 0.16.47, vue 3.5.39,
vue-i18n 11.4.6, electron-updater 6.8.9, electron-builder 26.15.3 (da 26.4.0: molti fix, può
incidere sul warning "cannot find path for dependency" del task4 warning-fix), fs-extra, prettier,
playwright, vitest 4.1.9, ecc.
- Come: `npm update` (tutti) oppure mirato `npm update <pkg>`. Poi test: `npm run dev`,
  `npm run build`, `npm run test:unit`.
- Nota: `electron 39.2.7 → 39.8.10` è nella lista Wanted — portarlo subito a 39.8.10 anche se
  resta EOL: contiene gli ultimi fix rilasciati per il 39.
- **Rischi per MarkText** (minor = compatibili per contratto semver, ma da testare dove tocca
  l'app): `element-plus` 2.13 → 2.14 può cambiare dettagli di resa dei componenti UI (dialog,
  tooltip — testare i dialog dopo il task5 warning-fix per non confondere le cause);
  `mermaid`/`katex` possono cambiare la resa di diagrammi/formule nei documenti; `vue-i18n`,
  `vue`, `pinia` patch: rischio molto basso; `electron-builder` 26.4 → 26.15 cambia la pipeline
  di packaging (testare `npm run build:win` completo e l'app pacchettizzata; può anche
  risolvere il warning "cannot find path for dependency" del task4 warning-fix);
  `electron` 39.8.10 è patch della stessa major: rischio basso, ma ritestare drag&drop tab
  (area storicamente sensibile ai bump di Electron, vedi electron#42252 in DECISIONS.md).
  Consiglio operativo: fare l'update in un giro solo, poi UN test manuale completo (editor,
  source mode, drag tab, dialog, export, build) — se qualcosa si rompe, bisecare il pacchetto
  colpevole con `git diff package-lock.json` e downgrade mirato.

### 4. Electron major 39 → 42/43 (PRIORITÀ ALTA, da pianificare come feature dedicata)

Da endoflife.date (2026-07-05):
| Versione | Uscita | EOL | Node interno |
|----------|--------|-----|--------------|
| 39 (attuale) | 2025-10-28 | **2026-05-05 — GIÀ EOL** | 22 |
| 40 | 2026-01-13 | 2026-06-30 — GIÀ EOL | 24 |
| 41 | 2026-03-10 | 2026-08-25 (2 mesi) | 24 |
| 42 | 2026-05-05 | 2026-10-20 | 24 |
| 43 (latest) | 2026-06-30 | 2027-01-05 | 24 |

- Raccomandazione: **42 o 43** (41 muore tra 2 mesi). Salire un major alla volta buildando e
  testando, leggendo le breaking changes di ciascun major (https://www.electronjs.org/docs/latest/breaking-changes).
- Impatti specifici di QUESTO progetto da ritestare a ogni salto (vedi DECISIONS.md):
  - **electron#42252** (drop stessa-finestra rotto, workaround dragend-based nel drag tab):
    se un Electron nuovo lo fixa, il percorso `drop` preferenziale torna attivo (il codice ha già
    il flag anti-doppia-esecuzione). Ritestare reorder, detach, cross-window, taskbar spring-loading.
  - Rebuild moduli nativi (`keytar`, `ced`, `native-keymap`, `@vscode/ripgrep`): richiede toolchain
    VS2022 funzionante (vedi task1 warning-fix per msvs_version).
  - Node interno passa da 22 a 24: verificare API Node usate nel main process.
- Consiglio: fare PRIMA la feature warning-fix (lockfile pulito, task4), POI l'upgrade Electron.

### 5. Altri major disponibili (da valutare, nessuna urgenza di sicurezza)

| Pacchetto | Da → A | Valutazione |
|-----------|--------|-------------|
| codemirror | 5.65 → 6.0.2 | **NON aggiornare ora**: CM6 è riscrittura totale (API incompatibile). Source mode è costruito su CM5 e i task pianificati T-M1..T-M6 (tab-bar-layout) assumono CM5. Migrazione = feature grande dedicata. |
| vite | 7.3 → 8.1 | Verificare PRIMA che electron-vite 5 (attuale, già latest) supporti Vite 8; altrimenti attendere electron-vite. |
| eslint | 9.39 → 10.6 | Solo tooling dev. Aggiornare in blocco con @babel/eslint-parser 8, eslint-plugin-jsonc 3, neostandard 0.13, quando si vuole: nessun impatto runtime. |
| vue-router | 4.6 → 5.1 | Uso limitato nel progetto (RouterView in Main). Leggere migration guide; rischio basso ma test manuale finestre. |
| katex | 0.16 → 0.17 | Leggere changelog (formule matematiche nell'editor). |
| postcss-preset-env | 10 → 11 | Solo build CSS, rischio basso. |
| vite-plugin-electron-renderer | 0.14 → 1.0 | Leggere changelog prima (plugin critico del build renderer). |

### 6. Toolchain (fuori package.json)

- **npm**: 11.14.1 installato → 11.18.0 disponibile (minor): `npm install -g npm@11.18.0`.
- **Node locale 22.21.1**: in maintenance (fine supporto attivo 2025-10-21), EOL 2027-04-30 —
  ancora OK. Node 24 è l'LTS attivo e combacia col Node interno di Electron 42/43: valutare il
  passaggio (nvm) insieme all'upgrade Electron. Aggiornare anche CLAUDE.md (prerequisiti build) se si cambia.

## Procedura operativa (come applicare i fix, in ordine)

Ogni passo: comando + verifica prima di passare al successivo. Tutto in `marktext/`.
Prerequisito: lavorare con il working tree pulito (o comunque con `git status` noto), così ogni
passo è isolabile e reversibile con un diff.

1. **Pulizia lockfile + languine** (= task4 warning-fix esteso):
   ```
   npm uninstall languine
   npm install
   ```
   Verifica: `git diff package.json package-lock.json` (rimozioni coerenti: languine, dragula,
   dom-autoscroller e transitive); `npm ls --all` senza invalid/extraneous; `npm run dev` parte.
2. **Vulnerabilità residue**:
   ```
   npm audit fix
   npm audit
   ```
   Verifica: residuo audit atteso ~0 (senza mai usare `--force`); test blocchi HTML/preview
   (dompurify).
3. **Minor/patch**:
   ```
   npm update
   ```
   Verifica: `npm outdated` (colonna Wanted allineata), `npm run test:unit`, `npm run build`,
   test manuale completo (editor, source mode, drag tab, dialog, export). Rischi dettagliati
   nella sezione 3 sopra.
4. **Upgrade Electron → 42/43**: feature dedicata con plan (breaking changes per major, rebuild
   moduli nativi, retest drag&drop/electron#42252, Node interno 24). NON farlo nello stesso giro
   dei passi 1-3.
5. **Major di tooling** (eslint stack, postcss-preset-env, vite 8 dopo verifica supporto
   electron-vite): quando comodo, nessuna urgenza.
6. **codemirror 6**: solo come feature futura dedicata, non ora.

Nota rapporto con la feature warning-fix: i passi 1-3 toccano il lockfile e possono cambiare
l'esito dei task 2 e 4 (browserslist, warning electron-builder) — farli PRIMA o INSIEME a quei
task, mai in mezzo ai test di altri task, per non confondere le cause di eventuali regressioni.

## ESITO APPLICAZIONE — 2026-07-05 (passi 1-3 eseguiti)

Eseguiti nello stesso giro (baseline commit `5013dfc`, working tree pulito prima dei comandi):

- `npm uninstall languine` → vulnerabilità da **30 a 3** in un colpo. (Primo tentativo fallito
  con EBUSY: MarkText dev era aperto e bloccava i file di Electron — chiuse le finestre in modo
  pulito e riprovato. Lezione: chiudere sempre app/dev server prima di toccare node_modules.)
- `npm install` → lockfile rigenerato: rimosse anche le voci orfane dragula/dom-autoscroller.
  `npm ls --all`: nessun invalid/extraneous (solo UNMET OPTIONAL platform-specific, normali).
- `npm audit fix` → fixati dompurify 3.4.11 e form-data; restava 1 low (esbuild sotto vite).
- `npm update` → 999 pacchetti aggiornati alla colonna Wanted; **`npm audit`: 0 vulnerabilità**
  (anche l'esbuild residuo risolto dall'update di vite 7.3.6). Electron 39.2.7 → 39.8.10,
  electron-builder 26.4.0 → 26.15.3, dompurify 3.4.11, element-plus 2.14.2, mermaid 11.16.0, ecc.
- `npx update-browserslist-db` → caniuse-lite 1.0.30001800, già allineato dall'update.
- `npm run rebuild-native` → ced, keytar, native-keymap ricompilati su Electron 39.8.10, OK.
- Rimossa riga stale `!node_modules/dragula/resources` da electron-builder.yml.
- Verifiche: `npm run build` OK (exit 0); `npx electron-builder --dir` OK — **il warning
  "cannot find path for dependency name=undefined" NON compare più** (builder 26.15.3 + lockfile
  pulito); exe generato e firmato in dist/win-unpacked.
- `npm outdated` finale: restano SOLO i major rimandati per scelta (electron 43, codemirror 6,
  eslint 10, vite 8, vue-router 5, katex 0.17, postcss-preset-env 11, @babel/eslint-parser 8,
  eslint-plugin-jsonc 3, neostandard 0.13, vite-plugin-electron-renderer 1.0).
- Nota: una deprecazione transitiva segnalata durante l'install (`boolean@3.2.0`, trascinata da
  dipendenze Electron): non azionabile direttamente, sparirà con gli update dei pacchetti che la usano.
- NON eseguito (per scelta, feature warning-fix): fix `.npmrc` msvs_version/clang (task1) — i
  warning npm "Unknown project config" sono ancora presenti e attesi.

Test runtime utente: pendente (vedi worklog task2/task4 warning-fix).

## Come tornare indietro (rollback di un giro di aggiornamenti)

Il commit salva `package.json` + `package-lock.json` = ricetta esatta delle versioni. Ma
`node_modules/` su disco NON è versionato: il solo checkout git non basta, va riallineato.

Procedura completa:

1. Ripristinare i file dal commit precedente al giro incriminato:
   ```
   git checkout <commit> -- package.json package-lock.json
   ```
   (oppure revert del commit degli aggiornamenti).
2. **`npm ci`** — cancella `node_modules` e reinstalla ESATTAMENTE ciò che dice il lockfile
   ripristinato. È il passo che risolve davvero: senza, su disco restano le versioni nuove.
   (`npm ci` elimina anche la cache Vite in `node_modules/.vite`.)
3. Solo se il giro includeva un bump di Electron o di moduli nativi (keytar, ced, native-keymap,
   @vscode/ripgrep): `npm run rebuild-native` dopo il ci.
4. Verifica: `npm run dev` parte e `git status` pulito.

Cosa il rollback git NON copre (fuori dal repo):
- npm globale (`npm install -g npm@...`): si torna indietro solo con un altro install globale
  della versione precedente.
- versione di Node cambiata via nvm: `nvm use <versione precedente>`.
- dati utente dell'app (userData, backup sessioni): gli aggiornamenti pacchetti non li toccano.

Regola operativa: **un commit dedicato per ogni giro di update** (languine+audit fix; npm update;
Electron major) = punto di ripristino isolato. Se qualcosa si rompe si reverte solo quel giro,
senza perdere il resto; il colpevole si biseca con `git diff package-lock.json` e downgrade mirato.

## Come rifare questi controlli in futuro

- `npm outdated` — cosa è vecchio (Wanted = sicuro, Latest = major).
- `npm audit` — vulnerabilità (mai `--force` senza analisi).
- `npx npm-check-updates` — vista major.
- `npm view <pkg> deprecated` — deprecazione singolo pacchetto (gli avvisi `npm warn deprecated`
  compaiono solo durante `npm install` fresco).
- endoflife.date/electron e endoflife.date/nodejs — scadenze supporto (anche via API JSON:
  `https://endoflife.date/api/electron.json`).
- Automazione consigliata: **Dependabot** (gratuito su GitHub) o **Renovate** sul fork — PR
  automatiche per update e alert sicurezza, senza controlli manuali periodici.

## PIANO AGGIORNAMENTO MAJOR RESIDUI — 2026-07-06

Snapshot `npm outdated` del 2026-07-06 (dopo i passi 1-3): restano solo major (più vitest, che è
patch). Classificazione dev/prod verificata da `package.json`. Obiettivo dell'utente: aggiornarli
**tutti** alla latest, anche i fortemente sconsigliati, potendo provare e tornare indietro.

Principio guida: **un giro = un commit dedicato**. Aggiornare più major insieme rende impossibile
capire quale ha rotto cosa. Aggiornare a piccoli gruppi omogenei, testare, poi committare o
revertire. I major hanno breaking changes per contratto: vanno provati, non dati per compatibili.

### Metodo per provare e tornare indietro (vale per OGNI giro)

Git versiona `package.json` + `package-lock.json`, NON `node_modules/`: dopo un ripristino git va
sempre riallineato il disco con `npm ci`.

**Modo consigliato per sperimentare (senza committare finché non convinto):**
```
# 1. partire da working tree pulito (git status pulito)
# 2. fare l'update del giro (comandi sotto)
# 3. testare (test specifici del giro)
# 4a. se OK  -> git add -A && git commit -m "update: <giro>"
# 4b. se NO  -> scartare tutto:
git checkout -- package.json package-lock.json
npm ci                     # riallinea node_modules ESATTAMENTE al lockfile ripristinato
```

**Modo alternativo (committare il giro, revertire dopo):**
```
npm install ...            # update del giro
git add -A && git commit -m "update: <giro>"
# test... se va tenuto, fine. Se va tolto:
git reset --hard HEAD~1    # (se il commit NON è ancora pushato)
#   oppure, se già condiviso: git revert --no-edit HEAD
npm ci                     # SEMPRE dopo, per riallineare node_modules
```

**IMPORTANTE — se il giro tocca Electron o moduli nativi** (keytar, ced, native-keymap): dopo
`npm ci` i binari nativi vanno ricompilati contro la nuova ABI. Farlo dentro l'ambiente **VS2022
v143** (Developer PowerShell for VS 2022, oppure `Enter-VsDevShell` su una PowerShell normale —
vedi sezione "Ambiente build nativi" sotto), poi:
```
npm run rebuild-native     # = npx @electron/rebuild -f
```
Senza questo passo l'app non carica i moduli nativi anche se il lockfile è corretto.

### Ambiente build nativi (lezione appresa il 2026-07-06)

Su un PC con **VS2026 (VS18) + VS2022** entrambi installati, node-gyp sceglie di default VS2026, il
cui toolset è **v145**. Le librerie Spectre di v145 non sono installabili → errore `MSB8040`
(richieste librerie con mitigazioni Spectre). Le Spectre v143 (VS2022) non aiutano perché la build
usa v145. La rilevazione VS di node-gyp inoltre fallisce via PowerShell e trova solo VS2026.
**Soluzione**: forzare la compilazione con VS2022 v143 (dove le Spectre v143 x64 sono installate),
caricando l'ambiente VS2022 nella shell prima di qualunque build nativa:
```
$vs = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -version "[17.0,18.0)" -products * -property installationPath -format value | Select-Object -First 1
Import-Module (Join-Path $vs "Common7\Tools\Microsoft.VisualStudio.DevShell.dll")
Enter-VsDevShell -VsInstallPath $vs -DevCmdArguments "-arch=x64" -SkipAutomaticLocation
# verifica: $env:VCINSTALLDIR deve puntare a ...\2022\...\VC\
```
Vale solo per quella finestra. In alternativa aprire direttamente "Developer PowerShell for VS 2022".
Prerequisito ambiente: `nvm use 22.21.1` (Node 24 di sistema non deve vincere nel PATH).

#### Procedura corretta su PC nuovo (o quando l'MSVC di default dà MSB8040)

Passaggi che alla fine hanno funzionato, in ordine. Chiave: eseguire l'install **dentro
l'ambiente VS2022 v143**, così i moduli nativi compilano col toolset giusto e tutti i postinstall
(incluso il download del binario Electron) girano correttamente in un colpo solo.

1. Chiudere app e dev server (electron/node residui bloccano `node_modules`, es. EBUSY su `ced`).
2. Aprire **"Developer PowerShell for VS 2022"** (oppure caricare VS2022 con `Enter-VsDevShell`, sopra).
3. `nvm use 22.21.1` e verificare `node -v` = v22.21.1 (il Node di sistema non deve vincere).
4. Verificare `$env:VCINSTALLDIR` → deve puntare a `...\2022\...\VC\`.
5. Dalla root progetto: `npm ci` — reinstalla dal lockfile e compila i nativi con v143 (Spectre
   v143 x64 presenti) senza MSB8040.
6. `npm run dev` per verificare che l'app parta.

Requisito una tantum in VS2022: componente **MSVC v143 - VS 2022 C++ x64/x86 con mitigazione
Spectre (versione = cartella MSVC più recente sotto `...\2022\...\VC\Tools\MSVC\`)**.
Se in futuro il giro include un bump di Electron o dei moduli nativi, dopo il `npm ci` eseguire
anche `npm run rebuild-native` nella stessa shell VS2022.

### Copertura test: cosa i test automatici NON coprono

Copertura reale del progetto (verificata 2026-07-06):
- **Unit** (`vitest run`): solo `tests/unit/filesystem-paths`, `encoding`, `config` — utility del main
  process. NON coprono editor/Muya, CSS/temi, KaTeX, vue-router, dialog, export.
- **E2E** (`playwright`): solo `tests/e2e/app-launch.spec.js` — smoke test "l'app si avvia".

Conseguenza per giro: i test automatici bastano **solo per i giri 1 (vitest) e 2 (ESLint)**, che
sono dev-only o auto-verificanti. Dal **giro 3 in poi** i pacchetti toccano runtime/UI che nessun
test copre → **obbligatorio test manuale** con `npm run dev` sulla superficie specifica del pacchetto
(temi, formule, navigazione finestre, ecc. — dettaglio nel singolo giro). Lo smoke e2e conferma solo
l'avvio, non la correttezza di resa/feature.

| Giro | Automatici bastano | Test necessario |
|------|--------------------|-----------------|
| 1 vitest | Sì | `npm run test:unit` |
| 2 ESLint | Sì | `npm run lint` |
| 3 postcss | No | build + controllo visivo temi/componenti |
| 4 katex | No | formule inline/blocco + preview + export |
| 5 vue-router | No | apertura finestre editor/Preferenze, console pulita |
| 6 vite-plugin | Parziale | build + `npm run dev` + smoke e2e |
| 7 electron | No | retest manuale pesante (drag tab, dialog, export, nativi) |

### Ordine consigliato dei giri (dal più sicuro al più rischioso)

Fare i giri in quest'ordine; ognuno è un commit isolato e reversibile con il metodo sopra.

#### Giro 1 — vitest (patch, rischio nullo) — FATTO 2026-07-06
Non è un major: `4.1.9 → 4.1.10` (Wanted già 4.1.10). Solo test runner, zero runtime.
```
npm install -D vitest@latest
```
Test: `npm run test:unit`.
Rollback: non serve praticamente mai; se serve, metodo generale.
**Esito 2026-07-06**: `test:unit` verde, app parte. Nessun test runtime necessario (vitest è
dev-only, non entra nell'app) → giro sufficiente e OK. Da committare.

#### Giro 2 — stack ESLint (dev only, nessun impatto runtime)
Aggiornare INSIEME perché interdipendenti (eslint 10 richiede parser/plugin/config compatibili):
`@babel/eslint-parser 7→8`, `eslint 9→10`, `eslint-plugin-jsonc 2→3`, `neostandard 0.12→0.13`.
```
npm install -D eslint@latest @babel/eslint-parser@latest eslint-plugin-jsonc@latest neostandard@latest
```
Perché a rischio basso: è tutto tooling di sviluppo, non entra nell'app pacchettizzata. Il rischio è
solo che la config lint (flat config) cambi e `npm run lint` segnali errori nuovi da sistemare.
Test: `npm run lint` (= `eslint --cache .`). Deve girare senza crash di config. Warning/errori di
regole nuovi si valutano e si sistemano o si silenziano nella config.
Rollback: metodo generale (nessun nativo coinvolto).

#### Giro 3 — postcss-preset-env 10 → 11 (build CSS)
```
npm install -D postcss-preset-env@latest
```
Perché a rischio basso: tocca solo la pipeline CSS in build. Il rischio è che cambi quali feature
CSS moderne vengono trasformate/polyfillate → possibili differenze visive.
Test: `npm run build`, poi `npm run dev` e controllo visivo dei temi (`src/renderer/src/assets/themes/`)
e dei componenti principali (editor, sidebar, dialog).
Rollback: metodo generale.

#### Giro 4 — katex 0.16 → 0.17 (rendering formule, dipendenza PROD)
```
npm install katex@latest
```
Perché va testato: katex rende le formule matematiche nell'editor. Un major può cambiare resa o
macro supportate. Leggere il changelog katex 0.17.
Test: documento con formula LaTeX **inline** (`$...$`) e **blocco** (`$$...$$`), verifica resa in
WYSIWYG e in preview, poi export HTML/PDF con formule.
Rollback: metodo generale.

#### Giro 5 — vue-router 4 → 5 (dipendenza PROD, uso limitato)
```
npm install vue-router@latest
```
Perché va testato: uso limitato (RouterView in `Main`), ma un major può cambiare API di routing.
Leggere la migration guide vue-router 5.
Test: apertura finestra editor, apertura finestra Preferenze, navigazione tra le pagine
(`src/renderer/src/pages/`). Verificare che non ci siano errori in console del renderer.
Rollback: metodo generale.

#### Giro 6 — vite 8 + vite-plugin-electron-renderer 1.0 (build system) — PARZIALMENTE BLOCCATO

**Vite 8: NON aggiornare ora (bloccante verificato).** `electron-vite@5` (attuale, già latest)
dichiara `peerDependencies.vite = "^5.0.0 || ^6.0.0 || ^7.0.0"` (verificato con
`npm view electron-vite@latest peerDependencies` il 2026-07-06): **non include Vite 8**. Forzare
Vite 8 rompe il peer e con ogni probabilità il build. Attendere una versione di electron-vite che
dichiari il supporto a Vite 8, poi aggiornarli insieme.
Se lo si vuole comunque provare (sconsigliato):
```
npm install -D vite@latest        # richiederà --force o genererà peer warning; build a rischio
```

`vite-plugin-electron-renderer 0.14 → 1.0` si può provare da solo (non dipende da Vite 8):
```
npm install -D vite-plugin-electron-renderer@latest
```
Perché a rischio: è un plugin critico del build del renderer; leggere il changelog 1.0 prima.
Test: `npm run build`, `npm run dev`, l'app deve partire e il renderer caricare senza errori.
Rollback: metodo generale.

#### Giro 7 — electron 39 → 43 (SCONSIGLIATO come giro unico; farlo come feature dedicata)

```
npm install -D electron@latest
# poi, nell'ambiente VS2022 v143 (vedi "Ambiente build nativi"):
npm run rebuild-native
```
**Perché sconsigliato in blocco:** è un salto di **3 major** in un colpo (39→40→41→42→43). Ogni
major ha breaking changes proprie (https://www.electronjs.org/docs/latest/breaking-changes), il Node
interno passa da 22 a 24, e tutti i moduli nativi vanno ricompilati contro la nuova ABI (ripetere la
trafila VS2022/v143). Va comunque fatto perché **Electron 39 è EOL** (motivo = sicurezza, non i
warn), ma **un major alla volta**, buildando e testando a ogni gradino, come feature dedicata con
plan. Bundlarlo con altri update rende impossibile bisecare le regressioni.
Test (pesante, a ogni gradino): `npm run build`, `npm run build:win`, app pacchettizzata che si
avvia; drag&drop tab (reorder, detach, cross-window, taskbar — area sensibile, electron#42252 in
DECISIONS.md); dialog; export HTML/PDF; source mode; scorciatoie (native-keymap); keychain (keytar);
ricerca file (@vscode/ripgrep). Verificare le API Node usate nel main process col passaggio a Node 24.
Rollback: metodo generale + `npm run rebuild-native` nell'ambiente VS2022 dopo `npm ci` (il giro
tocca i nativi). Conviene un commit dedicato SOLO per Electron, così il revert non trascina altro.

#### Giro 8 — codemirror 5 → 6 (FORTEMENTE SCONSIGLIATO; è una migrazione, non un update)

```
npm install codemirror@latest        # porterà a CM6: romperà il build finché il codice non è migrato
```
**Perché fortemente sconsigliato:** CodeMirror 6 è una **riscrittura totale** con API completamente
diversa da CM5 (moduli `@codemirror/*`, state/view separati, niente drop-in). La *source mode* del
progetto è costruita sull'API CM5, e i task pianificati tab-bar-layout (T-M1..T-M6) assumono CM5.
Aggiornare il solo pacchetto **non aggiorna il codice**: import e chiamate CM5 si rompono e la source
mode smette di compilare/funzionare. Non è un aggiornamento, è un **progetto di migrazione dedicato**
(riscrivere l'integrazione editor). Da NON fare in questo giro né come semplice bump.
Test (se lo si prova comunque): il build fallirà o la source mode non caricherà — è il
comportamento atteso, conferma che serve la migrazione. Tornare indietro.
Rollback: metodo generale (probabilmente necessario subito).

### Nota finale sui warning deprecati

Anche completando i giri 1-6, i `npm warn deprecated` (`boolean`, `glob@7`, `rimraf@2`, `inflight`,
`lodash.isequal`, `prebuild-install`) **non spariscono**: sono trascinati da `electron`,
`electron-builder`, `electron-updater`, `keytar` — tutti già al massimo del loro major. Spariranno
solo con l'upgrade Electron (giro 7) e con l'eventuale sostituzione di keytar (abbandonato a monte).
Sono innocui (`npm audit` = 0, solo a install fresco): non giustificano da soli i giri rischiosi.
