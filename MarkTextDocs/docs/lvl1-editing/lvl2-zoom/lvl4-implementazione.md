<span class="lvl-badge lvl-4"></span>

# Implementazione: zoom solo-testo

Listener sul contenitore dell'editor. Codice **reale** da `index.vue` (incluso via snippet):

```javascript title="src/renderer/src/components/editorWithTabs/index.vue (onContainerWheel)"
--8<-- "src/renderer/src/components/editorWithTabs/index.vue:74:79"
```

## Punti chiave

- `if (!e.ctrlKey) return` → senza Ctrl, comportamento normale (scroll).
- `e.preventDefault()` → **sopprime** lo zoom nativo di Chromium su tutta la pagina.
  Richiede che il listener sia registrato con `{ passive: false }` (un listener passive non
  può chiamare `preventDefault`).
- `bus.emit('mt::window-zoom-direction', ...)` → l'evento porta la direzione (`in`/`out`);
  chi ascolta applica il nuovo `font-size` a Muya e a CodeMirror (con `cm.refresh()`).

!!! info "Perché un evento sul bus"
    Lo zoom va applicato a editor diversi (Muya o CodeMirror) a seconda della modalità:
    centralizzare la decisione su un evento evita di duplicare la logica nei due componenti.
