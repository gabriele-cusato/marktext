# patch-package — strada percorribile futura (NON implementata)

Decisione utente 2026-07-12: NON implementare ora. Il task BUILD-1 (residuo HARD-TASK) è stato
chiuso senza setup perché al censimento (2026-07-12) risultavano **zero patch manuali** in
`node_modules`: un setup preventivo non avrebbe nulla da proteggere e non è il modo più corretto
di impostare le cose. Annotare qui la possibilità come soluzione limite per necessità future.

## Quando serve
Quando si è costretti a correggere un bug DENTRO una libreria in `node_modules` (upstream morto o
fix non mergiato) e la correzione deve sopravvivere a `npm install`/`npm ci`. Senza tooling, quelle
modifiche si perdono in silenzio al primo install: è già successo — le guard CodeMirror di ui-v2
(`mapFromLineView`, `posFromMouse`) sono andate perse così (vedi
`rischi-manutenzione-e-vulnerabilita.md` §3.5 e voce B1 in `idee-features-e-miglioramenti.md`).

## Come si fa (quando servirà)
1. `npm install --save-dev patch-package`.
2. In `package.json`: script `"postinstall": "patch-package"` (attenzione: concatenare se esiste
   già un postinstall).
3. Modificare il file in `node_modules/<pacchetto>/...`, poi `npx patch-package <pacchetto>`:
   genera `patches/<pacchetto>+<versione>.patch` da versionare nel repo.
4. Da quel momento ogni `npm install`/`npm ci` riapplica le patch automaticamente.

## Avvertenze
- Preferire SEMPRE il fix fuori da `node_modules` (wrapper nel nostro codice, override, fork
  dichiarato): patch-package è l'ultima risorsa (regola DECISIONS 2026-07-07: strada solida).
- Le patch si rompono ai bump di versione del pacchetto patchato: rigenerarle a ogni update.
- Se si adotta, aggiornare anche il flusso build documentato in CLAUDE.md (postinstall gira pure
  nei build CI/packaged).
