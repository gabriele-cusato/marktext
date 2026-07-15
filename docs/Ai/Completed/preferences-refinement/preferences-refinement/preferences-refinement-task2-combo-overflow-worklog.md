# preferences-refinement — task2 — worklog

Plan: `preferences-refinement-task2-combo-overflow-plan.md`.

## Avanzamento
- [x] Indagine: componente e causa esatta del clipping (teleport/overflow/popper)
  - Diagnosi (c) del plan confermata sul sorgente Element Plus 2.13
    (`node_modules/element-plus/es/components/popper/src/utils.mjs`, funzione `genModifiers`):
    il modifier `flip` di default riceve solo `{ padding: 5, fallbackPlacements }`, senza
    `boundary`/`rootBoundary` → popper.js usa il default `clippingParents` calcolato dagli
    ANTENATI DEL TRIGGER (`.pref-setting`, l'unico scrollabile). Confermato anche
    `fallbackPlacements` di default di `el-select`
    (`node_modules/element-plus/es/components/select/src/select.mjs:264-272`) =
    `['bottom-start','top-start','right','left']`.
- [x] Fix alla radice
  - Applicato nel wrapper unico `CurSelect` (`src/renderer/src/prefComponents/common/select/index.vue`):
    - `:fallback-placements="['bottom-start', 'top-start']"` — limita il flip a solo
      alto/basso (rimossi `right`/`left`, non pertinenti al layout verticale del pannello).
    - `:popper-options="{ modifiers: [{ name: 'flip', options: { rootBoundary: 'viewport' } }] }"`
      — forza il flip a considerare l'intera viewport invece dei soli antenati scrollabili.
      Verificato su sorgente (`components/popper/src/utils.mjs:4-14`, `deriveExtraModifiers`)
      che i modifier passati via `popper-options.modifiers` vengono accodati a quelli di default
      e poi mergiati per nome da popper.js (`mergeByName`): il nostro `rootBoundary` si aggiunge
      a `padding`/`fallbackPlacements` del flip di default senza sovrascriverli.
  - Stesso fix applicato a `fontTextBox` (`src/renderer/src/prefComponents/common/fontTextBox/index.vue`,
    `el-autocomplete`): SOLO `popper-options` (stesso oggetto `{modifiers:[{name:'flip',
    options:{rootBoundary:'viewport'}}]}`). `fallback-placements` NON applicata: verificato su
    sorgente (`node_modules/element-plus/es/components/autocomplete/src/autocomplete.mjs`) che
    `el-autocomplete` non espone quella prop (prende solo `popperClass`, `popperStyle`,
    `popperOptions`, `teleported`, `appendTo` da `useTooltipContentProps`, non `fallbackPlacements`).
  - Nessuna pezza z-index/margini/CSS: rispettata la regola DECISIONS 2026-07-07.
- [x] Verifica nessuna regressione sulle altre combo/popper (tooltip, color picker, ecc.)
  - Grep di tutti gli `el-select` in `prefComponents`: solo `common/select/index.vue` (il wrapper
    modificato) e riferimenti CSS in `spellchecker/index.vue` (nessun secondo componente
    `el-select` reale). Il wrapper è quindi punto unico confermato, coerente col plan.
  - Le altre popper (tooltip `InfoFilled`, color picker in theme) non usano `CurSelect` né
    `fontTextBox` e non sono state toccate.

## Scostamenti
- **Bypass autorizzato dall'utente (2026-07-12)**: il plan richiedeva una "Conferma runtime
  della diagnosi" (ispezionare `data-popper-placement` su `.el-select-dropdown` al primo open di
  una combo in basso, PC principale) PRIMA del fix, elencata tra i "Prerequisiti bloccanti". Su
  indicazione esplicita dell'orchestratore si è proceduto al fix senza questa conferma runtime,
  basandosi solo sulla diagnosi statica sul sorgente Element Plus (già ritenuta "causa più
  probabile" nel plan). Il test funzionale runtime resta comunque nella sezione Test sotto,
  DA TESTARE sul PC principale.

## Secondo giro (2026-07-12, dopo test utente) — fix rafforzato dall'orchestratore
- Test utente: bug ANCORA presente col primo fix. Misura runtime (snippet console): i popper
  aperti correttamente riportano `data-popper-placement=bottom-start`; quelli delle combo
  buggate restano in memoria con `top`/`top-start` → il flip si attiva comunque e ribalta il
  dropdown sopra il bordo alto della finestra. Limitare fallback/rootBoundary NON basta.
- Nuovo fix (in entrambi i wrapper `common/select/index.vue` e `common/fontTextBox/index.vue`):
  `placement: 'bottom-start'` esplicito + modifier `flip` DISABILITATO (`enabled: false`) +
  `preventOverflow` con `rootBoundary: 'viewport'` e `tether: false` — il dropdown si apre
  sempre verso il basso e viene traslato dentro la finestra se non c'è spazio (liste lunghe con
  trigger vicino al fondo). In `select/index.vue` anche `fallbackPlacements = ['bottom-start']`.

