# Session Persistence — Backup Periodico, Restore, Chiusura Silenziosa

**Scopo:** documenta la persistenza della sessione stile Notepad++ — backup periodico di tab non salvate in `userData/backup/`, restore al boot, chiusura silenziosa della finestra. Leggere PRIMA di toccare: salvataggio, chiusura tab/finestra, watcher, state editor.

**Origine:** `HARD-TASK.md` sezione H2 (2026-06-21, implementato da OPUS).

**Quando leggerlo:** app non ripristina tab al boot / session.json corrotto / backup non viene scritto / chiusura non è silenziosa / file unlink falso dopo save.

**Stato:** ✅ Implementato e verificato a runtime (utente macOS 2026-06-21, Linux/Windows in smoke-test). **Prerequisito per H5 detach multi-finestra.**

---

## Modello NPP (Notepad++)

**Spec utente osservato (2026-06-21):** chiudo l'app → riapro → ritrovo tutte le tab, anche untitled/non salvate; **nessun popup "vuoi salvare?"**

- Auto-salva i file modificati ogni N secondi in cartella backup
- Alla chiusura con modifiche non salvate NON chiede di salvare
- Tiene il backup e ricarica da lì al riavvio
- Default timer: **7 secondi**
- Path configurabile (NPP è hardcoded; qui configurabile)

---

## Architettura Realizzata (Main = IO, Renderer = Stato)

### Layout su Disco

**Directory:** `<userData>/backup/` (o cartella scelta via preferenza).

**File:**
- `session.json` = indice ordinato delle tab (pathname, isSaved, isActive, pinned, hasBackup, cursor, encoding/eol)
- `<id>.snapshot` = contenuto SOLE tab non al sicuro su disco (untitled o file dirty)

**Scrittura atomica:** tmp+rename, riusa il pattern R7 di `filesystem/index.js`. Cleanup snapshot orfani ad ogni scrittura (simmetria create/delete).

### Backup Periodico (Renderer, Owner)

- `setTimeout` ricorsivo con intervallo = pref secondi
- Scrive SOLO se `contentVersion` cambiato (niente I/O inutile)
- `bus.emit('pre-save')` PRIMA di leggere `tab.markdown` (flush sincrono del source debounced, invariante B8/B13 di `editor-core`)

### Chiusura Silenziosa (Owner, Feature ON)

- In `LISTEN_FOR_CLOSE`, intercetta `mt::ask-for-close`
- `pre-save` → `mt::session-save-and-close` (main scrive **await** e POI `window-close-by-id`)
- Nessun popup
- Feature OFF o finestra non-owner → flusso popup attuale identico (zero regressioni)

### Restore al Boot

- `app/index.js createWindow()` → se `sessionSnapshotEnabled` && `hasSessionSync` && nessun file da CLI
- `_restoreSessionWindow()` (finestra con `_isRestoreSession=true` → NIENTE blank tab)
- Bootstrap manda `isRestore`; renderer invia `mt::request-session-restore`
- Main risolve tab (file da disco freschi + watcher via `addToOpenedFiles`; snapshot per dirty/untitled)
- Risponde con `mt::restore-session` → action `RESTORE_SESSION` ricostruisce tab in ordine, attiva quella giusta, riordina pinnate-prima
- File sparito → Untitled + notifica `mt::show-notification`

### Owner (Finestra Principale)

- Prima editor window (`_sessionOwnerAssigned` in `app/index.js`)
- Flag `_isSessionOwner` nella EditorWindow → bootstrap → module var `isSessionOwner` nel renderer
- SOLO owner fa backup+close silenzioso
- Le altre mantengono il popup (no perdita dati) — **stesso limite di NPP** (solo prima istanza)

---

## File Toccati (8)

### Nuovo

- **`src/main/filesystem/session.js`** — IO: `resolveBackupDir`, `writeSession` (snapshot+indice+cleanup atomici), `hasSessionSync`, `loadSessionTabs` (risolve file da disco + snapshot, gestisce file mancanti)

