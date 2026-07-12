# Idee: miglioramenti codice e nuove feature

Raccolta del 2026-07-08. Origine: analisi dei riassunti in `docs/Ai/Completed/` + verifiche sul codice.
Regola guida (DECISIONS 2026-07-07): preferire la strada solida/pulita, no pezze; ogni voce va
proposta e confermata prima di implementare. Le voci sono candidate, NON approvate.

Legenda costo: 🟢 basso · 🟡 medio · 🔴 alto (feature dedicata).

---

## 1. Miglioramenti codice

### A — Dipendenze native da eliminare

| # | Voce | Costo | Note |
|---|------|-------|------|
| A1 | **keytar → `safeStorage`** (API nativa Electron) | 🟢 | keytar archiviato upstream. Uso confinato in `src/main/dataCenter/index.js` (3 chiamate). Esempio esplicito di "strada solida" in DECISIONS. Migrare formato storage token; l'uploader immagini non è usato dall'utente → rischio pratico quasi nullo |
| A2 | **ced → detector encoding JS** (es. `chardet`) | 🟢 | `ced` usato solo in `src/main/filesystem/encoding.js`, già lazy-load con fallback null + euristica propria `isValidUtf8`/windows-1252. Sostituzione localizzata |
| A3 | **fuzzaldrin → alternativa mantenuta** (fuse.js/fuzzysort) | 🟡 | Dep ferma al 2016; causa l'alias `path-browserify` in vite config. 5 siti d'uso (`filter`), 3 dentro muya → serve pure-JS. Verificare ranking risultati in quickInsert/emoji/prism |

**A1+A2 insieme**: sparisce lo step `@electron/rebuild --only ced,keytar` da tutti gli script di
build → build più semplice, niente ricompilazione nativa su macchina con policy (native-keymap
resta ma è N-API, carica senza rebuild).

### B — Robustezza / sicurezza

| # | Voce | Costo | Note |
|---|------|-------|------|
| B1 | **Patch CodeMirror perse** | 🟢/🟡 | VERIFICATO: `node_modules/codemirror` è vanilla — le guard di ui-v2 (mapFromLineView, posFromMouse) NON ci sono più; patch-package (S3) mai fatto. Strade: (a) se i crash click/cursore non si sono più visti dopo vari `npm install`, dichiararle superflue (markRaw era il fix radice) e aggiornare ui-v2.md; (b) se servono, reimplementarle nel wrapper renderer (try/catch), fuori da node_modules. Prima: chiedere all'utente se i crash sono ricomparsi |
| B2 | **Preload → `sandbox:true`** | 🔴 | Oggi il preload espone `fs` completo (`window.fileUtils`: read/write/unlink su qualunque path) e forza `sandbox:false`. Strada solida: spostare l'I/O in main via IPC scoped, preload senza Node. Seguito naturale di renderer-no-node-integration. Da pianificare come feature dedicata |
| B3 | **Residuo ripgrep nel renderer** | 🟢 | La ricerca è nel main (dataCenter usa `vscodeRgPath` proprio), ma il preload espone ancora `window.rgPath` e `src/renderer/src/node/paths.js` sopravvive (importato da bootstrap.js). Verificare ultimo call-site e ripulire |

### C — Rimandati di electron-upgrade (regola: warning notato → fix se possibile)

| # | Voce | Costo | Note |
|---|------|-------|------|
| C1 | **FIX #3 — warning `Not allowed to load local resource: file:///…`** | 🟢/🟡 | Path con spazi/parentesi: il render tenta `file://` prima del fallback `safe-file`. Fix a monte nel chokepoint `getImageInfo` di muya (idempotente, invariante task10 warning-fix). `correctImageSrc` NON si tocca (output persistito su disco) |
| C2 | **Dialog Open parte da Download** (breaking UX E43) | 🟢 | Tracciare ultima cartella usata e passare `defaultPath` al dialog |
| C3 | **postinstall auto-download binario Electron** | 🟢 | Script con `--use-system-ca`; evita il download manuale ai prossimi upgrade |

### D — Minori / bloccati

- ~~**B-REV11** accelerator duplicati~~: DISSOLTO 2026-07-12 — ri-censimento post
  menu-shortcut-overhaul: zero duplicati su tutte le piattaforme.
- **Muya `render(true)` lag su documenti grandi**: intervenire solo se lag notato davvero
  (follow-up in ricerca-e-utility.md).
