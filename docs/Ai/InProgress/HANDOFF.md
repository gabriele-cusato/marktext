# HANDOFF — stato sessione 2026-07-12/13 e ripresa

Ultima scrittura: 2026-07-13. Se questa data non è recente, non considerare il file attendibile.

Scopo: riprendere da qui nella prossima sessione. Leggere questo file, poi `docs/Ai/DECISIONS.md`
e i worklog citati. TODO.md è aggiornato.

## Cosa è stato implementato in questa sessione (tutto buildato, build+42 unit test verdi)

| Feature/task | Stato | Esito test utente |
|---|---|---|
| font-registry-fallback | fatto | combo font si popola (PC principale, ramo primario) |
| menu-shortcut-overhaul Parte E (label da binding reali) | fatto | OK |
| menu-shortcut-overhaul Parte G (clamp crash Source→MD) | fatto | OK, crash sparito |
| menu-shortcut-overhaul Parte F (Ctrl+Backspace code block) | fatto (word-delete nel ramo codeContent) | **OK, chiuso dall'utente** |
| menu-shortcut-overhaul Parte C (menu @ inline) | fatto | OK |
| recent-files + recent-files-icon | fatti | OK |
| format-toggle-off (multi-blocco stile Word) | fatto | OK; bug picker singolo-blocco NON riprodotto → considerato chiuso |
| preferences-refinement task1 (censimento: size mini, watcherUsePolling esposto+ricerca, session snapshot i18n, commento morto) | fatto | OK |
| preferences-refinement task2 (combo) | fix applicati ma **BUG ANCORA APERTO** (vedi sotto) | KO |
| locales-align (9 lingue, parità 0/0, +chiavi quickInsert inline, −orfane) | fatto | OK dopo rigenerazione min.json |
| window-minwidth-hamburger (550px/soglia 700) | fatto + fix popover (Teleport su body) | OK |
| folder-search task1-4 (handler rg+unit test, finestra, sidebar, overlay+icona) | fatti + fix overlay (bottone "…" dialog cartella, esempi esclusioni) | OK di base; spazi nei percorsi sicuri (spawn con array argomenti) |
| tabs-squared | **NON DA FARE** (decisione utente 2026-07-12), TODO chiuso | — |
| image-drag-in-doc | NON iniziato — da fare per ULTIMO, dopo commit preventivo dell'utente | — |

Fix trasversali: `.min.json` locale stantii (il runtime li preferisce ai `.json`; `npm run build`
NON esegue `minify-locales` — dopo aver toccato le locale eseguire SEMPRE `npm run minify-locales`);
warning intlify "HTML in message" fixati alla radice (rimossi `<userData>` e `<u>…</u>` dalle
stringhe, 2 chiavi × 9 lingue).

## BUG APERTO 1 — combo box Preferences (task2, priorità alta)

Sintomo: aprendo una combo nelle Preferences senza scrollare, le voci non si vedono (riappaiono
scrollando, spuntando sopra il riquadro). Riguarda TUTTE le combo (conferma utente).

Dati runtime raccolti (snippet console, finestra Preferences 950×650):
- Il popper APERTO risulta `data-popper-placement=bottom-start`, coordinate corrette sotto il
  trigger e SEGUE lo scroll (trigger top 578 → popper 618..692; dopo scroll trigger −21 → popper 18).
- Quindi né flip né z-index: il popper sfora il bordo BASSO della finestra (692 > 650) e resta
  tagliato dal bordo della BrowserWindow delle Preferences (finestra separata, `setting.js`,
  650px di altezza).

Tentativi già fatti (in `prefComponents/common/select/index.vue` + `common/fontTextBox/index.vue`):
1. `fallback-placements` limitati a bottom/top + modifier `flip` con `rootBoundary:'viewport'` → KO.
2. `placement:'bottom-start'` + `flip` DISABILITATO + `preventOverflow` `rootBoundary:'viewport',
   tether:false` → KO (placement giusto ma niente clamp verticale).
