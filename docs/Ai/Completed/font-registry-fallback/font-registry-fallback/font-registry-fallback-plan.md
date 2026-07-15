# font-registry-fallback — plan — 2026-07-08

Feature fuori scope emersa nel test di `renderer-no-node-integration` (task6, font picker).

## Problema
Su PC gestito (Group Policy) l'elenco font di sistema resta **vuoto**: la combo in
Preferences → (font) non mostra alcun font e il cursore permette solo di scrivere.

### Causa (verificata, NON è un bug del codice)
Handler `mt::get-system-fonts` in `src/main/dataCenter/index.js:311` chiama `getFonts()` di
**`font-list`**. Su Windows `font-list` enumera i font lanciando:
1. `powershell ... Add-Type -AssemblyName PresentationCore ...` → fallisce con
   `Questa modalità linguaggio non supporta la definizione di nuovi tipi` = PowerShell in
   **ConstrainedLanguage mode** (policy aziendale) blocca `Add-Type`.
2. fallback `cscript ...\fonts.vbs` → fallisce anch'esso (WSH/VBScript disabilitato da policy).

Risultato: `getFonts()` rigetta → l'handler ritorna `[]` (catch già presente). Su PC **non** ristretto
`font-list` funziona: il problema è solo ambiente. Stessa famiglia delle note
"Build bloccato su PC secondario" e "drag-drop bloccato da elevazione".

## Soluzione proposta
Aggiungere nell'handler un **fallback Windows via registro** quando `getFonts()` fallisce o torna vuoto.
Il registro font è leggibile **senza** `Add-Type`/`cscript` (quindi non bloccato da ConstrainedLanguage).

Chiavi:
- `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`
- `HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` (font per-utente)

I nomi valore sono del tipo `Arial (TrueType)` / `Arial Bold (TrueType)` / `Calibri (OpenType)`.
Famiglia = nome valore **senza** il suffisso ` (TrueType)` / ` (OpenType)` / ` (…)`.

### Come leggere il registro nel main (da VERIFICARE prima di scegliere)
Opzioni, in ordine di preferenza da valutare:
1. `reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"` via `execFile` (child_process,
   già importato nel main). **Verificare** che `reg.exe` NON sia bloccato dalla policy (a differenza di
   `Add-Type`/`cscript` di norma `reg.exe` è consentito — confermare sul PC ristretto).
2. Un modulo Node di lettura registro puro-JS (evita child_process) — valutare dipendenza aggiuntiva.

NON usare `Add-Type`/`cscript`/WMI (stessi blocchi).

### Handler (bozza, in `src/main/dataCenter/index.js`)
```js
ipcMain.handle('mt::get-system-fonts', async () => {
  try {
    const fonts = await getFonts()
    if (fonts && fonts.length) return fonts
  } catch { /* fallthrough al fallback */ }
  if (process.platform === 'win32') {
    try { return await getFontsFromRegistry() } catch { return [] }
  }
  return []
})
```
`getFontsFromRegistry()`: query delle due chiavi, split righe, per ogni valore togliere il suffisso
` (\w+)` finale, `trim`, dedupe (Set), ordinare. Ritornare array di stringhe come `getFonts()`.

## Limiti noti (da annotare)
- Il registro elenca i **file** font, quindi compaiono varianti di peso come famiglie distinte
  (`Arial`, `Arial Bold`, `Arial Italic`). `font-list` invece ritorna la famiglia base. Per un picker è
  accettabile; eventualmente collassare le varianti note (Bold/Italic/Light/…) è un raffinamento opzionale.
- Il fallback è **solo Windows**. macOS/Linux non hanno il problema (font-list usa altri metodi).

## Test
- Su PC ristretto: aprire Preferences → font → la combo si popola con i font di sistema.
- Su PC non ristretto: `getFonts()` funziona → il fallback non deve attivarsi (verificare che il ramo
  primario vinca quando ritorna una lista non vuota).

## Stato
- Solo plan. Implementazione: da fare (delegabile ad Agent-Code). Verifica preliminare `reg.exe` non
  bloccato = **bloccante** prima di scegliere l'opzione 1.
