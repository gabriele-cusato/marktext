## 2026-07-08 — DEP0180 `fs.Stats` in preview: interno a Electron, NON fixabile → documentato

Warning `(node) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated` visto in
`preview` (processo main). Trace con `--trace-deprecation`:
```
at asarStatsToFsStats (node:electron/js2c/node_init)
...
at ReaddirpStream._stat (node_modules/readdirp/index.js)
at ReaddirpStream._read (node_modules/readdirp/index.js)
```
**Causa radice:** è **codice interno di Electron** (`asarStatsToFsStats` nello shim asar del suo
`node_init`) che usa il costruttore `fs.Stats` deprecato. Viene innescato da **readdirp** (dip di
**chokidar v5**, il file-watcher) quando scandisce le cartelle. NON è nostro codice né una nostra dip
diretta: chokidar è già v5, readdirp non costruisce Stats — lo fa Electron nel wrapping fs.
**Decisione:** NON risolvibile a mano (va corretto upstream in Electron, già all'ultima versione).
Benigno: un warning per processo, solo in dev/preview (nel packaged Electron sopprime i deprecation →
non compariva). Documentato qui come noto-accettato per la regola "warning non fixabile → documentare".
Ricontrollare a futuri upgrade di Electron: quando lo correggono, sparisce senza azioni da parte nostra.

## 2026-07-08 — Warning non bloccanti: vanno comunque risolti se notati e possibile

- Precisazione (richiesta esplicita utente) della regola 2026-07-05: un warning **anche se NON
  bloccante** va risolto se possibile. Un warning indica **comunque un problema**, seppur magari di
  poco conto; non va ignorato solo perché non rompe nulla.
- Vale quando il warning **viene notato** (in dev, preview, packaged, console PowerShell o F12):
  se lo si vede, si affronta — o si risolve alla radice, o, se non risolvibile, lo si **documenta**
  esplicitamente (causa + perché non risolvibile), non lo si lascia cadere silenziosamente.
- Non confondere con "sopprimere": la regola 2026-07-05 resta (mai silenziare col flag). Qui si
  aggiunge che la soglia per intervenire NON è "blocca / non blocca" ma "è stato notato ed è
  risolvibile".
- Esempi di questa sessione (renderer-no-node test): deprecazioni Element Plus (`el-radio label`,
  `el-button size/type`) e l'intervention font "slow network" — non bloccanti, risolti comunque
  (feature `refactor-followup-fix`). DEP0180 `fs.Stats` in preview = da dipendenza, non risolvibile
  a mano → **documentata** come tale, non ignorata.

## 2026-07-07 — Modus operandi soluzioni: preferire la strada SOLIDA/PULITA anche se costa più modifiche (con conferma)

**Regola permanente per come proporre e scegliere le soluzioni in questo progetto** (richiesta
esplicita utente, da applicare in OGNI sessione, anche a contesto pulito):

- Quando esiste un fix "pezza" rapido (soppressione warning, flag, workaround locale) e un fix
  **corretto alla radice** più costoso (refactor, più file toccati, migrazione a API nativa/mantenuta),
  l'utente vuole **la strada solida e duratura**, NON la pezza. Anche se richiede più lavoro,
  più file, o una feature dedicata.
- Criteri di "solido": elimina il problema alla radice; usa componenti nativi/mantenuti invece di
  addon esterni morti o hack; migliora sicurezza/manutenibilità; non si ripresenta ai major futuri.
- **SEMPRE proporre prima e attendere conferma esplicita** dell'utente (vale il gate DECISIONS
  2026-07-03): riepilogo della strada solida + costo/scope + tradeoff, poi l'utente decide. Non
  partire in autonomia solo perché "è la strada giusta".
- Mai spacciare una soppressione per fix: se una cosa è un cerotto, dirlo apertamente e indicare
  qual è invece la soluzione corretta e quanto costa.
