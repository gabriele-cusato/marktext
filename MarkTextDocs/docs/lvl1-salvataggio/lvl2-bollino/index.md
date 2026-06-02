<span class="lvl-badge lvl-2"></span>

# Il pallino "non salvato"

Ogni scheda tiene traccia di **due versioni** del documento: quella che stai vedendo
nell'editor e quella attualmente scritta sul disco. Il pallino sulla scheda indica
semplicemente che **le due versioni sono diverse**.

## Quando appare e quando sparisce

- **Appare** appena il contenuto dell'editor diverge dall'ultima versione salvata/caricata.
- **Sparisce** quando salvi (`Ctrl+S`)… ma anche se **annulli** (`Ctrl+Z`) fino a tornare
  esattamente al testo di partenza: in quel caso non ci sono più differenze, quindi niente pallino.

## Un dettaglio non ovvio

In modalità **testo grezzo** (l'editor "tipo blocco note") il pallino può reagire con un
attimo di ritardo rispetto alla modalità WYSIWYG. Non è un difetto casuale: dipende da
**come** le due modalità comunicano le modifiche internamente. Il perché tecnico è spiegato
nel livello successivo.

[Approfondisci: come funziona →](lvl3-come-funziona/index.md){ .md-button .md-button--primary .lvl-cta .lvl-3 }
