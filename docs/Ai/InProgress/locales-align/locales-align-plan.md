# locales-align — plan — 2026-07-12

Origine: TODO.md "Menu/UI overhaul — follow-up": aggiustare le stringhe di traduzione dopo
l'overhaul di menu, palette e shortcut (voci rimosse dal palette, label cambiate, "Quick Open" →
"Recent Files" in arrivo).

## Prerequisiti bloccanti
- Da eseguire DOPO che menu/palette sono stabili: menu-shortcut-overhaul Parte E conclusa e
  feature `recent-files` implementata (cambia la label del comando). Farlo prima = doppio lavoro.
- Regola DECISIONS 2026-07-05: warning i18n (chiavi mancanti/HTML nelle stringhe) mai soppressi,
  fix alla radice. Precedente: feature `warning-fix` ha già sistemato chiavi i18n — non regredire.
- 9 lingue in `static/locales/`; script `scripts/minify-locales.mjs` nel build.

## Obiettivo
1. Censire le chiavi orfane: stringhe riferite a comandi/voci rimossi dal palette
   (paragraph.*, format.*, create/delete-paragraph) e a voci front menu rimosse (Style/turnInto).
2. Censire le chiavi mancanti/da aggiornare: nuove label ("Recent Files", eventuali nuove voci).
3. Allineare TUTTE le 9 lingue in modo coerente (stessa struttura chiavi in tutti i file).
4. Verifica: nessun warning i18n a runtime (dev/preview sul PC principale), nessuna chiave
   mostrata "cruda" a video.

## File da toccare
- `static/locales/*.json` (9 file)
- Eventuali punti renderer che referenziano chiavi rimosse (grep prima di togliere chiavi).

## Fatti verificati
- Batch 1/1b overhaul ha rimosso dal palette i comandi paragraph.* (tranne reset-paragraph),
  format.*, edit.create-paragraph, edit.delete-paragraph; il MENU APP conserva i suoi percorsi
  (`menu/templates/`) → le chiavi usate dal menu app NON vanno rimosse.

## Skill di codice
`coding-standard` (file dati JSON).

## Test
PC principale: cambiare lingua nelle Preferences e ispezionare menu/palette/dialog; console senza
warning i18n.
