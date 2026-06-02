<span class="lvl-badge lvl-3"></span>

# Come funziona la ricarica

Il watch dei file gira nel **processo main**[^mainproc] (usa `chokidar`[^chokidar]). Il renderer (UI) **non**
avvia né ferma il watch direttamente.

## La catena su modifica esterna

1. `watcher.js` rileva il `change`, rilegge il file con `loadMarkdownFile`.
2. Manda al renderer `mt::update-file` con il nuovo contenuto.
3. `LISTEN_FOR_FILE_CHANGE` (store `editor.js`) decide:
   - scheda **attiva** → emette `file-changed-externally` → mostra il dialogo;
   - scheda **in background** → salva `tab.pendingExternalChange`, niente dialogo (lo mostra
     allo switch).

## La scelta dell'utente

- **Ricarica** → `loadChange(change)`: rimpiazza lo stato del tab col contenuto del disco,
  imposta `isSaved=true` e ricarica l'editor (con `forceReload`).
- **Annulla** → `markDivergedFromDisk`: baseline al nuovo disco + `isSaved=false` → il
  pallino compare e resta, senza toccare contenuto/history.

!!! danger "Invariante IPC"
    Gli handler del watcher (`watcher-watch-file`…) **non** hanno prefisso `mt::` e sono
    chiamati **solo** dal main via `ipcMain.emit(channel, browserWindow, …)` → firma `(win, …)`.
    Non chiamarli dal renderer.

[Vedi il codice: implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }

## Dizionario

[^mainproc]: *Processo main* = il processo Node.js di Electron che gestisce sistema e file, separato dall'interfaccia (renderer).
[^chokidar]: *chokidar* = libreria Node.js che sorveglia i file e segnala quando cambiano.
