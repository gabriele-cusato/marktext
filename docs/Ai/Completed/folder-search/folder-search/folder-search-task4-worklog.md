# folder-search — task4 — worklog

Plan: `folder-search-task4-plan.md`.

## Avanzamento
- [x] Icona tab bar + voce nel popover hamburger
- [x] Componente overlay (campi, focus, Esc/click fuori)
- [x] Validazione + invoke `mt::open-folder-search-window` + gestione errore nell'overlay
- [x] Stato busy durante la ricerca

Stato: DA TESTARE.

## Note implementazione

- Icona "Search in Folder" aggiunta in `tabs.vue` nel gruppo `v2-tr-btn` (dopo "Apri file"),
  SVG inline cartella+lente (`stroke="currentColor"`, viewBox 0 0 16 16, stesso stile
  dell'icona cartella esistente), `title="Search in Folder"` hardcoded inglese. Voce
  gemella "Search in Folder" aggiunta in fondo al popover hamburger
  (`v2-tr-popover-item`), con wrapper `hamburgerFolderSearch` che richiama lo stesso
  handler (`openFolderSearch`) e chiude il popover, stesso pattern delle altre 3 voci.
  `openFolderSearch` emette `bus.emit('show-folder-search')` (stesso pattern di
  `openCommandPalette` → `bus.emit('show-command-palette')`).

- Nuovo componente `src/renderer/src/components/folderSearchOverlay/index.vue`, montato
  in `app.vue` (registrazione accanto a `command-palette`/`rename`/ecc., stesso livello,
  nessun v-if esterno: il componente gestisce da solo `show` interno via bus). Pattern di
  montaggio/focus/chiusura ricalcato 1:1 da `components/commandPalette/index.vue`:
  `Teleport to="body"`, backdrop `position:fixed;inset:0` trasparente con
  `@mousedown.self="close"` (click fuori chiude), pannello con `@mousedown.stop`,
  animazioni `v2fadeIn`/`v2dropIn` (keyframes globali già definiti in v2-tokens.css,
  non duplicati). Esc gestito con `window.addEventListener('keydown', ...)` in
  `onMounted`/rimosso in `onBeforeUnmount` (stesso principio del listener hamburger in
  tabs.vue), attivo solo se `show.value` è true. Focus sul campo cartella via
  `nextTick` + `ref` all'apertura (stesso pattern di `searchInput.value.focus()` nel
  command palette, senza il `setTimeout` extra: qui non c'è animazione di ingresso della
  lista che lo richieda).

- Campi overlay: input testo cartella (nessun bottone "Sfoglia" — vedi sotto), input
  testo query, tre checkbox (Case sensitive / Whole word / Regex), textarea esclusioni
  precompilata vuota (placeholder spiega che vuoto = usa la preferenza
  `searchExclusions`; se compilata, split su virgola o a-capo → array passato come
  `options.exclusions`). Messaggi di esito (errore/nessun risultato) mostrati come testo
  sotto il form, non bloccanti la riapertura.

