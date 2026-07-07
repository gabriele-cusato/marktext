# warning-fix — task3 — plan: eliminare doppio import di codemirror/mode/meta.js (warning Vite)

## Obiettivo
Eliminare il warning Vite in `npm run build`:
`codemirror/mode/meta.js is dynamically imported by loadmode.js but also statically imported by index.js, dynamic import will not move module into another chunk.`

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task3-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 3).
- File sorgente richiesti, esistenti e leggibili: `src/renderer/src/codeMirror/loadmode.js`, `src/renderer/src/codeMirror/index.js`.
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: `npm run build` senza il warning; source mode ancora funzionante (highlight per linguaggio).
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).
- Vietato sopprimere il warning via config Vite (`onwarn`, ecc.): fix alla radice (DECISIONS.md 2026-07-05).

## File da toccare
- `src/renderer/src/codeMirror/loadmode.js`

## Regole rilevanti
- Non toccare `src/muya/lib/` (fuori scope).
- Non cambiare il comportamento runtime: `meta.js` deve restare caricato staticamente a startup (serve la tabella estensione→mode prima di qualunque lazy-load).

## Fatti verificati
- `loadmode.js:4`: `import.meta.glob('../../../../node_modules/codemirror/mode/**/*.js')` — include anche `mode/meta.js` tra i mode lazy-caricabili (usato da `CodeMirror.requireMode`, righe 34-69).
- `index.js:9`: `import 'codemirror/mode/meta'` — import statico necessario a startup.
- Il conflitto è solo di chunking: `meta.js` non deve stare nel glob perché è già nel bundle statico.

## Sottoproblemi in ordine
1. In `loadmode.js`, escludere `meta.js` dal glob dinamico. `import.meta.glob` accetta un array di pattern con negazione: usare `['../../../../node_modules/codemirror/mode/**/*.js', '!../../../../node_modules/codemirror/mode/meta.js']` (verificare la sintassi di negazione supportata dalla versione di Vite del progetto prima di applicare; in alternativa filtrare la chiave `meta` nella logica di `requireMode`).
2. Verificare che `requireMode` non venga mai chiamato con mode `meta` (grep sugli usi); se può accadere, gestire il caso (no-op).
3. Build di verifica: `npm run build` senza il warning.
4. Aggiornare il worklog (checkbox + tag DA TESTARE).

## Esecutore e skill
- Esecutore: Agent-Code.
- Skill di codice: `coding-standard`.
