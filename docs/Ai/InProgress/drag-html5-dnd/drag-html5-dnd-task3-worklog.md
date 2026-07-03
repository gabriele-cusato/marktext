# drag-html5-dnd-task3 — worklog

## Prerequisiti verificati (2026-07-03)

- Worklog task2 letto per intero: stato finale **FUNZIONANTE (test manuale superato)**, PASS
  confermato dall'utente 2026-07-03 dopo i fix round 1-4 (BUG-DROP risolto via decisione
  su `dragend`, BUG-MULTIROW risolto). Nessun blocco.
- `DRAG-TASK.md` §2 punti 3-4 letti: punto 4 (`dropEffect === 'none'`) è il testo SUPERATO
  dalla decisione DECISIONS.md 2026-07-03 citata nel plan — non applicato, si usa il
  bounds-check su coordinate schermo come da AGGIORNAMENTO del plan.
- `HARD-TASK.md` §H5 letto via grep (H5-2, BUG-H5, "🅱️ PIANO IMPLEMENTATIVO B", Fase 2
  drag-out riga 995-1018): confermato canale `mt::detach-tab` esistente, payload
  `{tab, sourceTabId, screenX, screenY}`, gestione `_findEditorWindowAt` per il caso
  "drop su altra finestra MarkText" (task4) vs nuova finestra (task3).
- `EASY-TASK.md` §B/C letto via grep: flusso `pre-save` flush prima di leggere
  `tab.markdown`, baseline `originalMarkdown`/`pendingSavedMarkdown` — già rispettato da
  `DETACH_TAB` esistente (store/editor.js righe 975-1003), non toccato.
- File sorgenti riletti e confermati (righe correnti, shiftate poco rispetto al plan):
  `tabs.vue` (`onTabDragStart` riga ~322, `computeDragTarget` riga ~363, `onTabsDragOver`
  riga ~423, `onTabsDrop` riga ~477, `onTabDragEnd` riga ~490), `store/editor.js`
  (`DETACH_TAB` riga 975, firma `DETACH_TAB(tab, screen = null)` con `screen = {x, y}`),
  `src/main/app/index.js` (`_findEditorWindowAt` riga 447, `_createDetachWindow` riga 566,
  handler `mt::detach-tab` righe 986-1008).

## Avanzamento

- [x] Ri-confermare punti citati dal plan in `tabs.vue`/`store/editor.js`/`app/index.js` (righe possono essere shiftate).
      Vedi sezione Prerequisiti sopra: righe confermate via grep+Read, nessuna deviazione
      sostanziale rispetto al plan.
- [x] Confermare via grep assenza residui vecchio rilevamento H5-2 (`lastDragScreen`/`onDragMove`/`mousemove`, già rimossi in task2).
      Grep `lastDragScreen|onDragMove|addEventListener\('mousemove'|removeEventListener\('mousemove'`
      su `tabs.vue`: **nessun risultato**. Confermato: nessun residuo, nessuna rimozione
      necessaria.
- [x] Aggiungere ramo detach in `onTabDragEnd`: `dropHandledThisDrag` falso + rilascio fuori bounds finestra propria (coordinate schermo) → `DETACH_TAB(tab, { x: screenX, y: screenY })`. NON usare `dropEffect`.
      Implementato in `onTabDragEnd` (`tabs.vue`): il blocco esistente (fallback reorder,
      fix round 3) è stato ristrutturato in `if (insideTabbar) { reorder } else { detach }`
      — mutuamente esclusivo, nessuna sovrapposizione. `insideTabbar` invariato (stesso
      bounds-check su `.v2-tabbar` con `getBoundingClientRect`, ora estratto in una IIFE per
      chiarezza senza cambiarne la logica). Ramo detach: confronto
      `event.screenX`/`event.screenY` (coordinate schermo native del `dragend`) con
      `window.screenX`/`window.screenY`/`window.outerWidth`/`window.outerHeight` (bounds
      della finestra propria) → se fuori, `tab = tabs.value.find(t => t.id ===
      draggedTabId.value)` (risolto PRIMA del reset di `draggedTabId` a fine funzione,
      come richiesto dal plan) e `editorStore.DETACH_TAB(tab, { x: event.screenX, y:
      event.screenY })`. Nessun uso di `dropEffect`. Rilascio dentro la finestra ma fuori
      dalla tabbar: nessuna delle due condizioni scatta → nessuna azione, comportamento
      invariato (drag annullato).
