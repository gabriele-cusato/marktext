# warning-fix — task10 — worklog

## Avanzamento
- [x] Indagine: censimento funzionalità dipendenti da webSecurity false (Agent-Explorer, 2026-07-06)
- [x] Decisione strategia con l'utente: **B — custom protocol** (2026-07-06)
- [ ] Incremento 1: scheme custom + handler + rewrite image src (correctImageSrc/utils) + webSecurity:true (entrambe le finestre)
- [ ] Test inc.1: immagini locali inline in dev E packaged; niente warning webSecurity/allowRunningInsecureContent; printToPDF ok
- [ ] Incremento 2: adattare drag tab→Explorer (tabs.vue) e copia immagine (copyCutCtrl.js) al nuovo prefisso
- [ ] Test inc.2: drag su desktop + copia immagine ok; nessuna regressione DnD tab
- [ ] Incremento 3: CSP dinamica dev/prod (togliere unsafe-eval/ws in prod)
- [ ] Test inc.3: dev con HMR ok; build prod senza warning CSP; app packaged funzionante

## Indagine (Agent-Explorer, 2026-07-06)
Sintesi nel plan (sezione "Fatti verificati"). Punti chiave: webSecurity:false serve alle immagini locali inline (`file://` da correctImageSrc) sia in dev sia in prod; printToPDF dipende dallo stesso webContents; nessun custom protocol esistente; CSP `img-src` ha già `file:` (indipendente da webSecurity); `unsafe-eval` solo per Vite dev; export HTML NON impattato; drag/copia assumono `file://` letterale (tabs.vue:453, copyCutCtrl.js:140).

## Test
(da compilare dopo il test dell'utente, un incremento per volta — build/test sul PC principale, qui bloccato da Group Policy)
