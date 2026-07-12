# font-registry-fallback — worklog

Plan di riferimento: `font-registry-fallback-plan.md`.

## Avanzamento

- [x] Verifica preliminare: `reg.exe` NON bloccato dalla policy sul PC ristretto (verificato 2026-07-12,
  `reg query` su HKLM e HKCU Fonts funziona in ConstrainedLanguage → scegliere l'opzione 1 del plan:
  `reg query` via `execFile`)
- [x] Implementare `getFontsFromRegistry()` in `src/main/dataCenter/index.js` (query HKLM+HKCU,
  strip suffisso ` (TrueType)`/` (OpenType)`/…, trim, dedupe, sort)
- [x] Modificare handler `mt::get-system-fonts`: fallback al registro solo se `getFonts()` fallisce
  o torna vuoto (ramo primario deve vincere quando ritorna lista non vuota)
- [x] Solo `process.platform === 'win32'`; altri OS → comportamento invariato

DA TESTARE

## Test

(compilare dopo il test)
- Su PC ristretto: Preferences → font → combo popolata.
- Su PC principale (non ristretto): fallback NON attivo, lista da `getFonts()`.
