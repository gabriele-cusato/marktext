# warning-fix — task8 — plan: prop "cursor" undefined in source mode (Vue warn)

## Obiettivo
Eliminare il `[Vue warn]: Invalid prop: custom validator check failed for prop "cursor"` (con `cursor=undefined`) che compare passando a source mode e si ripete a ogni tick del backup sessione (~7s).

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task8-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 10).
- File sorgente richiesti, esistenti e leggibili: `src/renderer/src/components/editorWithTabs/index.vue`, `src/renderer/src/components/sourceCode/sourceCode.vue`, `src/renderer/src/store/editor.js`, `src/renderer/src/pages/app.vue`.
- Contesto obbligatorio da leggere PRIMA: `docs/Ai/Completed/editor-core/editor-core.md` (invarianti `handlePreSave` senza guardie) e `docs/Ai/Completed/session-persistence/session-persistence.md` (loop tick backup).
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: `npm run dev`, passare a source mode, attendere >7s, tornare a Muya: nessun Vue warn "cursor".
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).
- Vietato sopprimere il warning (es. togliere il validator): fix alla radice (DECISIONS.md 2026-07-05).

## File da toccare
- `src/renderer/src/components/editorWithTabs/index.vue` (prop `cursor`, righe 48-53)
- `src/renderer/src/store/editor.js` (solo se necessario: normalizzazione `cursor` in `LISTEN_FOR_CONTENT_CHANGE`, righe ~1504-1567)

## Regole rilevanti
- MASSIMA prudenza su `store/editor.js` e sul flusso pre-save: è il cuore di editor-core e session-persistence (bug B1-B14 già chiusi lì). NON cambiare la logica: solo normalizzazione del valore.
- NON toccare `sourceCode.vue handlePreSave` se non strettamente necessario: `handlePreSave` NON deve acquisire guardie (invariante editor-core).
- NON toccare il loop `tick` (editor.js:961-976): comportamento corretto di session-persistence.
- Il fix primario è di FORMA del prop, non di flusso.

## Fatti verificati
- `index.vue:48-53`: prop `cursor` con `validator(value) { return typeof value === 'object' }` e `required: true`, senza `type`/`default` → con `undefined` fallisce; con `null` passerebbe (`typeof null === 'object'`).
- Valore da `app.vue:142`: `computed(() => currentFile.value?.cursor)` → `undefined` quando la tab non ha mai avuto cursore popolato.
- In source mode `handlePreSave` (`sourceCode.vue:440-458`) passa solo `muyaIndexCursor` a `LISTEN_FOR_CONTENT_CHANGE`; `editor.js:1566` (`if (cursor)`) non popola mai la chiave.
- Il componente in `editor.vue:140-142` gestisce già cursor null/assente.

## Sottoproblemi in ordine
1. In `index.vue`: cambiare la definizione della prop `cursor` in `{ type: Object, default: null }` (rimuovendo `required: true`; il validator può restare solo se compatibile con `null`, altrimenti rimuoverlo — con `type: Object` è ridondante).
2. Verificare con grep tutti i punti che leggono la prop `cursor` dentro `index.vue` e i figli diretti a cui viene passata: confermare che gestiscano `null` (editor.vue:140-142 già verificato).
3. Valutare (e applicare solo se senza effetti collaterali) la normalizzazione in `app.vue:142`: `currentFile.value?.cursor ?? null` — rende esplicito il contratto "mai undefined".
4. NON modificare `editor.js:1566` a meno che i punti 1-3 non bastino; in tal caso limitarsi a normalizzare `cursor` a `null` senza cambiare la condizione di scrittura (attenzione: `this.currentFile.cursor = null` incondizionato SOVRASCRIVEREBBE il cursore salvato → vietato; la condizione `if (cursor)` deve restare).
5. Build di verifica: `npm run build`.
6. Aggiornare il worklog (checkbox + tag DA TESTARE).

## Esecutore e skill
- Esecutore: Agent-Code.
- Skill di codice: `coding-standard`.
