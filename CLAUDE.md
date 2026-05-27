# Agent Guidelines

| ------------------ | --------------------------------- |
| User preferences   | `src/main/preferences/`           |
| Keyboard shortcuts | `src/main/keyboard/`              |
| Menu definitions   | `src/main/menu/templates/`        |
| Vue components     | `src/renderer/src/components/`    |
| Pinia stores       | `src/renderer/src/store/`         |
| CSS themes         | `src/renderer/src/assets/themes/` |
| Editor engine      | `src/muya/lib/`                   |
| Translations       | `static/locales/`                 |
| Build icons        | `build/`                          |

## Getting Help

- **Existing docs**: `docs/` folder has detailed documentation
- **Developer docs**: `docs/dev/` for architecture and build info
- **Original repo**: https://github.com/marktext/marktext (historical reference)
- **This fork**: https://github.com/Tkaixiang/marktext

## Summary for Quick Reference

```
Main Process (Node.js)     →  src/main/
Renderer Process (Vue 3)   →  src/renderer/src/
Preload (IPC Bridge)       →  src/preload/
Editor Engine (Muya)       →  src/muya/
Shared Code                →  src/common/
User Preferences           →  src/main/preferences/schema.json
Translations               →  static/locales/
Build Config               →  electron-builder.yml
Vite Config                →  electron.vite.config.mjs
```

When in doubt, check the existing patterns in the codebase and follow them.

# AI Agent Guide for MarkText

This guide is designed for AI agents (Claude, GPT, Copilot, etc.) loading into this repository for the first time. It provides essential context to help you understand, navigate, and contribute to this codebase effectively.

## Quick Overview

**MarkText** is a cross-platform markdown editor built with:

- **Electron 39** - Desktop application framework
- **Vue 3** - Frontend UI framework (Composition API)
- **Pinia** - State management
- **electron-vite** - Build system (Vite-based)
- **Muya** - Custom WYSIWYG markdown editor engine (in `src/muya/`)

