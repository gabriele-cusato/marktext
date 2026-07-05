# warning-fix — task7 — plan: riformulare stringhe locale con bracket `< ... >` (falso positivo intlify)

## Obiettivo
Eliminare i warning `[intlify] Detected HTML in '< Empty HTML Block >' message` e `Detected HTML in '<div> HTML </div>' message` (compaiono anche a ogni nuovo paragrafo, via render Muya).

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task7-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 9).
- File sorgente richiesti: i 9 locale in `static/locales/`.
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: `npm run dev`, creare un paragrafo/blocco HTML vuoto: nessun warning "Detected HTML".
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).
- Vietato sopprimere il warning (es. `warnHtmlMessage: false`): decisione utente 2026-07-05, riformulazione obbligatoria (DECISIONS.md 2026-07-05).

## File da toccare
- `static/locales/en.json` e gli altri 8 locale (de, es, fr, ja, ko, pt, zh-CN, zh-TW).
- SOLO se i placeholder sono duplicati hardcoded altrove: verificare prima con grep (vedi sottoproblema 1).

## Regole rilevanti
- NON toccare `src/muya/lib/` (il codice è corretto: passa chiavi a `t()`, non HTML).
- Nuova formulazione decisa: sostituire i bracket angolari con quadre, es. `"< Empty HTML Block >"` → `"[ Empty HTML Block ]"`, `"<div> HTML </div>"` → placeholder equivalente senza `<>`. Mantenere il significato.
- Le stringhe sono placeholder visibili all'utente nell'editor (blocchi vuoti): la resa cambia leggermente, accettato dall'utente.

## Fatti verificati
- Chiavi coinvolte in `en.json:1368-1373` (blocco `editor.*`): `emptyHtmlBlock` (`"< Empty HTML Block >"`), `emptyMathFormula`, `invalidMathFormula`, `emptyMermaidBlock`, `emptyDiagramBlock` — tutte con formato `< ... >`.
- Anche la stringa `"<div> HTML </div>"` (placeholder inserimento blocco HTML) triggera il warning: individuarne la chiave esatta con grep nei locale.
- Catena del warning a ogni paragrafo: `parser/render/index.js:181/200/259` (`this.muya.options.t`) → `renderLeafBlock.js:137` → traduzione `editor.emptyHtmlBlock`.
- Il detector di vue-i18n scatta sul CONTENUTO della stringa tradotta (falso positivo), non sul codice.

## Sottoproblemi in ordine
1. Grep nei 9 locale di tutte le stringhe con pattern `<` seguito da testo e `>` nei valori (non solo le 5+1 note): elencare l'insieme completo delle chiavi da riformulare.
2. Grep nel codice (`src/`) di eventuali confronti hardcoded con i vecchi valori (es. `'< Empty HTML Block >'` usato come confronto stringa o nei test): se esistono, aggiornare anche quei siti.
3. Riformulare i valori in en.json (bracket quadre, stesso testo).
4. Applicare la stessa riformulazione negli altri 8 locale (mantenendo la traduzione esistente, cambiando solo i bracket).
5. Build di verifica: `npm run build`.
6. Aggiornare il worklog (checkbox + tag DA TESTARE).

## Esecutore e skill
- Esecutore: Agent-Code (9+ file).
- Skill di codice: `coding-standard`.

## Dipendenze tra task
- Tocca gli stessi 9 file locale del task6 → eseguire in SEQUENZA rispetto al task6, mai in parallelo.