- Esempi già emersi (contesto per sessioni future): keytar → `safeStorage` (API nativa Electron,
  non tenere l'addon morto); native-keymap napi → buildare contro Node ed escluderlo da
  electron-rebuild (non sopprimere il C4996); warning `crypto.fips`/`fs.F_OK` da
  vite-plugin-electron-renderer → la strada pulita è togliere `nodeIntegration` dal renderer e
  spostare l'I/O Node nel main via IPC (feature `renderer-no-node-integration`), non silenziare.

## 2026-07-07 — Drag file in finestra + taskbar: causa = elevazione (UIPI), CONFERMATO, non è bug di codice

- Sintomo: trascinare un file da Explorer dentro la finestra di MarkText per aprirlo NON
  funzionava, e le interazioni con la taskbar erano anomale. Sospetto pregresso: l'app girava
  **elevata** (Criteri di gruppo su questo PC corporate la eseguono solo come amministratore,
  gli stessi che bloccano `npm run build`), mentre Explorer gira non elevato → Windows scarta
  il drag-drop tra processi a integrità diversa (UIPI) prima che il renderer veda un evento.
- **Verifica utente 2026-07-07**: aprendo MarkText **normalmente** (non elevato), sia il drag
  dei file dentro la finestra sia le interazioni con la taskbar funzionano perfettamente →
  ipotesi elevazione/UIPI **confermata**. Non è un bug di MarkText: gli handler drag
  (`app.vue setupDragDropHandler`, muya `dragDropCtrl`, import dialog `mt::window::drop`) sono
  corretti.
- **Regola**: non scrivere codice per questo. Su una macchina che forza l'elevazione l'unico
  rimedio sarebbe nativo (`ChangeWindowMessageFilterEx` per WM_DROPFILES/WM_COPYGLOBALDATA/
  WM_COPYDATA dai processi a integrità più bassa) — cerotto d'ambiente, zona finestra delicata,
  sconsigliato. Da non confondere col downside cosmetico di electron#42252 (cursore divieto sul
  drag di una TAB sopra la propria tabbar: drag interno, cosa diversa).

## 2026-07-05 — Warning: mai sopprimerli, sempre fix alla radice

- Decisione utente (feature warning-fix): i warning (vue-i18n, Vite, Vue, Electron, npm, ecc.)
  non vanno MAI silenziati tramite opzioni che disattivano il controllo; vanno risolti alla
  radice (es. riformulare stringhe, aggiungere chiavi, correggere config). Vale anche per le
  feature future.
- Registro completo dei warning e delle cause: `docs/Ai/Warning-fix-notes.md`.

## 2026-07-01 — Version control consentito

- Consentito usare `git` solo per verifiche operative dopo Agent-Code: `status`, `diff`, elenco file modificati e ispezione patch contro plan.
- Vietati commit, amend, push, pull, rebase, merge o altre operazioni che modificano storia/stato remoto, salvo richiesta esplicita futura dell'utente.

## 2026-07-02 — drag-html5-dnd: gate task1 FAIL, Strada B scartata

