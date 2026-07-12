# residui-hard-task — M-REV10 (resync DOM↔store post-drag) — plan — 2026-07-12

Origine: TODO.md "Residui HARD-TASK" (da `performance-robustness`): resync DOM↔store dopo il drag
delle tab, ritenuto ridondante. Con la migrazione a HTML5 DnD nativo (`drag-html5-dnd`, dragula
RIMOSSO) è probabilmente codice morto.

## Prerequisiti bloccanti
- Esplorazione mirata (Agent-Explorer o verifica breve): individuare il codice di resync in
  `src/renderer/src/components/.../tabs.vue` (o dove risiede) e verificare che NESSUN percorso
  attuale lo invochi (il reorder oggi passa da `computeDragTarget` + `EXCHANGE_TABS_BY_ID`,
  vedi `Completed/drag-html5-dnd`). Grep di tutti i siti di chiamata (regola CLAUDE.md).
- Leggere `Completed/drag-html5-dnd/drag-html5-dnd.md` (invarianti drag) PRIMA di toccare tabs.vue.
- Version control: solo verifiche read-only (DECISIONS 2026-07-01).

## Obiettivo
Se confermato morto: rimuoverlo. Se ancora chiamato da un percorso vivo: NON rimuovere, documentare
chi lo usa e riportare all'utente.

## File da toccare
- Da confermare con l'esplorazione (atteso: solo `tabs.vue` o modulo drag correlato).

## Rischi
- Zona drag & drop = zona con storia di bug delicati (electron#42252, invarianti permanenti in
  Completed). Rimozione SOLO a fronte di grep esaustivo, nessuna modifica comportamentale.

## Skill di codice
`coding-standard`.

## Test
Sul PC principale: reorder tab stessa finestra, drag cross-finestra, detach — invariati.
