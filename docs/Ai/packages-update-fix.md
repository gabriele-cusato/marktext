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