- Test manuale spike task1 (`docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1-worklog.md`): `draggable="true"` su `.v2-tab` NON produce `dragstart` quando l'ancestor `.v2-tabbar` ha `-webkit-app-region: drag` — il window-drag OS intercetta il gesto anche con `no-drag` sul figlio. Rischio #1 di `DRAG-TASK.md §3` confermato reale, non un bug di configurazione (verificato: nessun hook custom tipo `WM_NCHITTEST`, CSS `no-drag` applicato correttamente in cascata).
- Utente ha scartato esplicitamente la "Strada B" (`DRAG-TASK.md §3bis`: restare su dragula + raise-finestre koffi). Non riproporla come opzione nelle prossime sessioni salvo che l'utente la richieda di nuovo esplicitamente.
- Da valutare come prossimo passo (NON iniziato, rimandato a sessione futura su richiesta esplicita dell'utente): mitigazione alternativa — sostituire `-webkit-app-region: drag` sulla tabbar con drag finestra gestito via JS (mousedown+move → IPC → `win.setPosition` manuale lato main), così nessun ancestor ha più `app-region:drag` e `draggable` sui tab dovrebbe poter funzionare liberamente. Richiede ricerca online prima di implementare (pattern non ancora verificato su Electron 39/Windows) e un nuovo spike dedicato prima di riprendere task2-5 della feature `drag-html5-dnd`.
- Finché questa valutazione non è fatta, i task2-5 di `drag-html5-dnd` restano bloccati (gate task1 non superato).

## 2026-07-02 — drag-html5-dnd: mitigazione scelta = drag region overlay "alla VS Code" (task1b), prima variante A poi B se FAIL

- Ricerca online (Agent-Search 2026-07-02): il candidato "JS window drag" (mousedown+move → IPC → `win.setPosition`) è SCARTATO come prima scelta — perde il tracking del mouse a velocità normale (confermato dal progetto electron-drag) e fa perdere Snap Layouts Win11, doppio-click-massimizza e Aero Snap (legati nativamente all'hit-test HTCAPTION di `app-region: drag`). Resta solo come fallback estremo. Anche il toggle dinamico drag/no-drag è scartato: Chromium non ricalcola le regioni in modo affidabile (issue Electron #6970).
- Pattern scelto: quello di VS Code, verificato nel sorgente ufficiale (`titlebarPart.ts`, `titlebarpart.css`) — le tab non devono mai essere discendenti di un elemento `app-region: drag`; la zona drag è un overlay `position:absolute` separato, mai antenato delle tab.
- Decisione utente (2026-07-02), consapevole che l'analogia con VS Code non è perfetta (in VS Code drag region e tab non si sovrappongono nemmeno come rettangoli; da noi la variante A conta sulla sottrazione `no-drag`, la stessa che nel task1 falliva per il gesto di drag):
  - **Variante A (prima)**: overlay `.v2-tabbar-drag-region` con `inset: 0` primo figlio di `.v2-tabbar` (che perde `drag`), tab sottratte via `no-drag` esistenti. Fiducia stimata ~60%. Spike: task1b (`drag-html5-dnd-task1b-plan.md`), nuovo GATE per task2-5.
  - **Variante B (solo se A FAIL)**: drag region SOLO sulle zone vuote della tabbar, mai sovrapposta ai rettangoli delle tab (struttura geometricamente identica a VS Code). Fiducia stimata ~85-90%. Nuovo spike dedicato da pianificare in quel caso.
- Fonti principali: github.com/microsoft/vscode `src/vs/workbench/browser/parts/titlebar/`, issue Electron #11768/#6970/#4237/#27149, electronjs.org/docs/latest/tutorial/custom-window-interactions, github.com/kapetan/electron-drag.

## 2026-07-02 — drag-html5-dnd: gate task1b PASS, task2-5 sbloccati

- Spike task1b (variante A, overlay `.v2-tabbar-drag-region`) testato a runtime dall'utente: `dragstart` HTML5 scatta sulle `.v2-tab`; drag finestra da zona vuota, doppio-click-maximize, click e multi-row tutti conservati. Variante B non necessaria.
- Il FAIL del task1 aveva DUE cause sovrapposte: (1) ancestor `app-region: drag` (risolta dall'overlay fratello) e (2) `e.preventDefault()` di dragula sul `mousedown` (`dragula.js` ~riga 113), che in Chromium sopprime il dragstart nativo — confermata disattivando dragula (`drake.destroy()`) e ritestando.
- Vincoli permanenti per la migrazione (task2-5): l'overlay `.v2-tabbar-drag-region` è struttura definitiva (le tab non devono mai tornare discendenti di un elemento `app-region: drag`); dragula NON può coesistere con l'HTML5 DnD sulle stesse tab → rimozione completa fin dal primo task che introduce il DnD nativo; gli spike temporanei in `tabs.vue` (log mousedown/dragstart, `drake.destroy()`) vanno rimossi/sostituiti dall'implementazione reale.

## 2026-07-03 — Workflow: gate obbligatorio prima di ogni Agent-Code (richiesta utente)

- Prima di OGNI avvio di Agent-Code (anche per fix round piccoli): pubblicare il riepilogo di cosa farà l'agente, dichiarare chi esegue e perché, e ATTENDERE l'OK esplicito dell'utente nel turno successivo. Una richiesta generica ("puoi correggere?") NON vale come OK: l'OK va dato dopo aver visto il riepilogo.
- Le istruzioni operative per l'agente vanno scritte in un file leggibile dall'utente PRIMA del lancio (plan del task per i task nuovi; per i fix round, sezione dedicata nel worklog del task), non solo inline nel prompt dell'agente.
- Regola nata il 2026-07-03 dopo un lancio di Agent-Code (fix round 4 task2 drag-html5-dnd) senza attesa dell'OK e senza istruzioni su file.

## 2026-07-03 — drag-html5-dnd: indagine taskbar spring-loading — strade GIÀ provate e NON risolutive (non ritentarle)

Obiettivo: drag di una tab sopra un'icona della taskbar Win11 deve rivelare la finestra (parità VS Code, che ci riesce con tab salvate E untitled sulla stessa macchina). Stato: NON ancora risolto. Registro di ciò che è già stato falsificato empiricamente (retest utente) per non riprovarlo:

- **NON è l'OS**: Win11 26200, feature attiva (drag file da Explorer → spring OK; drag LINK da Chrome stock → spring OK). Nessun aggiornamento/modifica Windows intercorso.
- **NON è il blocker accetta-poi-nega** (fix round 5, `stopPropagation`-only): corretto, ha risolto il drop cross-finestra ma NON la taskbar.
- **NON è il solo CF_HDROP**: spike 7 con `DownloadURL` (`SetDownloadFileInfo` → CF_HDROP differito + `SetAsyncMode(TRUE)` globale, verificato in os_exchange_data_provider_win.cc) → copia su desktop FUNZIONA (anche untitled via blob URL) ma taskbar NO.
- **NON sono i formati URL**: spike 7c con SOLO `text/uri-list` (verificato in data_transfer_util.cc: da JS finisce in `DropData.url_infos`, IDENTICO percorso del drag di un link → SetURLs → shortcut .url virtuale sincrono + CFSTR_INETURL) → taskbar NO, pur essendo il drag-link di Chrome funzionante sulla stessa macchina.
- **NON è il payload in generale**: anche il drag di TESTO semplice da MarkText non attiva la taskbar (nessun nostro handler coinvolto).
- Fatti utili acquisiti: `dropEffect` al `dragend` round-trippa per i drop ESTERNI (`'copy'` = consumato es. copia Explorer, `'none'` = rifiutato) → base valida per il gate "copia esterna vs nuova finestra". VS Code (dnd.ts): `DownloadURL` solo per schema `file:`, untitled = solo uri-list.
- **ESITO HARNESS (2026-07-03, chiude l'isolamento)**: Electron 39 minimale (framed E frameless) fa spring con QUALSIASI payload (link, testo, uri-list, perfino solo MIME custom). Quindi: Electron 39 scagionato, frameless scagionato, **formati/payload scagionati** (i tentativi 7/7b/7c sui formati erano fuori strada — NON ritentarli). **La causa è DENTRO MarkText**, globale alla pagina (rompe anche il drag di testo).
- Indiziato principale per la prossima sessione: handler `dragover` con `preventDefault` che coprono la pagina (Muya `dragDropCtrl.js` sull'editor, `.prevent` sulla `ul.v2-tabs`, eventuali handler globali) — famiglia electron#42252. Piano di bisezione dettagliato (harness con preventDefault globale → varianti → bisezione in MarkText) nel worklog task3, sezione "Harness Electron 39 minimale — ESITO E STRADA DA PERCORRERE".
- Dettagli completi: worklog task3 (`drag-html5-dnd-task3-worklog.md`, sezioni spike 7/7b/7c, ricerche Agent-Search e harness).

## 2026-07-03 — drag-html5-dnd: taskbar spring-loading RISOLTO — causa e regola permanente

- **Causa trovata e confermata a runtime (round 8)**: due handler `dragover` globali che marcavano
  `dropEffect='none'` (+`stopPropagation`) su OGNI drag non gestito — ramo else di
  `setupDragDropHandler` in `app.vue` (window-level, permanente) e ramo else del
  `dragoverHandler` di Muya (`contentState/dragDropCtrl.js`). Disattivati entrambi →
  spring-loading taskbar FUNZIONA sia per drag di testo sia per drag di tab (test utente
  2026-07-03). Coerente con l'esito harness (qualunque payload va bene: il problema non erano i formati).
- **REGOLA permanente (famiglia electron#42252)**: mai `preventDefault`, mai assegnare
  `dropEffect`, mai `stopPropagation` in un handler `dragover` per gesti che NON si intende
  accettare. Il rifiuto corretto è PASSIVO (dragover non cancellato = target non-accettante).
  Vale per qualunque nuovo drop-target futuro (editor, dialog, sidebar).
- I rami sono stati resi definitivi (commenti esplicativi al posto del codice rimosso).
  La voce precedente "indagine taskbar" resta come storico dei tentativi falsificati.
- Payload drag tab (fix round 9a): MIME custom `text/mt-tab-id` + `DownloadURL`
  (saved → `file:///`, untitled → blob URL). NIENTE `text/uri-list` (incollava l'URI come
  testo in qualunque target testuale, es. Chrome/Notepad). Drop esterni: gate su
  `dropEffect==='copy'` al dragend (copia consumata → niente detach/nuova finestra).

## 2026-07-03 — drag-html5-dnd: bug piattaforma electron#42252, evento `drop` stessa finestra INAFFIDABILE su Windows

- Diagnosi task2 (tracer DnD completo + ricerca online): il mancato reorder NON era un nostro bug. È **electron/electron#42252** ("Custom Drag and Drop broken on Electron 28 and later", Windows, chiuso "not planned", mai fixato): un refactor Chromium in `WebContentsViewAura` (`CompleteDragExit` azzera `current_drag_data_`, `UpdateDragOperation` non registra più l'operazione) rompe la consegna del `drop` per i drag HTML5 **interni alla stessa finestra**. Sintomi verificati da noi: `dragstart` ok, `dragover` consegnato e cancellato con `dropEffect='move'`, ma il valore non round-trippa (i log lo rivedono `none`), al rilascio arriva `dragleave`+`dragend` con `dropEffect:'none'` e il `drop` non viene MAI consegnato. Escluse cause nostre: overlay app-region (testato disattivato: identico), MIME solo-custom (aggiunto `text/plain`: identico), mancanza `dropEffect`/`dragenter.prevent` (aggiunti: identico).
- Il drag verso l'ESTERNO della finestra sorgente NON è affetto (confermato: hover-taskbar OLE funziona). Quindi: il **drop cross-finestra** (task4, la finestra destinazione riceve un drag "esterno") dovrebbe funzionare normalmente; il **detach** (task3) non usa `drop`.
- **REGOLA per questo progetto (finché #42252 non è fixato upstream): mai affidare logica stessa-finestra all'evento `drop` o a `dropEffect`.** Le decisioni si prendono su `dragend`, che arriva sempre e porta `clientX/clientY` del punto di rilascio:
  - rilascio dentro i bounds della tab bar propria → reorder (`computeDragTarget(clientX)` + `EXCHANGE_TABS_BY_ID`);
  - handler `drop` tenuto come percorso preferenziale con flag anti-doppia-esecuzione (se un futuro Electron fixa il bug, funziona il drop e il dragend non duplica);
  - per il detach task3: usare le coordinate schermo del `dragend`, NON `dropEffect === 'none'` (che su questa piattaforma è sempre 'none' per i drag interni).
- Downside cosmetico accettato dall'utente: durante il drag sopra la propria tabbar il cursore OS mostra il divieto (lo stato dell'operazione è azzerato lato browser, non modificabile da JS). Rivalutare se Electron fixa il bug.
- Fonti: github.com/electron/electron/issues/42252 (root cause dettagliata), Chromium #1005747 e #327244265 (fragilità note drop/dragend con `DoDragDrop` nested loop su Windows).
