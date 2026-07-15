# residui-hard-task — BUILD-1 (patch-package) — plan — 2026-07-12

Origine: TODO.md "Residui HARD-TASK". Setup di `patch-package` per rendere persistenti eventuali
patch a `node_modules` (richiede un giro npm).

## Prerequisiti bloccanti
- Deve girare `npm` → SOLO sul PC principale (su questo PC il wrapper npm è bloccato dalla policy;
  in admin funziona ma il giro npm di installazione conviene farlo dove l'ambiente è libero).
- Censire PRIMA quali patch a `node_modules` esistono/servono davvero: se nessuna patch è
  attualmente applicata a mano, valutare se il setup serve ancora (chiedere all'utente).
- Version control: solo verifiche (`git status`/`diff`) per ispezionare le modifiche a
  `package.json` (DECISIONS 2026-07-01). Niente commit.
- Da combinare nello stesso giro npm: `npm install` di pulizia post rimozione dragula
  (voce aperta in `Completed/drag-html5-dnd`), se non già fatto.

## Obiettivo
1. `npm install --save-dev patch-package`.
2. Script `postinstall`: `"postinstall": "patch-package"` in `package.json` (verificare che non
   esista già un postinstall da concatenare).
3. Se esistono patch manuali già applicate in `node_modules`: generarle con
   `npx patch-package <pacchetto>` e versionare la cartella `patches/`.
4. Verifica: `npm install` pulito riapplica le patch senza errori.

## File da toccare
- `package.json` (devDependency + script postinstall)
- `patches/` (nuova cartella, se ci sono patch)

## Fatti verificati
- Nessuna cartella `patches/` presente oggi nel repo (da riconfermare al momento dell'esecuzione).

## Skill di codice
Non serve (operazione di tooling/npm, nessun codice sorgente).
