# tabs-squared — plan — 2026-07-12 — NON DA FARE (decisione utente 2026-07-12)

> Decisione utente 2026-07-12: questo task NON va implementato (nemmeno come spike). Il plan
> resta come riferimento nel caso venga ripreso in futuro. Un Agent-Code avviato per errore è
> stato fermato prima di qualunque modifica al codice.

Origine: TODO.md: valutare per le tab un aspetto alternativo con bordi squadrati "stile Apple"
(possibile resa più gradevole). Task ESPLORATIVO/ESTETICO: l'output è una proposta visiva da far
valutare all'utente, non un cambio definitivo deciso a priori.

## Prerequisiti bloccanti
- Leggere `Completed/tab-bar-layout/tab-bar-layout.md` e `Completed/ui-v2/ui-v2.md` PRIMA di
  toccare il CSS delle tab (absolute design load-bearing, costanti JS↔CSS sync, token `--v2-*`).
- Solo CSS/token: NESSUNA modifica a markup/logica tab (drag, multi-row, hover-expand intatti).
- Decisione finale = dell'utente dopo confronto visivo.

## Obiettivo
1. Spike: variante CSS "squadrata" (border-radius ridotto/azzerato, eventuali bordi/separatori)
   applicata via classe o token alternativi, facilmente attivabile/disattivabile per confronto.
2. Screenshot/prova sul PC principale in light e dark.
3. Decisione utente: adottare, iterare o scartare. Se adottata → sostituire i valori nei token,
   rimuovere lo switch di spike.

## File da toccare (verificati, Agent-Explorer 2026-07-12)
- `src/renderer/src/components/editorWithTabs/tabs.vue`, `<style scoped>` righe 1169-1798 — UNICO
  file con lo stile delle tab. Punti per lo spike squadrato: `.v2-tab` `border-radius:100px`
  (1379-1403, nessun border esplicito); `.v2-tab-active` (1411-1416, surface+shadow);
  `.v2-tab-active::before` striscia accent (1427-1438); `.is-pinned` inset shadow (1453-1458);
  `.v2-tab-new-li` `border-radius:50%` (1510-1532); ghost drag `border-radius:100px` + border
  (1568-1582); `.v2-tr-btn` `border-radius:8px` (1683-1747).
- Token: `src/renderer/src/assets/styles/v2-tokens.css` (unica sorgente `--v2-*`, dark sotto
  `html[data-v2-theme='dark']` righe 47-64, import in `main.js:24`).
- ⚠️ SMENTITO l'assunto iniziale: i temi in `assets/themes/*.theme.css` NON definiscono token
  `--v2-*` (solo variabili legacy Muya) → non vanno toccati per questo restyle.

## Skill di codice
`coding-standard` (CSS).

## Test
PC principale: resa in light/dark, multi-row, tab pinnata, hover-expand, drag — tutto invariato
funzionalmente.
