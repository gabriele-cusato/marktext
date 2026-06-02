# Prerequisiti e avvio

Come preparare l'ambiente e far partire MarkText in sviluppo.

## Prerequisiti

| Strumento | Versione |
|---|---|
| Node.js | **22.21.1** (consigliato via `nvm`) |
| Python | ≥ 3.12 |
| Visual Studio 2022 | workload **"Desktop development with C++"** + **MSVC v143 Spectre-mitigated libs (x64/x86)** |

!!! tip "Node con nvm"
    ```bash
    nvm install 22.21.1
    nvm use 22.21.1
    ```

## Comandi principali

```bash
npm install              # installa le dipendenze
npm run dev              # avvia in sviluppo (hot reload solo renderer)
npm run build:win        # build di produzione Windows
npm run test:unit        # unit test con Vitest
npm run test:e2e         # end-to-end con Playwright (fa build prima)
```

## Note su hot reload

!!! warning "Cosa NON ha hot reload"
    - **Main** e **preload**: nessun hot reload → riavvia il processo dev dopo una modifica.
    - **Renderer**: ha hot reload ma **perde lo stato** → in caso di comportamento strano, fai un full reload.

## Entry point

- `src/main/index.js` — avvio app, eseguito una volta.
- `src/renderer/main.js` — montaggio Vue per ogni finestra editor.

Vedi il codice di avvio reale in [Codice sorgente](../codice/index.md).
