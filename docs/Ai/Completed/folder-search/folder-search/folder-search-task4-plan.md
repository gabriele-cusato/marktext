# folder-search — task4 (overlay input + icona tab bar) — plan — 2026-07-12

Riferimento generale: `folder-search-plan.md`.

## Obiettivo del task
Icona "Search in folder" nella sezione destra della tab bar; click → overlay in sovraimpressione
che chiede cartella, query e opzioni; Esegui → invoca il main (`mt::open-folder-search-window`,
task2) che apre la finestra nuova; errori mostrati nell'overlay. Solo renderer.

## Prerequisiti bloccanti
- Questo plan + worklog `folder-search-task4-worklog.md`.
- DOPO `recent-files-icon` e `window-minwidth-hamburger` (stesso file tabs.vue): entrambe già
  implementate — VERIFICARE in `tabs.vue` la presenza del bottone Recent Files e del collasso
  hamburger, e integrarsi con entrambi (la nuova icona va nel gruppo che collassa nell'hamburger,
  come voce aggiuntiva del popover sotto soglia).
- Task 1-2-3 implementati (canali e shape da riusare, verificare i nomi reali nel codice).
- VIETATO version control; NIENTE build (build unica finale).

## Sottoproblemi (in ordine)
1. Icona SVG inline (lente con cartella, monocromatica `stroke="currentColor"`, stile coerente
   con le icone `v2-tr-btn` esistenti) in `tabs.vue`, `title="Search in Folder"` hardcoded
   inglese (i18n futura); aggiunta anche come voce nel popover hamburger.
2. Overlay: componente nuovo (`components/folderSearchOverlay/` o posizione coerente con gli
   overlay/dialog esistenti — guardare come è fatto il command palette o dialog simili per
   pattern di montaggio, focus trap, chiusura Esc/click fuori). Campi: percorso cartella (input
   testo + bottone sfoglia via dialog IPC esistente se disponibile, altrimenti solo input),
   query, checkbox case sensitive / whole word / regex, campo esclusioni opzionale (precompilato
   dalla preferenza `searchExclusions`, editabile come override una-tantum).
3. Validazione minima client: cartella e query non vuote; Esegui → `invoke('mt::open-folder-search-window',
   { directory, query, options })`; risposta con `error` → messaggio nell'overlay (niente
   finestra); ok → chiudere l'overlay (la finestra nuova la apre il main).
4. Stato busy durante la ricerca (spinner/disabilitazione Esegui, la ricerca può durare secondi).

## Regole
- File attesi: `tabs.vue` (icona + voce hamburger) + componente overlay nuovo + eventuale
  registrazione. NON toccare v2-tokens.css; rispettare le invarianti tab bar documentate nei
  commenti di tabs.vue e in `Completed/tab-bar-layout`.
- Commenti in italiano, forma all'infinito.

## Skill di codice
`coding-standard` (Vue 3).
