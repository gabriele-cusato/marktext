# locales-align

## Scopo
Allineare i file locales (.json) di tutte le 9 lingue dopo che menu/palette/shortcut sono stati riordinati (menu-shortcut-overhaul, recent-files). Rimuovere chiavi orfane (comandi rimossi), aggiungere chiavi nuove (voci aggiunte), struttura coerente su tutte le lingue.

## Modifiche

### File modificati
**static/locales/{de,en,es,fr,ja,ko,pt,zh-CN,zh-TW}.json**
- Rimosse **54 chiavi identiche in tutte le lingue**: `commands.paragraph.*` (tranne resetParagraph), `commands.format.*`, `frontMenu.turnInto.*`, `edit.createParagraph`/`deleteParagraph` (orfane da menu-shortcut-overhaul batch 1)
- Rimosse **4 chiavi da lingue specifiche**: `search.searchResultCount` (sostituita da `searchResultInfo`), `uploader.brewInstallCommand`, `quickInsert.sequenceDiagram.*`, `quickInsert.plantumlDiagram.*` (sostituiti da `sequenceChart`/`plantUMLChart`)
- Aggiunte **51 chiavi per lingua** (8 lingue non-EN): allineamento strutturale con `en.json` (statusBar, store.editor, theme, menu.theme.tufte, contextMenu.tabs, preferences.editor.writingBehavior, ecc.)
- Aggiunte **19 chiavi per lingua** (9 lingue): nuova sezione `quickInsert.inlineFormat` (task menu "@" inline, parte C di menu-shortcut-overhaul)
- Aggiunte **6 chiavi per lingua** (9 lingue): nuova sezione `preferences.general.sessionSnapshot` (task preferences-refinement task1)
- Aggiornato `commands.file.quickOpen` da "Quick Open" a valore già presente in `menu.file.recent` (Recent Files)

### Build/minify
- Script `npm run minify-locales` eseguito → regenerati i file `.min.json` (il runtime preferisce i `.min.json` ai `.json`)
- Verificato: `npm run build` completa senza errori/warning

## Da tenere a mente

**REGOLA OPERATIVA CRITICA**: Dopo OGNI modifica ai file `.json` locale eseguire `npm run minify-locales`. Il build standard `npm run build` NON esegue la minificazione → i `.min.json` restano stantii e il runtime continua a usarli. Il file non modificato passa inosservato fino a runtime.

**Parità strutturale raggiunta**: Tutte le 9 lingue hanno la stessa struttura chiavi dopo questo task (verify script `compare-locales.mjs` riporta `missing (0) / extra (0)` per le 8 lingue non-EN rispetto a `en.json`).

**Traduzioni non verificate da terza fonte**: "Tufte" (tema) traslitterato in ja ("タフト") e ko ("터프트") seguendo pattern oneDark — traslitterazione NON verificata su fonte autorevole, segnalata come incertezza se avanzata richiesta.

**Test esito**: Utente (2026-07-12/13, PC principale) OK — lingue corrette dopo rigenerazione `.min.json`, console senza warning i18n. Feature chiusa.