3. Aggiunto `altAxis:true` a preventOverflow (per popper bottom l'asse verticale è l'altAxis,
   off di default) → **utente riporta ancora KO** — MA da verificare se il test è avvenuto dopo
   un riavvio completo di `npm run dev` (l'ultima build è passata; hot-reload non sempre basta).

Prossimi passi in ordine:
1. Far riavviare COMPLETAMENTE il dev e rimisurare con lo snippet (in `preferences-refinement-
   task2-combo-overflow-worklog.md` c'è la storia; snippet: setTimeout 4s che stampa placement,
   rect del popper aperto e rect di `document.activeElement`). Se il popper ora resta dentro la
   finestra ma il bug visivo persiste, il taglio avviene altrove (guardare `overflow` di
   `.pref-container`/`.pref-setting` e in quale nodo body viene teleportato il popper).
2. Verificare che le `popper-options` arrivino DAVVERO all'istanza popper a runtime (sorgente già
   verificato: `element-plus/es/components/popper/src/utils.mjs` → `buildPopperOptions` accoda i
   modifier utente e popper.js li merge per nome; ma non è stato provato a runtime).
3. Se popper-options risultano ignorate: alternative da valutare — `:teleported="false"` (dropdown
   inline nel flusso scrollabile), oppure aumentare l'altezza min della finestra Preferences,
   oppure `max-height` più bassa della dropdown via `popper-class`. Preferire sempre il fix alla
   radice (DECISIONS 2026-07-07, niente pezze z-index/margini).

## BUG APERTO 2 — warning `normalizeHeaderText` (nuovo, da tracciare)

`exportMarkdown.js:189 normalizeHeaderText: ATX heading regex did not match:
ag-0-1jtc5k9ffag-1-1jtc5k9ff# tutto beneasdfasdf...`
Il testo del blocco heading contiene id interni (`ag-0-<suffix>` e `ag-1-<suffix>`, stesso suffisso)
concatenati PRIMA del `# …`. Il warning è la spia (fallback già presente); il difetto è la
contaminazione del testo. REPRO NON ANCORA NOTA: chiesto all'utente in quale momento compare
(digitazione? salvataggio/snapshot? chiusura tab? dopo highlight di ricerca?) — risposta non
ancora arrivata. Quando c'è la repro: Agent-Explorer su come `block.children[0].text` possa
contenere chiavi di blocco (sospetti da verificare: percorso export/snapshot che legge dal DOM,
marker di highlight ricerca, merge di blocchi).

## Pulizie e chiusure rimaste

1. **Rimozione log di debug** (fare a bug combo chiuso, o anche subito — i fix log-first sono
   confermati): tutti i `[PARTE-F-DEBUG]` (keyboard.js, backspaceCtrl.js — elenco completo dei
   punti in `menu-shortcut-overhaul/worklog-parteF.md`) e `[FMT-TOGGLE-DEBUG]` (formatCtrl.js,
   formatPicker/index.js — elenco in `format-toggle-off/format-toggle-off-worklog.md`).
   ATTENZIONE: in backspaceCtrl.js un `else` finale esiste SOLO per un log — rimuovere anche
   l'else vuoto. Poi build.
2. **Sezioni "Test" dei worklog**: riportare gli esiti utente della tabella sopra nei worklog
   che ancora non li hanno (li scrive l'orchestratore, non un agente).
3. **TODO.md**: spuntare le voci completate dopo la conferma finale dei test (locales,
   preferences censimento, icona recenti, minwidth+hamburger, toggle format, folder search…;
   combo resta aperta).
4. **Agent-Summary**: a test confermati, riassumere le feature concluse in
   `docs/Ai/Completed/<feature>/` + aggiornare `Completed/index.md` (feature: recent-files,
   menu-shortcut-overhaul, format-toggle-off, font-registry-fallback, locales-align,
   window-minwidth-hamburger, folder-search, preferences-refinement — quest'ultima SOLO quando
   la combo è chiusa).
5. **image-drag-in-doc**: ultimo task rimasto (TODO.md); farlo SOLO dopo che l'utente ha
   committato (sua richiesta esplicita: commit preventivo prima della modifica pericolosa).

## Note operative per la prossima sessione

- Siamo sul PC principale: build/dev consentiti ma build solo per modifiche grandi
  (DECISIONS 2026-07-12). L'utente ha concesso in QUESTA sessione un bypass una-tantum dei gate
  OK per gli Agent-Code (non registrato in DECISIONS su sua richiesta): NON è più valido, si
  torna al gate per ogni Agent-Code (DECISIONS 2026-07-03).
- Git: solo verifiche read-only, mai commit/push (DECISIONS 2026-07-01). C'è MOLTO lavoro non
  committato: suggerire subito all'utente un commit.
- Dopo modifiche alle locale: `npm run minify-locales` obbligatorio (i `.min.json` mascherano i
  `.json`). Candidata nota permanente in Docs/Ai/Notes o DECISIONS.
- Unit test: `npm run test:unit` (vitest, 42 verdi incluso `dataCenter-search-in-folder.test.js`).
