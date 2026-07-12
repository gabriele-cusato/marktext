# residui-hard-task — B-REV11 (accelerator duplicati) — plan — 2026-07-12

Origine: TODO.md "Residui HARD-TASK" (da feature `performance-robustness`): esistevano accelerator
assegnati a più comandi; serviva un test runtime per capire "chi vince", poi azzerare il perdente.

## ⚠️ Possibile obsolescenza (punto di attenzione)
La feature `menu-shortcut-overhaul` (Batch 1 + 1b, 2026-07-09) ha riassegnato/svuotato MOLTI binding
nei 3 file `keybindings{Windows,Linux,Darwin}.js`. I duplicati censiti da B-REV11 potrebbero non
esistere più. **Primo passo obbligatorio: ri-censire i duplicati sullo stato ATTUALE**, non fidarsi
dell'elenco storico.

## Prerequisiti bloccanti
- Ri-censimento duplicati sullo stato attuale dei 3 file keybindings (grep/script di conteggio
  accelerator ripetuti per piattaforma). Se zero duplicati → chiudere il task come "dissolto
  dall'overhaul", nessun codice.
- Test runtime (PC principale, l'utente): per ogni duplicato residuo, provare la combinazione e
  annotare quale comando scatta.
- Version control: solo verifiche read-only (DECISIONS 2026-07-01).

## Obiettivo
Per ogni accelerator duplicato residuo: decidere il vincitore (col dato runtime + conferma utente)
e svuotare il binding perdente nei file keybindings (edit di soli dati, basso rischio).

## File da toccare
- `src/main/keyboard/keybindingsWindows.js` / `keybindingsLinux.js` / `keybindingsDarwin.js`

## Skill di codice
`coding-standard` (edit dati minime).