- [x] Verificare/documentare eventuale bounds-check residuo lato main per posizionamento finestra.
      Confermato (non nuovo, comportamento conservato): l'handler `mt::detach-tab`
      (`src/main/app/index.js` righe 986-1008, NON toccato) fa GIÀ un bounds-check lato
      main via `_findEditorWindowAt(screenX, screenY, sourceWin.id)` quando `screenX` è un
      number — cioè sempre, dato che il renderer ora invia sempre coordinate valide nel
      ramo detach (mai più `null`, quello restava per il context-menu H5-1). Se il punto
      cade dentro un'altra finestra MarkText esistente, il main dirotta lì la tab
      (`mt::receive-detached-tab`, percorso task4) invece di creare una nuova finestra;
      altrimenti chiama `_createDetachWindow` (nuova finestra, percorso task3). Questo
      bounds-check main decide DOVE (o su quale finestra esistente) posizionare la tab,
      non SE fare il detach — quella decisione (bounds-check su coordinate schermo vs
      finestra propria) resta nel renderer come da regola del plan. Nessuna modifica
      necessaria in `app/index.js`.
- [x] Verificare pulizia stato locale post-detach (path esistente di `onTabDragEnd`).
      Il ramo detach è dentro lo stesso `if (!dropHandledThisDrag && draggedTabId.value &&
      event)` che precede il reset finale: dopo la chiamata a `DETACH_TAB`, l'esecuzione
      prosegue regolarmente su `dropHandledThisDrag = false`, `draggedTabId.value = null`,
      `dragTargetId.value = null`, `dragIndicatorVisible.value = false` e il blocco
      `nextTick` con `tabsRenderKey.value++`/`recomputePinnedTab()`/
      `requestAnimationFrame(() => updateTabRowsLayout())` — invariato, nessuna modifica.
      La tab sorgente non viene rimossa localmente dal renderer in questo punto (la
      rimozione avviene su ack `mt::detach-tab-ack` dal main, percorso esistente non
      toccato in questo task): lo stato locale della finestra sorgente (layout/pinnedTab)
      resta comunque coerente perché il reset/ricalcolo gira sempre, indipendentemente dal
      ramo (reorder/detach/nessuna azione).
- [x] Rimuovere log `[DEBUG drag-html5-dnd-task2]` (coda task2) e aggiungere log temporaneo `[DEBUG drag-html5-dnd-task3]` nel ramo detach.
      Rimossi i 3 log `[DEBUG drag-html5-dnd-task2]` residui: `onTabDragStart` (id
      sorgente), `onTabsDrop` (droppedId/dragTargetId), `onTabDragEnd` fallback
      (inside/coordinate + esito reorder). Grep di conferma:
      `DEBUG drag-html5-dnd-task2` → **nessun risultato**. Aggiunto UN log temporaneo
      `[DEBUG drag-html5-dnd-task3]` nel ramo detach di `onTabDragEnd` (prima del check
      `outsideWindow`): stampa `event.screenX/screenY`, i bounds finestra
      (`window.screenX/screenY/outerWidth/outerHeight`) e l'esito `outsideWindow` — utile
      per il test manuale, da rimuovere a detach confermato funzionante.
- [x] Verificare staticamente e riportare esito.
      Parse SFC di `tabs.vue` con lo script Node in scratchpad
      (`parse` + `compileScript` + `compileTemplate`, `@vue/compiler-sfc`): **ALL OK**,
      nessun errore. `store/editor.js` e `src/main/app/index.js` NON toccati (nessuna
      modifica necessaria, confermato dai punti sopra) → nessun `node --check` richiesto,
      nessuna deviazione dal vincolo "toccare SOLO tabs.vue + eventualmente
      store/editor.js".

## Retest task3 (utente, 2026-07-03): detach in NUOVA finestra OK, ma 2 regressioni

- Detach su desktop → nuova finestra: **OK** (log: coordinate sane, `outsideWindow: true`).
- **REGRESSIONE-TASKBAR**: hover sull'icona taskbar durante il drag non rivela più le
  finestre (funzionava il 2026-07-02, worklog task2 round 1). Pillola e cursore di divieto
  ancora visibili sopra la taskbar → il drag OLE è vivo, è lo STATO (dati/operazione) a
  essere corrotto.
