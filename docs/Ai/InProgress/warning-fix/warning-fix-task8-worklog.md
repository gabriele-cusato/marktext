# warning-fix — task8 — worklog

## Avanzamento
- [ ] Prop cursor in index.vue → type Object, default null (no required)
- [ ] Grep consumatori della prop cursor: tutti gestiscono null
- [ ] Normalizzazione `?? null` in app.vue:142 (solo se senza effetti collaterali)
- [ ] Build di verifica

## Test
(da compilare dopo il test dell'utente: switch a source mode, attesa >7s con modifiche non salvate, ritorno a Muya, apertura file in source — nessun Vue warn "cursor"; posizione cursore preservata al cambio modalità)
