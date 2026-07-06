# drag-html5-dnd-task1b — worklog

## Avanzamento

- [x] Ri-grep in `tabs.vue`: confermare posizioni `app-region`, struttura template, presenza spike task1.
      Confermato via grep+read (2026-07-02) in `src/renderer/src/components/editorWithTabs/tabs.vue`:
      struttura `.v2-tabbar` (riga ~2) > `.v2-tabbar-scroll` (riga ~13, `ref="tabContainer"`,
      `@mouseenter="onTabsEnter"`) > `ul.v2-tabs` (`ref="tabDropContainer"`) con `li.v2-tab`
      (righe ~20-56); `.v2-topright` riga ~93. CSS `.v2-tabbar` righe ~792-805 con
      `-webkit-app-region: drag`/`app-region: drag`; `.v2-tabbar-scroll` righe ~940-952;
      `ul.v2-tabs` righe ~959-976 (`no-drag`); `.v2-tab` righe ~979-1003 (`no-drag`). Spike task1
      ancora presente: `draggable="true"` + `@dragstart="onTabDragStartSpike(file)"` (righe ~30/34),
      funzione `onTabDragStartSpike` (script, righe ~267-269). Nessuna deviazione sostanziale dai
      "Fatti già verificati" del plan (solo shift di poche righe, atteso).
