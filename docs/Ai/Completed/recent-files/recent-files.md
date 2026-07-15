# recent-files

## Scopo
Sostituire la vecchia funzione "Quick Open" (lista tab aperti) con una **Recent Files**: elenco persistito di file aperti di recente (max 10, più recente in cima). Accessibile via command palette (Ctrl+K, poi digita "Recent Files") e icona nella tab bar.

## Modifiche

### File principali modificati
1. **src/main/menu/index.js**
   - Rimosso `return` anticipato per macOS in `addRecentlyUsedDocument` → lista JSON aggiornata su tutte le piattaforme
   - Abbassato `MAX_RECENTLY_USED_DOCUMENTS` da 12 a 10

2. **src/main/app/index.js**
   - Aggiunto handler IPC `mt::get-recently-used-documents` che ritorna la lista via `this._accessor.menu.getRecentlyUsedDocuments()`

3. **src/renderer/src/commands/quickOpen.js**
   - `run()` sostituisce sorgente dati da tab locali a lista via IPC `mt::get-recently-used-documents`
   - Aggiunto guard per lista vuota (comportamento preesistente preservato)

4. **static/locales/en.json**
   - Aggiornato `quickOpen` label da "Quick Open" a "Recent Files"
   - Le altre 8 lingue alignate nel task `locales-align`

5. **src/renderer/src/components/editorWithTabs/tabs.vue** (parte icon)
   - Aggiunta icona SVG nella sezione destra (clock history style), tra cartella e palette
   - Handler `openRecentFiles()` emette `bus.emit('cmd::execute', 'file.quick-open')` → apre palette nel modo Recent Files
   - Timing: ignora silenziosamente click nei primi ~400ms dal bootstrap se comando non registrato

## Da tenere a mente

**Cross-platform persistenza**: Prima della rimozione del `return` anticipato su macOS, il JSON restava vuoto lì mentre la jump-list OS funzionava. Adesso il JSON è mantenuto su tutte le piattaforme (assieme a `app.addRecentDocument` per macOS). Non riaprire il `return` anticipato.

**Coordinamento tab bar**: L'icona recent-files è nella sezione destra della tab bar insieme a command palette e cartella. È preveduta per essere raccolta dall'hamburger nella feature `window-minwidth-hamburger` sotto 700px. Non spostare l'icona da quella posizione.

**Test esito**: Utente (2026-07-12/13, PC principale) OK — palette "Recent Files" funzionante, list persistence confermata. Feature chiusa.
