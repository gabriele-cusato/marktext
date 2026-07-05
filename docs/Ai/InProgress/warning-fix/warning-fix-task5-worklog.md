# warning-fix — task5 — worklog

**Stato: DA TESTARE**

## Avanzamento
- [x] Grep CSS `.el-dialog__title` / `.el-dialog__header` (temi inclusi) - nessun uso di `.el-dialog__title`; `.el-dialog__header` usato in index.css, tweet/index.vue, rename/index.vue, key-input-dialog.vue. Verificato nel sorgente Element Plus (dialog-content.vue) che l'elemento `<header class="el-dialog__header">` avvolge sia lo slot title sia lo slot header: nessun adattamento CSS necessario
- [x] Rinomina #title → #header in key-input-dialog.vue
- [x] Rinomina #title → #header in tweet/index.vue
- [x] Rinomina #title → #header in rename/index.vue
- [x] Rinomina #title → #header in editorWithTabs/editor.vue (dialog tabella)
- [x] Verifica compatibilità slot header (props/markup) su sorgente Element Plus - confermato in `node_modules/element-plus/es/components/dialog/src/dialog-content.vue_vue_type_script_setup_true_lang.mjs`: `renderSlot(_ctx.$slots, "header", ...)` sostituisce il contenuto di default (span con classe `el-dialog__title`) mantenendo lo stesso `<header class="el-dialog__header">` come contenitore; nessuna prop richiesta dallo slot per l'uso attuale (contenuto statico, nessun uso di close/titleId/titleClass)
- [x] Build di verifica - `npm run build` completata con successo (exit 0)

## Test
- 2026-07-06 (utente): dialog OK, nessun ElementPlusError. Task CHIUSO.
- Nota: durante il test del rename scoperto errore NON legato a questo task (`selectionChange:
  expected cursor but cursor is null` via RENAME_FILE): tracciato nella feature editor-ui-fixes.
