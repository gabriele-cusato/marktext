# Worklog — Parte F — menu-shortcut-overhaul

Task-bug: Ctrl+Backspace (cancella parola indietro) non funziona nei code block (Ctrl+Del sì).
Fonte autorevole: `menu-shortcut-overhaul-plan.md`, Parte F. Decisione utente 2026-07-12:
resta batch di questa feature. Metodo: log-first (strumentare, runtime, poi fix).

## Prerequisiti bloccanti
- Loop runtime col PC principale: log temporanei → test utente → analisi → fix → rimozione log.

## Avanzamento
- [x] Log temporanei: `eventHandler/keyboard.js` (~178: ctrlKey/metaKey, tipo blocco, chiamata
  backspaceHandler) + `contentState/backspaceCtrl.js:119` (ramo attivo, preventDefault sì/no)
- [x] Log resi piatti (stringhe, non oggetti) + copertura completa di TUTTI i rami di
  `backspaceHandler` (i log a oggetto comparivano come "Object" collassato in console, dati
  inutilizzabili nel primo giro di test; inoltre nessun ramo strumentato risultava preso, quindi
  serviva coprire anche i rami non ancora loggati)
- [x] Test utente in code block + confronto col percorso Delete funzionante (secondo giro,
  con i log ora leggibili e la copertura completa)
- [x] Diagnosi asimmetria → fix: confermato che il ramo `codeContent` in `backspaceCtrl.js`
  (righe ~285-336) non leggeva mai `event.ctrlKey`/`event.altKey` e cancellava sempre 1 carattere
  (o `tabSize` per l'unindent). Fix applicato: nuovo ramo `isWordDelete` (attivo con
  `ctrlKey || altKey`, cursore collassato, `offset > 0`) che calcola `deleteLen` con
  `pre.match(/\S+\s*$/) || pre.match(/\s+$/)` (stile VSCode: cancella la parola più eventuali
  spazi fino al cursore, o solo gli spazi se non c'è parola prima) e cancella `deleteLen`
  caratteri riusando la stessa macchina di aggiornamento `text`/`offset`/`singleRender` già
  usata dal ramo esistente. Il ramo speciale "crash fix" (testo che termina con `\n`) resta con
  priorità invariata davanti a `isWordDelete`. Log `codeContent completato` aggiornato con
  `isWordDelete` e `deleteLen`.
- [ ] Rimozione log
- [ ] Conferma test utente sul fix (word-delete Ctrl+Backspace e Alt+Backspace nei code block)

## Log temporanei aggiunti (prefisso `[PARTE-F-DEBUG]`, tutti da rimuovere a fix chiuso)
Tutti i log elencati sotto usano ora stringhe piatte (template literal), non oggetti, per essere
leggibili/copiabili direttamente dalla console senza doverli espandere.

- `src\muya\lib\eventHandler\keyboard.js` case `Backspace`: log prima e dopo
  `contentState.backspaceHandler(event)` — ctrlKey/metaKey/altKey, tipo/functionType del blocco al
  cursore, poi `event.defaultPrevented` dopo la chiamata.
- `src\muya\lib\eventHandler\keyboard.js` case `Delete`: stesso log, per
  `contentState.deleteHandler(event)` — confronto diretto Backspace-vs-Delete.
- `src\muya\lib\contentState\backspaceCtrl.js` inizio `backspaceHandler`: log di ingresso
  (ctrlKey/metaKey, start/end cursore) + log su uscita anticipata `!start || !end`.
- `src\muya\lib\contentState\backspaceCtrl.js` dopo risoluzione `startBlock`/`endBlock`: nuovo log
  di contesto con `startBlock.type`/`functionType` e `endBlock.key`/`functionType`.
- Rami aggiunti/etichettati (uno per ciascuno, "ramo: <etichetta>", loggato solo quando il ramo è
  effettivamente preso — copertura ora completa lungo tutto il metodo):
  - `ramo: selectedImage`
  - `ramo: isSelectAll`
  - `ramo: atxLine heading fix`
  - `ramo: needRender inline_math/ruby`
  - `ramo: table th prima cella`
  - `ramo: cellContent selezione intera`
  - `ramo: codeContent preso` (**candidato principale**: questo ramo fa sempre
    `preventDefault()`/`stopPropagation()` e cancella manualmente 1 solo carattere, o `tabSize` se
    rilevato unindent, senza mai controllare `event.ctrlKey` — se confermato a runtime è la causa
    per cui Ctrl+Backspace nei code block cancella solo 1 carattere invece della parola) + log di
    fine ramo con il nuovo offset
  - `ramo: uscita anticipata selezione multipla (start!==end)`
  - `ramo: inline-image cancellazione immagine`
  - `ramo: inline-image merge testo adiacente`
  - `ramo: cursore fine immagine inline`
  - `ramo: cellContent fix <br/>`
  - `ramo: cellContent ultimo carattere`
  - `ramo: paragraphContent dopo footnoteInput`
  - `ramo: codeContent inizio blocco senza preSibling`
  - `ramo: cellContent inizio cella`
  - `ramo: inlineDegrade` (con tipo/info)
  - `ramo: merge con blocco precedente`
  - `ramo: nessun ramo del blocco principale preso (uscita implicita a fine funzione)` — nuovo
    `else` aggiunto solo per il log, nessun cambio di comportamento (prima non c'era nessuna azione
    quando nessuna condizione del blocco principale era vera, ora c'è solo il log)

## Istruzioni test utente (PC principale, `npm run dev`)
1. Aprire un file con un blocco di codice (```` ``` ````), scrivere alcune parole su una riga.
2. Posizionare il cursore a metà/fine di una parola nel code block, premere **Ctrl+Backspace**.
   Guardare la console DevTools: cercare le righe `[PARTE-F-DEBUG]`. Attesa: comparirà il log
   `keyboard.js Backspace keydown` con `ctrlKey: true`, poi il log di ingresso
   `backspaceHandler ingresso`, poi (probabile) il log `ramo codeContent preso` con `ctrlKey: true`
   seguito da `ramo codeContent completato` — se compare, conferma che il ramo cancella comunque
   1 carattere ignorando ctrlKey.
3. Ripetere lo stesso con **Ctrl+Delete** sulla stessa riga (posizionando il cursore a inizio
   parola), per confronto: guardare se compare (o no) un log equivalente lato `deleteHandler` e se
   `defaultPrevented` risulta `true`/`false`.
4. Copiare/incollare in worklog (sezione Test sotto) le righe di log rilevanti di entrambi i test,
   così si può confermare la diagnosi prima del fix.

## Test
Esito utente (2026-07-12/13, PC principale): OK — Ctrl+Backspace nel code block cancella
per parola (fix word-delete nel ramo codeContent). Chiuso esplicitamente dall'utente.
Restano da rimuovere i log `[PARTE-F-DEBUG]` (keyboard.js, backspaceCtrl.js — elenco punti
sopra in questo worklog; attenzione all'`else` finale in backspaceCtrl.js che esiste solo
per un log: rimuovere anche l'else vuoto).
