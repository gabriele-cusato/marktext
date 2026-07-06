# source-comments-html-open-task7 — worklog

## Avanzamento

- [x] Confermare flusso save → `window-file-saved` → ignore watcher → eventi watcher.
- [x] Analizzare consumo entry in `_shouldIgnoreEvent()` / `_isPendingIgnore()`.
- [x] Fare ignorare tutti gli eventi self-save coerenti durante finestra di ignore.
- [x] Conservare pulizia entry scadute e notifiche di modifiche esterne reali.
- [x] Verificare staticamente e riportare esito.

Stato task: DA TESTARE (manuale, vedi sezione Test).

### Dettaglio implementazione

Prerequisiti bloccanti verificati: plan e worklog Task3 letti (`source-comments-html-open-task3-plan.md`,
`source-comments-html-open-task3-worklog.md`); fonti locali indicate lette (`watcher.js` per intero;
le altre fonti elencate nel plan erano già state lette/analizzate nell'analisi root cause
dell'orchestratore riportata sopra in questo worklog, confermata coerente col codice attuale).

File toccato: `src/main/filesystem/watcher.js`, funzione `_shouldIgnoreEvent()`.

Root cause confermata (come da analisi orchestratore): `_shouldIgnoreEvent()` faceva `splice` della
entry ignore al primo evento `add`/`change` che matcha `winId`+`pathname`, anche se l'evento cadeva
dentro la finestra `duration`. Un salvataggio atomico (tmp + rename) genera più eventi `add`/`change`
consecutivi sullo stesso path: il primo evento consumava la entry, i successivi non trovavano più match
e passavano come modifica esterna reale, causando il falso prompt "file changed on disk".

Fix applicato: `_shouldIgnoreEvent()` è ora non-consuming come `_isPendingIgnore()`, con filtro basato
sul tempo invece di `splice` al match:
- Ogni chiamata filtra `_ignoreChangeEvents` rimuovendo solo le entry scadute oltre
  `duration + GRACE_PERIOD` (pulizia anti-leak, invariato lo spirito della pulizia esistente).
- Se l'evento arriva entro `duration` dalla entry corrispondente (`winId`+`pathname`), viene sempre
  ignorato (`return true`) senza rimuovere la entry: eventi multipli dello stesso salvataggio atomico
  sono tutti coperti.
- Punto critico segnalato nel worklog (fallback mtime "cloud drive", GH#3044): con un peek puramente
  non-consuming filtrato solo per `duration`, la entry sarebbe sparita alla scadenza prima che un
  evento tardivo potesse beneficiare del controllo `mtime`. Risolto introducendo una finestra di grazia
  aggiuntiva (`GRACE_PERIOD = WATCHER_STABILITY_POLL_INTERVAL * 2`, 300ms) oltre `duration`: durante
  questa finestra la entry resta presente ma NON ignora più incondizionatamente l'evento (il ramo
  `now - start < duration` non scatta più), bensì esegue lo stesso controllo `mtime` di prima
  (`fileInfo.mtime - start < duration`) come fallback per cloud drive/re-sync tardivi. Solo dopo
  `duration + GRACE_PERIOD` la entry viene rimossa dal filtro. Comportamento del ramo mtime invariato
  rispetto al codice precedente (stessa condizione, stesso messaggio di log), solo lo spostamento da
  "consuming via splice" a "non-consuming via filter temporale" con finestra di grazia esplicita.

Non toccata `_isPendingIgnore()` (già corretta/non-consuming, usata da `unlink`) né la catena
`openInBrowser`/`shell.openExternal` (nessuna modifica a `Ctrl+Shift+O`).

Nessun altro file toccato oltre `watcher.js` e questo worklog: il fix è risultato sufficiente lato
watcher, non è stato necessario toccare `windowManager.js` o `editor.js`.

### Verifiche eseguite

- `node --check src/main/filesystem/watcher.js` → OK, nessun errore di sintassi.
- `npx eslint src/main/filesystem/watcher.js` → nessun errore/warning riportato.
- `npm run build` non eseguito: come per gli altri task di questa feature, l'ambiente ha limitazioni
  (Criteri di gruppo) che bloccano build complete; usate le verifiche statiche sopra come sostituto,
  in linea con quanto già fatto nei worklog precedenti della stessa feature.
- Non esistono test automatici dedicati al watcher nel repo (nessun file trovato per
  `watcher` sotto directory di test); nessun test unitario eseguibile per questa area, quindi non
  praticabile eseguirne uno per questo fix.

## Analisi root cause (orchestratore, 2026-07-01, task non ancora eseguito da Agent-Code)

Confermato leggendo `src/main/filesystem/watcher.js`:
- `_shouldIgnoreEvent()` (righe ~385-420, usato dagli handler `add`/`change`) è **consuming**: fa `splice` della entry ignore al primo evento che matcha `winId`+`pathname`, anche se ancora dentro la finestra di durata.
- `_isPendingIgnore()` (righe ~366-375, usato solo da `unlink`) è **non-consuming**: fa solo `filter` per rimuovere le entry scadute per tempo, poi `.some()` senza rimuovere.
- Un save atomico (tmp + rename) può generare più eventi `add`/`change` sullo stesso path. Il primo evento consuma la entry ignore; gli eventi successivi nella stessa finestra non trovano più match → passano come modifica esterna reale → falso prompt "file changed on disk". Causa confermata, non solo ipotizzata.

Fix da fare:
1. Rendere `_shouldIgnoreEvent` non-consuming come `_isPendingIgnore`: filtrare le entry solo per scadenza tempo (`now - start < duration`), senza `splice` al primo match, così ogni evento `add`/`change` nella finestra viene ignorato correttamente.
2. Attenzione al ramo "cloud drive" (fallback su `mtime` del file quando la entry è già scaduta per tempo, righe ~400-415): oggi funziona perché la entry sopravvive fino al primo match anche oltre `duration`, permettendo il check `mtime`. Con un peek puramente non-consuming filtrato per tempo, la entry sparirebbe alla scadenza prima che un evento tardivo possa beneficiare del fallback. Da preservare con una delle due strade: mantenere le entry ancora leggibili per una finestra di grazia oltre `duration` prima del filter definitivo, oppure separare esplicitamente "entry nella finestra → ignora sempre" da "entry appena scaduta → controlla mtime come oggi" senza rimuoverla nel frattempo.
3. Mantenere pulizia entry scadute e comportamento `unlink` invariato (non toccare `_isPendingIgnore`, già corretto).
4. Nessuna modifica a `openInBrowser`/`shell.openExternal` (Ctrl+Shift+O resta invariato, non è la causa).

Prossimo passo: eseguire task7 (plan già pronto in `source-comments-html-open-task7-plan.md`) con Agent-Code, seguendo i sottoproblemi già elencati nel plan, incorporando questo punto 2 come attenzione aggiuntiva.

## Test

DA TESTARE lato utente: dopo `Ctrl+S` su `.html` source mode e dopo `Ctrl+Shift+O`, nessun falso prompt `file changed on disk`; modifica esterna reale deve continuare a mostrare prompt.

Risultato test utente 2026-07-01: falso prompt "file changed on disk" NON compare più — fix confermato funzionante. Utente non è riuscito a riprodurre in modo affidabile una regola precisa.

Nuovo bug segnalato 2026-07-01: a volte il file non riesce a essere salvato. Non riproducibile con pattern chiaro dall'utente. Contenuto file di test usato (`.html`):
```html
<html>
  <body>
    bella fra come stai
  </body>
  <script>
    // document.getElementById("ciao").text = "ciao"
  </script>
</html>
```
Da indagare: possibile interazione tra la finestra di grazia introdotta in questo task (`GRACE_PERIOD` in `_shouldIgnoreEvent`) e il flusso di scrittura file, oppure causa indipendente dal fix watcher (es. lock file Windows durante rename atomico, race tra save multipli ravvicinati). Indagine in corso, vedi eventuale nuovo task successivo per la root cause e il fix.