### Main (No Hot Reload)

- **`src/main/windows/editor.js`** — flag `_isRestoreSession`/`_isSessionOwner`; `addBlankTab` soppressa in restore; `isRestore`/`isSessionOwner` nel payload `mt::bootstrap-editor`
- **`src/main/app/index.js`** — import session + `WindowLifecycle`; **single-window gate in `_createEditorWindow`**; helper `_getExistingEditorWindow`; owner dinamico; `_restoreSessionWindow(appendFiles, rootDir)`; branch restore-first+append; append file CLI nel handler `mt::request-session-restore`; 4 handler IPC (`mt::session-save`, `mt::session-save-and-close`, `mt::request-session-restore`, `mt::select-session-backup-path`)
- **`src/main/preferences/schema.json`** + **`static/preference.json`** — 3 pref: `sessionSnapshotEnabled` (default **true**), `sessionBackupPath` (default `""`), `sessionBackupInterval` (default **7** secondi). ⚠️ I default REALI vengono da preference.json STATICO; schema = solo validazione

### Renderer (Hot Reload)

- **`src/renderer/src/store/preferences.js`** — 3 default mirror + action `SELECT_SESSION_BACKUP_PATH`
- **`src/renderer/src/store/editor.js`** — module vars `isSessionOwner`/`sessionBackupTimer`/`lastBackupVersion`; bootstrap branch `isRestore`; close silenzioso in `LISTEN_FOR_CLOSE`; nuove action `COLLECT_SESSION`/`RESTORE_SESSION`/`LISTEN_FOR_SESSION`
- **`src/renderer/src/pages/app.vue`** — registra `LISTEN_FOR_SESSION()` in onMounted
- **`src/renderer/src/prefComponents/general/index.vue`** — sezione "Session snapshot & periodic backup" (bool + range secondi + folder-picker). Testi **hardcoded in inglese** (lezione ITEM-PERF-WARN)

---

## Complessità e Rischi

- **Complessità:** alta (~450 righe)
- **Rischio:** medio — contenuto da canale sessione PARALLELO (non passa da `FILE_SAVE`, non tocca `handlePreSave`/baseline/`pendingSavedMarkdown`); gate `contentVersion`; feature gated da preferenza (OFF = comportamento identico)
- **⚠️ File MAIN:** no hot reload → RIAVVIARE `npm run dev`

---

## Single-Window Stile Notepad++ (2026-06-21)

**Limite 1 RISOLTO:** aprire file (CLI/doppio-click) con feature ON → **ripristina sessione E accoda il file** come ultima tab. Se file **già aperto**, porta solo focus su quella tab (no doppione).

Boot: `createWindow()` fa restore-first + passa file CLI a `_restoreSessionWindow` → main DOPO `mt::restore-session` chiama `openTabsFromPaths` (dedup via `isSamePathSync`).

**Limite 2 RISOLTO:** **single-window**: con feature ON NON si apre mai 2ª finestra. Chokepoint UNICO `_createEditorWindow` (tutto passa lì: New Window, `--new-window`, apertura file, `openFilesInNewWindow`): se finestra editor esiste la **riusa** (apre lì tab + `bringToFront`); "New Window" puro → nuova tab vuota.

OS-level single-instance lock già esiste. Owner sempre l'unica finestra → determinato dinamicamente (`_getExistingEditorWindow()===null`, corretto anche macOS re-activate).

Con feature OFF: multi-finestra come prima (zero regressioni).

---

## Test Runtime (Verificati Utente 2026-06-21)

