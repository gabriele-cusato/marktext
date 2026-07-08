# electron-upgrade — fix1 — plan: safe-file:// immagini locali rotte (regressione E43)

## Obiettivo
Ripristinare il rendering delle immagini locali, rotto dall'upgrade a Electron 43. Chromium di E43
parsa diversamente lo scheme `safe-file` (registrato `standard:true`): quando muya emette
`safe-file://C:/...` (doppio slash), Chromium interpreta `C:` come **host** (`url.host === "c"`, i due
punti persi), non come parte del pathname. L'handler attuale gestisce solo la forma triple-slash
`safe-file:///C:/...` → per la forma host il path risulta errato → `net::ERR_FILE_NOT_FOUND` (main) +
`net::ERR_UNEXPECTED` (renderer).

## Prerequisiti bloccanti
- `src/main/app/index.js` deve esistere e contenere `protocol.handle('safe-file', ...)` (verificato: riga 240).
- NON toccare muya (`src/muya/...`): il fix è lato handler per rispettare gli invarianti del task10
  (muya emette il suo URL, l'handler si adatta). Se il file o l'handler non corrispondono a quanto
  descritto qui, fermarsi senza modificare.
- Build/test a runtime: li fa l'utente sul PC principale. Agent-Code NON builda né avvia l'app.
- Version control: VIETATO qualsiasi comando git (DECISIONS 2026-07-01). Non committare, non fare stage.
- Skill di codice: `coding-standard`.

## Unico file da toccare
`src/main/app/index.js` — dentro `protocol.handle('safe-file', (request) => {...})`.

## Codice attuale (righe 242-249, verificato)
```js
const url = new URL(request.url)
let filePath = decodeURIComponent(url.pathname)
// Su Windows il pathname mantiene lo slash iniziale prima della lettera di unità
// (es. "/C:/percorso"): va tolto per ottenere un path filesystem valido.
if (isWindows && /^\/[a-zA-Z]:/.test(filePath)) {
  filePath = filePath.slice(1)
}
return net.fetch(pathToFileURL(filePath).toString())
```

## Modifica richiesta
Gestire entrambe le forme su Windows: triple-slash (pathname `/C:/...`) e host (`url.host` = lettera
unità singola, pathname `/...`). Sostituire il blocco `if (isWindows ...)` con:
```js
if (isWindows) {
  if (/^\/[a-zA-Z]:/.test(filePath)) {
    // forma safe-file:///C:/... (host vuoto, triple slash): togliere lo slash iniziale.
    filePath = filePath.slice(1)
  } else if (/^[a-zA-Z]$/.test(url.host)) {
    // forma safe-file://C:/... (Chromium E43 parsa "C" come host, due punti persi):
    // ricomporre "C:" + pathname.
    filePath = `${url.host}:${filePath}`
  }
}
```
Aggiornare/estendere il commento sopra il blocco per spiegare le due forme (mantenere lo stile
all'infinito, italiano). Non cambiare altro (try/catch, log, `net.fetch`, `pathToFileURL` restano).

## Sottoproblemi (blocchi logici)
1. Sostituire il blocco `if (isWindows ...)` con la versione a due rami.
2. Aggiornare il commento esplicativo delle due forme URL.
3. Verifica statica: nessun'altra occorrenza di parsing `safe-file` da allineare nel file.

## Fatti già verificati
- Handler a `src/main/app/index.js:240`; scheme registrato `standard:true, secure:true` a riga ~64.
- `isWindows`, `net`, `pathToFileURL`, `log` già importati/in scope (usati nel blocco attuale).
- Nessuna modifica a muya necessaria: il doppio-slash lo emette muya, il fix è difensivo lato handler.
