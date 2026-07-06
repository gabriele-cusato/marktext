# editor-ui-fixes — task1 — plan: errore "selectionChange: cursor null" al rename tab

## Obiettivo
Eliminare l'`Uncaught (in promise) Error: selectionChange: expected cursor but cursor is null` (paragraphCtrl.js:21) quando si fa Rename dal context menu di una tab (il rename riesce, ma l'errore compare 2 volte in console).

## Prerequisiti bloccanti
- Questo plan e il worklog `editor-ui-fixes-task1-worklog.md` esistenti e leggibili.
- File richiesti: `src/renderer/src/components/editorWithTabs/editor.vue`.
- Contesto: `docs/Ai/Completed/editor-core/editor-core.md`.
- Target di verifica: `npm run build` exit 0; test utente: rename di una tab (anche in background) senza errori in console.
- Version control: solo `git status`/`git diff`; vietati commit (DECISIONS.md 2026-07-01).

## Fatti verificati (Agent-Explorer 2026-07-06)
- Catena: `TabContextMenu.vue:75-79` Rename → `RENAME_FILE` (editor.js:1310-1313) → `UPDATE_CURRENT_FILE` attiva la tab cliccata → `watch(currentFile)` (editor.vue:405-413) chiama `scrollToCursor(0)` incondizionatamente → `scrollToCursor` (editor.vue:750-758) chiama `editor.value.getSelection()` → Muya `selectionChange` lancia se la selezione DOM non è dentro l'editor (caso: click sul context menu, focus fuori dall'editor; `getCursorRange()` ritorna start/end null — selection/index.js:547-570).
- In Muya c'è già un TODO noto (GH#848) su quel throw: NON toccare Muya.
- Pre-esistente, NON regressione del task8 warning-fix (il cursore coinvolto è la selezione DOM interna di Muya, non la prop Vue).

## File da toccare
- `src/renderer/src/components/editorWithTabs/editor.vue` — SOLO la funzione `scrollToCursor` (righe ~750-758).

## Regole rilevanti
- NON toccare `src/muya/lib/` (il throw è comportamento engine noto).
- NON rimuovere la chiamata a scrollToCursor dal watch (serve nei cambi tab normali).

## Sottoproblemi in ordine
1. In `scrollToCursor`: try/catch attorno a `editor.value.getSelection()`; se lancia (nessun cursore attivo, es. cambio tab senza focus nell'editor), return silenzioso senza scroll. Commento in italiano che spiega il caso.
2. Build `npm run build`.
3. Worklog (checkbox + DA TESTARE).

## Esecutore e skill
- Agent-Code. Skill: coding-standard.
