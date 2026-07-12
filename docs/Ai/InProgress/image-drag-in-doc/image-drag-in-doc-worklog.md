# image-drag-in-doc — worklog

Plan di riferimento: `image-drag-in-doc-plan.md`.

## Stato

Decisione utente (2026-07-12): **si fa, ma per ULTIMA**, dopo il completamento e i test di tutti
gli altri punti in corso. Prima di iniziare l'implementazione l'utente farà un commit (modifica
rischiosa su Muya). Se si procede: prima indagine mirata (Agent-Explorer su transformer +
selezione immagine), poi plan implementativo dettagliato, poi questa checklist va sostituita.

## Avanzamento

- [x] Decisione utente: procedere — in coda DOPO tutti gli altri task (commit preventivo utente)
- [ ] (se si procede) Indagine transformer + selezione immagine → plan implementativo dettagliato
- [ ] (se si procede) Implementazione per sottoproblemi (dragstart condizionato, payload interno,
  ghost/dropAnchor, ramo drop interno con rimozione+reinserimento blocco)

## Test

(compilare dopo il test — obbligatorio su PC principale: verificare anche NON-regressione su
drop immagini esterne e spring-loading taskbar)
