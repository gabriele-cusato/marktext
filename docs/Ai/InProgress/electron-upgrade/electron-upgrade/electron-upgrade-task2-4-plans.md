# electron-upgrade — task2/3/4 — plan (scheletro): 40→41, 41→42, 42→43

I gradini 2-4 seguono la **stessa procedura del task1**, cambiando solo il numero di versione e le
breaking changes specifiche. NON dettagliati ora: le breaking changes di ogni major vanno lette al
raggiungimento del gradino (changelog non verificabile in anticipo). Un file plan/worklog dedicato
per gradino verrà scorporato da qui quando si arriva a quel punto, se serve.

## Prerequisito comune
Gradino precedente committato e verde (build + retest manuale OK). Working tree pulito.

## Procedura comune (per ogni gradino N → N+1)
1. Leggere breaking changes della major N+1: https://www.electronjs.org/docs/latest/breaking-changes
2. Ambiente VS2022 v143 + `nvm use <node>` (vedi nota Node sotto). Chiudere app/dev server.
3. `npm install -D electron@<N+1>`
4. `npm run rebuild-native` (VS2022 v143)
5. `npm run build` (exit 0)
6. `npm run dev` (app parte, console pulita)
7. Retest manuale completo (drag tab, dialog, export, source mode, scorciatoie, keychain,
   ricerca file — lista nell'index).
8. `npm run build:win` (app pacchettizzata parte)
9. OK → commit dedicato `update: electron <N> → <N+1>`. KO → rollback + causa nel worklog.

> **Nota trasversale (vale per tutti i gradini)**: le tabelle sotto sono l'analisi statica del
> changelog ufficiale contro il codice (2026-07-07). Coprono solo le rotture note e documentate.
> Le **verifiche runtime restano OBBLIGATORIE** a ogni gradino anche dove l'analisi non segnala
> nulla: Chromium/Node nuovi possono introdurre regressioni non elencate, e i moduli nativi
> ricompilati vanno esercitati. L'analisi NON sostituisce il test manuale della superficie
> sensibile (drag tab, dialog, export, source mode, scorciatoie, keychain, ricerca file).

## task2 — 40 → 41 — breaking changes analizzate

| Voce 41 | Tipo | Impatto MarkText | Azione |
|---------|------|------------------|--------|
| PDF non creano più WebContents separato (OOPIF) | Behavior | NO: MarkText non rileva risorse PDF via WebContents. | Nessuna (comunque test runtime). |
| Cookie change cause aggiornato nell'evento 'changed' | Behavior | NO: nessun listener cookie nel progetto. | Nessuna. |
| showHiddenFiles nei dialog Linux | Deprecated | NO: non usato (grep vuoto). | Nessuna. |

## task3 — 41 → 42 — breaking changes analizzate

| Voce 42 | Tipo | Impatto MarkText | Azione |
|---------|------|------------------|--------|
| **electron non si scarica più via postinstall** (download on-demand al primo run) | Behavior | **SÌ (ambiente)**: CI già usa `--ignore-scripts`, ma dalla 42 il binario si scarica al primo `npx electron`/`npm run dev`. Su rete aziendale con SSL inspection può fallire (`unable to get local issuer certificate`) come electron-builder. | Usare `NODE_OPTIONS=--use-system-ca` al primo run (già in CLAUDE.md §"Ambiente ristretto"). `ELECTRON_SKIP_BINARY_DOWNLOAD` non più supportato — non usato qui, ok. |
| Notifiche macOS → UNNotification (richiede code-signing) | Behavior | NO: nessun `new Notification` nel main. | Nessuna. |
| OSR device scale factor default → 1.0 | Behavior | NO: nessun offscreen rendering. | Nessuna. |
| clearStorageData: rimosso options.quotas | Removed | NO: non usato. | Nessuna. |
| createFromNamedImage: hslShift solo array | Deprecated | NO: non usato (solo 1 riga commentata). | Nessuna. |

## task4 — 42 → 43 (target finale) — breaking changes analizzate

| Voce 43 | Tipo | Impatto MarkText | Azione |
|---------|------|------------------|--------|
| **dialog defaultPath default = Downloads** quando non specificato | Behavior | **SÌ (UX)**: i dialog SENZA `defaultPath` (es. `dataCenter/index.js:173,192` pick cartella/file immagine) ora aprono su Downloads invece dell'ultima cartella OS. Quelli con `defaultPath` (save `file.js`, open `app/index.js`) OK. | Opzionale: decidere se tracciare l'ultima cartella e passarla come `defaultPath`. Solo UX, no crash. |
| Rounded corners default su Linux (frameless CSD) | Behavior | Basso, **solo Linux**: `config.js` `frame:false` (2 finestre). | Controllo visivo su Linux; opzione `roundedCorners` se indesiderato. |
| WCO rispetta title bar nativa Linux | Behavior | NO: nessun `titleBarOverlay`/WCO. | Nessuna. |
| NativeImage.toBitmap() normalizza a sRGB | Behavior | NO: non usato. | Nessuna. |
| chrome.scripting CSS su più frame fallback | Behavior | NO: nessuna estensione. | Nessuna. |
| showHiddenFiles rimosso su Linux | Removed | NO: non usato. | Nessuna. |

- Note: gradino finale. A chiusura: aggiornare `packages-update-fix.md` (Giro 7 = FATTO),
  spostare la feature in `Completed/` via agent-summary, valutare Renovate/Dependabot per i
  major futuri.

## Nota Node dev
Se dal task1 si è passato l'ambiente dev a Node 24 (nvm), mantenerlo per tutti i gradini e
aggiornare CLAUDE.md (prerequisiti build). Altrimenti restare su 22.21.1 finché il build regge.

## Worklog gradini 2-4
Compilare qui (o in file scorporati) man mano:
- task2: NON INIZIATO
- task3: NON INIZIATO
- task4: NON INIZIATO