## Terzo giro (2026-07-13) — misura runtime decisiva + fix `altAxis`
- Test utente sul secondo fix: ANCORA KO. Nuova misura runtime (snippet console, finestra
  Preferences 950×650): il popper aperto risulta `data-popper-placement=bottom-start`,
  coordinate corrette sotto il trigger e SEGUE lo scroll (trigger top 578 → popper 618..692;
  dopo scroll trigger −21 → popper 18..92). Quindi né flip né z-index: il popper sfora il
  bordo BASSO della finestra (692 > 650) e resta tagliato dal bordo della BrowserWindow
  delle Preferences (finestra separata, 650px di altezza, `setting.js`).
- Causa del mancato clamp: per un popper con placement bottom l'asse verticale è l'asse
  ALTERNATIVO di `preventOverflow`, e `altAxis` è `false` di default → il modifier clampava
  solo in orizzontale. Fix: aggiunto `altAxis: true` alle opzioni `preventOverflow` in
  entrambi i wrapper (`common/select/index.vue`, `common/fontTextBox/index.vue`).
- Esito utente sul fix `altAxis`: riportato ancora KO, MA da verificare se il test è avvenuto
  dopo un riavvio COMPLETO di `npm run dev` (hot-reload non sempre riapplica le
  popper-options). Retest da riavvio pulito in corso (2026-07-13).

## Quarto giro (2026-07-13) — retest da riavvio pulito: diagnosi "bordo finestra" FALSIFICATA
Misura runtime dopo riavvio completo di `npm run dev` (viewport 835×920):
- Senza scroll: popper `bottom-start`, rect 618..692, trigger 578..602 → popper DENTRO il
  viewport (692 < 920), eppure le voci NON si vedono.
- Con scroll: trigger −122..−98, popper 0..74 → voci VISIBILI ma "fuori dal riquadro"
  preferences (spuntano sopra il pannello).
- Nessun antenato con `overflow` clippante tra popper e `documentElement` (teleport a body,
  padre DIV senza classe).
