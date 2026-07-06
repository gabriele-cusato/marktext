# source-comments-html-open-task10 — Fix race non-atomica in writeFile/atomicWrite

## Obiettivo

Bug segnalato dall'utente: a volte il salvataggio di un file (es. `.html` in source mode) non va a buon fine, senza pattern riproducibile. Indagine (Agent-Explorer) ha escluso il watcher/Task7 come causa e ha trovato la causa strutturale nella "scrittura atomica" (`writeFile` in `src/main/filesystem/index.js` e `atomicWrite` in `src/main/filesystem/session.js`, stesso pattern in entrambi): usano `move(tmpPath, pathname, { overwrite: true })` di `fs-extra`, che internamente NON è una singola operazione atomica ma fa `remove(dest)` e SOLO DOPO `fs.rename(src, dest)` (`node_modules/fs-extra/lib/move/move.js:28-46`). Se il `remove(dest)` o il successivo `rename` falliscono (es. lock transitorio Windows da antivirus/indicizzazione/cloud sync, non coperto da retry per lo step `remove`), il catch in `writeFile`/`atomicWrite` cancella anche il file temporaneo appena scritto, causando fallimento del salvataggio e, nel caso peggiore, perdita di entrambe le versioni del file (originale già rimosso, tmp cancellato nel catch).

Correggere sostituendo `move(..., { overwrite: true })` con `fs.rename` diretto (via `fsPromises.rename`), che su Node/libuv effettua l'overwrite della destinazione in una singola syscall (singolo `MoveFileExW` con `MOVEFILE_REPLACE_EXISTING` su Windows, `rename(2)` atomico su POSIX), eliminando la finestra di race tra `remove` e `rename`.

## Prerequisiti bloccanti

