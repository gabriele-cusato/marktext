<span class="lvl-badge lvl-4"></span>

# Implementazione: clone della scheda attiva

Quando la barra è multi-riga, `recomputePinnedTab` decide se mostrare il clone della scheda
attiva. Codice **reale** da `tabs.vue` (incluso via snippet):

```javascript title="src/renderer/src/components/editorWithTabs/tabs.vue (recomputePinnedTab)"
--8<-- "src/renderer/src/components/editorWithTabs/tabs.vue:438:464"
```

## Logica

- Se **non** è multi-riga (o non ci sono schede) → nessun clone (`pinnedTab = null`).
- `offsetTop` di ogni scheda dice in quale riga si trova. Si confronta la scheda attiva
  con la prima riga (`firstTop`).
- Se la scheda attiva è **nella prima riga** (`offsetTop <= firstTop`) → niente clone.
- Altrimenti il clone punta alla scheda attiva.

!!! note "Perché è una funzione separata"
    È estratta da `updateTabRowsLayout` perché il calcolo del clone deve poter girare
    **fuori dal lock di layout** (es. dopo un drag), altrimenti il clone non si aggiornava.
