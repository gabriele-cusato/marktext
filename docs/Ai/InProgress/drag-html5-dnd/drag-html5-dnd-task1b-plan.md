# drag-html5-dnd-task1b — Spike mitigazione: drag region overlay "alla VS Code"

## Obiettivo

Il task1 (spike rischio #1) è FALLITO: `draggable="true"` su `.v2-tab` non produce mai `dragstart` quando l'ancestor `.v2-tabbar` ha `-webkit-app-region: drag` — il window-drag OS intercetta il gesto nonostante `no-drag` su `ul.v2-tabs` e `.v2-tab` (worklog task1, DECISIONS.md 2026-07-02).

Questo task testa la mitigazione raccomandata dalla ricerca online (2026-07-02): ristrutturare la drag region come fa VS Code (verificato nel sorgente: `titlebarPart.ts` + `titlebarpart.css`) — le tab NON devono mai essere discendenti di un elemento `app-region: drag`. La zona drag diventa un overlay assoluto separato, fratello (non antenato) delle tab.

Questo task è un GATE (come task1): se dopo la ristrutturazione `dragstart` scatta → PASS, si sbloccano task2-5. Se FAIL → fermarsi e riportare all'orchestratore: è già deciso (DECISIONS.md 2026-07-02) che in quel caso si passa alla **variante B** (drag region solo sulle zone vuote della tabbar, mai sovrapposta ai rettangoli delle tab), con nuovo spike dedicato — NON implementarla in questo task.

## Ipotesi da testare (esplicita)

Il calcolo delle regioni drag OS dovrebbe essere identico a oggi (unione rect `drag` meno rect `no-drag`), ma il task1 dimostra che la relazione ancestor→discendente rompe il `dragstart` HTML5. L'ipotesi è che spostando `app-region: drag` su un overlay fratello (mai antenato delle `.v2-tab`), Chromium possa generare `dragstart` sulle tab. VS Code funziona così in produzione; non è però garantito sul nostro layout → per questo è uno spike, non il refactor.

## Prerequisiti bloccanti

- File letto e richiesto: `DRAG-TASK.md` (root progetto), §3, §4.1, §6 e "Stato decisioni".
- File letto e richiesto: `Docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1-worklog.md` (esito FAIL del task1 e spike ancora presente nel codice).
- File sorgente richiesto e leggibile: `src/renderer/src/components/editorWithTabs/tabs.vue`.
- Worklog di questo task: `Docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1b-worklog.md` (deve esistere, lo aggiorna Agent-Code).
- File/cartelle vietate: nessuna lettura/modifica di file fuori da quelli elencati in "File da toccare"; non leggere né modificare segreti esterni al repo.
- Target verifica: parse SFC statico + test manuale runtime OBBLIGATORIO dell'utente su Windows (determina l'esito del gate).
- Comandi version control: `Docs/Ai/DECISIONS.md` consente al manager solo `git status/diff` per verifiche operative; Agent-Code NON deve usare git, Visual SourceSafe `ss`, svn o altri comandi di version control.
- Se uno dei prerequisiti manca o è ambiguo, fermarsi senza modificare codice e aggiornare il worklog con il blocco.

## Skill da caricare

Caricare `coding-standard` prima di modificare codice. Se si compila/testa, caricare anche `build`.

## File da toccare SOLO per questo task

- `src/renderer/src/components/editorWithTabs/tabs.vue`
- `Docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1b-worklog.md`

## Fatti già verificati (2026-07-02, orchestratore — ri-grep per conferma, i numeri di riga possono shiftare)

Struttura attuale in `tabs.vue`:
- Template: `.v2-tabbar` (div radice, riga ~2) contiene `.v2-tabbar-scroll` (riga ~11, con `ref="tabContainer"` e `@mouseenter="onTabsEnter"`) che contiene `ul.v2-tabs` (`ref="tabDropContainer"`) con le `li.v2-tab`; poi `.v2-topright` (riga ~91, `ref="topRightEl"`). `.v2-tabbar` ha `@mouseleave="onTabbarLeave"`.
- CSS: `.v2-tabbar` riga ~794-820: `position: relative; z-index: 10; overflow: hidden; max-height: var(--v2-tab-h); -webkit-app-region: drag; app-region: drag;` + transition su max-height/box-shadow/padding-right + `display:flex`.
- `.v2-tabbar-scroll` riga ~940-952: `flex: 1; position: relative; overflow: visible;` — commento attuale dice "Scroll-area resta DRAG (eredita da .v2-tabbar)": andrà aggiornato.
- `ul.v2-tabs` riga ~959-976: `position: relative` + `no-drag`.
- `.v2-tab` riga ~979-1003: `position: relative` + `no-drag`.
- Altri `no-drag` esistenti: `.v2-tab-new-li`, `.v2-topright-clone`, `.v2-tr-plus`, `.v2-tr-btn` (verificati nel worklog task1).
- Spike task1 ANCORA presente e da conservare: template `draggable="true"` + `@dragstart="onTabDragStartSpike(file)"` (righe ~30/34), funzione `onTabDragStartSpike` (righe ~267-269).
- Ricerca online (Agent-Search 2026-07-02, fonti nel report): VS Code usa `div.titlebar-drag-region` con `position:absolute; top:0; left:0; width:100%; height:100%; -webkit-app-region: drag`, PREPENDED come primo figlio del container (che NON ha `drag`); gli elementi interattivi vengono dopo nel DOM (paint sopra) con `no-drag`. Le tab editor di VS Code vivono fuori da qualunque ancestor `drag`.

