# residui-hard-task

## Scopo
Chiusura di 3 task "hard" da TODO.md che risultano essere **non implementabili come concepiti o già risolti** da feature precedenti. Nessuna modifica al codice — registrazione della risoluzione di ciascun task.

## Task chiusi (senza implementazione)

### BUILD-1 (patch-package)
**Motivo chiusura**: Censimento ha confermato che nessuna patch manuale esiste oggi nel repo (`patches/` non presente, nessun `postinstall` in package.json). L'utilità del setup `patch-package` richiede patch reali da proteggere. Senza patch attuali, il setup non serve.

**Decisione utente (2026-07-12)**: NON implementare. Setup annotato per il futuro in note esterna (strada disponibile se patch emergono).

**Azione collaterale**: `npm install` di pulizia eseguito sul PC principale 2026-07-12 (ha risolto `path-browserify` mancante in alias vite config).

### B-REV11 (accelerator duplicati)
**Motivo chiusura**: Ri-censimento dei keybindings ATTUALI (file `keybindings{Windows,Linux,Darwin}.js`) ha confermato **ZERO accelerator assegnati a più comandi** su tutte le piattaforme. I duplicati storici sono stati **dissolti dalle riassegnazioni di menu-shortcut-overhaul (Batch 1/1b 2026-07-09)**.

**Azione richiesta**: Aggiornare TODO.md (B-REV11 → dissolto da menu-shortcut-overhaul).

**Nota**: Eventuali conflitti residuali tra keybindings file e accelerator hardcoded nei menu template / shortcut Electron rimangono fuori scope del censimento automatico — monitorare se emergono runtime (nessun conflitto segnalato fino a ora).

### M-REV10 (resync DOM↔store post-drag)
**Motivo chiusura**: Esplorazione grep esaustiva ha confermato che la funzione `resyncDomToStore` (o varianti `resync/domOrder`) **NON esiste nel codice attuale**. Il reorder tab usa solo `computeDragTarget` + `EXCHANGE_TABS_BY_ID` (store).

**Conclusione**: La funzione è stata **già rimossa dalla migrazione `drag-html5-dnd`** (feature 2026-07-XX, documented in `Completed/drag-html5-dnd/drag-html5-dnd.md:18` + task2-worklog:24,90). Il riferimento nel TODO.md/HARD-TASK.md è obsoleto (citava righe pre-migrazione).

**Azione richiesta**: Aggiornare TODO.md (M-REV10 → risolto/obsoleto da drag-html5-dnd).

## Modifiche al codice
**Nessuna**. I tre task non hanno prodotto modifiche al sorgente, solo documentazione della risoluzione e decisioni di chiusura.

## Da tenere a mente

**Nessun dato carico-bearing per il futuro** — i tre task sono "cleanup" amministrativo di TODO.md, NON feature implementative. Le loro chiusure non introducono invarianti da preservare nelle modifiche future.

**patch-package strada disponibile**: Se in futuro emerge la necessità di patch manuali a node_modules (es. bug non risolti a monte, o workaround temporaneo), la strada per impostare `patch-package` è conosciuta e annotata.

**TODO.md aggiornamento**: I tre task vanno segnati come chiusi/risolti nel TODO.md principale, per evitare riletture future.
