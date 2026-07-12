# Worklog — Batch 2 (Parte E) — menu-shortcut-overhaul — DA TESTARE

Task: label shortcut derivati dai binding reali (refactor strutturale, elimina la classe di bug
"label ≠ shortcut"). Fonte autorevole: `menu-shortcut-overhaul-plan.md`, Parte E.

## Prerequisiti bloccanti
- Batch 1 + 1b conclusi e testati (fatto, vedi `worklog-batch1.md`).
- Sessione sul PC principale (DECISIONS 2026-07-12): build consentito perché refactor strutturale
  ("modifica grande"); verifica runtime a carico dell'utente.

## Avanzamento

- [x] Renderer: mappa `commandId → accelerator` dai binding reali (`mt::keybindings-response`,
  già ricevuti in `store/commandCenter.js`) — aggiunto state `keybindingMap` popolato
  nell'handler esistente, nessuna nuova richiesta IPC
- [x] Passare la mappa a Muya via `muya.options.getShortcut(commandId)` (stesso pattern
  dell'opzione `t`) — iniettato in `editor.vue` (closure sullo store, letta ad ogni chiamata)
- [x] Mapping esplicito voce menu → commandId (frontMenu, quickInsert, formatPicker) — campo
  `commandId` aggiunto in ogni config
- [x] Sostituire le stringhe `shortCut` hardcoded con `getShortcut(...)` + formatter leggibile
  (`Ctrl+Shift+P`, niente glyph `⇧⌃`) — formatter `formatShortcutForDisplay` in
  `store/commandCenter.js` (gestisce solo l'alias `CmdOrCtrl` da keybindings.json utente; i
  file keybindings*.js usano già forme leggibili per piattaforma)
- [x] B-ter: voci senza binding reale → nessun label mostrato (verificato anche palette:
  nessun default hardcoded residuo salvo `file.zoom` che è un gesto mouse, non una tastiera,
  quindi legittimo)

## Esito

Task DA TESTARE (verifica runtime a carico dell'utente, vedi sezione Test sotto). Build
(`npm run build`) completata senza errori.

## Test

(compilare dopo il test sul PC principale)
- Label in front menu / "@" / menu selezione = shortcut reali post-Batch 1 (es. duplicate
  Ctrl+Shift+P, code fence Ctrl+Alt+C).
- Voci senza binding: nessun label.
