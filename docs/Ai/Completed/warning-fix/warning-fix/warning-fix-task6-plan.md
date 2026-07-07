# warning-fix — task6 — plan: chiavi i18n mancanti (searchInTabs, common.close)

## Obiettivo
Eliminare i warning `[intlify] Not found 'sideBar.search.searchInTabs' key in 'en' locale messages` e `Not found 'common.close'`.

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task6-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 8).
- File sorgente richiesti, esistenti e leggibili: `src/renderer/src/components/sideBar/search.vue` e i 9 locale in `static/locales/` (en, de, es, fr, ja, ko, pt, zh-CN, zh-TW).
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: `npm run dev`, aprire la ricerca in sidebar (Ctrl+Shift+F): nessun warning intlify "Not found" in console.
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).
- Vietato sopprimere i warning (es. `missingWarn: false`): fix alla radice (DECISIONS.md 2026-07-05).

## File da toccare
- `src/renderer/src/components/sideBar/search.vue` (righe 4, 7, 22)
- `static/locales/en.json`, `de.json`, `es.json`, `fr.json`, `ja.json`, `ko.json`, `pt.json`, `zh-CN.json`, `zh-TW.json`

## Regole rilevanti
- NON toccare la logica di ricerca (feature ricerca-e-utility, invarianti in Completed/): solo chiavi i18n e chiamate `t()`.
- Mantenere la struttura esistente dei JSON: `sideBar.search.*` esiste già (en.json:239-247), `common.*` esiste già (en.json:1046-1049, solo cancel/ok).
- Traduzioni per i locale non-en: coerenti con lo stile delle voci vicine nello stesso file (es. come sono tradotti gli altri `sideBar.search.*`). Se una lingua non è traducibile con confidenza, usare l'inglese come valore e segnalarlo nel worklog.

## Fatti verificati
- `search.vue:4`: `t('sideBar.search.searchInTabs', 'Cerca in tutte le tab')` (titolo).
- `search.vue:7`: `t('common.close', 'Chiudi')` (bottone chiusura).
- `search.vue:22`: `t('sideBar.search.searchInTabs', 'Search in all tabs...')` (placeholder) — STESSA chiave del titolo con fallback diverso: bug, servono due chiavi distinte.
- Le chiavi mancano in tutti i 9 locale. `dialog.close`/`tabs.close` esistono ma a path diversi: non riusabili come `common.close`.

## Sottoproblemi in ordine
1. Sdoppiare la chiave in `search.vue`: riga 4 → `sideBar.search.searchInTabsTitle`, riga 22 → `sideBar.search.searchInTabsPlaceholder` (nomi definitivi a discrezione, purché distinti e nel namespace `sideBar.search`). Riga 7 resta `common.close`.
2. Aggiungere in TUTTI i 9 locale: `sideBar.search.searchInTabsTitle`, `sideBar.search.searchInTabsPlaceholder` (dentro il blocco `sideBar.search` esistente) e `common.close` (dentro `common`).
3. Verificare con grep che nessun altro file usi `sideBar.search.searchInTabs` (vecchia chiave) o si aspetti `common.close` con altro significato.
4. Build di verifica: `npm run build`.
5. Aggiornare il worklog (checkbox + tag DA TESTARE).

## Esecutore e skill
- Esecutore: Agent-Code (10 file).
- Skill di codice: `coding-standard`.
