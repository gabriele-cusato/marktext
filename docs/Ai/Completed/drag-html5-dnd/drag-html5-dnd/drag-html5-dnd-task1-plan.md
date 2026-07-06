# drag-html5-dnd-task1 — Spike rischio #1: draggable + -webkit-app-region:drag

## Obiettivo

Prima di investire nel refactor completo (task2-5), verificare a runtime il rischio esplicitamente segnalato in `DRAG-TASK.md §3` ("rischio #1"): se `draggable="true"` HTML5 su un elemento dentro una tab bar con `-webkit-app-region: drag` sul contenitore genitore funziona su Windows/Electron 39, o se il window-drag OS "mangia" l'evento `dragstart` impedendo il DnD nativo.

Questo task è un GATE: se lo spike fallisce (draggable non parte quando dentro una regione app-region:drag anche con `no-drag` sull'elemento), la migrazione HTML5 DnD va rivalutata PRIMA di procedere con task2-5. Se lo spike ha successo, i task successivi procedono come pianificato.

## Prerequisiti bloccanti

- File letto e richiesto: `DRAG-TASK.md` (root progetto), in particolare §3 "Downgrade/rischi" e §6 "Prossimi passi" punto 1.
- File sorgente richiesto e leggibile: `src/renderer/src/components/editorWithTabs/tabs.vue`.
- Verificare per intero (ri-grep, non fidarsi dei numeri di riga scritti qui: possono essere shiftati rispetto a quando è stata fatta l'esplorazione) le classi `no-drag`/`-webkit-app-region` attuali su `.v2-tabbar`, `.v2-tabs`/`ul`, `.v2-tab`, `.v2-tab-new-li`, `.v2-topright-clone`, `.v2-tr-plus`, `.v2-tr-btn`.
- File/cartelle vietate: non toccare taskbar/raise/marker se esistenti fuori scope; non leggere né modificare segreti esterni al repo.
- Target verifica: nessuna build/lint sufficiente da sola — questo task richiede OBBLIGATORIAMENTE un test manuale runtime su Windows (piattaforma target primaria del rischio) prima di poter dichiarare lo spike concluso.
- Comandi version control: `docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code non deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare questo worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/tabs.vue`
- `docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1-worklog.md`

Modifica minima e temporanea (spike): NON sostituire dragula, NON rimuovere nulla dell'infrastruttura esistente. Aggiungere SOLO `draggable="true"` sulla `.v2-tab` e un handler `dragstart` minimale (es. `console.log`/contatore visibile) per verificare se l'evento nativo scatta. Non toccare altri file.

## Regole e invarianti rilevanti

- Non rimuovere né disabilitare dragula in questo task: deve continuare a funzionare normalmente in parallelo allo spike (il vero conflitto da testare è la convivenza `draggable` + `app-region:drag`, non l'interazione con dragula).
- Non introdurre modifiche visive permanenti: lo spike deve essere facilmente rimovibile/reversibile a fine task se il risultato è negativo.
- Il test deve avvenire con la finestra in stato normale (non massimizzata/minimizzata) e verificare sia `.v2-tab` che eventualmente un punto di controllo su `.v2-tabbar` stesso, per capire esattamente dove si ferma l'evento se si ferma.

## Fatti già verificati

- `DRAG-TASK.md` §3: "Coesistenza `-webkit-app-region: drag` + `draggable=true` sulla stessa tab bar: rischio #1 da verificare a runtime su Windows... Le `.v2-tab` sono già `no-drag` (DESIGN-TASK) → in teoria `draggable` funziona, ma confermare."
- Esplorazione codice (Agent-Explorer, 2026-07-01) conferma che oggi `.v2-tab` ha già la classe `no-drag` applicata nel CSS (verificato riga per riga in `tabs.vue`), quindi la premessa del rischio (l'elemento su cui si vuole trascinare non è già dentro una regione app-region:drag diretta) è coerente.

## Sottoproblemi in ordine

1. Ri-grep in `tabs.vue` le classi `-webkit-app-region`/`no-drag` attuali per confermare che non siano cambiate dall'esplorazione.
2. Aggiungere temporaneamente `draggable="true"` e un handler `dragstart` minimale su `.v2-tab` (solo log/contatore, nessuna logica di drag reale).
3. Verificare staticamente (parse SFC) che la modifica non rompa nulla.
4. Aggiornare worklog con `[x]` e nota `DA TESTARE` esplicita: il test manuale runtime è OBBLIGATORIO e determina l'esito del gate, non solo un "nice to have".

## Verifica richiesta

- Parse SFC di `tabs.vue`.
- Test manuale (utente, Windows): trascinare una tab con il mouse tenendo premuto — verificare nella console DevTools se l'evento `dragstart` si registra (log/contatore) o se il drag viene invece intercettato/ignorato dal window-drag OS (nessun log, o la finestra stessa inizia a spostarsi).
- Esito atteso da riportare esplicitamente nel worklog: **PASS** (dragstart si attiva correttamente, la migrazione può procedere con task2-5) oppure **FAIL** (il window-drag OS prevale, serve rivalutare l'approccio prima di continuare — fermarsi e riportare all'orchestratore, NON procedere con task2-5 senza nuova decisione).
