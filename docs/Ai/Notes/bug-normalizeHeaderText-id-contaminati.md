# BUG APERTO — warning `normalizeHeaderText`: testo heading contaminato da id interni

Stato: APERTO, senza repro (2026-07-13). Nessuna feature associata → tracciato qui.

## Sintomo
Warning in console:
```
exportMarkdown.js:189 normalizeHeaderText: ATX heading regex did not match:
ag-0-1jtc5k9ffag-1-1jtc5k9ff# tutto beneasdfasdf...
```
Il testo del blocco heading contiene id interni di blocco (`ag-0-<suffisso>` e
`ag-1-<suffisso>`, stesso suffisso) concatenati PRIMA del `# …`. Il warning è solo la spia
(il fallback in `exportMarkdown.js` è già presente e regge); il difetto vero è la
contaminazione del testo del blocco.

## Repro
NON nota. Tentativi utente 2026-07-13 senza successo: apertura sezione Preferences,
scrittura/modifica di testo in Muya, passaggio ripetuto a Source mode e ritorno —
il warning non ricompare. Momento originario della comparsa non ricordato.

## Prossimi passi (quando ricompare)
- Annotare SUBITO l'azione in corso (digitazione? salvataggio/snapshot? chiusura tab?
  highlight di ricerca?) e se possibile copiare il testo completo del warning.
- Poi Agent-Explorer su come `block.children[0].text` possa contenere chiavi di blocco.
  Sospetti da verificare: percorso export/snapshot che legge dal DOM, marker di highlight
  della ricerca, merge di blocchi.
