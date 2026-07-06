# editor-ui-fixes — task1 — worklog

## Avanzamento
- [x] try/catch in scrollToCursor (editor.vue) con return silenzioso se nessun cursore attivo
- [x] Build di verifica

## Build
`npm run build` fallito per motivo ambientale, non di codice: "Il programma è bloccato dai Criteri di gruppo. Per ulteriori informazioni, contattare l'amministratore del sistema." (electron-vite build bloccato da Group Policy sulla macchina). Nessun errore di compilazione riportato. Da rieseguire su una macchina senza questo blocco per la verifica finale.

## Test
- 2026-07-06 (utente): rename tab dal context menu → nessun errore `selectionChange` in console F12. Scroll-to-cursor nei cambi tab standard invariato. **OK.**
