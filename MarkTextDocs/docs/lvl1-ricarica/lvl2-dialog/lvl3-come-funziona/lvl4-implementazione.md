<span class="lvl-badge lvl-4"></span>

# Implementazione: loadChange

Inizio dell'azione `loadChange` nello store. Codice **reale** da `editor.js` (incluso via snippet):

```javascript title="src/renderer/src/store/editor.js (loadChange — inizio)"
--8<-- "src/renderer/src/store/editor.js:116:144"
```

## Punti chiave

- Destruttura[^destructuring] i metadati dal `change`: `encoding`, `lineEnding`, `trimTrailingNewline`… →
  il file ricaricato **conserva** codifica e fine-riga (vedi anche [Salvataggio › Formato](../../../lvl1-salvataggio/lvl2-formato-eol/index.md)).
- `getSingleFileState(...)` crea un nuovo stato documento dai dati del disco.
- Cerca il tab con `isSamePathSync`[^isamepath] (confronto robusto di percorsi).
- Se il tab è stato chiuso nel frattempo → errore gestito + notifica (niente crash).

Più sotto nello stesso metodo, `loadChange` salva la vecchia history (per poter ripristinare)
ed emette `file-changed` con `forceReload: true`, così l'editor sorgente fa `setValue` reale
anche se è la stessa tab.

## Dizionario

[^destructuring]: *Destrutturazione* = sintassi JavaScript per estrarre più proprietà da un oggetto in una sola riga.
[^isamepath]: *isSamePathSync* = funzione che confronta due percorsi file in modo robusto (gestisce maiuscole, separatori, ecc.).
