# source-comments-html-open-task10 — worklog

## Avanzamento

- [x] Confermare comportamento `move()`/`fs-extra` e retry Windows nativi vs `graceful-fs`.
- [x] Sostituire `move(..., {overwrite:true})` con rename diretto in `src/main/filesystem/index.js`.
- [x] Applicare stessa modifica in `src/main/filesystem/session.js`.
- [x] Gestire `EXDEV` in modo non distruttivo.
- [x] Verificare correttezza cleanup tmp su errore con la nuova implementazione.
- [x] Aggiornare commento "R7".
- [x] Verificare staticamente e riportare esito.

Stato task: DA TESTARE (manuale, vedi sezione Test).

## Prerequisiti bloccanti — verifica

- Worklog Task7 letto (`source-comments-html-open-task7-worklog.md`): contiene il bug segnalato
  dall'utente e conferma che l'esplorazione ha escluso il watcher come causa, indicando come
  possibile causa il lock file/rename atomico — coerente con l'analisi di questo task.
- `src/main/filesystem/index.js` e `src/main/filesystem/session.js` letti per intero prima di
  modificare.
- `node_modules/fs-extra/lib/move/move.js` riletto: confermato `doRename()` fa `await remove(dest)`
  (se `overwrite`) e SOLO DOPO `await fs.rename(src, dest)` — due syscall separate (righe 28-46).
- `node_modules/graceful-fs/polyfills.js` righe 87-124 riletto: su Windows patcha `fs.rename`
  (callback-based) con retry fino a 60s su `EACCES`/`EPERM`/`EBUSY`.

## Sottoproblema 2 — retry Windows: scelta e fonte

Verificato che `fs-extra` stesso avvolge `graceful-fs`, non `fs` nativo di Node:
`node_modules/fs-extra/lib/fs/index.js:5` fa `const fs = require('graceful-fs')`, poi promisifica
(via `universalify`) l'intera API incluso `rename` e la esporta. `node_modules/fs-extra/lib/index.js`
riesporta `./fs` (commento nel file: "Export promiseified graceful-fs") assieme a `./move` ecc.

Verificato inoltre che `graceful-fs` patcha SOLO l'API a callback di `fs` (`graceful-fs.js`:
`module.exports = patch(clone(fs))`, nessun riferimento a `fs.promises` nel modulo — grep su
`graceful-fs.js` per "promises" non trova nulla). Quindi `fs/promises` nativo di Node NON beneficia
dei retry Windows di `graceful-fs`, perché graceful-fs non lo patcha.

Scelta: importare `rename` direttamente da `'fs-extra'` (che è il `fs.rename` di `graceful-fs`
promisificato) invece di usare `fsPromises` nativo di Node. Questo preserva i retry Windows su
`EACCES`/`EPERM`/`EBUSY` fino a 60s senza aggiungere una dipendenza esplicita da `graceful-fs` (già
presente come dipendenza transitiva di `fs-extra`, nessun nuovo import da aggiungere al
`package.json`).

## Modifiche applicate

### `src/main/filesystem/index.js`

- Import: rimosso `move`, aggiunto `rename` (`import { readlinkSync, outputFile, rename, remove } from 'fs-extra'`).
- `writeFile()`: `move(tmpPath, pathname, { overwrite: true })` sostituito con `rename(tmpPath, pathname)`.
- Commento "R7" riscritto per spiegare perché ora è davvero una singola syscall atomica, perché
  `rename` viene importato da `fs-extra` (retry Windows di `graceful-fs`) e perché il cleanup del tmp
  nel catch resta sicuro con la nuova implementazione.

### `src/main/filesystem/session.js`

- Import: rimosso `move`, aggiunto `rename`.
- `atomicWrite()`: stessa sostituzione (`move(tmp, filePath, { overwrite: true })` → `rename(tmp, filePath)`),
  stesso pattern di commento sintetico che rimanda al commento esteso in `index.js` per non duplicare
  la spiegazione lunga due volte.

## Sottoproblema 5 — gestione EXDEV