Conclusione: NON è overflow oltre il bordo della BrowserWindow (ipotesi del terzo giro
falsificata: qui non c'è alcun overflow, `altAxis`/preventOverflow non entrano in gioco) e
NON è clipping da `overflow`. Il popper è posizionato correttamente ma viene COPERTO dal
pannello preferences: visibile solo dove il pannello non c'è sotto → problema di
stacking/z-index o di painting.
Prossimo passo: snippet con `document.elementFromPoint` al centro del popper aperto per
identificare l'elemento che lo copre e la sua catena di stacking (position/z-index), più
z-index/position/opacity computati del popper e del suo contenitore teleport.

## Quinto giro (2026-07-13) — CAUSA RADICE trovata e fixata
- Snippet `elementFromPoint` al centro del popper aperto: il punto appartiene a
  `.pref-compound-body` dentro `.v2-settings-backdrop` — `position: fixed`, **z-index: 3500**
  (`settingsModal/index.vue:322`). Il popper EP ha z-index 2042/2043 (contatore Element Plus
  dal default 2000): sempre SOTTO il backdrop → coperto ovunque il modal è opaco, intravisto
  solo attraverso il backdrop trasparente sopra il pannello.
- Nota: le Preferences NON sono più una BrowserWindow separata — sono il settings modal v2
  dentro la finestra principale (l'informazione "finestra separata 650px" del HANDOFF era
  stantia; per questo il viewport misurato era 835×920).
- Fix alla radice (orchestratore, 1 riga in `src/renderer/src/main.js`): opzione ufficiale
  `zIndex: 3600` in `app.use(ElementPlus, ...)` — base z-index dei popper EP sopra il
  backdrop (3500) e sotto i layer v2 context menu/popover hamburger (4000), che devono
  restare vincenti.
- Approvato dall'utente insieme al passo successivo: se il fix risolve, rollback delle
  popper-options dei giri 2-3 (flip disabilitato, `altAxis`, `fallback-placements` in
  `common/select/index.vue` e `common/fontTextBox/index.vue`) per tornare al comportamento
  EP di default, con retest separato.

## Sesto giro (2026-07-13) — comportamento finale richiesto: dropdown DENTRO il riquadro
- Test utente sul fix `zIndex: 3600`: le voci finalmente SI VEDONO (z-index era la causa
  dell'invisibilità), ma il dropdown teleportato su body fluttua SOPRA il modal: esce dal
  riquadro quando si scrolla e, con liste lunghe e trigger in fondo, copre il contenuto
  senza possibilità di scrollare oltre.
- Comportamento voluto (specifica utente): il dropdown deve stare dentro il riquadro
  preferences, essere clippato dai suoi bordi durante lo scroll, e se sborda in basso deve
  allungare lo scroll del pannello (voci raggiungibili scrollando, mai coprendo contenuto).
- Fix (orchestratore, entrambi i wrapper): `:teleported="false"` su `el-select` e
  `el-autocomplete` — dropdown reso inline nel body scrollabile del modal
  (`.v2-settings-body`, overflow-y auto, position relative: un discendente absolute che
  sborda ne allunga la scrollHeight). `popperOptions` semplificate: `placement:
  'bottom-start'` + flip disabilitato; RIMOSSO `preventOverflow` (altAxis/tether: il clamp
  alla viewport contrasterebbe l'"estendi sotto e scrolla") e rimossa la prop
  `fallback-placements` (inutile con flip spento).
- `zIndex: 3600` in `main.js` mantenuto: serve comunque agli altri popup EP sopra il
  backdrop del modal (3500).

## Settimo giro (2026-07-13) — voce evidenziata bianca a mouse fuori (classe legacy `.hover`)
- Test utente sul sesto giro: comportamento dentro-il-riquadro FUNZIONA. Nuovo difetto: a
  mouse fuori dalla dropdown la voce evidenziata diventa quasi bianca (illeggibile col tema
  scuro).
- Diagnosi (snippet `elementsFromPoint` doppio, mouse dentro vs fuori): l'unico elemento che
  cambia è il `li` `is-selected is-hovering` — dentro `rgba(255,255,255,0.04)` (override
  nostro via `:hover`), fuori `rgb(245,247,250)` = default EP `--el-fill-color-light`.
  Element Plus 2.x rimette l'evidenza sulla voce selezionata con la classe `is-hovering`;
  il nostro override CSS usava `.hover`, nome legacy di Element UI mai matchato in EP 2.x.
  Bug preesistente, invisibile finché la dropdown era coperta dal bug z-index.
- Fix (orchestratore): `.hover` → `.is-hovering` in `common/select/index.vue` e
  `spellchecker/index.vue`; in `common/fontTextBox/index.vue` aggiunto `.highlighted`
  (equivalente EP per `el-autocomplete`, navigazione da tastiera) accanto al `:hover`.
  Verificato su `element-plus/dist/index.css`: `.el-select-dropdown__item.is-hovering` e
  `.el-autocomplete-suggestion li.highlighted` sono le regole default da sovrascrivere.

## Test
BUG CHIUSO — esito utente 2026-07-13: tutto funziona.
Riepilogo giri: 1-4 KO (diagnosi errate: flip, poi bordo finestra); quinto giro PARZIALE —
`zIndex: 3600` in `main.js` rende visibili le voci (causa invisibilità: popper EP z-index
~2000 sotto il backdrop del settings modal a 3500); sesto giro OK — `teleported=false` tiene
la dropdown dentro il riquadro (clip su scroll, scrollHeight estesa per liste lunghe);
settimo giro OK — `.is-hovering`/`.highlighted` al posto della classe legacy `.hover`: voce
evidenziata leggibile col tema scuro anche a mouse fuori.
Fix definitivi: `main.js` (zIndex 3600), `common/select/index.vue`,
`common/fontTextBox/index.vue` (teleported=false + popperOptions flip-off + classi hover EP),
`spellchecker/index.vue` (classe hover EP). Task2 chiuso → feature preferences-refinement
completa (task1 già OK).
