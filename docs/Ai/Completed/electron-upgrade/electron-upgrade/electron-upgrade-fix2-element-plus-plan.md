# electron-upgrade — fix2 — plan: Element Plus size="mini" non valido

## Obiettivo
Eliminare il valore `size="mini"` (rimosso in Element Plus 2.x; validi solo ""/`default`/`small`/
`large`), sostituendolo con `size="small"`. Emerge dall'update di element-plus (non da Electron):
in console appare il warning "Invalid prop size" e i componenti perdono la dimensione voluta.

## Prerequisiti bloccanti
- I due file `.vue` devono esistere e contenere le occorrenze `size="mini"` indicate (verificate sotto).
- NON toccare la logica dei componenti: solo la sostituzione del valore della prop `size`.
- Build/test a runtime: li fa l'utente sul PC principale. Agent-Code NON builda né avvia l'app.
- Version control: VIETATO qualsiasi comando git (DECISIONS 2026-07-01). Non committare, non fare stage.
- Skill di codice: `coding-standard`.

## File da toccare (disgiunti da fix1, che è nel main)
1. `src/renderer/src/components/exportSettings/index.vue` — **6 occorrenze** (righe 49, 55, 78, 85, 97, 104).
2. `src/renderer/src/components/editorWithTabs/editor.vue` — **2 occorrenze** (righe 52, 61).

> Nota: `exportSettings/index.vue` sarà toccato anche dalla feature futura `renderer-no-node-integration`
> (import `fs`). Qui si modifica SOLO l'attributo `size`, niente altro, per non interferire.

## Modifica richiesta
Sostituire ogni `size="mini"` con `size="small"` nei due file. Nessun'altra modifica.
Sostituzione esatta del valore dell'attributo; non cambiare indentazione, altri attributi o markup.

## Sottoproblemi (blocchi logici)
1. `exportSettings/index.vue`: sostituire tutte e 6 le occorrenze `size="mini"` → `size="small"`.
2. `editor.vue`: sostituire entrambe le occorrenze `size="mini"` → `size="small"`.
3. Verifica statica: `grep size="mini"` sui due file → zero risultati residui.

## Fatti già verificati
- Occorrenze confermate via Grep (2026-07-07): exportSettings 6, editor.vue 2 → totale 8, coerente
  con l'analisi dell'index (`electron-upgrade.md` §FIX #2).
- Element Plus 2.x: "mini" rimosso; valori validi ""/default/small/large.
