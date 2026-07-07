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

## task2 — 40 → 41
- Breaking changes 41: DA LEGGERE.
- Note: —

## task3 — 41 → 42
- Breaking changes 42: DA LEGGERE.
- Note: —

## task4 — 42 → 43 (target finale)
- Breaking changes 43: DA LEGGERE.
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