- [x] Template: overlay `.v2-tabbar-drag-region` come primo figlio di `.v2-tabbar`.
      Aggiunto `<div class="v2-tabbar-drag-region" />` come primo figlio di `.v2-tabbar`, prima di
      `.v2-tabbar-scroll` (template, subito dopo l'apertura di `.v2-tabbar` con `@mouseleave`), con
      commento che spiega il pattern VS Code (overlay fratello, mai antenato delle tab) e il
      riferimento al GATE task1b / DRAG-TASK.md.
- [x] CSS: rimuovere `app-region: drag` da `.v2-tabbar`, aggiungere regola overlay, aggiornare commenti stantii.
      Rimosse le due righe `-webkit-app-region: drag; app-region: drag;` da `.v2-tabbar` (ex righe
      ~804-805), sostituito il commento sopra con nota sullo spike task1b (drag OS non più su
      `.v2-tabbar`, ora fornito dall'overlay fratello). Aggiunta nuova regola `.v2-tabbar-drag-region`
      (position:absolute; inset:0; app-region:drag) subito dopo `.v2-tabbar-scroll`, con commento su
      assenza z-index necessario (ordine sorgente) e reversibilità. Aggiornato il commento stantio in
      `.v2-tabbar-scroll` ("Scroll-area resta DRAG...") per riflettere che ora la zona drag la
      fornisce l'overlay sottostante.
- [x] Diagnostica: handler spike `mousedown` su `.v2-tab` con log.
      Aggiunto `@mousedown="onTabMouseDownSpike(file)"` su `li.v2-tab` (template, accanto a
      `@dragstart`) e funzione `onTabMouseDownSpike(file)` nello script (accanto a
      `onTabDragStartSpike`), che fa `console.log('[SPIKE drag-html5-dnd] mousedown fired', file.id)`.
      Marcata come spike temporanea/reversibile nel commento.
- [x] Verifica statica: parse SFC di `tabs.vue`.
      Eseguito script Node ad-hoc (scratchpad, non committato) con `@vue/compiler-sfc`
      (`parse` + `compileScript` + `compileTemplate`): nessun errore, `ALL OK`.
- [x] Riportare esito test manuale runtime (PASS/FAIL) — GATE per task2-5. **PASS** (vedi sezione Test).

## Test

DA TESTARE lato utente (OBBLIGATORIO, gate bloccante), su Windows, finestra in stato normale
(non massimizzata/minimizzata), `npm run dev` + DevTools renderer. Vedere la sezione
"Verifica richiesta" del plan `drag-html5-dnd-task1b-plan.md` per i 6 punti di controllo:
1. Trascinare una tab → deve comparire `[SPIKE drag-html5-dnd] mousedown fired <id>` poi
   `[SPIKE drag-html5-dnd] dragstart fired <id>`; la finestra NON deve spostarsi.
2. Trascinare dalla zona vuota della tabbar → la finestra deve ancora spostarsi (drag OS via overlay).
3. Doppio-click sulla zona vuota della tabbar → massimizza/ripristina (HTCAPTION nativo conservato).
4. Click normale su tab, click su ×, "+", bottoni topright → tutti ancora funzionanti.
5. Reorder tab via dragula → verificare che funzioni ancora (possibile interferenza attesa/accettabile
   con `draggable="true"` in parallelo, NON è un FAIL del gate — dragula verrà rimosso in task2-5).
6. Multi-row: hover-expand della bar ancora funzionante.

Esito da riportare qui: **PASS** o **FAIL** (con indicazione del punto che fallisce).

**Esito test manuale runtime (utente, 2026-07-02): PARZIALE — overlay OK, dragstart ancora assente.**
1. Trascinando una tab: compare SOLO `[SPIKE drag-html5-dnd] mousedown fired <id>`, NIENTE `dragstart`.
   La finestra NON si sposta più (nel task1 si spostava) → l'overlay ha risolto l'intercettazione
   del window-drag OS: il gesto ora arriva al DOM.
2. Drag da zona vuota tabbar → finestra si sposta: OK.
3. Doppio-click zona vuota → maximize/ripristino: OK.
4. Click tab / × / + / bottoni topright: OK.
5. Reorder dragula: funziona, nessun errore.
6. Multi-row hover-expand: OK.

**Analisi post-test (orchestratore, 2026-07-02):** il blocco residuo di `dragstart` NON è più
l'app-region ma dragula stesso: `node_modules/dragula/dragula.js` riga ~113, funzione `grab()`,
esegue `e.preventDefault()` sul `mousedown` (fix della loro issue #155) — e in Chromium il
preventDefault sul mousedown impedisce l'avvio del drag HTML5 nativo (`dragstart` mai generato).
Coerente con i sintomi: mousedown loggato (i listener DOM girano prima del preventDefault-effetto),
nessun dragstart, finestra ferma, reorder dragula funzionante.
Verifica decisiva proposta: disabilitare TEMPORANEAMENTE l'init dragula (`drake = dragula(...)`,
`tabs.vue` riga ~637) e ripetere il punto 1 — se `dragstart` scatta, gate PASS (dragula viene
comunque rimosso nei task2-5); reorder assente durante questo test è atteso.

**Verifica decisiva eseguita (orchestratore + utente, 2026-07-02): GATE PASS.**
Aggiunto `drake.destroy()` subito dopo l'init dragula (spike temporaneo, marcato nel codice) →
ritestato il punto 1: in console compaiono ORA sia `[SPIKE drag-html5-dnd] mousedown fired <id>`
sia `[SPIKE drag-html5-dnd] dragstart fired <id>`. La finestra non si muove.

**Conclusione — il FAIL del task1 aveva DUE cause sovrapposte, entrambe confermate:**
1. `-webkit-app-region: drag` sull'ancestor `.v2-tabbar` (risolta con l'overlay fratello
   "alla VS Code", variante A — sufficiente, variante B non necessaria);
2. `e.preventDefault()` di dragula sul `mousedown` (`dragula.js` ~113), che in Chromium
   sopprime il dragstart nativo (risolta rimuovendo dragula; nei task2-5 va rimosso del tutto:
   dragula e HTML5 DnD NON possono coesistere sulla stessa tab).

**Task2-5 SBLOCCATI**, con due vincoli nuovi da riportare nei loro plan:
- l'overlay `.v2-tabbar-drag-region` diventa struttura definitiva (non più spike);
- la rimozione di dragula deve essere completa fin dal primo task che introduce il DnD nativo
  (niente fase di coesistenza); gli spike temporanei (log mousedown/dragstart, `drake.destroy()`)
  vanno rimossi/sostituiti dall'implementazione reale.
