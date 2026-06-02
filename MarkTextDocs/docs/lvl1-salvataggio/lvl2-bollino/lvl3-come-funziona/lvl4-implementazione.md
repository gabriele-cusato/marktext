<span class="lvl-badge lvl-4"></span>

# Implementazione del pre-save flush

Codice **reale** preso live da `sourceCode.vue` (incluso via snippet, non copiato):

```javascript title="src/renderer/src/components/editorWithTabs/sourceCode.vue (handlePreSave)"
--8<-- "src/renderer/src/components/editorWithTabs/sourceCode.vue:324:347"
```

## Punti chiave

- `commitTimer` è il timer del debounce 1s: viene **cancellato** subito.
- `getMarkdownAndCursor(editor.value)` legge il contenuto **reale** di CodeMirror in quel momento.
- `LISTEN_FOR_CONTENT_CHANGE` è la mutation[^mutation] dello store: chiamandola qui, sincrona,
  `tab.markdown` è fresco prima che `FILE_SAVE` lo legga.
- Il commento nel codice spiega perché **non** si filtra per `isFirstLoad` (bug B13).

## Aggancio dell'evento

L'handler è registrato/deregistrato sul bus mitt[^mitt]:

```javascript
// onMounted
bus.on('pre-save', handlePreSave)
// onBeforeUnmount
bus.off('pre-save', handlePreSave)
```

!!! info "Perché Muya non ha questo problema"
    Muya committa in modo sincrono a ogni `change` → niente debounce → niente flush necessario.
    Infatti `editor.vue` non ascolta `pre-save`.

## Dizionario

[^mutation]: *Mutation* (Pinia) = funzione/azione dello store che modifica lo stato in modo tracciabile.
[^mitt]: *mitt* = piccola libreria di "event bus": permette a componenti diversi di scambiarsi eventi (`emit`/`on`) senza conoscersi.
