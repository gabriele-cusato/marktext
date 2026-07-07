# electron-upgrade — Aggiornamento Electron 39 (EOL) → 43 (latest)

## Scopo

Portare Electron dalla major **39** (EOL 2026-05-05, nessun fix di sicurezza) alla **43**
(latest, EOL ~2027-01-05). Motivo = sicurezza, non warning. È il "Giro 7" rimandato in
`docs/Ai/packages-update-fix.md` (§4 e §Giro 7), promosso a feature dedicata.

## Vincolo di metodo: UN major alla volta

Salto totale = 3 major (39→40→41→42→43). NON aggiornare in blocco: ogni major ha breaking
changes proprie (https://www.electronjs.org/docs/latest/breaking-changes) e va buildato+testato
prima di salire al successivo. Bundlare i major rende impossibile bisecare le regressioni.

Un task = un gradino = un commit dedicato e reversibile.

| Task | Salto | Note major | Stato |
|------|-------|-----------|-------|
| task1 | 39 → 40 | Node interno **22 → 24** (verificare API Node nel main process) | DA FARE |
| task2 | 40 → 41 | breaking changes da leggere al raggiungimento | DA FARE |
| task3 | 41 → 42 | breaking changes da leggere al raggiungimento | DA FARE |
| task4 | 42 → 43 | breaking changes da leggere al raggiungimento; target finale | DA FARE |

I plan dei task 2-4 sono da dettagliare con le breaking changes specifiche **quando si raggiunge
quel gradino** (non verificabili in anticipo senza leggere il changelog di ogni major).

## Fatti verificati (2026-07-07)

- Latest Electron pubblicata: **43.0.0** (`npm view electron version`, confermato utente).
- Electron NON ha LTS: supporta solo le 3 major più recenti, major nuova ~ogni 8 settimane →
  ogni major vive ~6 mesi. 43 è la scelta corretta ora (EOL più lontano tra le supportate).
- Stato attuale progetto: `electron ^39.2.7`, `electron-builder ^26.4.0`, `electron-updater ^6.6.2`.
- Moduli nativi da ricompilare a ogni salto: **keytar ^7.9.0, ced ^2.0.0, native-keymap ^3.3.7,
  @vscode/ripgrep ^1.17.0**. Script: `npm run rebuild-native` (= `npx @electron/rebuild -f`).

## Ambiente build nativi (OBBLIGATORIO a ogni task)

Da `packages-update-fix.md` §"Ambiente build nativi". Su PC con VS2026+VS2022, node-gyp sceglie
VS2026 v145 (Spectre non installabili → errore MSB8040). Forzare VS2022 v143:

1. Aprire **"Developer PowerShell for VS 2022"** (o `Enter-VsDevShell` su VS2022, vedi doc).
2. `nvm use 22.21.1` (per task1; valutare Node 24 dal task in cui conviene — vedi sotto).
3. Verificare `$env:VCINSTALLDIR` → deve puntare a `...\2022\...\VC\`.
4. Chiudere app/dev server prima di toccare `node_modules` (EBUSY su `ced`).

Requisito una tantum in VS2022: componente **MSVC v143 x64/x86 con mitigazione Spectre**.

## Node interno 22 → 24 (attenzione al task1)

Electron 40 porta Node interno da 22 a 24. Il Node **di sviluppo** (nvm) resta 22.21.1 per il
build, ma le API Node usate nel **main process** girano sul Node 24 di Electron a runtime →
verificare che nulla di deprecato/rimosso in Node 24 sia usato in `src/main/` e `src/common/`.
Valutare il passaggio dell'ambiente dev a Node 24 (nvm) insieme, aggiornando CLAUDE.md
(prerequisiti build) se si cambia.

## Aree da RETESTARE a ogni gradino (nessun test automatico le copre)

Copertura automatica reale: unit = solo utility main; e2e = solo smoke "app parte". Tutto il
resto è **test manuale obbligatorio**. Superficie sensibile ai bump Electron (vedi DECISIONS.md):

- **Drag&drop tab** (area storicamente rotta dai bump): reorder, detach, cross-window, taskbar
  spring-loading. Bug piattaforma **electron#42252** (drop stessa-finestra inaffidabile):
  se un Electron nuovo lo fixa, il percorso `drop` preferenziale torna attivo (flag
  anti-doppia-esecuzione già presente) → ritestare che non ci sia doppia esecuzione.
- **Dialog** (Element Plus + finestre native).
- **Export** HTML/PDF (printService).
- **Source mode** (CodeMirror 5).
- **Scorciatoie** (native-keymap), **keychain** (keytar), **ricerca file** (@vscode/ripgrep).
- **App pacchettizzata** che si avvia (`npm run build:win`), non solo dev.

## Vincolo ambiente (Group Policy)

Su questo PC (secondario) build e test Playwright sono bloccati da Group Policy — vedi memoria
`build-bloccato-su-pc-secondario` e CLAUDE.md §"Ambiente ristretto". **Build/rebuild nativo/test
si eseguono sul PC principale.** Qui si scrivono solo i doc e (se serve) le patch di codice, che
poi vengono buildate/testate altrove.

## Rollback (per ogni gradino)

Git versiona `package.json` + `package-lock.json`, NON `node_modules/`. Dopo un ripristino git:
```
git checkout -- package.json package-lock.json     # (o git revert del commit del gradino)
npm ci                                              # riallinea node_modules ESATTAMENTE al lockfile
npm run rebuild-native                              # SEMPRE (il giro tocca i nativi), in ambiente VS2022
```
Commit dedicato per gradino = revert isolato senza trascinare altro.

## Regola di workflow

Prima di ogni Agent-Code: riepilogo + OK esplicito utente + istruzioni su file (DECISIONS.md
2026-07-03). Ma gran parte di questa feature è comandi npm + test manuale dell'utente, non
scrittura di codice: Agent-Code serve solo se un breaking change richiede patch al codice.