Il `tmpPath`/`tmp` è sempre creato come `${pathname}.tmp` / `${filePath}.tmp`, cioè nella stessa
directory della destinazione finale: `EXDEV` (cross-device rename) non può verificarsi in pratica
perché sorgente e destinazione sono sempre sullo stesso volume/mount point. Non è stato aggiunto un
fallback esplicito di tipo `moveAcrossDevice` (copy+remove) perché aggiungerebbe complessità per un
caso che non può accadere con questo schema di naming del tmp, e un fallback "silenzioso" del genere
rientrerebbe comunque nel raggio di rischio che questo task vuole eliminare (più step non atomici).
Scelta: nessuna gestione speciale di `EXDEV` — se mai accadesse (es. cambiamento futuro di dove viene
creato il tmp), l'errore propaga naturalmente dal `.catch()` esistente fino al chiamante (che già
gestisce il fallimento del save, vedi `mt::tab-save-failure` in `src/main/menu/actions/file.js`), senza
crash non gestito. Il tmp non viene cancellato in modo distruttivo: se il rename fallisce con `EXDEV`,
il file `pathname`/`filePath` originale non è mai stato toccato (nessun `remove(dest)` previo con la
nuova implementazione), quindi cancellare il tmp nel catch resta sicuro come per ogni altro errore di
rename.

## Sottoproblema 6 — correttezza cleanup tmp su errore

Verificato che non c'è race tra `.then()` riuscito e `.catch()`: in JavaScript/Promise, se
`rename(tmpPath, pathname)` risolve con successo, la catena passa alla risoluzione finale della
Promise restituita da `writeFile`/`atomicWrite` e il blocco `.catch()`/`catch {}` non viene eseguito
affatto (in `index.js` è un `.catch()` concatenato dopo un `.then()` già risolto; in `session.js` è un
`try/catch` sincrono sull'`await`, stessa garanzia). Il cleanup del tmp nel catch scatta SOLO se
`outputFile` fallisce (tmp non scritto, comportamento invariato) oppure se `rename` stesso fallisce
(tmp esiste ancora, destinazione mai toccata con la nuova implementazione dato che non c'è più
`remove(dest)` previo) — mai dopo un rename riuscito. Nessuna modifica necessaria alla struttura del
`.catch()`/`try-catch` oltre alla sostituzione della chiamata.

## Fatto NON toccato

`ignoreChangedEvent()` e la logica del watcher (`src/main/filesystem/watcher.js`) non sono state
toccate, come richiesto dal plan: il fix riguarda solo la primitiva di scrittura file, non il watcher.

## Verifiche eseguite

- `node --check src/main/filesystem/index.js` → OK, nessun errore di sintassi.
- `node --check src/main/filesystem/session.js` → OK, nessun errore di sintassi.
- `npx eslint src/main/filesystem/index.js src/main/filesystem/session.js` → nessun errore/warning
  riportato (solo warning npm non correlati su config sconosciute `msvs_version`/`clang`).
- `npm run build` non eseguito: come per gli altri task di questa feature, l'ambiente ha limitazioni
  (Criteri di gruppo) che bloccano build complete; usate le verifiche statiche sopra come sostituto,
  in linea con quanto già fatto nei worklog precedenti della stessa feature.

## Test

DA TESTARE lato utente (vedi "Verifica richiesta" nel plan):

- Salvare ripetutamente lo stesso file `.html` con `Ctrl+S` più volte ravvicinate: nessun fallimento,
  nessuna perdita di contenuto.
- Salvare con il file aperto/in uso da altro processo (es. anteprima browser aperta dopo
  `Ctrl+Shift+O`): il salvataggio deve riuscire o fallire in modo pulito (file originale intatto se
  fallisce), mai perdere entrambe le versioni.
- Salvare file di sessione/backup (chiusura app con tab non salvate, riapertura, verifica
  `session.json`/snapshot integri) per confermare che `atomicWrite` in `session.js` non ha
  regressioni.
- Ripetere il test originale dell'utente (file `.html` con `<script>` contenente commento JS) più
  volte per verificare l'assenza del fallimento intermittente, pur sapendo che potrebbe restare non
  riproducibile al 100% (causa esterna tipo AV/indicizzazione).