- ~~**Lint giro 2**~~: risolto a 0 il 2026-07-06; nota `lint-da-correggere.md` eliminata
  (esiti registrati in `packages-update-fix.md` §B giro 2).
- **NON proposto**: split di `store/editor.js` (~2270 righe) o `tabs.vue` (~1800). File grandi ma
  pieni di invarianti documentate; split = rischio senza problema reale (contro la regola no-forzature).

### B4 — Watcher: polling automatico per percorsi a rischio (idea futura, 2026-07-12)
Oggi `watcherUsePolling` sta diventando una preferenza manuale (feature `preferences-refinement`).
Evoluzione possibile: individuare dal path del file aperto se è a rischio di notifiche OS mancanti
(percorso di rete UNC `\\server\...`, drive mappato, cartelle sync note) e attivare il polling
SOLO per quei file, automaticamente, lasciando le notifiche native per i path locali. Elimina la
scelta manuale; costo: euristica di rilevazione + watcher misto per-path in `filesystem/watcher.js`.

---

## 2. Feature utente

| # | Voce | Costo | Note |
|---|------|-------|------|
| U1 | **Riapri tab chiusa (`Ctrl+Shift+T`)** | 🟢 | Stack "tab chiuse di recente" + voce context menu. La sessione serializza già tutto lo stato tab (pathname, cursore, encoding): trattenere gli ultimi N stati chiusi in memoria. Gap reale vs Notepad++/browser |
| U2 | **File recenti nella command palette** | 🟢 | IN CORSO 2026-07-12: feature `recent-files` (`InProgress/recent-files/`, plan pronto + task icona tab bar) |
| U3 | **Cronologia locale dei file (mini-timeline)** | 🟡 | Ogni save conserva le ultime N versioni in `userData/history/` (riusa il pattern snapshot atomico tmp+rename della sessione). Context menu tab → "Restore previous version". Copre l'errore irreversibile (salvato per sbaglio, Ctrl+Z esaurito). Coerente con la filosofia crash-safe di session-persistence |
| U4 | **Diff tab vs disco / tra due tab** | 🟡 | CodeMirror 5 ha addon `merge` ufficiale. Caso killer: nel dialog "file changed on disk" mostrare il diff prima di scegliere Reload/Keep (oggi si sceglie alla cieca). Secondo uso: confronto tra due tab aperte (staple Notepad++) |
| U5 | **Outline/TOC documento in sidebar** | 🟡 | Sidebar già esistente (oggi solo ricerca, `sideBarIcons`). Aggiungere icona "outline": heading del doc corrente, click → jump. Non viola la decisione No-IDE (è document-level, non project-level). NB: esisteva un `view.toggle-toc` (accelerator `Ctrl+K`, da liberare per H3 commenti — vedi editor-advanced.md): verificare cosa resta di quel percorso prima di costruire |
| U6 | **Ctrl+Tab in ordine MRU** | 🟢 | Switch tab stile IDE: ultima tab usata per prima. Verificare binding attuale |
| U7 | **Word count / tempo lettura in status bar** | 🟢 | Chip "1.234 words · 5 min". Word count già calcolato in `cursorActivity` (P-REV2) |

## 3. Feature manutenzione progetto

| # | Voce | Costo | Note |
|---|------|-------|------|
| M1 | **CI GitHub Actions** (lint + unit + e2e su push/PR) | 🟢/🟡 | Vitest + 11 e2e Playwright esistono ma girano solo a mano sul PC principale. CI = gate automatico contro le regressioni sulle invarianti (dirty-flag, save, drag). Miglior rapporto costo/beneficio della lista |
| M2 | **Test unit sulle invarianti documentate** | 🟡 (a lotti) | lightTouch merge, normalizeMarkdown vs normalizeBlock, baseline B9, getMarkdownForSave: funzioni pure → testabili senza Electron. Ogni bug chiuso B1-B14 diventa un test che ne impedisce il ritorno |
| M3 | **Raccolta diagnostica in-app** | 🟢 | `electron-log` già presente. Aggiungere handler `uncaughtException`/`unhandledRejection` con report su file + menu Help → "Open logs folder" / "Copy diagnostic info". Oggi i problemi runtime si vedono solo con F12 aperto al momento giusto |
| M4 | **Smoke-test e2e sessione/drag** | 🟡 | Le due aree più fragili (restore multi-tab, detach, reorder) non hanno e2e dedicati. Da fare dopo M1 così girano in CI |