- Worklog Task7 richiesto e leggibile: `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task7-worklog.md` (contiene il bug segnalato e l'esclusione del watcher come causa).
- File sorgenti richiesti e leggibili: `src/main/filesystem/index.js`, `src/main/filesystem/session.js`.
- Fonte locale richiesta e leggibile (per confermare il comportamento di `move` prima di sostituirlo): `node_modules/fs-extra/lib/move/move.js`.
- Fonte locale richiesta e leggibile (per confermare i retry Windows su `fs.rename`, da NON perdere con la sostituzione): `node_modules/graceful-fs/polyfills.js` (righe ~87-124, retry EACCES/EPERM/EBUSY fino a 60s su Windows) e verificare se `fs-extra`/i moduli usati in questi due file passano già per `graceful-fs` o per `fs`/`fs/promises` nativo di Node.
- File/cartelle vietate: non toccare drag/tabbar/HTML5 DnD/taskbar/raise/marker; non leggere né modificare segreti esterni al repo.
- Target verifica: `node --check` sui file toccati; eslint se disponibile; test manuale runtime salvataggi ripetuti/ravvicinati.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/main/filesystem/index.js`
- `src/main/filesystem/session.js`
- `docs/Ai/InProgress/source-comments-html-open/source-comments-html-open-task10-worklog.md`

Non toccare `src/main/filesystem/watcher.js` (Task7), `sourceCode.vue` (Task9 se in corso in parallelo — file disgiunti, nessuna sovrapposizione prevista), keybindings, menu, IPC, drag/tabbar.

## Regole e invarianti rilevanti

- Non introdurre perdita di dati: in nessun caso di errore si deve arrivare a uno stato in cui NÉ il file originale NÉ il file tmp sono presenti/recuperabili, se evitabile. Se `fs.rename` fallisce, il file `pathname` originale NON deve essere già stato cancellato (questo è proprio il difetto da eliminare).
- Mantenere il comportamento di cleanup del file `.tmp` in caso di errore PRIMA del rename (se `outputFile(tmpPath, ...)` fallisce, nessun rename è stato tentato, comportamento invariato). Se invece il rename stesso fallisce dopo che il tmp è stato scritto correttamente, valutare se cancellare il tmp sia ancora corretto (il file originale a quel punto è probabilmente intatto, quindi cancellare il tmp non causa data-loss) — verificare che questo resti vero con la nuova implementazione.
- Gestire l'eventuale errore `EXDEV` (cross-device rename, se tmp e destinazione finissero su volumi diversi): la logica attuale di `fs-extra` ha un fallback `moveAcrossDevice` per questo caso. Dato che il tmp è creato nella stessa directory della destinazione (`${pathname}.tmp`), `EXDEV` non dovrebbe verificarsi in pratica, ma non deve causare un crash non gestito se capitasse (log + errore propagato, non necessariamente un fallback completo di move-across-device).
- Non rimuovere i retry Windows su `EACCES`/`EPERM`/`EBUSY` se già forniti da `graceful-fs` sotto al modulo `fs` usato: verificare se `fs/promises` nativo di Node include già questi retry o se serve preservare esplicitamente il path che passa da `graceful-fs`.
- Applicare la stessa correzione in modo coerente sia in `writeFile` (`index.js`) sia in `atomicWrite` (`session.js`): stesso pattern, stesso fix, per non lasciare un doppio standard.
- Non toccare il commento "R7" esistente se non per aggiornarlo a riflettere la nuova implementazione (mantenere la spiegazione del perché è atomico ora davvero in un solo step).
- Non toccare la logica del watcher (`ignoreChangedEvent`, chiamata da `windowManager.js` dopo il successo del save): resta invariata, non è parte di questo bug.

## Fatti già verificati

- `src/main/filesystem/index.js:25-42` `writeFile()`: `outputFile(tmpPath, content, options).then(() => move(tmpPath, pathname, { overwrite: true })).catch(err => { remove(tmpPath).catch(()=>{}); throw err })`.
- `src/main/filesystem/session.js:39-48` `atomicWrite()`: stesso identico pattern (`outputFile` → `move(..., {overwrite:true})` → catch che rimuove il tmp).
- `node_modules/fs-extra/lib/move/move.js:28-46` `doRename()`: con `overwrite: true` e path che non cambia solo maiuscole/minuscole, fa `await remove(dest)` PRIMA di `await fs.rename(src, dest)` — due syscall separate, non una singola operazione atomica, nonostante il commento "R7: atomic write" nel codice MarkText lo assuma.
- `move` e `remove` di `fs-extra` sono usati SOLO per questo pattern tmp+rename in entrambi i file (verificato con grep su `src/main/filesystem/`); nessun altro uso di `move` da preservare in questi due file.
- `node_modules/graceful-fs/polyfills.js:87-124`: su Windows, `graceful-fs` patcha `fs.rename` con retry fino a 60s su `EACCES`/`EPERM`/`EBUSY` (commento esplicito: AV software può lockare la directory). Questo retry copre SOLO lo step `fs.rename`, non lo step `remove(dest)` che lo precede nel pattern attuale — motivo per cui eliminare lo step `remove` separato riduce la superficie di fallimento.
- `ignoreChangedEvent()` (chiamata da `windowManager.js:454-458` dopo il successo del save) viene invocata solo DOPO che la write si è già risolta con successo: nessuna relazione/lock con questo bug, confermato dall'esplorazione Task7.
- Il fallimento di save non è silenzioso lato utente: propaga fino a `mt::tab-save-failure` (`src/main/menu/actions/file.js:162-165` circa, gestito in `src/renderer/src/store/editor.js:514-536`), quindi l'utente vede una notifica di errore quando capita — ma il fix deve ridurre la frequenza/eliminare la causa strutturale, non limitarsi a migliorare il messaggio.

## Sottoproblemi in ordine

1. Rileggere `node_modules/fs-extra/lib/move/move.js` per confermare esattamente cosa fa `move()` con `overwrite:true` (già fatto in fase di analisi, riconfermare prima di modificare).
2. Verificare se `fs`/`fs/promises` nativo di Node (usato per `fsPromises.rename`) beneficia già dei retry Windows equivalenti a `graceful-fs`, o se serve importare `graceful-fs` esplicitamente per non perdere quella protezione. Documentare la scelta nel worklog con la fonte.
3. In `src/main/filesystem/index.js`, sostituire `move(tmpPath, pathname, { overwrite: true })` con un rename diretto (`fsPromises.rename` o equivalente coerente col resto del file), rimuovendo la dipendenza da `remove(dest)` prima del rename. Aggiornare l'import in cima al file di conseguenza (rimuovere `move` se non più usato, aggiungere l'import necessario per il rename diretto).
4. Applicare la stessa modifica in `src/main/filesystem/session.js` `atomicWrite()`.
5. Gestire l'errore `EXDEV` in modo non distruttivo (log + propagazione, oppure fallback esplicito se ritenuto necessario — motivare la scelta nel worklog).
6. Verificare che il catch esistente (cleanup del tmp su errore) resti corretto con la nuova implementazione: non deve cancellare un tmp che in realtà è già stato rinominato con successo (evitare race tra `.then()` riuscito e `.catch()` per errori successivi non pertinenti).
7. Aggiornare il commento "R7" per riflettere la reale singola operazione atomica.
8. Aggiornare worklog task10 con `[x]`, verifiche eseguite e note `DA TESTARE`.

## Verifica richiesta

- `node --check` su `src/main/filesystem/index.js` e `src/main/filesystem/session.js`.
- eslint sui due file se eseguibile nell'ambiente.
- Test manuale atteso:
  - Salvare ripetutamente lo stesso file `.html` con `Ctrl+S` più volte ravvicinate: nessun fallimento, nessuna perdita di contenuto.
  - Salvare con il file aperto/in uso da altro processo (es. anteprima browser aperta dopo `Ctrl+Shift+O`): il salvataggio deve riuscire o fallire in modo pulito (file originale intatto se fallisce), mai perdere entrambe le versioni.
  - Salvare file di sessione/backup (se testabile facilmente: chiusura app con tab non salvate, riapertura, verifica `session.json`/snapshot integri) per confermare che `atomicWrite` in `session.js` non ha regressioni.
  - Ripetere il test originale dell'utente (file `.html` con `<script>` contenente commento JS) più volte per verificare l'assenza del fallimento intermittente, pur sapendo che potrebbe restare non riproducibile al 100% (causa esterna tipo AV/indicizzazione).
