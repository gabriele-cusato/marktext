# lint-da-correggere — residui ESLint da sistemare a mano (giro 2 aggiornamento pacchetti)

Contesto: giro 2 del piano aggiornamento (vedi `packages-update-fix.md`). Aggiornati
`eslint-plugin-jsonc 2→3`, `@babel/eslint-parser 7→8`, `neostandard 0.12→0.13`. **eslint resta 9**
(la 10 è bloccata dal peer `eslint ^9` di neostandard 0.13). neostandard 0.13 introduce regole
`@stylistic/*` e Vue più severe → molte violazioni di sola formattazione.

Aggiunto anche ignore per `MarkTextDocs/**` e `**/*.min.js` in `eslint.config.mjs` (buco preesistente:
eslint lint-ava i bundle minificati del sito docs, ~32k errori spuri).

## RISOLTO 2026-07-06 — lint a 0 problemi

- `npx eslint . --fix` → 404 problemi di formattazione risolti (riformatta ~15 file, nessun cambio logica).
- 5 errori corretti a mano:
  - `file.js` — rimosso import inutilizzato `MARKDOWN_EXTENSIONS`.
  - `tabs.vue` — rimosso dead chain `currentTheme`→`theme`→`preferencesStore`→import (+ `computed`
    dall'import vue). Era codice morto, zero effetto runtime.
  - `search.vue` — rimossa label `outer:`: `break outer` → `break` + guardia `if (truncated) break`
    nel for esterno (comportamento identico).
  - `editor.js` — `// eslint-disable-next-line no-control-regex` sul regex sentinella `\x02` (hard-break, intenzionale).
- 2 warning `vue/no-v-html` risolti con blocco `<!-- eslint-disable vue/no-v-html -->` +
  `<!-- eslint-enable -->`: verificato che l'input è SVG statico (BaseContextMenu → `ICONS` da
  `./icons`; settingsModal → costanti `ICON_*`), nessun input utente → nessun rischio XSS.
- Da fare: `npm run dev` (verifica tab e ricerca dopo le modifiche) + commit giro 2.

## Stato originale: `npm run lint` = 411 problemi (78 errori, 333 warning)

- **313 auto-fixabili** (73 errori + 240 warning): pura formattazione. Si risolvono con:
  ```
  npx eslint . --fix
  ```
  Riformatta ~15 file (indentazione, attributi Vue su nuova riga, spazi, newline in oggetti/ternari).
  Nessun cambio di logica. Da fare come commit dedicato ("style: eslint --fix dopo bump neostandard").

- **~98 NON auto-fixabili**: richiedono decisione umana. Elenco sotto (da rifare `npm run lint` dopo
  il `--fix` per confermare i residui esatti).

## Errori reali da correggere a mano (5)

1. **no-unused-vars** — `src/main/menu/actions/file.js:7`
   `'MARKDOWN_EXTENSIONS' is defined but never used`.
   → Rimuovere l'import/costante se davvero inutilizzato; oppure verificare se serviva (grep usi).

2. **no-unused-vars** — `src/renderer/src/components/editorWithTabs/sourceCode.vue:317`
   `'currentTheme' is assigned a value but never used`.
   → Rimuovere la variabile o usarla dove previsto.

3. **no-labels** — `src/renderer/src/components/sideBar/search.vue:201:5` e `215:11`
   `Unexpected labeled statement` / `Unexpected label in break statement`.
   → Rifattorizzare il ciclo per non usare label (estrarre in funzione con return, o flag), oppure,
   se la label è voluta e chiara, `// eslint-disable-next-line no-labels` sulle due righe.

4. **no-control-regex** — `src/renderer/src/store/editor.js:1967:14`
   `Unexpected control character(s) in regular expression: \x02`.
   → Quasi certamente intenzionale (stripping di caratteri di controllo nel parsing). Se voluto,
   `// eslint-disable-next-line no-control-regex` sopra la riga. NON rimuovere il \x02 senza capire
   cosa filtra.

## Warning da decidere (non auto-fixabili, intenzionali)

- **vue/no-v-html** — `src/renderer/src/components/contextMenu/BaseContextMenu.vue:32`,
  `src/renderer/src/components/settingsModal/index.vue:72`
  `'v-html' directive can lead to XSS attack`.
  → Uso intenzionale (HTML/markdown già sanitizzato con dompurify). Scelte:
  - lasciare come warning (non blocca il lint);
  - `// eslint-disable-next-line vue/no-v-html` sulle righe se si vuole lint a zero warning;
  - assicurarsi che l'input sia sempre sanitizzato a monte (verifica sicurezza, non solo lint).

## Obiettivo lint pulito

1. `npx eslint . --fix` (formattazione, ~313 problemi via).
2. Correggere i 5 errori reali sopra.
3. Decidere sui warning `vue/no-v-html` (disable inline o tenere).
4. `npm run lint` → deve chiudere a 0 errori (0 warning se si disabilitano gli v-html intenzionali).
5. Commit. Se si tiene tutto nel giro 2: un commit per il bump+config, uno per il `--fix`, uno per i
   fix manuali — così il diff estetico è isolabile dal resto.

## Nota di rollback

Se il costo del riformatta-tutto non vale (è solo tooling dev), alternativa: revert neostandard a
0.12 (`npm install -D neostandard@0.12.2`) → sparisce la maggior parte delle violazioni nuove e non
serve riformattare. Vedi strada "B" discussa il 2026-07-06.
