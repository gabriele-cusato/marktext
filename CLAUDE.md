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

## TODO

Vedi e modifica `TODO.md` nella root del progetto (`C:\Projects\MarkText\TODO.md`).
