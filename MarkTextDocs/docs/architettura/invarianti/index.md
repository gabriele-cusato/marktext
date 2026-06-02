# Invarianti critiche

!!! danger "Leggere prima di toccare editor, salvataggio, dirty flag, watcher o selezione"
    Queste decisioni sono **volute**. Romperle reintroduce bug già risolti.

Questo ramo raccoglie le invarianti, divise per argomento (espandi a sinistra):

- [Dirty flag (bollino)](dirty-flag.md)
- [Salvataggio](salvataggio.md)
- [Colori selezione](colori-selezione.md)

## Indice rischi — "se tocchi… attenzione a…"

| Se tocchi… | Cosa controllare PRIMA |
|---|---|
| **Selezione / evidenziazione** | `cursorActivity` (`sourceCode.vue`) fa già il dirty check (N12) e arma il `commitTimer`. Per i colori usa `--cmSelectionColor`, non `--selectionColor`. |
| **Salvataggio / autosave** | Flusso `pre-save` flush, baseline `originalMarkdown`, lightTouch. **Non** aggiungere guardie a `handlePreSave`. |
| **Chiusura tab** | I path di close **non** passano da `UPDATE_CURRENT_FILE` (edge B14). |
| **Toggle Muya↔source** | `_applySourceCodeForFile` PRIMA di `file-changed`; guard `handleFileChange`; `cmStatePerTab`. |
| **Watcher / ricarica** | Avvio watch dal **main** (`ipcMain.emit`, firma `(win,…)`); handler senza `mt::` non dal renderer. |
| **Shortcut** | Gli accelerator di menu Electron **precedono** gli `extraKeys` di CodeMirror → routing mode-aware via `bus`. |
| **CSS / temi** | Token in `v2-tokens.css`; un valore in un tema non aggiorna gli override negli altri. |

## Mappa file chiave

| Area | File |
|---|---|
| Store editor (dirty, save, reload, tab) | `src/renderer/src/store/editor.js` |
| Source editor (CodeMirror) | `src/renderer/src/components/editorWithTabs/sourceCode.vue` |
| WYSIWYG editor (Muya wrapper) | `src/renderer/src/components/editorWithTabs/editor.vue` |
| Dialog reload esterno | `src/renderer/src/components/editorWithTabs/fileChangedDialog.vue` |
| Token design system v2 | `src/renderer/src/assets/styles/v2-tokens.css` |
| Watcher file | `src/main/filesystem/watcher.js` |
