# warning-fix — task9 — plan: indagine normalizeHeaderText / marcatore cursore DNA nei heading

## Obiettivo
Capire con certezza perché `normalizeHeaderText` (console.warn custom, `src/muya/lib/utils/exportMarkdown.js:189`) riceve testo heading con prefisso `ag-0-...` (marcatore cursore) e stabilire se il marcatore può finire nel markdown esportato/salvato (possibile corruzione dati). POI decidere il fix.

## Prerequisiti bloccanti
- Questo plan e il worklog `warning-fix-task9-worklog.md` esistenti e leggibili.
- Registro warning: `docs/Ai/Warning-fix-notes.md` (punto 11).
- File richiesti: `src/muya/lib/utils/exportMarkdown.js`, `src/muya/lib/utils/importMarkdown.js`, `src/muya/lib/config/index.js`, `src/muya/lib/utils/random.js`.
- Contesto obbligatorio: `docs/Ai/Completed/editor-core/editor-core.md` (flussi pre-save) e `docs/Ai/Completed/editor-advanced/editor-advanced.md` (undo unificato, uso export/import tra modalità).
- Nessun file sensibile/vietato coinvolto.
- Target di verifica: riproduzione runtime del warn da parte dell'utente + controllo del file salvato.
- Version control: consentito solo `git status`/`git diff` per verifica; vietati commit/push (DECISIONS.md 2026-07-01).
- Vietato rimuovere il console.warn senza aver risolto la causa (DECISIONS.md 2026-07-05).

## Fatti verificati (ipotesi ad alta plausibilità, NON confermata al 100%)
- Il warn scatta quando `/^ {0,3}(#{1,6})(.*)$/` non matcha il testo di un blocco `headingStyle === 'atx'` (`exportMarkdown.js:182-198`).
- Il prefisso `ag-0-1jsprhq9r` ha il formato di `getLongUniqueId()` (`random.js:1-6`), usato per `CURSOR_ANCHOR_DNA`/`CURSOR_FOCUS_DNA` (`config/index.js:313-314`): marcatori inseriti nel markdown durante il parsing (`importMarkdown.js:480-509,562-568`) e normalmente rimossi (`importMarkdown.js:529,593-606`).
- Osservazione utente: il warn appare al passaggio a source mode e all'export (`ag-...### ciao come stai?` — marcatore incollato a `###` senza spazio, ANCHE con heading come primo blocco).

## Sottoproblemi in ordine (indagine, non fix)
1. Delegare ad Agent-Explorer una mappa completa del flusso: chi chiama `new ExportMarkdown`/`generate()` con contenuto che può contenere i DNA (candidati: toggle source mode, pre-save, undo unificato Muya↔source, copy). Per ciascun percorso: il markdown passa da `importMarkdown` con `insertCursorMarker` attivo? Chi dovrebbe rimuovere i marker e in quale punto?
2. Identificare staticamente il caso in cui la rimozione fallisce per le righe heading: sospetto — il marker è inserito PRIMA di `###` (offset 0, riga heading) e la regex/logica di rimozione si aspetta il marker dentro il testo, o la rimozione avviene su un campo (`text`) diverso da quello che l'export legge (`children[0].text`).
3. Se l'analisi statica non basta: proporre all'utente un log temporaneo mirato (Agent-Code, patch minima e reversibile) nei punti di inserimento/rimozione marker, e fargli riprodurre il caso (heading + switch source mode). Le verifiche runtime le esegue l'utente.
4. VERIFICA CORRUZIONE (priorità): l'utente salva un file con heading mentre il warn è attivo e si ispeziona il file su disco: il marcatore `ag-...` è presente nel file? Esito da registrare nel worklog.
5. Con la causa confermata: scrivere il piano di fix (nuovo giro di conferma con l'utente prima di implementare — il fix NON fa parte di questo task).
6. Aggiornare il worklog a ogni passo.

## Esecutore e skill
- Esecutore: orchestratore coordina; Agent-Explorer per il punto 1-2; eventuale Agent-Code per il log temporaneo (punto 3) previa conferma utente.
- Skill di codice (solo per l'eventuale punto 3): `coding-standard`.

## Regole rilevanti
- Muya: nessuna dipendenza Electron/Node, solo JS puro + DOM (CLAUDE.md §8). I mixin contentState si aggiungono come prototype.
- Nessuna modifica di logica in questo task: solo indagine + eventuale log temporaneo reversibile.
