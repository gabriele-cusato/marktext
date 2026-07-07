# electron-upgrade — fix1 — worklog: safe-file:// immagini locali (E43)

## Avanzamento
- [x] Sostituito il blocco `if (isWindows ...)` con la versione a due rami (triple-slash + host)
- [x] Aggiornato il commento esplicativo delle due forme URL
- [x] Verificato che non ci siano altre occorrenze di parsing `safe-file` da allineare nel file

## Test
Test utente 2026-07-07 (PC principale, Electron 43): **OK**. Immagini locali con path con spazi/OneDrive
renderizzano in dev e nell'app pacchettizzata (`build:win`). Nessun `ERR_UNEXPECTED`/`ERR_FILE_NOT_FOUND`
per le immagini servite via `safe-file`.

Residuo NON bloccante (candidato FIX #3): in console compaiono due `Not allowed to load local resource:
file:///C:/Users/.../CrossDevice/OnePlus 15 (1)/.../Screenshot_....jpg` per due immagini con path con
spazi+parentesi. Le immagini si vedono comunque → probabile tentativo `file://` (bloccato, loggato) con
fallback a `safe-file://` che funziona. Da valutare se sopprimere il tentativo `file://` a monte. Non
regressione di FIX #1 (che copre lo scheme safe-file).
