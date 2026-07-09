# recent-files — plan — 2026-07-09

Sostituire la vecchia funzione **quick-open** (che mostra solo i tab attualmente aperti) con una
**Recent Files**: elenco dei file aperti di recente (percorsi assoluti), max ~10-12, senza duplicati,
il più recente in cima, ordine aggiornato ad ogni apertura, persistito su disco.

## Scoperta chiave: l'infrastruttura esiste già (lato main)

`src/main/menu/index.js` ha GIÀ tutta la logica richiesta, oggi usata per la jump-list OS + menu Linux:

- `addRecentlyUsedDocument(filePath)` (riga 49): dedupe (`splice`/`unshift`), cap a
  `MAX_RECENTLY_USED_DOCUMENTS = 12` (riga 15), **most-recent-first**, persiste su
  `recently-used-documents.json` in `userDataPath` (`RECENTS_PATH`, riga 33).
- `getRecentlyUsedDocuments()` (riga 87): legge/valida la lista dal JSON.
- Chiamata ad **ogni apertura file**: `src/main/app/index.js:1005, 1026, 1089`.

Nota piattaforma: su Windows/Linux il JSON viene mantenuto; su macOS `addRecentlyUsedDocument`
esce prima (riga 53 `if (isOsx) return`) e usa `app.addRecentDocument` (recent OS). Per il command
palette serve una lista leggibile dal renderer → su macOS il JSON potrebbe non essere popolato.
**Da decidere** (vedi sotto): togliere il `return` anticipato su macOS così il JSON è mantenuto ovunque.

Conseguenza: **non si costruisce da zero**. Basta esporre `getRecentlyUsedDocuments()` al renderer e
sostituire la sorgente dati di `QuickOpenCommand`.

## Modifiche proposte

### 1. Main — esporre la lista via IPC
Aggiungere un handler IPC `mt::get-recently-used-documents` che ritorna `getRecentlyUsedDocuments()`.
- **Accesso all'istanza AppMenu (verificato):** l'AppMenu è creata in `app/accessor.js:26`
  (`this.menu = new AppMenu(...)`) ed è raggiungibile come `this._accessor.menu` dalle classi main (già
  usata così in `app/index.js:994,1071` e `windows/editor.js:47,455`). Registrare l'handler dove
  l'accessor è disponibile (es. metodo di setup IPC in `app/index.js`) e ritornare
  `this._accessor.menu.getRecentlyUsedDocuments()`.
- Usare `ipcMain.handle` + `ipcRenderer.invoke` (richiesta/risposta pulita).

### 2. Main — mantenere il JSON anche su macOS (DECISO: cross-platform)
Decisione utente: feature **cross-platform**. In `addRecentlyUsedDocument` (`menu/index.js:53`) rimuovere
il `return` anticipato su macOS così anche lì la lista JSON viene aggiornata, **mantenendo comunque**
`app.addRecentDocument(filePath)` (jump-list OS). Verificare che il resto della funzione (dedupe/cap/save)
non abbia assunzioni non-macOS.

### 2b. Max voci (DECISO: 10, costante globale)
`MAX_RECENTLY_USED_DOCUMENTS` è oggi **12** (`menu/index.js:15`), usato anche per jump-list OS + menu
Linux. Decisione utente: **abbassare la costante globale a 10** (unico punto, coerenza palette + menu OS;
jump-list ridotta a 10 accettabile — confermato).

### 3. Renderer — trasformare `QuickOpenCommand` in "Recent Files"
`src/renderer/src/commands/quickOpen.js`:
- In `run()` sostituire la sorgente `_editorState.tabs.map(t => t.pathname)` con la lista ottenuta via
  IPC `mt::get-recently-used-documents`.
- Filtrare i percorsi non più esistenti su disco (opzionale: verifica esistenza file, o lasciare che
  l'apertura fallisca con messaggio).
- `executeSubcommand` resta invariato: apre per path (`mt::open-file-by-window-id`).
- Rinominare id/descrizione da `file.quick-open` a qualcosa come `file.recent-files` **oppure** tenere
  l'id e cambiare solo label/comportamento (meno punti da toccare — vedi sotto grep).

### 4. Label / i18n
Aggiornare la descrizione del comando (`descriptions.js` → `commands.file.quickOpen`) e le stringhe
locali in `static/locales/` per riflettere "Recent Files" invece di "Quick Open".

### 5. Shortcut
La Ctrl+P era in conflitto con `file.print` ed è **già stata rimossa** dal binding di `file.quick-open`
(win/linux/darwin). Recent Files resta raggiungibile via command palette. Se si vuole una shortcut
dedicata, sceglierne una libera (vedi plan `menu-shortcut-overhaul`) — NON riusare Ctrl+P.

## Grep obbligatori prima di implementare (regola CLAUDE.md)
```
file.quick-open   → commands/index.js (export+registrazione), commandCenter, main/commands/file.js,
                    common/commands/constants.js, descriptions.js, keybindings* (già svuotati)
QuickOpenCommand  → commands/index.js (export), dove viene istanziato/registrato nel command center
mt::open-file-by-window-id  → handler main che apre il file (riuso invariato)
```
## Decisioni (tutte confermate)
- Cross-platform: **SÌ**. → punto 2.
- Max voci: **10**, costante globale. → punto 2b.
- Filtrare i file non più esistenti: **SÌ** — filtrarli dalla lista prima di mostrarla.
- Id comando: **tenere `file.quick-open`** internamente (cambiare solo sorgente dati + label), meno punti
  da toccare; rinominare eventualmente in un secondo momento.

## Test (sul PC principale — build bloccato su questo, vedi memory)
- Aprire più file → command palette "Recent Files" → mostra i percorsi, più recente in cima.
- Riaprire un file già in lista → risale in cima, nessun duplicato.
- Superare il max → la lista si tronca.
- Riavviare l'app → la lista persiste (letta dal JSON).

## Stato
Plan **completo e pronto**. Tutte le decisioni chiuse; accesso `appMenu` risolto (`this._accessor.menu`,
punto 1). Nessun unknown bloccante residuo. Attende solo il via per delega ad Agent-Code (non ancora
lanciato). Verifica finale runtime sul PC principale.