- Bottone "Sfoglia": inizialmente NON aggiunto (vedi nota storica sotto), poi implementato
  in un fix successivo su richiesta esplicita dell'utente dopo test runtime, con
  autorizzazione a toccare `src/main`. Aggiunto in `src/main/app/index.js` un nuovo
  handler `ipcMain.handle('mt::folder-search-select-directory', async (e) => {...})`
  (vicino all'handler `mt::open-folder-search-window`) che fa
  `dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties:
  ['openDirectory'] })` e ritorna `filePaths[0]` o `null` se annullato — stesso pattern
  dei dialog `.on` esistenti (`mt::select-default-directory-to-open`), ma come `handle`
  perché qui il percorso deve tornare al chiamante per un uso arbitrario (il campo testo
  dell'overlay), non essere scritto direttamente in una preferenza. Nel renderer, bottone
  "…" (`v2-fs-browse`) aggiunto in fondo al campo cartella (wrapper `v2-fs-directory-row`
  con input + bottone), disabilitato quando `busy`; click → `browseDirectory()` →
  `invoke('mt::folder-search-select-directory')` → se il percorso non è nullo valorizza
  `directory`. Nessuna modifica al preload: `window.electron.ipcRenderer.invoke` è già
  un pass-through generico (usato anche per `mt::open-folder-search-window`), niente
  whitelist per canale da aggiornare.

  Nota storica (motivazione dell'assenza iniziale, ora superata): in una prima
  implementazione il bottone non era stato aggiunto perché nessun canale `invoke`
  generico esisteva già in main per questo scopo e il task era vincolato a "NIENTE
  main/preload". Il fix successivo ha rimosso quel vincolo su autorizzazione esplicita.

- Validazione: bottone Esegui disabilitato se cartella o query sono vuote (trim), sia
  via `:disabled` sul bottone sia via guardia in cima a `submit()` (copre anche il
  submit da Enter sui due input). Esito dell'invoke:
  - `!result.ok` → `errorMessage` mostrato nell'overlay (l'overlay resta aperto);
  - `result.ok && result.empty` → `emptyMessage` "Nessun risultato." (overlay resta
    aperto, nessuna finestra è stata aperta dal main);
  - `result.ok` (né empty né error) → `close()` (la finestra nuova la apre il main).
  Anche l'`invoke` stesso in try/catch: un reject imprevisto mostra comunque un
  messaggio di errore invece di un'eccezione silenziosa in console.

- Stato busy: `busy` disabilita entrambi gli input, le 3 checkbox, la textarea e il
  bottone Esegui durante l'`invoke` (può durare secondi su cartelle grandi); il bottone
  mostra uno spinner CSS inline (rotazione, nessuna dipendenza dal componente `loading`
  esistente — quel componente è pensato per coprire un intero pannello con
  `position:absolute`, non per stare dentro un bottone). La chiusura (Esc/click fuori/✕)
  è bloccata mentre `busy` è true, per non perdere il feedback dell'invoke pendente.

## Vincoli di non interferenza rispettati
Non toccati: `src/renderer/src/components/sideBar/**`, store Pinia esistenti (nessuna
scrittura, nessuna nuova property — il componente non importa nemmeno lo store
preferenze, la lettura di `searchExclusions` è demandata al main), `src/muya/**`,
`src/main/**`, `src/preload/**`. File toccati: `tabs.vue` (icona + hamburger + handler),
`app.vue` (registrazione componente), nuovo `folderSearchOverlay/index.vue`.

## Test
Esito utente (2026-07-12/13, PC principale): OK — overlay e integrazione end-to-end
funzionanti, inclusi i due fix post-feedback qui sotto. Chiuso.

### Feedback utente (test runtime) + fix applicati
Dopo un primo giro di test runtime, l'utente ha richiesto due modifiche:

1. **Bottone "Sfoglia"**: assente nella prima versione (vedi nota storica sopra).
   L'utente ha autorizzato esplicitamente di toccare `src/main` per questo fix.
   Aggiunto handler dedicato `mt::folder-search-select-directory` in
   `src/main/app/index.js` + bottone "…" nel renderer (`v2-fs-directory-row`).
   DA TESTARE runtime: click su "…" → dialog di sistema si apre; selezione cartella →
   campo cartella valorizzato; annullamento dialog → campo invariato; bottone disabilitato
   durante `busy`.

2. **Placeholder esclusioni**: il testo generico precedente ("Pattern glob separati da
   virgola o a capo (vuoto = usa la preferenza)") è stato sostituito con esempi concreti
   su righe multiple nel placeholder della textarea: `Es: *.log, *.min.js`, poi `*.log` e
   `node_modules/**` su righe separate, più il richiamo "(vuoto = usa la preferenza)".
   Semantica invariata: campo vuoto → il main usa `searchExclusions`; campo compilato →
   override una-tantum, split su virgola o a-capo in `submit()` (nessuna modifica alla
   logica di `submit()`, solo al testo del placeholder).
   DA TESTARE runtime: verificare che il placeholder multiriga sia leggibile nella
   textarea (2 righe di altezza, `rows="2"`, ridimensionabile con `resize: vertical`).
