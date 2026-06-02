# Funzionalità (Task 1–10)

Stato finale delle funzionalità implementate. Tutte ✅ testate (ultimo giro 2026-05-30).

| # | Argomento | Stato |
|---|---|---|
| 1 | Conversione EOL (CRLF/LF/CR, preserva quello del file) | ✅ |
| 2 | Rilevamento/conversione encoding (`ced` + `iconv-lite`) | ✅ |
| 3 | UPPERCASE / lowercase (globale Muya + source) | ✅ |
| 4 | Operazioni riga (sposta/duplica/elimina, solo source) | ✅ |
| 5 | Copia percorso file dal context menu tab | ✅ |
| 6 | Zoom testo Ctrl+rotella (solo testo, non UI) | ✅ |
| 7 | Word Wrap toggling (solo source) | ✅ |
| 8 | Selezione visibile in source mode (temi scuri) | ✅ |
| 9 | Ricarica file modificato esternamente | ✅ |
| 10 | Pulizia console.log di debug | ✅ |

## Dettaglio

??? abstract "1 — Conversione EOL"
    Supporta CRLF (`\r\n`), LF (`\n`), CR (`\r`). `loadMarkdownFile`
    (`main/filesystem/markdown.js`) rileva l'EOL realmente presente e lo **preserva**;
    `preferredEol` solo come fallback. Non forza l'EOL dell'OS (non "sporca" un file Unix su Windows).

??? abstract "2 — Encoding"
    `ced` + `iconv-lite`. Flusso: BOM → deterministico; solo-ASCII → default `utf8`;
    byte > 0x7F → euristica `ced`. Scrittura: `iconv.encode(..., {addBOM})`. Vedi fix [B3](../bug/index.md).

??? abstract "3 — UPPERCASE / lowercase"
    `Ctrl+Shift+U` = MAIUSCOLO, `Ctrl+U` = minuscolo. **Globale** in entrambe le viste.
    Source: `cm.replaceSelections(...)`. Muya: `ContentState.prototype.changeSelectionCase`.

??? abstract "4 — Operazioni riga (solo source)"
    - **Sposta riga** `Ctrl+Shift+↑/↓` → `swapLineUp`/`swapLineDown` (registrati su `codeMirror.commands`, non built-in CM5).
    - **Duplica** `Ctrl+D`, **Elimina** `Ctrl+L`.
    - In **Muya** il line-move via Alt+frecce è **disabilitato** (era distruttivo).
    - Split (`Ctrl+I`) / Join (`Ctrl+J`): non implementati (in `TODO.md`).

??? abstract "6 — Zoom testo"
    Listener `wheel {passive:false}` su `.container`: con `ctrlKey` → `preventDefault()`
    (sopprime lo zoom nativo Chromium) + aggiorna il fattore. Muya: `fontSize`; CodeMirror:
    `font-size` + `cm.refresh()`.

## Riferimenti shortcut

| Tasto | Markdown (Muya) | Source (CodeMirror) |
|---|---|---|
| `Ctrl+Shift+U` | MAIUSCOLO | MAIUSCOLO |
| `Ctrl+U` | minuscolo | minuscolo |
| `Ctrl+D` | `format.strike` | duplica riga/blocco |
| `Ctrl+L` | `format.hyperlink` | elimina riga |
| `Ctrl+Shift+↑/↓` | estende selezione cross-block (B10) | sposta riga |
| `Ctrl+0` | `tabs.switchToTenth` (NON per reset zoom) | idem |
