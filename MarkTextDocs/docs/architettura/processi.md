# Processi e IPC

## I tre processi

| Processo | Cartella | Modulo | Ruolo |
|---|---|---|---|
| **Main** | `src/main/` | CommonJS | operazioni di sistema, finestre, I/O file |
| **Renderer** | `src/renderer/` | ES Modules | UI Vue 3, interazione utente |
| **Preload** | `src/preload/` | CommonJS | ponte IPC, espone API sicure al renderer |

## Comunicazione IPC

Main e renderer comunicano via IPC con eventi prefissati `mt::`.

```javascript
// Renderer → Main
window.electron.ipcRenderer.send('mt::save-file', data)

// Main → Renderer
win.webContents.send('mt::file-saved', result)
```

!!! danger "Regola critica sugli handler IPC"
    Un handler `ipcMain.on` può essere chiamato da **due lati** con primo argomento diverso:

    | Chiamante | Come chiama | Primo arg |
    |---|---|---|
    | Renderer | `ipcRenderer.send('canale', data)` | `IpcMainEvent` → usa `BrowserWindow.fromWebContents(event.sender)` |
    | Main | `ipcMain.emit('canale', browserWindow, data)` | il `BrowserWindow` direttamente |

    **Prima** di cambiare la firma di un handler, grep **entrambi** i pattern. Una firma sola non serve i due chiamanti.

I canali registrati in `windowManager.js` **senza** prefisso `mt::` (es. `watcher-watch-file`)
sono chiamati **solo dal main** via `ipcMain.emit`. Il renderer non li usa.
