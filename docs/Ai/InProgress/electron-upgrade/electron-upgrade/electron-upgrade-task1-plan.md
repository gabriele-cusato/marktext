# electron-upgrade — task1 — plan: Electron 39 → 40

## Obiettivo
Salire dalla major 39 alla 40 (Node interno 22 → 24), ricompilare i moduli nativi, verificare
build + retest manuale della superficie sensibile. Gradino isolato in un commit dedicato.

## Prerequisiti bloccanti
- Feature index `electron-upgrade.md` letto.
- `docs/Ai/packages-update-fix.md` §Giro 7 e §"Ambiente build nativi" letti.
- `docs/Ai/DECISIONS.md` (electron#42252, drag) letto.
- Ambiente: PC principale (build sbloccato). "Developer PowerShell for VS 2022" attiva,
  `nvm use 22.21.1`, `$env:VCINSTALLDIR` → `...\2022\...\VC\`.
- Working tree pulito (`git status`) prima di iniziare.

## Breaking changes Electron 40 — analisi contro il codice (2026-07-07)

Fonte: changelog ufficiale https://www.electronjs.org/docs/latest/breaking-changes

| Voce 40 | Tipo | Impatto MarkText | Azione |
|---------|------|------------------|--------|
| clipboard API da renderer | Deprecated | **SÌ (futuro)**: `src/renderer/src/util/clipboard.js` usa `@electron/remote` clipboard (`NSFilenamesPboardType`, `FileNameW`). Il preload già espone `clipboard` via `contextBridge` (path corretto). Deprecato in 40, **rimosso in 44**. | Non blocca 40-43. Reinstradare su clipboard del preload PRIMA della 44 (vedi index §"Salto futuro 44"). |
| dSYM macOS ora tar.xz | Behavior | NO: solo debug symbols macOS. | Nessuna. |
| Node interno 22 → 24 | (Chromium/Node) | **DA VERIFICARE**: le API Node del main process girano su Node 24 a runtime. | Grep sotto + test runtime. |

Grep API Node potenzialmente toccate dal salto a Node 24 (elencare i punti sospetti prima di
aggiornare; lista indicativa da confermare col changelog Node 24 al momento dell'esecuzione):
```
grep -rn "punycode\|url.parse\|Buffer(\|fs.rmdir\|process.binding" src/main src/common
```

**IMPORTANTE**: il changelog copre solo le rotture note e documentate. Le **verifiche runtime del
passo 6 restano obbligatorie** anche se l'analisi qui non segnala nulla di bloccante: possono
emergere problemi non elencati (Chromium nuovo, regressioni di comportamento, interazioni con i
moduli nativi). L'analisi statica NON sostituisce il test manuale.

## Passi
1. Ambiente pronto (prerequisiti sopra). Chiudere app/dev server.
2. Aggiornare solo Electron alla 40:
   ```
   npm install -D electron@40
   ```
3. `npm run rebuild-native` (nell'ambiente VS2022 v143) → keytar/ced/native-keymap ricompilati
   contro la nuova ABI, senza MSB8040.
4. Build:
   ```
   npm run build          # exit 0 atteso
   ```
5. Avvio dev + smoke:
   ```
   npm run dev            # app parte, console renderer/main pulita
   ```
6. **Retest manuale** (nessun test automatico copre): drag tab (reorder, detach, cross-window,
   taskbar spring-loading), dialog, export HTML/PDF, source mode, scorciatoie, keychain,
   ricerca file. Annotare esiti nel worklog con tag DA TESTARE/OK.
7. Se electron#42252 risulta fixato (il `drop` stessa-finestra ora arriva): verificare che il
   flag anti-doppia-esecuzione eviti reorder doppio; annotarlo in DECISIONS.md.
8. Build pacchettizzata: `npm run build:win` → app che si avvia.
9. Se tutto OK → commit dedicato `update: electron 39 → 40`. Se rompe → rollback (metodo
   nell'index) e annotare la causa nel worklog prima di ritentare.

## Punti che possono richiedere Agent-Code (patch codice)
- Se un breaking change 40 rompe il main process (es. API rimossa) → patch mirata, con gate
  (riepilogo + OK + istruzioni su file) prima di lanciare l'agente.
- Se drag/dialog/export regrediscono per un cambio di comportamento Electron → indagine
  dedicata (worklog), non forzare.

## Esecutore
- Comandi npm + rebuild + test manuale: **utente** sul PC principale (build bloccato qui).
- Eventuale patch codice: Agent-Code, solo dopo gate.

## Rischio residuo dichiarato
- MSB8040 se l'ambiente non è VS2022 v143 → seguire §"Procedura corretta su PC nuovo" del doc.
- Node 24: API deprecate/rimosse non rilevabili senza il changelog — il passo 6 (runtime) è il
  gate reale oltre al build.
- Downgrade di un solo major (40→39) sempre possibile via rollback: nessun punto di non ritorno.