This a new fork by **Peter Thomson** of the fork recent by [Tkaixiang](https://github.com/Tkaixiang/marktext) that modernized the original MarkText with Vue 3, Pinia, and electron-vite.

## Project Structure

```
marktext/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   ├── app/           # App controller, window management
│   │   ├── menu/          # Application menus
│   │   ├── preferences/   # User settings (schema.json)
│   │   ├── commands/      # Command system
│   │   ├── keyboard/      # Keyboard shortcuts
│   │   ├── filesystem/    # File operations, watchers
│   │   └── windows/       # Window classes
│   │
│   ├── renderer/src/      # Electron renderer (Vue 3 SPA)
│   │   ├── pages/         # Top-level pages (app.vue, preference.vue)
│   │   ├── components/    # Vue components
│   │   ├── store/         # Pinia stores
│   │   ├── prefComponents/# Preference UI components
│   │   └── assets/        # CSS, icons, themes
│   │
│   ├── preload/           # Preload scripts (IPC bridge)
│   │
│   ├── muya/              # Markdown editor engine (DO NOT MODIFY LIGHTLY)
│   │   └── lib/
│   │       ├── contentState/  # Document state management
│   │       ├── parser/        # Markdown parsing (marked.js)
│   │       ├── ui/            # Editor UI components
│   │       └── eventHandler/  # Input handling
│   │
│   └── common/            # Shared utilities (both processes)
│
├── static/                # Static assets
│   ├── locales/           # i18n JSON files (9 languages)
│   └── preference.json    # Default preferences
│
├── docs/                  # Documentation
│   └── dev/               # Developer docs
│
├── build/                 # Build resources (icons)
├── electron-builder.yml   # Packaging configuration
└── electron.vite.config.mjs  # Vite build config
```

## Key Concepts

### 1. Process Architecture

| Process  | Location        | Module Type | Purpose                                        |
| -------- | --------------- | ----------- | ---------------------------------------------- |
| Main     | `src/main/`     | CommonJS    | System operations, window management, file I/O |
| Renderer | `src/renderer/` | ES Modules  | Vue 3 UI, user interaction                     |
| Preload  | `src/preload/`  | CommonJS    | IPC bridge, exposes safe APIs to renderer      |

### 2. IPC Communication

Main and renderer communicate via IPC with `mt::` prefixed event names:

```javascript
// Renderer → Main
window.electron.ipcRenderer.send('mt::save-file', data)

// Main → Renderer
win.webContents.send('mt::file-saved', result)
```

### 3. State Management (Pinia)

Key stores in `src/renderer/src/store/`:

- `editor.js` - Document tabs, content, file tree (largest store)

- `preferences.js` - User settings

- `layout.js` - UI layout state

- `project.js` - Open folder/project

- `commandCenter.js` - Command palette
  
  # AI Agent Guide for MarkText

This guide is designed for AI agents (Claude, GPT, Copilot, etc.) loading into this repository for the first time. It provides essential context to help you understand, navigate, and contribute to this codebase effectively.

## Quick Overview

**MarkText** is a cross-platform markdown editor built with:

- **Electron 39** - Desktop application framework
- **Vue 3** - Frontend UI framework (Composition API)
- **Pinia** - State management
- **electron-vite** - Build system (Vite-based)
- **Muya** - Custom WYSIWYG markdown editor engine (in `src/muya/`)

This a new fork by **Peter Thomson** of the fork recent by [Tkaixiang](https://github.com/Tkaixiang/marktext) that modernized the original MarkText with Vue 3, Pinia, and electron-vite.

## Project Structure

```
marktext/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   ├── app/           # App controller, window management
│   │   ├── menu/          # Application menus
│   │   ├── preferences/   # User settings (schema.json)
│   │   ├── commands/      # Command system
│   │   ├── keyboard/      # Keyboard shortcuts
│   │   ├── filesystem/    # File operations, watchers
│   │   └── windows/       # Window classes
│   │
│   ├── renderer/src/      # Electron renderer (Vue 3 SPA)
│   │   ├── pages/         # Top-level pages (app.vue, preference.vue)
│   │   ├── components/    # Vue components
│   │   ├── store/         # Pinia stores
│   │   ├── prefComponents/# Preference UI components
│   │   └── assets/        # CSS, icons, themes
│   │
│   ├── preload/           # Preload scripts (IPC bridge)
│   │
│   ├── muya/              # Markdown editor engine (DO NOT MODIFY LIGHTLY)
│   │   └── lib/
│   │       ├── contentState/  # Document state management
│   │       ├── parser/        # Markdown parsing (marked.js)
│   │       ├── ui/            # Editor UI components
│   │       └── eventHandler/  # Input handling
│   │
│   └── common/            # Shared utilities (both processes)
│
├── static/                # Static assets
│   ├── locales/           # i18n JSON files (9 languages)
│   └── preference.json    # Default preferences
│
├── docs/                  # Documentation
│   └── dev/               # Developer docs
│
├── build/                 # Build resources (icons)
├── electron-builder.yml   # Packaging configuration
└── electron.vite.config.mjs  # Vite build config
```

## Key Concepts

### 1. Process Architecture

| Process  | Location        | Module Type | Purpose                                        |
| -------- | --------------- | ----------- | ---------------------------------------------- |
| Main     | `src/main/`     | CommonJS    | System operations, window management, file I/O |
| Renderer | `src/renderer/` | ES Modules  | Vue 3 UI, user interaction                     |
| Preload  | `src/preload/`  | CommonJS    | IPC bridge, exposes safe APIs to renderer      |

### 2. IPC Communication

Main and renderer communicate via IPC with `mt::` prefixed event names:

```javascript
// Renderer → Main
window.electron.ipcRenderer.send('mt::save-file', data)

// Main → Renderer
win.webContents.send('mt::file-saved', result)
```

### 3. State Management (Pinia)

Key stores in `src/renderer/src/store/`:

- `editor.js` - Document tabs, content, file tree (largest store)
- `preferences.js` - User settings
- `layout.js` - UI layout state

---

## Fork Info

Fork attivo: https://github.com/peterjthomson/marktext (PeterJThomson, basato su fork Tkaixiang)
Stack completo: Electron + electron-vite + Vue3 + Pinia + Vitest + Playwright

## Prerequisiti Build

- Node.js **22.21.1** (usa nvm: `nvm install 22.21.1` + `nvm use 22.21.1`)
- Python >= 3.12
- VS2022 con workload **"Desktop development with C++"** + componente **"MSVC v143 Spectre-mitigated libs (x64/x86)"**

## Comandi principali

```bash
npm install              # installa dipendenze
npm run dev              # avvia in dev (hot reload solo renderer)
npm run build:win        # build produzione Windows
npm run test:unit        # unit test con Vitest
npm run test:unit:watch  # watch mode
npm run test:e2e         # e2e con Playwright (fa build prima)
```

## Entry Points

- `src/main/index.js` — avvio app, eseguito una volta
- `src/renderer/main.js` — montaggio Vue per ogni finestra editor

## Hot Reload & Dev Notes

- Main e preload NON hanno hot reload → riavviare processo dev dopo modifica
- Renderer ha hot reload ma perde stato → fare full reload se comportamento strano
- Compile target: main/preload → CommonJS; renderer → ESModules only; common → solo Node.js API (usabile da main/renderer); muya → solo JS puro + DOM/BOM (no Electron/Node)

## Flow apertura file

`File > Open` → evento `app-open-file-by-id` → `App.openTab()` → `mt::open-new-tab` → `src/renderer/store/editor.js`

Dettagli IPC: `docs/dev/code/IPC.md`

## Regole di verifica obbligatoria (imparate da bug reali)

### IPC handler — firma del primo argomento

In questo progetto esistono **due pattern di chiamata** per gli handler `ipcMain.on`:

| Chiamante | Come chiama | Primo arg nel handler |
|-----------|-------------|----------------------|
| Renderer | `ipcRenderer.send('channel', data)` | `IpcMainEvent` → usare `BrowserWindow.fromWebContents(event.sender)` |
| Main process | `ipcMain.emit('channel', browserWindow, data)` | `BrowserWindow` direttamente |

**Prima di cambiare la firma di un handler esistente**, eseguire sempre entrambi i grep:
```
ipcMain.emit('nome-channel'        ← chiamate da main process
ipcRenderer.send('nome-channel'    ← chiamate da renderer
```
Se esistono chiamate da entrambi i lati, la firma non può soddisfarli entrambi → servono due channel separati o un branch interno.

### Canali senza prefisso `mt::` in windowManager.js

I canali registrati in `windowManager.js` **senza** prefisso `mt::` (es. `watcher-watch-file`, `watcher-unwatch-file`, `window-add-file-path`, ecc.) sono chiamati **esclusivamente dal main process** via `ipcMain.emit`. Il renderer non li usa e non deve usarli.

### Prima di aggiungere un ipcRenderer.send

Verificare se il main process gestisce già quell'evento in un altro percorso. Esempio: chiusura tab → il renderer manda `mt::window-tab-closed` → il main chiama `removeFromOpenedFiles` → che già emette `watcher-unwatch-file`. Aggiungere un secondo send dal renderer per lo stesso scopo causa conflitti di firma o doppia esecuzione.

### Prima di modificare una funzione condivisa

Cercare **tutti i siti di chiamata** con grep prima di cambiare firma, tipo di argomento o comportamento:
```
grep -r "nomeFunzione\|'nome-channel'" src/
```
Non fermarsi al primo risultato trovato. Verificare anche le chiamate indirette (es. funzione A chiama B che chiama il channel).

### Prima di assumere che "nessun altro usa X"

Se stai modificando un handler, un evento bus, o un metodo che esiste già nel codice: assumere sempre che qualcun altro lo chiami finché il grep non dimostra il contrario.

---

## Checklist generale di verifica (applicare PRIMA di scrivere codice)

Queste regole valgono per qualsiasi modifica, non solo IPC. Lo scopo è rendere obbligatorio il check prima di dare per scontato qualcosa.

### 1. Prima di cambiare firma / tipo di argomento di qualsiasi funzione o handler

- Grep tutti i siti di chiamata (`nomeFunzione(`, `'nome-channel'`)
- Verificare le chiamate indirette: funzione A → chiama B → usa il channel
- Se i caller sono in processi diversi (main vs renderer), la firma può non essere la stessa per tutti

### 2. Prima di aggiungere una nuova funzionalità / costante / channel / evento bus

- Grep per verificare che non esista già con nome diverso
- Verificare che il comportamento desiderato non sia già gestito da un altro percorso nel codice (es. evento già emesso altrove, azione già eseguita da un handler esistente)
- Doppia esecuzione dello stesso effetto è spesso peggio dell'assenza

### 3. Prima di rimuovere o rinominare qualsiasi cosa visibile dall'esterno

Qualsiasi cosa "visibile dall'esterno" include: funzioni esportate, proprietà Pinia, eventi bus, canali IPC, classi CSS, nomi di prop Vue, costanti condivise.
- Grep tutti i file che la usano (non solo il file corrente)
- Verificare anche i file di test, locales, menu templates

### 4. Prima di modificare CSS (classi, variabili custom)

- Grep la variabile / classe in tutti i file `.css`, `.vue`, `.js`
- Le variabili `--custom-property` possono essere usate in temi multipli (`src/renderer/src/assets/themes/`)
- Cambiare un valore in un file non aggiorna gli override negli altri temi

### 5. Prima di aggiungere un `bus.on` in un componente Vue

- Verificare che esista il corrispondente `bus.off` in `onBeforeUnmount` — listener orfani causano esecuzioni multiple dopo rimount
- Verificare che nessun altro componente già ascolti lo stesso evento e faccia la stessa cosa (doppia esecuzione)

### 6. Prima di assegnare una scorciatoia da tastiera

- Grep il channel/comando nei file `keybindings*.js` per verificare che la combinazione non sia già assegnata
- Verificare anche i comandi di sistema Electron che non passano dai file keybindings

### 7. Prima di modificare lo shape di un Pinia store (aggiungere/rinominare proprietà)

- Grep i componenti che usano `storeToRefs` o accedono direttamente alla proprietà
- I getter hanno la stessa sintassi delle proprietà state — verificare che il nuovo nome non collida con un getter esistente

### 8. Prima di modificare Muya (`src/muya/lib/`)

- Muya è engine isolato (no Electron, no Node, solo JS puro + DOM)
- I mixin di `contentState` si aggiungono come prototype — grep `ContentState.prototype.nomeMetodo` per verificare che non esista già in un altro mixin
- Modifiche a Muya impattano **sia** la modalità WYSIWYG **sia** tutto ciò che chiama `editor.value.*` nei componenti Vue

### 9. Prima di modificare un flusso asincrono (IPC, promise, watcher)

- Identificare tutti i punti di ingresso del flusso, non solo quello che stai toccando
- Verificare chi gestisce l'errore: se un handler non risponde, il chiamante si blocca silenziosamente?
- Verificare la simmetria start/stop: ogni `watch` ha un `unwatch`, ogni `on` ha un `off`, ogni risorsa aperta viene chiusa

---

## TODO

Vedi e modifica `TODO.md` nella root del progetto (`C:\Projects\MarkText\TODO.md`).
