# drag-html5-dnd-task1 — worklog

## Avanzamento

- [x] Ri-confermare classi `-webkit-app-region`/`no-drag` attuali in `tabs.vue`.
      Confermato via grep (2026-07-02) in `src/renderer/src/components/editorWithTabs/tabs.vue`:
      - `.v2-tabbar` (riga ~795-796): `-webkit-app-region: drag` / `app-region: drag`.
      - `.v2-tabs` (ul, riga ~965-966): `no-drag`.
      - `.v2-tab` (riga ~981-983): `no-drag`.
      - `.v2-tab-new-li` (riga ~1110-1111): `no-drag`.
      - `.v2-topright-clone` (riga ~1206-1207): `no-drag`.
      - `.v2-tr-plus` (riga ~1238-1239): `no-drag`.
      - `.v2-tr-btn` (riga ~1288-1289): `no-drag`.
      Nessuna deviazione rispetto a quanto descritto in `DRAG-TASK.md` §3/§4.1 e nei "Fatti già verificati" del plan.
- [x] Aggiungere spike `draggable="true"` + handler `dragstart` minimale su `.v2-tab`.
      Modifica in `src/renderer/src/components/editorWithTabs/tabs.vue`:
      - Template (`<li>` `.v2-tab`, ~riga 20-34): aggiunto `draggable="true"` e `@dragstart="onTabDragStartSpike(file)"`.
      - Script (`<script setup>`, subito dopo `selectFile`, ~riga 262-267): aggiunta funzione
        `onTabDragStartSpike(file)` che fa SOLO `console.log('[SPIKE drag-html5-dnd] dragstart fired', file.id)`.
      Nessuna logica di drag reale, nessun tocco al cablaggio dragula (init `dragula(...)`, handler `drag`/`dragend`/`drop`,
      `tabsRenderKey`, `recomputePinnedTab`, `layoutLockUntil`) — verificato via grep: dragula continua a funzionare
      esattamente come prima, in parallelo allo spike.
- [x] Verificare staticamente (parse SFC).
      Verificato con `@vue/compiler-sfc` (`parse`, `compileTemplate`, `compileScript`) via script Node ad-hoc:
      parse OK, template compilato OK, script compilato OK (nessun errore).
- [ ] Riportare esito test manuale runtime (PASS/FAIL) — GATE per task2-5. **DA TESTARE** (vedi sotto).

## Test

DA TESTARE lato utente (OBBLIGATORIO, gate bloccante), su Windows, finestra in stato normale (non massimizzata/minimizzata):
1. Avviare l'app in dev (`npm run dev`), aprire DevTools del renderer.
2. Trascinare una tab con il mouse tenendo premuto (click-and-drag su una `.v2-tab`).
3. Osservare la console DevTools:
   - Se compare il log `[SPIKE drag-html5-dnd] dragstart fired <tab.id>` → l'evento nativo `dragstart` si attiva correttamente → esito **PASS** (la migrazione può procedere con task2-5).
   - Se NON compare alcun log e invece la finestra stessa inizia a spostarsi (o il gesto viene ignorato senza log) → il window-drag OS ha "mangiato" l'evento → esito **FAIL** (fermarsi, non procedere con task2-5, riportare all'orchestratore per rivalutare l'approccio).
4. Verificare anche un punto di controllo su `.v2-tabbar` stesso (area drag OS, fuori dalle tab) per capire dove esattamente si ferma l'evento se si ferma (es. provare a iniziare il drag leggermente fuori dalla pill della tab, sulla zona app-region:drag adiacente).
5. Riportare qui sotto l'esito esplicito.

**Esito test manuale runtime (utente, 2026-07-02): FAIL.**
Nessun log `[SPIKE drag-html5-dnd] dragstart fired` in console. Trascinando la tab la FINESTRA si sposta (comportamento window-drag OS), non l'evento HTML5 `dragstart`. Confermato il rischio #1 di `DRAG-TASK.md §3`: `-webkit-app-region: drag` sul contenitore `.v2-tabbar` intercetta il gesto prima che Chromium possa promuoverlo a `dragstart` nativo, nonostante `.v2-tab` abbia già `no-drag`.

**Gate NON superato: task2-5 di questa feature restano bloccati.** Da investigare la causa esatta (CSS `no-drag` non rispettato in questo contesto vs. logica custom di window-drag nel main) prima di decidere se esiste una mitigazione o se si passa alla Strada B (`DRAG-TASK.md §3bis`: restare su dragula + raise-finestre koffi).
