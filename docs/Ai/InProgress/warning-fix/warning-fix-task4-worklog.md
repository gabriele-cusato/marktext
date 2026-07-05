# warning-fix — task4 — worklog

## Avanzamento
- [x] `npm install` → lockfile rigenerato, diff verificato (voci orfane dragula/dom-autoscroller rimosse; incluso anche `npm uninstall languine`, vedi packages-update-fix.md)
- [x] `npm ls --all` senza invalid/extraneous (solo UNMET OPTIONAL platform-specific, normali)
- [x] Rimozione riga stale dragula da electron-builder.yml
- [x] `npm run build` + `npx electron-builder --dir`: messaggio SPARITO (sì)
- [x] ~~Se persiste: individuata riga sorgente in app-builder-lib~~ — non necessario
- [x] Verifica integrità output build (app avviabile) — testato utente 2026-07-05, OK

Note 2026-07-05:
- Warning "cannot find path for dependency name=undefined" e "dependancy undefined" NON compaiono
  più con electron-builder 26.15.3 (aggiornato da 26.4.0 nel giro `npm update`) + lockfile pulito.
  Non isolata la causa singola (update builder vs lockfile: applicati nello stesso giro); coerente
  con la famiglia di issue #9011/#9259 registrate in Warning-fix-notes.md.
- Packaging di verifica completato: dist/win-unpacked/marktext.exe generato e firmato (~210MB),
  exit 0, nessun errore. Resta solo la riga informativa "duplicate dependency references" (info
  normale di electron-builder, non un warning).

## Test
- 2026-07-05 (utente): dev funziona tutto senza errori dopo il giro aggiornamenti (lockfile
  pulito, languine rimosso, update pacchetti). Warning builder sparito (verifica orchestratore).
- 2026-07-05 (utente): exe pacchettizzato `dist/win-unpacked/marktext.exe` avviato e funzionante.
  Task CHIUSO.
