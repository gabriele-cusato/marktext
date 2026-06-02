# Dirty flag (bollino "non salvato")

Il bollino = `tab.isSaved === false`. La verità è il confronto tra **contenuto editor**
e **`tab.originalMarkdown`** (baseline = ultima versione salvata/caricata; `null` per Untitled).

## Campi rilevanti sul tab

- `markdown` — contenuto corrente nello store.
- `originalMarkdown` — baseline per il confronto dirty.
- `isSaved` — flag bollino.
- `justLoaded` — **timestamp** (non booleano, B1). Finestra `LOAD_SETTLE_MS = 400ms`:
  durante questa finestra i content-change aggiornano `originalMarkdown` **senza** marcare
  dirty (Muya fa ≥2 pass di normalizzazione all'init).
- `pendingExternalChange` — modifica esterna rimandata per tab in background (B14).
- `trimTrailingNewline` — politica newline finale (0/1/3).

## Differenza Muya vs CodeMirror

- **Muya**: commit sincrono → `tab.markdown` sempre fresco.
- **CodeMirror**: commit debounced 1s → per ~1s `tab.markdown` può essere stale (radice di B8/B13).

Vedi anche [Salvataggio](salvataggio.md) per il flush `pre-save`.
