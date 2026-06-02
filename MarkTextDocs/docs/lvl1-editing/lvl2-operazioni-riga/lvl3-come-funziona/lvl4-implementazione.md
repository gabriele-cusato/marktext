<span class="lvl-badge lvl-4"></span>

# Implementazione: comando swapLineUp

Registrazione del comando su `codeMirror.commands`. Codice **reale** da `codeMirror/index.js`
(incluso via snippet):

```javascript title="src/renderer/src/codeMirror/index.js (swapLineUp)"
--8<-- "src/renderer/src/codeMirror/index.js:24:56"
```

## Punti chiave

- Il commento in cima spiega **perché** non si importa l'addon Sublime (conflitti).
- `cm.isReadOnly()` → guardia: se sola-lettura, restituisce `codeMirror.Pass` (lascia passare).
- `cm.operation(...)` → racchiude tutte le modifiche in **una** operazione atomica[^atomic] (un solo
  evento di undo, un solo refresh).
- L'origin[^origin] `'+swapLine'` sulle `replaceRange` marca le modifiche (utile per la history).

`swapLineDown` è simmetrico (sotto nello stesso file).

## Dizionario

[^atomic]: *Operazione atomica* = blocco di modifiche trattato come una sola (un solo undo, un solo refresh).
[^origin]: *Origin* (CodeMirror) = etichetta su una modifica che ne indica la provenienza (utile per undo/history).