- **REGRESSIONE-CROSS-FINESTRA**: rilascio su un'altra finestra MarkText → nessun log in
  console della sorgente, nessun effetto (indipendentemente dal punto di rilascio).
- Ambiente: monitor singolo (riprodotto anche multi-monitor), scaling 150%, nessun
  aggiornamento/modifica Windows dal 2026-07-02.

## Diagnosi + Fix round 5 (orchestratore, 2026-07-03)

- Root cause individuata (timeline + ricerca Agent-Search): `blockForeignTabDropOutsideTabbar`
  (fix round 1 task2) faceva `preventDefault()` + `dropEffect='none'` su OGNI dragover fuori
  dalla tab bar — "accetta-poi-nega" generalizzato a livello window. È il pattern che innesca
  il meccanismo di electron#42252 (`CompleteDragExit` azzera `current_drag_data_` → stato del
  drag OLE corrotto per l'intero gesto): spring-loading taskbar inerte e drop cross-finestra
  mai consegnato. Il blocker è l'UNICA modifica globale al DnD arrivata dopo il 2026-07-02
  (ultima data con taskbar funzionante). Fonti: github.com/electron/electron/issues/42252;
  ricerca 2026-07-03 (nessuna dipendenza OS: Windows 11 build ≥22H2 ha la feature, nessun
  aggiornamento intercorso).
- **Fix applicato** (`tabs.vue`, modifica minima diretta con OK utente):
  `blockForeignTabDropOutsideTabbar` ora fa SOLO `stopPropagation()` (blocca l'handler di
  Muya), NIENTE `preventDefault`/`dropEffect`: il rifiuto avviene per default (dragover non
  cancellato = target non-accettante). Copertura zona-testo invariata: il dataTransfer porta
  solo il MIME custom, il contenteditable non ha flavor testuali da incollare.
- Strumentazione temporanea aggiunta per il retest (rimuovere a diagnosi chiusa): log
  INCONDIZIONATO d'ingresso in `onTabDragEnd` (clientX/Y, screenX/Y, dropHandled,
  draggedTabId) e log in `onTabsDrop` (verifica consegna drop cross-finestra).
- Verifica statica: parse SFC **ALL OK**.

## Retest round 5 (utente, 2026-07-03)

- **Cross-finestra: RISOLTO dal round 5** — la migrazione tab → altra finestra MarkText ora
  funziona (testata 2 volte, log sani: `outsideWindow: true`, coordinate corrette). Prima
  del round 5 non funzionava mai → la rimozione di `preventDefault`+`dropEffect='none'`
  dal blocker era davvero la causa del drop cross-finestra morto.