## Regole e invarianti rilevanti (da DRAG-TASK.md §4 — NON violarle)

- NON toccare il cablaggio dragula (init `dragula(...)`, handler `drag`/`dragend`/`drop`), `tabsRenderKey`, `recomputePinnedTab`, `layoutLockUntil`, `updateTabRowsLayout`: devono restare esattamente come sono.
- NON alterare proprietà che influenzano `offsetWidth`/`offsetTop` dei tab o dell'ul (la detection di wrap multi-row li misura). L'overlay deve essere `position: absolute` → fuori dal flow → nessun impatto sulle misure. Non aggiungere padding/margin/border a elementi esistenti.
- Inv. 1 (MEDIUM-TASK): `.v2-topright` resta `absolute`; non toccare la riserva `padding-right` (gestita inline via JS).
- NON rimuovere i `no-drag` esistenti da `ul.v2-tabs`, `.v2-tab`, `.v2-tab-new-li`, `.v2-topright-clone`, `.v2-tr-plus`, `.v2-tr-btn`.
- Conservare lo spike task1 (`draggable="true"`, `onTabDragStartSpike`): serve per il test del gate.
- Modifica reversibile: se il gate fallisce, deve bastare rimuovere l'overlay e ripristinare le 2 righe `app-region: drag` su `.v2-tabbar`.
- `.v2-tabbar` ha `overflow: hidden` e anima `max-height` (40px ↔ 260px in multi-row): l'overlay con `inset: 0` segue automaticamente l'espansione — non fissare height esplicite.
- Commenti nel codice: in italiano, forma all'infinito, coerenti con lo stile del file (commenti densi con riferimenti B1/S7/T-ME ecc.).

## Sottoproblemi in ordine

1. Ri-grep in `tabs.vue`: confermare posizioni attuali di `app-region` (drag e no-drag), struttura template `.v2-tabbar` > `.v2-tabbar-scroll` / `.v2-topright`, presenza spike task1. Se deviazioni sostanziali dai "Fatti già verificati" → fermarsi e annotare nel worklog.
2. Template: aggiungere `<div class="v2-tabbar-drag-region" />` come PRIMO figlio di `.v2-tabbar` (prima di `.v2-tabbar-scroll`), con breve commento che spiega il pattern VS Code (overlay fratello, mai antenato delle tab) e il perché (gate task1b, riferimento DRAG-TASK.md).
3. CSS: rimuovere le due righe `-webkit-app-region: drag; app-region: drag;` da `.v2-tabbar` (aggiornare il commento sopra di esse, righe ~802-803) e aggiungere la nuova regola:
   ```css
   .v2-tabbar-drag-region {
     position: absolute;
     inset: 0;
     -webkit-app-region: drag;
     app-region: drag;
   }
   ```
   Nessun `z-index`: i fratelli successivi (`.v2-tabbar-scroll` relative, `.v2-topright` absolute) vengono dopo nell'ordine sorgente → dipingono e ricevono hit DOM sopra l'overlay. Aggiornare anche il commento stantio in `.v2-tabbar-scroll` ("Scroll-area resta DRAG (eredita da .v2-tabbar)") → ora la zona drag la fornisce l'overlay sottostante.
4. Diagnostica spike: aggiungere su `.v2-tab` un handler temporaneo `@mousedown="onTabMouseDownSpike(file)"` con `console.log('[SPIKE drag-html5-dnd] mousedown fired', file.id)` accanto a `onTabDragStartSpike` (stesso stile, chiaramente marcato SPIKE temporaneo). Serve a distinguere, in caso di nuovo FAIL, se gli eventi mouse arrivano al DOM o vengono mangiati prima.
5. Verifica statica: parse SFC di `tabs.vue` con `@vue/compiler-sfc` (parse + compileTemplate + compileScript), come fatto nel task1.
6. Aggiornare il worklog: `[x]` sui sottoproblemi, tag `DA TESTARE` sul gate runtime.

## Verifica richiesta

- Parse SFC di `tabs.vue` senza errori.
- Test manuale (utente, Windows, finestra in stato normale, `npm run dev` + DevTools):
  1. Trascinare una tab: DEVE comparire `[SPIKE drag-html5-dnd] mousedown fired <id>` e poi `[SPIKE drag-html5-dnd] dragstart fired <id>`; la finestra NON deve spostarsi.
  2. Trascinare dalla zona vuota della tabbar (fuori dalle pill): la FINESTRA deve ancora spostarsi (drag OS via overlay).
  3. Doppio-click sulla zona vuota della tabbar: la finestra deve massimizzare/ripristinare (comportamento nativo HTCAPTION conservato).
  4. Click normale su tab (selezione), click su ×, click su "+", bottoni topright (⌘, 📂, −, □, ×): tutti ancora funzionanti.
  5. Reorder tab via dragula: verificare che funzioni ancora (trascinamento pill con mirror). NB: con `draggable="true"` + dragula in parallelo il comportamento potrebbe interferire ORA che dragstart scatta — se dragula risulta rotto durante lo spike, annotarlo come atteso/accettabile (dragula verrà rimosso nei task2-5), NON è un FAIL del gate.
  6. Multi-row: con molte tab aperte, hover-expand della bar ancora funzionante (mouseenter su `.v2-tabbar-scroll`).
- Esito da riportare nel worklog: **PASS** (dragstart scatta, drag finestra su zona vuota OK → sbloccare task2-5 con questa struttura) oppure **FAIL** (specificare quale punto fallisce; fermarsi e riportare all'orchestratore).
