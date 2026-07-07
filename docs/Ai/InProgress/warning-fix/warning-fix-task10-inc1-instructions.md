# warning-fix — task10 — incremento 1 — istruzioni per Agent-Code

## Scope (SOLO questo)
Introdurre un custom protocol `safe-file` per servire le immagini locali, alzare
`webSecurity:true` su entrambe le finestre, aggiornare la CSP `img-src`. **NON toccare** drag
tab→Explorer, copia immagine, né la CSP dev/prod: sono incremento 2 e 3.

Leggere prima: `warning-fix-task10-plan.md` (incremento 1) e `Warning-fix-notes.md` (punto 7).
Skill di codice: `coding-standard`. **NON usare git** (i commit li fa l'utente).

## API Electron 39 — VERIFICATA (doc ufficiale, non a memoria)
- `protocol.registerSchemesAsPrivileged([{ scheme, privileges }])`: **solo PRIMA** dell'evento
  `ready`, **una sola volta**. Privileges usati: `{ standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }`.
- `protocol.handle(scheme, handler)`: **DOPO** `ready`. Il handler riceve un `Request`, ritorna
  `Response | Promise<Response>`. Servire il file con `net.fetch(pathToFileURL(filePath).toString())`.
- Import necessari: aggiungere `protocol, net` a `import { ... } from 'electron'`; `pathToFileURL`
  da `node:url`. `path` e `fsPromises` sono già importati in `app/index.js`.

## Modifiche (con ancoraggi verificati)

### 1. `src/main/app/index.js`
- Riga 6 import: aggiungere `protocol, net` alla destructuring da `'electron'`. In cima al file
  aggiungere `import { pathToFileURL } from 'node:url'`.
- Nel **costruttore**, PRIMA della riga `app.on('ready', this.ready)` (attuale riga 96), chiamare
  `protocol.registerSchemesAsPrivileged([{ scheme: 'safe-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } }])`.
- Nel metodo `ready = () => {` (attuale riga 210), come **prima** istruzione utile registrare il
  handler:
  ```js
  protocol.handle('safe-file', (request) => {
    // safe-file:///C:/percorso/con spazi/img.png  →  path filesystem
    const url = new URL(request.url)
    // host vuoto (triple slash); pathname = "/C:/..." su Windows, "/percorso" su UNIX
    let filePath = decodeURIComponent(url.pathname)
    if (isWindows && /^\/[a-zA-Z]:/.test(filePath)) filePath = filePath.slice(1) // togli lo slash iniziale prima di "C:"
    return net.fetch(pathToFileURL(filePath).toString())
  })
  ```
  PUNTO DELICATO Windows: drive letter, spazi, encoding percentuale, UNC. Non assumere: se il path
  non risolve, loggare e ritornare una Response 404, non lasciar propagare l'eccezione.

### 2. `src/muya/lib/utils/getImageInfo.js` — `correctImageSrc` — **NON TOCCARE**
Già verificato: il suo output finisce in `block.text` (`imageCtrl.js:114` e `:159`) = markdown
PERSISTITO su disco. Cambiarlo in `safe-file://` corromperebbe i file salvati. Su disco l'`src`
deve restare `file://`. Lasciare questa funzione INVARIATA.

### 3. `src/muya/lib/utils/index.js` — `getImageInfo` (righe 259-306) — UNICO punto da cambiare
È l'unico chokepoint di rendering (verificato: `renderLeafBlock.js:144` per gli `<img>` HTML e
`renderInlines/image.js:36` per le immagini markdown instradano ogni `src` da qui). La conversione
`file://`→`safe-file://` avviene SOLO a render, il testo salvato resta `file://`.
Cambiare i DUE punti di ritorno che producono un file locale:
- **riga ~282** (ramo path assoluto/relativo locale):
  `src: 'file://' + path.resolve(baseUrl, src)` → `src: 'safe-file://' + path.resolve(baseUrl, src)`.
- **righe ~273-276** (ramo `isUrl`): qui `src` può essere http/https OPPURE un `file://` locale già
  salvato. Convertire SOLO il caso `file://`:
  ```js
  return {
    isUnknownType: false,
    src: src.startsWith('file://') ? src.replace(/^file:\/\//, 'safe-file://') : src
  }
  ```
  Così gli `<img src="file://...">` già presenti su disco vengono resi come `safe-file://`;
  http/https restano invariati. NON toccare i rami data-url (294-298) né unknown (302-305).

### 4. `src/renderer/index.html` — CSP (riga 14)
`img-src * data: file: blob:;` → aggiungere `safe-file:` (mantenere `file:` per ora, si rimuove
in inc.3 se non più usato): `img-src * data: file: blob: safe-file:;`.

### 5. `src/main/config.js` — `webSecurity`
- `editorWinOptions.webPreferences.webSecurity` riga 22: `false` → `true`.
- `preferencesWinOptions.webPreferences.webSecurity` riga 51: `false` → `true`.

## Vincoli / cose da NON rompere
- Invarianti DnD (`drag-html5-dnd.md`): NON toccare logica dragover/dragend/dropEffect. Qui non si
  tocca affatto quel codice.
- URL http/https, `data:`, `blob:` NON vanno riscritti: solo i path locali assoluti.
- Se un prerequisito manca o un'assunzione non regge (es. correctImageSrc alimenta il salvataggio),
  fermarsi senza forzare e scriverlo nel worklog.

## Interim noto (accettato)
Fino all'inc.2, copia immagine (`copyCutCtrl.js:140`) e drag tab→Explorer (`tabs.vue:453`)
assumono ancora `file://` letterale → potrebbero comportarsi male con `safe-file://`. È atteso:
si sistemano nell'inc.2. Il test dell'inc.1 verifica SOLO rendering immagini + assenza warning.

## Build/test
Agent-Code NON builda (bloccato da Group Policy su questo PC). Lasciare il worklog con stato
"DA TESTARE" e l'elenco di cosa l'utente deve verificare sul PC principale:
- immagine locale `![](C:/...)` visibile inline in **dev** E in **app packaged**;
- nessun warning `webSecurity`/`allowRunningInsecureContent` in dev (console F12);
- `printToPDF` (se esposto): immagini locali presenti nel PDF.