- **CASO RESIDUO ultima-tab**: trascinare l'UNICA tab di una finestra verso un'altra
  finestra non fa nulla. Causa (verificata nel codice): guardia `if (this.tabs.length <= 1)
  return` a inizio `DETACH_TAB` (`store/editor.js:976`) — sensata per il detach in NUOVA
  finestra (splittare una finestra da 1 tab è un no-op), sbagliata per la MIGRAZIONE verso
  finestra esistente (spostare l'ultima tab è legittimo). L'"assenza di log" riferita
  dall'utente è quasi certamente osservazione dal DevTools sbagliato: i log vivono nella
  console della finestra SORGENTE (la secondaria/detached, che non apre DevTools da sola).
  Interseca BUG-H5-EMPTYWIN (finestra svuotata dovrebbe auto-chiudersi).
- **REGRESSIONE-TASKBAR: NON risolta dal round 5.** Nessuna miniatura/reveal, cursore
  sempre divieto ovunque (anche sopra tab bar con dropEffect='move' dichiarato), finestre
  mai portate in primo piano. Ipotesi blocker falsificata come causa taskbar (resta causa
  confermata del solo cross-finestra). Prossimo passo diagnostico (senza codice): test
  discriminanti con drag di TESTO dall'editor e drag di FILE da Explorer sopra la taskbar,
  per separare "problema del nostro drag tab" da "problema finestra/app/OS".
- Reorder stessa finestra e detach su desktop: confermati OK anche dopo il round 5.

## Aggiornamento indagine taskbar (2026-07-03, post test discriminanti)

- Test utente: (a) drag di TESTO dall'editor MarkText sopra la taskbar → NESSUN reveal;
  (b) drag di file da Explorer → reveal OK (cursore divieto presente anche lì, ma in tema
  scuro: normale, è il cursore OLE di Explorer).
- Conclusione: **il problema taskbar NON è del nostro drag tab** — il drag di testo non
  passa da alcun nostro handler (il blocker filtra su MIME `text/mt-tab-id`). Qualsiasi
  drag originato dalla finestra Electron/Chromium non attiva lo spring-loading; quelli di
  Explorer sì. Livello: Electron/Chromium vs shell Win11, non regressione dei fix round
  1-5. La "conferma OLE/taskbar" del 2026-07-02 (worklog task2, round 1) va considerata
  inattendibile. Ricerca online mirata delegata (in corso): condizione tecnica che la
  taskbar verifica + eventuali workaround per drag "taskbar-friendly".

## Istruzioni Fix round 6 — migrazione ultima-tab + auto-chiusura finestra svuotata (scritte dall'orchestratore, da eseguire con Agent-Code previo OK utente)

Comportamento richiesto dall'utente (2026-07-03): la guardia `tabs.length <= 1` va bene
per la finestra ORIGINALE (owner); per le finestre SECONDARIE no — trascinare l'unica tab
di una secondaria su un'altra finestra deve migrare la tab e far SPARIRE la secondaria.

File toccabili: `src/renderer/src/store/editor.js` (solo `DETACH_TAB` e handler
`mt::detach-tab-ack` in `LISTEN_FOR_SESSION`), `src/main/app/index.js` (solo handler
`mt::detach-tab`), worklog task3. Nessun altro file.

1. `DETACH_TAB(tab, screen)` (`store/editor.js` ~riga 975-976): sostituire la guardia
   `if (this.tabs.length <= 1) return` con `if (this.tabs.length <= 1 && !screen) return`
   (il path context-menu, senza coordinate, resta bloccato com'è oggi). Aggiungere al
   payload IPC `isLastTab: this.tabs.length === 1`.
2. Handler `mt::detach-tab` (`app/index.js` ~986-1008): leggere `isLastTab`; recuperare
   `const srcEditor = this._windowManager.get(sourceWin.id)`. Se
   `isLastTab && (!targetWin || (srcEditor && srcEditor._isSessionOwner))` → return
   (no-op: l'ultima tab dell'owner non migra — richiesta utente — e l'ultima tab verso
   NESSUNA finestra non crea una nuova finestra fotocopia). Altrimenti flusso invariato.
3. Handler `mt::detach-tab-ack` (`store/editor.js` ~942-945): dopo `FORCE_CLOSE_TAB(t)`,
   se `this.tabs.length === 0` → `window.electron.ipcRenderer.send('mt::cmd-close-window')`
   (chiusura graceful della finestra svuotata; il caso owner non può arrivarci per la
   guardia al punto 2). VERIFICARE prima il comportamento di `FORCE_CLOSE_TAB` sull'ultima
   tab: se auto-apre una blank tab (tabs.length torna 1), adattare (es. rilevare PRIMA
   della chiusura che era l'ultima e chiudere la finestra invece di chiudere la tab, o
   dopo la blank auto-aperta chiudere comunque la finestra) e documentare la scelta.
4. Vincoli: NON toccare `_findEditorWindowAt`/`_createDetachWindow`/flusso ack esistente
   oltre ai punti detti; nessun nuovo canale IPC; verificare entrambi i pattern di
   chiamata IPC (regola CLAUDE.md) prima di modificare gli handler; parse SFC non serve
   (niente .vue), `node --check` sui due .js toccati; log temporanei non richiesti.
5. Test manuale atteso: secondaria con 1 tab → drag sulla finestra originale = tab
   migrata + secondaria chiusa; owner con 1 tab → drag fuori/su secondaria = nessuna
   azione; context-menu "sposta in nuova finestra" su ultima tab = invariato (no-op);
   migrazione con 2+ tab = invariata; detach su desktop = invariato.

## Fix round 6 — esecuzione (2026-07-03)

- [x] Punto 1 — `DETACH_TAB` (`store/editor.js`): guardia sostituita con
      `if (this.tabs.length <= 1 && !screen) return` (il path context-menu, sempre senza
      `screen`, resta bloccato invariato). Aggiunto al payload IPC `isLastTab: this.tabs.length
      === 1` (letto PRIMA di qualunque mutazione della lista, valore corretto).
- [x] Punto 2 — handler `mt::detach-tab` (`app/index.js`): letto `isLastTab` dal payload;
      recuperato `srcEditor = this._windowManager.get(sourceWin.id)`; aggiunto
      `if (isLastTab && (!targetWin || (srcEditor && srcEditor._isSessionOwner))) return`
      SUBITO dopo il calcolo di `targetWin` (prima del branch `if (targetWin) {...} else
      {...}` esistente, non toccato oltre l'inserimento). Verificati entrambi i pattern di
      chiamata IPC (regola CLAUDE.md): grep `ipcMain.emit('mt::detach-tab'` → nessun
      risultato, grep `ipcRenderer.send('mt::detach-tab'` → solo `store/editor.js:995`.
      Quindi il canale è chiamato ESCLUSIVAMENTE dal renderer via `ipcRenderer.send` e
      gestito da `ipcMain.on` (già la firma esistente, non modificata). Stesso controllo per
      `mt::cmd-close-window`: solo `ipcRenderer.send` da `commands/index.js` e `tabs.vue`,
      gestito da `ipcMain.on('mt::cmd-close-window', ...)` in `menu/actions/file.js:570`
      (handler esistente, non toccato, chiusura graceful confermata).
- [x] Punto 3 — handler `mt::detach-tab-ack` (`store/editor.js`, in `LISTEN_FOR_SESSION`):
      dopo `FORCE_CLOSE_TAB(t)`, aggiunto `if (this.tabs.length === 0)
      window.electron.ipcRenderer.send('mt::cmd-close-window')`.
      **Verifica FORCE_CLOSE_TAB su ultima tab (richiesta dal punto 3)**: letta
      l'implementazione (`store/editor.js` righe 1096-1144) — rimuove la tab da `this.tabs`
      via `splice`, aggiorna `currentFile`/undo/autosave/watcher, e se `this.tabs.length ===
      0` azzera solo `listToc`/`toc`. **NON riapre alcuna blank tab** (nessuna chiamata a
      `NEW_UNTITLED_TAB` in `FORCE_CLOSE_TAB`, confermato per lettura diretta e per grep
      `NEW_UNTITLED_TAB\(` sull'intero file: le uniche chiamate sono in `RESTORE_SESSION`
      e `NEW_TAB_WITH_CONTENT`, nessuna in `FORCE_CLOSE_TAB` né in `CLOSE_TABS`). **Scelta
      adottata**: nessun adattamento necessario — il semplice
      controllo `this.tabs.length === 0` DOPO `FORCE_CLOSE_TAB(t)` è sufficiente e non
      richiede di anticipare la rilevazione prima della chiusura, perché non c'è alcuna
      blank tab auto-aperta che falserebbe la lunghezza.
      Il caso owner non arriva a questo ack per l'ultima tab: bloccato a monte dal punto 2
      (il main non manda `mt::detach-tab-ack` se nega il detach).
- [x] Punto 4 — Vincoli rispettati: non toccati `_findEditorWindowAt`/`_createDetachWindow`/
      il resto del flusso ack; nessun nuovo canale IPC (riusati `mt::detach-tab`,
      `mt::detach-tab-ack`, `mt::cmd-close-window`, tutti preesistenti); nessun log
      temporaneo aggiunto per questo fix (i log task3 esistenti nel ramo detach di
      `tabs.vue` non sono stati toccati, file fuori scope di questo fix).
- [x] Punto 5 — Verifiche statiche eseguite:
      `node --check src/main/app/index.js` → OK (nessun output, CommonJS nativo).
      `node --check src/renderer/src/store/editor.js` → OK (Node rileva automaticamente la
      sintassi ESM — `import`/`export` — anche senza `"type": "module"` nel `package.json`
      più vicino, e la analizza correttamente; nessun errore di parsing). Non è stato
      necessario un fallback con `acorn`/`@babel/parser`.

**Stato: DA TESTARE (riavvio completo npm run dev: modifiche al main).**

**Retest round 6 (utente, 2026-07-03): PASS su tutti i 5 punti** — migrazione ultima-tab
da secondaria con auto-chiusura, no-op su owner/desktop/context-menu, nessuna regressione
su migrazione 2+ tab, reorder, detach su desktop.

## Spike round 7 — taskbar spring-loading "alla VS Code" (2026-07-03)

Contesto: test utente = le tab di VS Code ATTIVANO lo spring-loading della taskbar (anche
untitled); comportamento richiesto anche per MarkText. Ricerca Agent-Search sul sorgente
VS Code (`dnd.ts`, `fillEditorsDragData`) + Chromium (`os_exchange_data_provider_win.cc`):
VS Code imposta al dragstart il formato `DownloadURL` ("mime:nomefile:url") → Chromium
genera CF_HDROP differito nell'IDataObject OLE → la taskbar riconosce il drag come "file".
Requisiti utente: (1) funzionare anche per tab untitled; (2) drop su Explorer/desktop =
COPIA del file (parità VS Code, accettato), drop su zone senza azione di copia = nuova
finestra come oggi.

Spike applicato direttamente dall'orchestratore (solo `tabs.vue`, OK utente condizionato
"se lo spike prevede questi comportamenti"):
- `effectAllowed` da `'move'` a `'copyMove'` (senza 'copy' consentito Explorer non può
  accettare e la taskbar non vede un drag da file).
- `onTabDragStart`: `setData('DownloadURL', 'text/markdown:<nome>:<url>')` — tab salvata →
  URI `file:///` dal pathname; tab untitled → **blob URL** col contenuto corrente (file
  virtuale, candidato per il requisito 1 — da verificare a runtime, Chromium accetta
  blob/data URL nel DownloadURL ma non c'è fonte diretta per il caso taskbar).
- Blob revocato al dragstart successivo e allo smontaggio, NON al dragend (con CF_HDROP
  differito il target può materializzare il file dopo la fine del gesto).
- Log `ENTER` del dragend esteso con `dropEffect`: serve a verificare se per i drop
  ESTERNI accettati arriva `'copy'` (base del futuro gate "copia esterna → niente
  detach/nuova finestra"; per i drag interni resta 'none', electron#42252). Il gate NON è
  ancora implementato in questo spike: al drop su desktop sono ATTESI entrambi gli effetti
  (copia + nuova finestra) — stato transitorio noto, si decide il gate coi dati del test.
- Parse SFC: ALL OK.

**Stato: DA TESTARE (spike round 7).**

**Retest spike 7 (utente, 2026-07-03):**
- Taskbar: NO, né tab salvata né untitled — ipotesi "basta CF_HDROP differito" FALSIFICATA.
- Copia su desktop: OK sia salvata (copia file) sia untitled (scrive file dal blob) →
  DownloadURL/blob funzionano, requisito "drop su Explorer/desktop = copia" già coperto.
- `dropEffect` al dragend su drop esterno accettato: `'copy'` (round-trip esterno vivo).
  Punto 5 (zona che rifiuta) riportato con lo stesso log `'copy'` — da ri-verificare con
  una zona che mostri davvero il divieto (sospetto test su target che accettava).
- Reorder invariato.

**Spike 7b (2026-07-03):** aggiunto `setData('text/uri-list', <stesso URI>)` accanto al
DownloadURL (VS Code lo imposta; percorso Chromium SetURL → CFSTR_INETURL + shortcut .url
virtuale FILEDESCRIPTOR). Test discriminante parallelo richiesto all'utente: trascinare un
LINK da Chrome/Edge sopra la taskbar — dice se lo stock Chromium può attivare lo
spring-loading su questa macchina (se no, VS Code usa qualcosa di nativo/patchato e serve
ricerca sulle patch Electron di VS Code). Parse SFC: ALL OK.

**Stato: DA TESTARE (spike round 7b).**

**Retest 7b (utente, 2026-07-03):** taskbar ancora NO (con DownloadURL + uri-list);
drag di un LINK da Chrome stock → taskbar SÌ (= lo stock Chromium può attivarla, niente
magia VS Code); drop su zona che rifiuta davvero (calcolatrice) → `dropEffect: 'none'` +
nuova finestra (gate confermato: 'copy' = consumato esterno, 'none' = detach). Nessuna
regressione reorder.

**Ricerca su sorgente Chromium/VS Code (Agent-Search, 2026-07-03, fonti primarie):**
- `text/uri-list` da JS → `DropData.url_infos` (data_transfer_util.cc, percorso IDENTICO
  al drag di un link) → `SetURLs` (os_exchange_data_provider_win.cc): MozUrl + shortcut
  `.url` virtuale SINCRONO (FILEDESCRIPTOR+FILECONTENTS) + CFSTR_INETURL + CF_UNICODETEXT.
- `DownloadURL` → `SetDownloadFileInfo`: CF_HDROP delay-rendered + **`SetAsyncMode(TRUE)`
  sull'INTERO IDataObject**. Non sopprime gli altri formati, ma marca tutto il drag come
  asincrono → indiziato principale dello spring-loading spento (correlazione, la taskbar
  è closed-source).
- VS Code (`dnd.ts`, verbatim): `DownloadURL` SOLO per schema `file:`; le tab UNTITLED
  impostano solo `text/uri-list` con URI `untitled:...` → coerente: l'untitled VS Code
  attiva la taskbar senza DownloadURL. Contraddizione residua: la tab SALVATA VS Code ha
  entrambi i formati e (riferito dall'utente) attiva comunque la taskbar — nessuna patch
  Electron custom di VS Code trovata a spiegarlo; da ri-verificare con test mirato.

**Spike 7c (2026-07-03):** rimosso `DownloadURL` (e blob), tenuto SOLO `text/uri-list`
(saved → `file:///...`; untitled → `marktext-untitled:<nome>`, come lo schema `untitled:`
di VS Code). Replica esatta del drag-link verificato. Effetto collaterale transitorio:
drop su desktop/Explorer = shortcut `.url`, non più copia del file (trade-off da decidere
coi risultati). Parse SFC: ALL OK.

**Stato: DA TESTARE (spike round 7c).**

**Retest 7c (utente, 2026-07-03): FAIL — taskbar NO per salvata E untitled anche con solo
`text/uri-list` (replica formati drag-link). VS Code: spring OK sia salvata sia untitled.
Nessuna regressione (reorder, migrazione, detach). L'ipotesi "questione di formati del
dataTransfer" è quindi INSUFFICIENTE: con formati identici (da sorgente) al drag-link di
Chrome — che sulla stessa macchina attiva la taskbar — il nostro drag resta inerte.
Variabili residue: (a) configurazione finestra/app MarkText (frameless verificato:
`frame:false`, no `transparent`, flag ok); (b) regressione Electron 39 (VS Code usa un
Electron più vecchio). Prossimo passo: test-harness Electron 39 minimale fuori da
MarkText (vedi sotto).**

## Harness Electron 39 minimale (2026-07-03) — ESITO E STRADA DA PERCORRERE

Harness in scratchpad (2 finestre: framed + frameless, stessa Electron 39 del progetto,
ZERO codice MarkText; 4 sorgenti di drag: A link nativo, B testo, C div con
`text/uri-list` file:///, D div con SOLO MIME custom).

**Risultato test utente (2026-07-03): spring-loading taskbar SÌ per TUTTI (A, B, C, D) in
ENTRAMBE le finestre.**

Conclusioni certe:
- **Electron 39 SCAGIONATO** (stessa versione, stessa macchina, funziona).
- **Frameless SCAGIONATO** (la finestra `frame:false` fa spring uguale).
- **Payload SCAGIONATO** (perfino il solo MIME custom D fa spring → i round 7/7b/7c sui
  formati erano fuori strada: qualunque payload va bene).
- → **La causa è DENTRO MarkText** (vale anche per il drag di testo semplice, quindi è
  qualcosa di GLOBALE alla pagina, non il dragstart delle tab).

**Indiziato principale** (coerente con electron#42252, stessa famiglia del BUG-DROP):
gli handler `dragover` che fanno `preventDefault` dentro la pagina durante il gesto —
nell'harness non ce ne sono e tutto funziona; in MarkText ce ne sono almeno tre che
coprono quasi tutta la superficie: (1) **Muya** (`dragDropCtrl.js`, accetta qualsiasi
drag sull'editor come testo → preventDefault sul dragover, vale anche per i drag di
TESTO); (2) `@dragover.prevent`/`@dragenter.prevent` sulla `ul.v2-tabs`; (3) eventuali
handler globali anti-navigazione file-drop (da cercare). Meccanismo sospettato: uscire
dalla finestra dopo che un dragover è stato "accettato" corrompe lo stato OLE del gesto
(`CompleteDragExit` azzera `current_drag_data_`) → la taskbar vede un drag senza stato.
Nota di cautela: VS Code ha comunque drop-target interni e fa spring → probabile che
conti COME/QUANDO si fa preventDefault (es. solo mentre si è sopra il target vs
globalmente, o la gestione di dragleave), non la sola presenza.

**Piano prossima sessione (bisezione, ordine):**
1. Harness: aggiungere `window.addEventListener('dragover', e => e.preventDefault())`
   → se lo spring muore, meccanismo CONFERMATO in isolamento (5 minuti).
2. Harness: varianti — preventDefault solo su un sotto-div (uscendo dalla finestra da
   un'area senza handler), poi con un contenteditable stile Muya → capire la condizione
   esatta che corrompe (sempre? solo se l'ULTIMO dragover prima dell'uscita era
   prevented? solo senza dragleave pulito?).
3. MarkText: bisezione speculare — disattivare temporaneamente i listener dragover di
   Muya (`dragDropCtrl`), poi i `.prevent` della tabbar, e ritestare il drag di TESTO e
   di TAB sulla taskbar → individuare il/i colpevole/i reale/i.
4. Col colpevole confermato, progettare il fix vero (es. preventDefault condizionale
   solo quando serve davvero accettare, pattern VS Code da confrontare su dnd.ts/
   dropTarget) — NON riapplicare i tentativi sui formati (7/7b/7c, falsificati).
5. Poi riprendere: gate finale desktop (dropEffect 'copy'/'none', dati già validati),
   decisione DownloadURL sì/no per la copia su Explorer (dipende dall'esito taskbar),
   task4 (indicatore cross-finestra), task5 (cleanup dipendenze).

Harness: `scratchpad/taskbar-drag-test/` (main.js + index.html) — NOTA: lo scratchpad è
per-sessione, alla prossima sessione RICREARLO (contenuto integrale ricostruibile da
questo worklog: 2 BrowserWindow ±frame, pagina con link/testo/div uri-list/div custom).

**Stato task3: detach+migrazione COMPLETI e testati; taskbar = causa localizzata dentro
MarkText, bisezione pianificata (punti 1-4 sopra); spike 7c ancora nel codice
(uri-list senza DownloadURL) in attesa della decisione finale.**

## Stato task: detach/migrazione funzionanti (salvo caso ultima-tab, fix round 6 pianificato); indagine taskbar in corso

## Test

DA TESTARE lato utente (OBBLIGATORIO), su Windows, `npm run dev` + DevTools renderer:
1. Trascinare una tab fuori da qualunque finestra (es. sul desktop) e rilasciare: si apre
   una nuova finestra con quella tab, contenuto corretto (incluso caso dirty/non salvato).
2. Ripetere con tab untitled (mai salvata) e con tab con modifiche non salvate: verificare
   che il contenuto arrivi intatto nella nuova finestra (flush pre-save rispettato).
3. Tab sorgente rimossa correttamente dalla finestra originale, nessuna tab
   fantasma/duplicata.
4. Rilascio sopra un'altra finestra MarkText esistente: deve attivarsi il path esistente
   di dirottamento (`mt::receive-detached-tab`, territorio task4), NON il detach in nuova
   finestra — verificare che non si apra una finestra in più in questo caso.
5. Rilascio dentro la finestra propria ma fuori dalla tabbar (es. sopra l'editor): nessuna
   azione, drag annullato (comportamento invariato da task2).
6. Reorder task2 (dentro la tabbar, anche multi-row) non deve essere regredito dal
   refactor del ramo `if/else` in `onTabDragEnd`.
7. Console pulita da log `[DEBUG drag-html5-dnd-task2]`; compare SOLO
   `[DEBUG drag-html5-dnd-task3]` nel ramo detach, da rimuovere a test passato.
