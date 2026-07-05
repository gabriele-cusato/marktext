# editor-ui-fixes — task2 — plan: cursore non mantenuto passando da Muya a source mode

## Obiettivo
Passando da markdown (Muya) a source mode, il cursore CodeMirror deve aprirsi alla posizione corrente del cursore Muya (oggi si apre altrove; il verso source→Muya funziona già).

## Prerequisiti bloccanti
- Questo plan e il worklog `editor-ui-fixes-task2-worklog.md` esistenti e leggibili.
- File richiesti: `src/renderer/src/components/editorWithTabs/editor.vue`, `src/renderer/src/components/editorWithTabs/sourceCode.vue` (sola lettura per verifica).
- Contesto: `docs/Ai/Completed/editor-core/editor-core.md` e `docs/Ai/Completed/editor-advanced/editor-advanced.md` (undo unificato: pushUnified usa già liveCursor).
- Target di verifica: `npm run build` exit 0; test utente: cursore a metà documento → switch a source → CM posizionato sulla riga corrispondente (e viceversa ancora funzionante).
- Version control: solo `git status`/`git diff`; vietati commit (DECISIONS.md 2026-07-01).

## Fatti verificati (Agent-Explorer 2026-07-06)
- `watch(sourceCode)` in editor.vue:415-445 calcola `liveCursor = getMuyaIndexCursor()` (riga 434) ma lo usa SOLO per `pushUnified` (history undo): NON scrive mai `file.muyaIndexCursor` sullo store.
- `sourceCode.vue:1204-1215` al mount usa il prop `muyaIndexCursor` (da app.vue:145 ← `currentFile.muyaIndexCursor`) come posizione iniziale; lo store si aggiorna solo in `LISTEN_FOR_CONTENT_CHANGE` (editor.js:1565-1567), cioè solo a modifica di contenuto — non al semplice spostamento del cursore.
- Verso funzionante (source→Muya): `prepareTabSwitch` (sourceCode.vue:129-142) salva esplicitamente il cursore live nello store al momento dello switch. Manca l'anello simmetrico nel verso Muya→source.

## File da toccare
- `src/renderer/src/components/editorWithTabs/editor.vue` — SOLO il blocco watch(sourceCode) righe ~415-445.

## Regole rilevanti
- NON toccare `pushUnified` né la logica undo unificata (solo aggiungere la scrittura sullo store).
- NON toccare sourceCode.vue (legge già correttamente il prop).
- NON toccare `LISTEN_FOR_CONTENT_CHANGE`.

## Sottoproblemi in ordine
1. Nel watch(sourceCode), dopo il calcolo di `liveCursor`: se `liveCursor` è valorizzato, scrivere `file.muyaIndexCursor = liveCursor` (riferimento reattivo Pinia, pattern già usato nel file). Commento in italiano.
2. Verificare (lettura) che il mount di sourceCode.vue avvenga dopo il flush della scrittura (entrambi dipendono dallo stesso cambio reattivo; se il mount leggesse il valore vecchio, riportarlo nel worklog e fermarsi per decidere).
3. Build `npm run build`.
4. Worklog (checkbox + DA TESTARE).

## Esecutore e skill
- Agent-Code. Skill: coding-standard.

## Dipendenze
- Tocca editor.vue come il task1 → eseguire in SEQUENZA dopo il task1.
