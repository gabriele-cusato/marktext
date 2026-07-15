# recent-files — worklog

Plan di riferimento: `recent-files-plan.md` (completo, tutte le decisioni chiuse).

## Avanzamento

- [x] Main: handler IPC `mt::get-recently-used-documents` (`ipcMain.handle`, ritorna
  `this._accessor.menu.getRecentlyUsedDocuments()`) — aggiunto in `src/main/app/index.js`
  subito dopo l'handler `mt::next-untitled-index`, stesso metodo di setup IPC.
- [x] Main: rimuovere il `return` anticipato macOS in `addRecentlyUsedDocument`
  (`menu/index.js:53`), mantenendo `app.addRecentDocument` — rimosso, `getRecentlyUsedDocuments`
  ora aggiorna dedupe/cap/save su tutte le piattaforme; nessuna assunzione non-macOS residua nel
  resto della funzione. Nota: `clearRecentlyUsedDocuments` (poco sotto) ha un `if (isOsx) return`
  analogo ma NON è nello scope di questo task (il plan menziona solo `addRecentlyUsedDocument`) —
  lasciato invariato.
- [x] Main: `MAX_RECENTLY_USED_DOCUMENTS` 12 → 10 (`menu/index.js:15`)
- [x] Renderer: `QuickOpenCommand` (`commands/quickOpen.js`) — `run()` ora usa
  `ipcRenderer.invoke('mt::get-recently-used-documents')` invece di `_editorState.tabs`. Filtro
  file non più esistenti: NON aggiunto lato renderer, perché già presente lato main dentro
  `getRecentlyUsedDocuments()` (filtro preesistente `isFile2(f) || isDirectory2(f)`, menu/index.js
  righe ~94-96) — la lista arriva già ripulita, requisito soddisfatto senza duplicare la verifica.
  Aggiunto anche un guard `if (recentDocuments.length === 0) throw new Error(null)` per preservare
  il comportamento preesistente di `run()` (non mostrare la palette quando non c'è nulla da
  elencare) — adattamento minimo, non richiesto esplicitamente dal plan ma necessario perché la
  vecchia condizione era basata su tabs/projectTree, non più pertinente con la nuova fonte dati.
- [x] Label/i18n: descrizione comando → "Recent Files". `descriptions.js` già puntava a
  `commands.file.quickOpen` (nessuna modifica necessaria lì); cambiata solo la stringa in
  `static/locales/en.json` (`quickOpen: "Quick Open"` → `"Recent Files"`). Le altre 8 lingue
  (zh-TW, fr, ko, zh-CN, pt, es, ja, de — tutte con chiave `quickOpen` alla stessa struttura)
  NON toccate come da istruzione: da allineare nel task successivo `locales-align`.
- [x] Grep obbligatori del plan eseguiti (`file.quick-open`, `QuickOpenCommand`,
  `mt::open-file-by-window-id`) — nessun riferimento incoerente trovato, id comando invariato
  ovunque (commands/index.js, editor.js, descriptions.js, main/commands/file.js, keybindings*,
  common/commands/constants.js).

## Stato: DA TESTARE

## Test

Esito utente (2026-07-12/13, PC principale): OK — palette "Recent Files" funzionante,
nessuna anomalia riportata. Feature chiusa (vedi anche recent-files-icon).
