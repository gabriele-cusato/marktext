# Untitled Counter Globale — Counter Condiviso Multi-Finestra, Monotono

**Scopo:** fix di **BUG-H5-UNTITLED**: il numero delle tab "Untitled-N" è ora un counter unico e globale condiviso tra **TUTTE le finestre** aperte. Comportamento **monotono**: una volta assegnato un numero N, non viene mai riusato (nemmeno dopo chiusura della tab) finché l'app resta aperta.

**Origine:** `HARD-TASK.md` sezione H5-RE (2026-06-28 handoff + aggiornamento 2026-07-04), BUG-H5-UNTITLED.

**Quando leggerlo:** il counter Untitled si ripete tra finestre / detach non avanza il numero / restore dal disco causa collisioni.

**Stato:** ✅ Implementato 2026-07-04. ✅ Verificato utente runtime (detach multi-finestra, bidirezionalità, restore, monotonia). ✅ BUG-H5-UNTITLED CHIUSO.

---

## Root Cause

**Calcolo locale nel renderer:** `src/renderer/src/store/help.js`, funzione `getBlankFileState(tabs, ...)` calcolava `untitleId = Math.max(...tabs.map(...))` **sulle sole tab locali** della finestra corrente (`f.pathname === ''`). Conseguenza: due finestre parallele riassegnavano gli stessi numeri e persino lo stesso numero poteva salire su una finestra durante il detach cross-finestra (bidirezionalità interrotta).

---

## Soluzione Realizzata

### 1. Counter Globale nel Main Process
**`src/main/app/index.js`:**
- Campo `this._untitledIdSeq = 0` nel costruttore (vicino a `_sessionRegistry`).
- Handler IPC `ipcMain.handle('mt::next-untitled-index', (event, localMax) => { ... })` che:
  - Riceve `localMax` = max calcolato localmente dal renderer (protezione per edge case: restore, detach, quando il main non ha ancora visto tab existing).
  - Aggiorna il counter: `this._untitledIdSeq = Math.max(this._untitledIdSeq, Number(localMax) || 0)`.
  - Incrementa atomico (sincrono, senza await): `return ++this._untitledIdSeq`.

### 2. Bump Passivo dal Registro Sessione
**`src/main/app/index.js` handler `mt::session-save` e `mt::session-save-and-close`:**
- Ad ogni periodico salvataggio sessione, estrae il max dei numeri Untitled dalle tab existing (`pathname === ''`).
- Aggiorna il counter globale: `this._untitledIdSeq = Math.max(this._untitledIdSeq, max)`.
- Copre detach, restore, e qualunque drift senza toccare flussi esistenti.

### 3. Renderer Asincrono con Fallback
**`src/renderer/src/store/editor.js`, azione `NEW_UNTITLED_TAB`:**
- Resa `async`.
- Chiama `await ipcRenderer.invoke('mt::next-untitled-index', getLocalUntitledMax(this.tabs))` per ottenere N dal main.
- Try/catch: se invoke fallisce, fallback a calcolo locale (N = null, usa logica precedente).
- Passa N a `getBlankFileState(tabs, ..., forcedNumber = N)`.

### 4. Helper Estratto e Riusato
**`src/renderer/src/store/help.js`:**
- Funzione `getLocalUntitledMax(tabs)` estrae il calcolo del max locale (stessa regex/guard NaN).
- Riusata sia nel fallback di `getBlankFileState` sia come `localMax` inviato al main.
- Parametro aggiunto `forcedNumber = null` a `getBlankFileState`: se valido, usa quello; altrimenti comportamento precedente (fallback).

### 5. Seed al Boot
**`src/main/app/index.js`, handler `mt::request-session-restore`:**
- Al restore normale (da `loadSessionTabs`), estrae il max dai filename Untitled della sessione salvata.
- Al detach (via `_createDetachWindow`), bump da `_bumpUntitledSeqFromTabs([tab])`.
- Non necessaria modifica a `session.js`: il bump passivo + `localMax` coprono tutti i flussi.

---

## File Toccati

| File | Modifica |
|------|----------|
| `src/main/app/index.js` | Counter globale `_untitledIdSeq`, handler `ipcMain.handle('mt::next-untitled-index')`, bump nei `mt::session-save` / `mt::session-save-and-close`, seed in `mt::request-session-restore` |
| `src/renderer/src/store/editor.js` | Azione `NEW_UNTITLED_TAB` resa async, invoke con try/catch fallback locale |
| `src/renderer/src/store/help.js` | Helper `getLocalUntitledMax(tabs)`, parametro `forcedNumber` a `getBlankFileState` |

---

## Decisione di Design Implementata

**Monotonia:** il counter non riusa mai un numero liberato finché l'app è aperta. Cambio di comportamento rispetto al "max vivo locale" di prima, accettato dall'utente 2026-07-04: elimina collisioni cross-finestra e comportamento incoerente durante detach.

---

## Test Runtime (Utente 2026-07-04)

✅ **TUTTO OK — "funziona ottimo":**

1. **Detach di file salvato:** finestra 1 crea Untitled fino a -3, detach file salvato → finestra 2, nuova tab in finestra 2 = **Untitled-4** (non riparte da 1).
2. **Bidirezionalità:** finestra 1 fino a -6, detach di Untitled-6 → finestra 2, nuova tab in finestra 2 = **Untitled-7**; poi nuova tab in **finestra 1** = **Untitled-8** (counter globale avanza per entrambe).
3. **Restore e monotonia:** riavvio app con sessione contenente Untitled-5 → prima nuova tab = **Untitled-6** (no collisioni). Chiudere Untitled-3 e crearne una nuova = **Untitled-9** (3 non riusato).
4. **Nessuna regressione:** single-window non toccato, tab numerate in crescita, nessun breakage.

---

## Trappole e Scelte Vincolanti

1. **Atomicità della incrementazione:** il `++counter` nel main deve essere sincrono (no `await` tra lettura e incremento). Node è single-thread, quindi è atomico. Mantenere questa invariante.

2. **Fallback locale critico:** se il canale IPC fallisce (main crash, comunicazione persa), il renderer non lascia l'utente bloccato: usa il calcolo locale di riserva. Mantenere il try/catch.

3. **localMax come protezione:** il rendering passa `localMax` al main per coprire i casi in cui il counter main non ha ancora visto tab existing (restore massivo, detach subito dopo boot). Non togliere questo parametro per non riaprire derive.

4. **Bump passivo > seed esplicito:** il bump negli handler `mt::session-save` copia il principio di least surprise: il main "conosce" le tab esistenti dai periodici salvataggi, senza bisogno di logica speciale per restore/detach/creazione. Non aggiungere seed esplicito in `session.js` (già confermato nel worklog: scomodo e non necessario).

5. **Monotonia accettata:** il numero non è riusabile. Questo differisce dal "max vivo locale" di prima ed è una scelta user-facing. Mantenere finché non cambino i requisiti.

---

## Cross-Link

- **[drag-detach-multi-window](../drag-detach-multi-window/drag-detach-multi-window.md)** — Contesto H5-B multi-finestra dove questo bug si manifestava. BUG-H5-UNTITLED ora risolto in questa feature.
