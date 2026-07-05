# warning-fix — task10 — plan: Electron security warnings (webSecurity, CSP) — ULTIMO task

## Obiettivo
Eliminare i tre security warning in console dev (Disabled webSecurity, allowRunningInsecureContent, Insecure CSP) rendendo la configurazione sicura in produzione e permissiva SOLO dove il dev lo richiede, senza rompere le funzionalità (immagini locali in primis).

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task10-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 7).
- File richiesti: `src/main/config.js`, `src/renderer/index.html`, file di creazione finestre in `src/main/windows/`.
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: `npm run dev` senza i tre warning; `npm run build` + app packaged con immagini locali, export, preferenze funzionanti.
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).
- ORDINE: eseguire per ULTIMO (decisione utente 2026-07-05), dopo il test di tutti gli altri task.

## Fatti verificati
- `src/main/config.js:22` (editor window) e `:51` (preferences window): `webSecurity: false` incondizionato, nessun branch dev/prod (config.js non importa NODE_ENV/isDevMode).
- `allowRunningInsecureContent`: NON impostato esplicitamente nel codice (con `webSecurity: false` Electron lo forza a true, da cui il secondo warning: derivato, si risolve col primo).
- CSP: `src/renderer/index.html:9-18`, meta con `script-src 'self' 'unsafe-inline' 'unsafe-eval'`; commento riga 7: "CSP relaxed for development... Vite requires unsafe-eval"; il tag vale anche in build.
- I warning compaiono solo in dev (Electron li tace su app packaged) ma la configurazione insicura resta anche in produzione.

## Sottoproblemi in ordine
1. INDAGINE (Agent-Explorer): perché `webSecurity: false`? Censire cosa carica il renderer da `file://` o schemi non-http (immagini locali nel documento, temi, export PDF, preview). Cercare commenti/documentazione in docs/dev e nel fork originale. Output: elenco funzionalità che dipendono da webSecurity off.
2. DECISIONE (con l'utente, dopo l'indagine): strategia — (a) webSecurity true + `protocol.registerFileProtocol`/custom scheme per le risorse locali (soluzione corretta, più lavoro), oppure (b) webSecurity condizionato a dev/packaged come primo passo. Il punto va riportato all'utente con i fatti del punto 1 prima di implementare.
3. CSP dinamica: `unsafe-eval` necessario SOLO a Vite in dev → generare/iniettare la CSP in base all'ambiente (electron-vite supporta index.html trasformato, oppure header via `session.webRequest.onHeadersReceived` nel main). In prod: CSP senza unsafe-eval (verificare che il bundle prod non lo richieda: element-plus/vue runtime compilato non dovrebbero).
4. Implementazione (Agent-Code, dopo OK utente sul piano di dettaglio del punto 2-3).
5. Verifica runtime completa (utente): dev senza warning; app packaged con immagini locali nel documento, apertura preferenze, export.
6. Aggiornare il worklog.

## Esecutore e skill
- Esecutore: orchestratore coordina; Agent-Explorer per punto 1; Agent-Code per punto 4 previa conferma.
- Skill di codice: `coding-standard`.

## Regole rilevanti
- NON abbassare la sicurezza per zittire i warning (mai sopprimere: DECISIONS.md 2026-07-05); l'obiettivo è ALZARE la sicurezza in prod.
- Toccare `config.js` per entrambe le finestre (editor E preferences) in modo coerente.
- Rischio rottura alto (immagini locali, export): ogni step va testato a runtime prima del successivo.
