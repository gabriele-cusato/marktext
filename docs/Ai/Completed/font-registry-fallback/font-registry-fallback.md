# font-registry-fallback

## Scopo
Su Windows in ambiente ristretto (ConstrainedLanguage mode, policy aziendale), il modulo `font-list` fallisce (`Add-Type`/`cscript` bloccati) e la combo font nelle Preferences rimane vuota. Implementare fallback Windows via registro (HKLM/HKCU Fonts) che è leggibile senza `Add-Type`/`cscript`.

## Modifiche

### File modificato
**src/main/dataCenter/index.js**
- Aggiunto `getFontsFromRegistry()`: query `reg.exe` sulle chiavi `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` e `HKCU\[id]`, parsing output, strip suffisso ` (TrueType)`/` (OpenType)`, dedupe, ordinamento
- Modificato handler `mt::get-system-fonts`: fallback al registro solo se `getFonts()` fallisce o torna vuoto (ramo primario vince quando ritorna lista non vuota)
- Guard `process.platform === 'win32'`: fallback solo Windows; macOS/Linux comportamento invariato

## Da tenere a mente

**Windows-only fallback**: La feature NON influisce su macOS/Linux (che non hanno il problema ConstrainedLanguage). Solo Windows active.

**Ramo primario prioritario**: Se `getFonts()` funziona (PC libero), ritorna subito la lista e il registro NON viene interrogato. Il fallback è usato solo quando il ramo primario fallisce o torna vuoto.

**Varianti di peso in registro**: Il registro elenca font per file (Arial, Arial Bold, Arial Italic compaiono come famiglie distinte), mentre `font-list` ritorna la famiglia base. Per il picker è accettabile. Se è richiesto collassare le varianti, è un raffinamento opzionale.

**Verifica preliminare**: Prima dell'implementazione è stata verificata su PC ristretto che `reg.exe` NON è bloccato dalla policy (opzione 1 del plan). Questa verifica NON va rifare se la policy non cambia.

**Test esito**: Utente (2026-07-12/13, PC principale) OK — combo font popola correttamente dal ramo primario `getFonts()`. Fallback non testabile sul PC principale (non in ConstrainedLanguage mode). Feature chiusa.
