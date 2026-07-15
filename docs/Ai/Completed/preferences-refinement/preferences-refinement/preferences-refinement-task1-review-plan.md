# preferences-refinement — task1 (controllo generale) — plan — 2026-07-12

Origine: TODO.md "Menu/UI overhaul — follow-up": controllo generale e rifinitura delle Preferences.

## Prerequisiti bloccanti
- Perimetro: `src/renderer/src/prefComponents/`, `src/renderer/src/pages/preference.vue`,
  `src/main/preferences/schema.json`, `static/preference.json`.
- Precedenti da rispettare: migrazioni Element Plus già fatte (`refactor-followup-fix`) — non
  regredire; regola warning (DECISIONS 2026-07-05).
- Decisioni utente sulle voci del censimento (sotto) prima di delegare i fix.

## Censimento statico (Agent-Explorer 2026-07-12) — lista difetti verificata
Pannelli: general, editor, markdown, spelling, theme, image (+folderSetting/uploader),
keybindings (+key-input-dialog); routing `router/index.js:19-73`, nav `sideBar/config.js:12-55`.

1. **5 preferenze MORTE** (definite in schema + default store, zero letture in main, zero UI):
   `searchExclusions` (schema.json:367), `searchMaxFileSize` (:375), `searchIncludeHidden` (:381),
   `searchNoIgnore` (:386), `searchFollowSymlinks` (:391). Erano della vecchia ricerca full-text
   rimossa. → Proposta: rimuoverle (schema + store/preferences.js:82-86 + static/preference.json)
   OPPURE tenerle come base per la futura feature `folder-search` (decisione utente).
2. **Chiave senza schema**: `treePathExcludePatterns` usata (general/index.vue:84,227;
   watcher.js:172; store:22; static/preference.json:16) ma ASSENTE da schema.json → aggiungerla.
3. **Residui `size="mini"`** (non valido in Element Plus 2.x):
   image/components/folderSetting/index.vue:13,19; image/components/uploader/index.vue:240-307.
4. **Sezione "Session snapshot & periodic backup" NON i18n** (general/index.vue:140-174, testi
   inglesi hardcoded) — coordinare con feature `locales-align`.
5. **el-radio commentato** con vecchio pattern `label` (general/index.vue:110, codice morto
   commentato) → rimuovere il commento morto.
6. `watcherUsePolling` letta dal watcher ma senza controllo UI. DECISO (delega utente
   all'orchestratore, 2026-07-12): **esporla** nel pannello General come checkbox con descrizione
   chiara ("controllo file a intervalli invece delle notifiche OS — attivare solo se le modifiche
   esterne ai file su percorsi di rete non vengono rilevate"). Costo minimo, dà pieno controllo.

## Obiettivo
Validare la lista con l'utente (+ eventuali difetti visivi emersi dalla sua prova manuale) →
fix in un unico batch Agent-Code.

## Fatti verificati (contesto)
- Bug combo box trattato A PARTE nel task2 di questa feature.
- Font picker vuoto su PC ristretto trattato dalla feature `font-registry-fallback` (non qui).

## Skill di codice
`coding-standard` (Vue 3 + Element Plus).

## Test
PC principale: passata completa di tutti i pannelli dopo i fix.
