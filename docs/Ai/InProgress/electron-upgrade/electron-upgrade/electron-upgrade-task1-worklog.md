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
(da compilare)

## Esito
(da compilare: OK e commit / rollback + causa)
