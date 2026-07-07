# warning-fix — task2 — plan: aggiornare browserslist (caniuse-lite)

## Obiettivo
Eliminare il warning `Browserslist: browsers data (caniuse-lite) is 7 months old` in `npm run dev`.

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task2-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 2).
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: rilanciare `npm run dev` e controllare l'assenza del warning.
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).

## File da toccare
- `marktext/package-lock.json` (solo tramite il comando, mai a mano).

## Fatti verificati
- `package.json` non contiene config browserslist; il dato vecchio sta nel lockfile.

## Sottoproblemi in ordine
1. Eseguire `npx update-browserslist-db@latest` nella cartella `marktext/`.
2. Verificare con `git diff` che sia cambiato solo `package-lock.json` (voce caniuse-lite).
3. Rilanciare `npm run dev` e verificare che il warning sia sparito.

## Esecutore e skill
- Esecutore: orchestratore direttamente (un comando + verifica, sotto la soglia delle poche righe).
- Skill: nessuna (nessun codice scritto).
