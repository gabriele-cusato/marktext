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

## 2026-07-03 — drag-html5-dnd: bug piattaforma electron#42252, evento `drop` stessa finestra INAFFIDABILE su Windows

- Diagnosi task2 (tracer DnD completo + ricerca online): il mancato reorder NON era un nostro bug. È **electron/electron#42252** ("Custom Drag and Drop broken on Electron 28 and later", Windows, chiuso "not planned", mai fixato): un refactor Chromium in `WebContentsViewAura` (`CompleteDragExit` azzera `current_drag_data_`, `UpdateDragOperation` non registra più l'operazione) rompe la consegna del `drop` per i drag HTML5 **interni alla stessa finestra**. Sintomi verificati da noi: `dragstart` ok, `dragover` consegnato e cancellato con `dropEffect='move'`, ma il valore non round-trippa (i log lo rivedono `none`), al rilascio arriva `dragleave`+`dragend` con `dropEffect:'none'` e il `drop` non viene MAI consegnato. Escluse cause nostre: overlay app-region (testato disattivato: identico), MIME solo-custom (aggiunto `text/plain`: identico), mancanza `dropEffect`/`dragenter.prevent` (aggiunti: identico).
- Il drag verso l'ESTERNO della finestra sorgente NON è affetto (confermato: hover-taskbar OLE funziona). Quindi: il **drop cross-finestra** (task4, la finestra destinazione riceve un drag "esterno") dovrebbe funzionare normalmente; il **detach** (task3) non usa `drop`.
- **REGOLA per questo progetto (finché #42252 non è fixato upstream): mai affidare logica stessa-finestra all'evento `drop` o a `dropEffect`.** Le decisioni si prendono su `dragend`, che arriva sempre e porta `clientX/clientY` del punto di rilascio:
  - rilascio dentro i bounds della tab bar propria → reorder (`computeDragTarget(clientX)` + `EXCHANGE_TABS_BY_ID`);
  - handler `drop` tenuto come percorso preferenziale con flag anti-doppia-esecuzione (se un futuro Electron fixa il bug, funziona il drop e il dragend non duplica);
  - per il detach task3: usare le coordinate schermo del `dragend`, NON `dropEffect === 'none'` (che su questa piattaforma è sempre 'none' per i drag interni).
- Downside cosmetico accettato dall'utente: durante il drag sopra la propria tabbar il cursore OS mostra il divieto (lo stato dell'operazione è azzerato lato browser, non modificabile da JS). Rivalutare se Electron fixa il bug.
- Fonti: github.com/electron/electron/issues/42252 (root cause dettagliata), Chromium #1005747 e #327244265 (fragilità note drop/dragend con `DoDragDrop` nested loop su Windows).
