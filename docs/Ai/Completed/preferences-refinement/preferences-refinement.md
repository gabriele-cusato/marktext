# preferences-refinement

## Scopo
Controllo generale delle Preferences e fix di bug. Task1: rifinitura pannelli (voce 5 morti, chiavi mancanti da schema, widget legacy, watcherUsePolling). Task2: bug combo box overflow — le voci del dropdown escono dal riquadro preferences quando la combo è in basso (causa: z-index backdrop > z-index popper ElementPlus).

## Modifiche

### Task1 — Controllo pannelli
1. **src/renderer/src/prefComponents/**
   - Sostituito `size="mini"` (non valido Element Plus 2.x) con `size="small"` in `image/components/{folderSetting,uploader}/index.vue`
   - Rimosso blocco di codice commentato morto (`el-radio` con pattern legacy `label`)

2. **src/renderer/src/prefComponents/general/index.vue**
   - Aggiunto checkbox `watcherUsePolling` nel pannello General sezione Sidebar (controllo file a intervalli vs notifiche OS)
   - Aggiunta sezione "Session snapshot & periodic backup" con i18n (nuove chiavi `preferences.general.sessionSnapshot.*` in locales)

3. **static/locales/en.json**
   - Aggiunte 6 chiavi `preferences.general.sessionSnapshot.*` e chiave `preferences.general.sidebar.watcherUsePolling`

4. **src/main/preferences/schema.json**
   - Verificato: `treePathExcludePatterns` è già presente (precedente fix), nessuna modifica necessaria

### Task2 — Bug combo overflow
1. **src/renderer/src/main.js**
   - Aggiunto `zIndex: 3600` in `app.use(ElementPlus, ...)` per innalzare la base z-index dei popper ElementPlus sopra il backdrop del settings modal (3500)

2. **src/renderer/src/prefComponents/common/select/index.vue** (wrapper `CurSelect`)
   - Aggiunto `:teleported="false"` a `el-select` → dropdown reso inline nel body scrollabile del modal (anziché teleportato a body fluttuante)
   - Semplificato `popperOptions`: `placement: 'bottom-start'`, flip disabilitato
   - Corretto selector CSS `.hover` → `.is-hovering` (classe ElementPlus 2.x, non legacy)

3. **src/renderer/src/prefComponents/common/fontTextBox/index.vue** (wrapper autocomplete)
   - Aggiunto `:teleported="false"` a `el-autocomplete`
   - Semplificato `popperOptions` coerente con select
   - Aggiunto `.highlighted` accanto a `:hover` (classe autocomplete ElementPlus)

4. **src/renderer/src/prefComponents/spellchecker/index.vue**
   - Corretto selector CSS `.hover` → `.is-hovering`

5. **src/renderer/src/prefComponents/sideBar/config.js**
   - Rimossa `watcherUsePolling` dalla lista di esclusione della ricerca preferenze (ora che ha UI nel pannello General deve comparire nei risultati)

## Da tenere a mente

**z-index backdrop 3500**: Le Preferences non sono una finestra separata — sono il settings modal v2 dentro la finestra principale. Il backdrop ha z-index 3500; popper ElementPlus di default 2000 → sempre coperto. Se altri popup ElementPlus devono stare SOPRA il backdrop (non sotto), andranno a 3600+.

**teleported=false + inline overflow**: Col popover teleportato a body (default ElementPlus), il dropdown fluttuava sopra il modal. Con `teleported=false` il dropdown è inline nel body scrollabile del modal (`.v2-settings-body`, `overflow-y: auto`) → è clippato dai bordi e con liste lunghe estende lo scrollHeight (richiesto dal plan).

**Classe `.is-hovering` non `.hover`**: Il selector `.hover` è legacy di Element UI. Element Plus 2.x usa `.is-hovering` per selezione/highlight. L'assenza di override rendeva la voce quasi bianca (illeggibile tema scuro).

**watcherUsePolling ora visibile**: Questa preferenza era usata dal watcher ma senza UI. Task1 l'espone nel pannello General e task2 la rende ricercabile (la rimuove dalla blacklist della ricerca).

**Preferenze morte NON rimosse**: Le 5 chiavi `search*` (searchExclusions, ecc.) sono state tenute per decisione utente — servono come base per la futura feature `folder-search`.

**Test esito**: Utente (2026-07-12/13, PC principale) OK — passata pannelli (size small, session snapshot i18n, checkbox watcherUsePolling), combo dropdown visibile senza scroll preventivo, voce evidenziata leggibile tema scuro. Feature chiusa.
