# warning-fix — task4 — plan: electron-builder "cannot find path for dependency name=undefined"

## Obiettivo
Eliminare (o diagnosticare con certezza) il messaggio `cannot find path for dependency name=undefined reference=undefined` e la riga `dependancy undefined` durante `npm run build`, e chiudere l'item aperto "npm install post rimozione dragula" della feature drag-html5-dnd.

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task4-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 4, con esito ricerca online 2026-07-05).
- File richiesti: `marktext/package.json`, `marktext/package-lock.json`, `marktext/electron-builder.yml`.
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: `npm run build` completo; controllo del messaggio + integrità dell'output (dimensione asar, app avviabile).
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).

## Fatti verificati
- `package.json` non contiene più dragula/dom-autoscroller; `package-lock.json:27-29` li dichiara ancora come dipendenze dirette root; `node_modules/dragula/` ancora su disco; `electron-builder.yml:15` riga stale `!node_modules/dragula/resources`.
- Nota utente: il warning esisteva GIÀ prima della rimozione di dragula → il lockfile non è l'unica causa possibile.
- Ricerca online (2026-07-05): famiglia di issue electron-builder 26.x (#9011, #9129, #9259) — il messaggio emerge quando l'albero logico delle dipendenze (da lockfile/npm ls) contiene nodi senza corrispettivo fisico risolvibile (entry orfane, optional deps platform-specific non installate); `name`/`reference` restano undefined perché letti dal package.json del nodo non risolto. Nei casi gravi (#9208, #9259) il problema porta a build rotte: NON è garantito innocuo, va verificato l'output.
- Il messaggio letterale esatto non è stato trovato nelle issue: la diagnosi per il nostro caso specifico va confermata sul sorgente locale di `app-builder-lib` in node_modules.

## Sottoproblemi in ordine
1. `npm install` in `marktext/` per rigenerare il lockfile (rimozione entry orfane dragula/dom-autoscroller e delle cartelle da node_modules). Verificare con `git diff package-lock.json` che le rimozioni siano coerenti (solo voci orfane e transitive collegate). ATTENZIONE: npm potrebbe aggiornare altre voci; se il diff mostra cambi estesi non collegati, fermarsi e riportare all'utente prima di procedere.
2. `npm ls --all` → nessun `invalid`/`extraneous` residuo.
3. Rimuovere la riga stale `!node_modules/dragula/resources` da `electron-builder.yml`.
4. `npm run build` → verificare se il messaggio persiste.
5. SE persiste: individuare nel sorgente locale `node_modules/app-builder-lib` la riga esatta che genera il log ("cannot find path for dependency") e risalire a quale nodo dell'albero ha name undefined (delegare l'esplorazione ad Agent-Explorer); probabile candidato: optional dependency platform-specific (issue #9259).
6. In ogni caso: verificare l'integrità dell'output di build (app in dist/win-unpacked avviabile, moduli presenti) — test runtime dell'utente.
7. Aggiornare il worklog (checkbox + tag DA TESTARE).

## Esecutore e skill
- Esecutore: orchestratore per i comandi (npm install, npm ls, build) e la riga yml; Agent-Explorer per l'eventuale punto 5.
- Skill: nessuna skill di codice (config/lockfile); caricare `build` se servono dettagli sui comandi di build.

## Regole rilevanti
- Non modificare package-lock.json a mano: solo tramite npm.
- Non usare `ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES` (sopprimerebbe il sintomo: vietato per decisione utente 2026-07-05).
