<span class="lvl-badge lvl-4"></span>

# Implementazione: zona drag sulla tab bar

CSS **reale** da `tabs.vue` sul selettore `.v2-tabbar` (incluso via snippet):

```css title="src/renderer/src/components/editorWithTabs/tabs.vue (.v2-tabbar)"
--8<-- "src/renderer/src/components/editorWithTabs/tabs.vue:676:679"
```

- `-webkit-app-region: drag` → la barra diventa zona-titolo trascinabile.
- `app-region: drag` → forma non-prefissata[^prefix], per compatibilità futura.

## L'override sui figli interattivi

Gli elementi cliccabili dentro la barra annullano il drag:

```css
.v2-tab,
.v2-tab-new-li,
.v2-tr-btn {
  -webkit-app-region: no-drag;
}
```

Così il drag-finestra resta attivo solo sugli spazi vuoti della barra, mentre schede e
bottoni restano cliccabili.

## Dizionario

[^prefix]: *Prefisso vendor* (`-webkit-`) = forma sperimentale/proprietaria di una proprietà CSS; la versione senza prefisso è quella standard.
