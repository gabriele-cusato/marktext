# warning-fix — task5 — plan: el-dialog slot #title → #header (deprecazione Element Plus)

## Obiettivo
Eliminare l'`ElementPlusError: [el-dialog] the title slot is about to be deprecated in version 3.0.0, please use the header slot instead` dalla console F12.

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task5-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 6).
- File sorgente richiesti, esistenti e leggibili: i 4 file elencati sotto.
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: `npm run dev`, aprire i 4 dialog e controllare assenza dell'errore in console + resa grafica invariata del titolo.
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).
- Vietato sopprimere il warning: fix alla radice (DECISIONS.md 2026-07-05).

## File da toccare
- `src/renderer/src/prefComponents/keybindings/key-input-dialog.vue` (righe ~7-16)
- `src/renderer/src/components/tweet/index.vue` (righe ~3-10)
- `src/renderer/src/components/rename/index.vue` (righe ~3-10)
- `src/renderer/src/components/editorWithTabs/editor.vue` (riga ~39, dialog inserimento tabella)

## Regole rilevanti
- Solo rinomina slot `#title` → `#header` nei 4 file; nessun'altra modifica ai dialog.
- Prima di toccare CSS: grep `.el-dialog__title` e `.el-dialog__header` in tutti i `.vue`/`.css` (checklist CLAUDE.md §4: le classi possono essere usate in più temi in `src/renderer/src/assets/themes/`). Lo slot header di Element Plus ha markup interno diverso dal title: se c'è CSS agganciato, verificare la resa e adattare in modo minimale.
- `editor.vue` è file grande e delicato (feature editor-core): toccare SOLO la riga dello slot del dialog tabella.

## Fatti verificati
- Solo questi 4 file usano `<template #title>` in `<el-dialog>`; exportSettings/import/about non usano lo slot title.

## Sottoproblemi in ordine
1. Grep preliminare CSS: `.el-dialog__title` / `.el-dialog__header` in `.vue`, `.css` e temi.
2. Rinominare `#title` → `#header` nei 4 file.
3. Verificare via doc locale o sorgente Element Plus del progetto (node_modules) che lo slot `header` riceva le stesse props/comportamento (lo slot header espone `close`, `titleId`, `titleClass`; il contenuto semplice resta compatibile).
4. Build di verifica: `npm run build` (o `npm run dev` avviabile senza errori).
5. Aggiornare il worklog (checkbox + tag DA TESTARE).

## Esecutore e skill
- Esecutore: Agent-Code (4 file, con verifica CSS).
- Skill di codice: `coding-standard`.