- ✅ **T1 default ON**: prima apertura → Preferences→General c'è "Session snapshot" **spuntato**, intervallo 7s
- ✅ **T2 chiusura silenziosa**: apri tab con modifiche → chiudi finestra → **NESSUN popup**, si chiude subito
- ✅ **T3 restore completo**: 3 untitled scritte + 1 untitled vuota + 2 file esterni dirty + 2 file salvati → chiudi → riapri → **tutte 8 tab**, stesso ordine, tab attiva giusta, bollino dirty giusto, contenuto corretto
- ✅ **T4 crash-safety**: scrivi in untitled, attendi ~8s (ciclo backup), **killa processo** (Task Manager) → riapri → contenuto ripristinato (≤ intervallo perso)
- ✅ **T5 path configurabile**: Preferences → "Select folder" → scegli → chiudi/riapri → sessione in quella cartella
- ✅ **T6 intervallo**: porta a 1s → `session.json` si aggiorna più spesso
- ✅ **T7 file esterno cambiato**: tra sessioni, modifica file salvato ripristinato → al reload dialog watcher (riuso meccanismo esistente)
- ✅ **T8 file esterno cancellato**: cancella su disco file dirty → al restore riapre come **Untitled** + notifica
- ✅ **T9 feature OFF**: spegni pref → popup "salvare?" riappare; al riavvio NON ripristina
- ✅ **T10 pinned + source/Muya**: pinna 2 tab, lasciane 1 in source con testo non committato → chiudi/riapri → pinnate restano prime, testo salvato (grazie `pre-save` flush)
- ✅ **T11 cleanup**: salva tab dirty → snapshot sparisce da cartella
- ✅ **T12 apertura file = restore + append**: sessione esistente, apri file da CLI → ripristina **tutta** sessione E aggiunge quel file. Se già in sessione → niente doppione, focus su quella tab
- ✅ **T13 single-window**: app aperta, apri altro file → **nessuna 2ª finestra**, tab si aggiunge. "New Window" → **nuova tab**, non finestra
- ✅ **T14 feature OFF = multi-finestra**: spegni → "New Window" torna a creare finestre separate

---

## macOS / Linux (Risposta Domanda Utente 2026-06-21)

**Cartella cross-platform corretta:** `app.getPath('userData')` è API Electron cross-platform:
- Win: `%APPDATA%\marktext`
- macOS: `~/Library/Application Support/marktext`
- Linux: `~/.config/marktext` (o `$XDG_CONFIG_HOME`)

Scrittura atomica (fs-extra) OS-agnostica. Timer renderer OS-agnostico.

**macOS VERIFICATO DALL'UTENTE (2026-06-21, build firmato):** backup in `~/Library/Application Support/marktext/backup`, restore + close silenzioso OK.

**Note comportamento macOS:** 
- `window-all-closed` NON chiude l'app → chiudendo finestra sessione si salva comunque, re-activate dal dock → restore
- Owner ricalcolato dinamicamente

**Linux:** smoke-test consigliato (no problema architetturale atteso; `app.getPath('userData')` risolve `~/.config/marktext`).

---

## Bug Runtime Risolti (2026-06-21)

**`Error: An object could not be cloned`** ai `send` di `mt::session-save` (tick periodico) e `mt::session-save-and-close` (X chiusura).

**Causa:** `COLLECT_SESSION` ritorna oggetti con **proxy reattivi Pinia/Vue** (cursor/encoding) → structured-clone IPC non li serializza.

**Fix:** `deepClone(this.COLLECT_SESSION())` ai due `send` (stesso idioma già usato per `deepClone(unsavedFiles)`).

---

## Mappa File

| Cosa | File |
|---|---|
| Session IO atomico | `src/main/filesystem/session.js` |
| Owner e restore window | `src/main/app/index.js`, `src/main/windows/editor.js` |
| Backup periodico e close | `src/renderer/src/store/editor.js` |
| Pref backup | `src/main/preferences/schema.json`, `static/preference.json`, `src/renderer/src/store/preferences.js` |
| UI pref | `src/renderer/src/prefComponents/general/index.vue` |
| Bootstrap | `src/renderer/src/pages/app.vue` |

---

## Cross-Link

- **Editor Core** (`editor-core/editor-core.md`): invarianti `pre-save`, B8/B13, `handlePreSave` senza guardie
- **Drag & Detach** (`drag-detach-multi-window/drag-detach-multi-window.md`): H5 (multi-finestra-aware) usa questa session architecture