## 4. Feature "quality of life" quotidiane (idee aggiuntive)

Verificato che NON esistono già (typewriter/focus mode, Copy-as-HTML e recenti nel menu esistono
già → esclusi da questa lista).

| # | Voce | Costo | Note |
|---|------|-------|------|
| Q1 | **Inserisci data/ora** (stile F5 di Notepad++) | 🟢 | Comando palette + shortcut: inserisce timestamp nel formato preferito (preferenza formato). Non esiste nel codebase (grep verificato). Utile per note/journal quotidiani |
| Q2 | **Bookmark di riga in source mode** | 🟡 | `Ctrl+F2` toggle, `F2` next (muscle memory NPP). CM5 supporta marker nel gutter. Persistenza opzionale in sessione. Verificare conflitti accelerator prima (regola keybindings) |
| Q3 | **Operazioni riga extra**: ordina righe, rimuovi duplicati, trim trailing whitespace | 🟢 | Source mode, accanto alle line-ops esistenti (Ctrl+D/L, sposta). Staple NPP. Trim anche come opzione al save (attenzione interplay lightTouch/normalizzazioni — vedi editor-core §C) |
| Q4 | **Template nuovo file / snippet** | 🟡 | "New from template": cartella `userData/templates/` con file .md; palette → scegli template → nuova tab precompilata (meeting, daily note, ecc.) |
| Q5 | **Quick capture globale** | 🟡 | Scorciatoia di sistema (globalShortcut) + icona tray: porta avanti l'app e apre una nuova Untitled. Trasforma l'app in strumento di cattura note istantaneo. Attenzione: interplay con single-window/session owner |
| Q6 | **Colori tab** | 🟡 | Tag colore assegnabile da context menu tab (4-5 colori), persistito in sessione. Organizzazione visiva con molte tab aperte (NPP lo ha da v8.4). Tocca tabs.vue → leggere PRIMA invarianti tab-bar-layout.md |
| Q7 | **Auto-save opzionale sui file salvati** | 🟡 | Preferenza OFF di default: salva su disco a intervallo/perdita focus per i file con pathname (le untitled restano su snapshot sessione). ⚠️ Interplay delicato con lightTouch, baseline `originalMarkdown` e watcher self-save (task7 source-comments): passare dal flusso `FILE_SAVE` esistente, non crearne uno parallelo |
| Q8 | **Cronologia ricerche** | 🟢 | Dropdown ultime N ricerche nel find (Ctrl+F) e nella sidebar (Ctrl+Shift+F), persistite tra sessioni |
| Q9 | **Statistiche selezione in status bar** | 🟢 | Con selezione attiva: "X parole, Y caratteri selezionati". Complementare a U7 |
| Q10 | **Copy as rich text** | 🟢/🟡 | Il "Copy as HTML" esistente copia il markup come testo. Aggiungere copia in formato clipboard HTML (rich text) → incollare in Word/Outlook mantiene la formattazione. Passa dal clipboard IPC del main (clipboard-ipc-migration): aggiungere handler `write` con `{ html, text }` |
| Q11 | **Incolla URL su selezione → link markdown** | 🟢 | Selezione attiva + incolla URL → `[selezione](url)` invece di sostituire il testo. Standard negli editor moderni. Verificare prima se muya lo fa già in pasteCtrl |
| Q12 | **"Apri cartella contenitore"** nel context menu tab | 🟢 | `shell.showItemInFolder(pathname)`. Verificare se già presente nel TabContextMenu |

---

## 5. Priorità consigliate

1. **M1 (CI)** + **U1 (riapri tab)** — massimo valore/costo.
2. **A1+A2 (dipendenze native)** — semplificano build e sicurezza, esempio esplicito DECISIONS.
3. **U3 (cronologia locale)** + **U4 (diff su reload)** — completano la filosofia "mai perdere dati".
4. **C1/C2 (warning + dialog Open)** — piccoli, chiudono i rimandati di electron-upgrade.
5. **B1 (ricognizione patch CM)** — solo verifica + decisione, poi eventuale fix.
6. Quality of life a piacere: Q1, Q3, Q8, Q9, Q12 sono i più economici.

Ogni voce, prima dell'implementazione: riepilogo del piano + conferma utente (gate DECISIONS
2026-07-03), plan per task in `InProgress/<feature>/` come da workflow.
