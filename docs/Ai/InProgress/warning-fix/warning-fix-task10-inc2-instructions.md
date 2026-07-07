# warning-fix — task10 — incremento 2 — istruzioni per Agent-Code

## Scope (SOLO questo)
Adattare copia immagine e rendere idempotente `getImageInfo` dopo l'introduzione dello scheme
`safe-file` (incremento 1 già applicato e testato). **NON** toccare la CSP dev/prod (è inc.3).

Leggere prima: `warning-fix-task10-plan.md` (incremento 2, scope CORRETTO) e
`warning-fix-task10-inc1-instructions.md` (contesto scheme safe-file).
Skill di codice: `coding-standard`. **NON usare git** (commit li fa l'utente). **NON buildare**
(bloccato da Group Policy su questo PC; test runtime dell'utente sul PC principale).

## Contesto
Dall'inc.1 l'`src` delle immagini è `safe-file://` SOLO a render (via `getImageInfo` in
`src/muya/lib/utils/index.js`). Su disco / nel markdown resta `file://` (`correctImageSrc` non è
stato toccato). Due call-site rielaborano l'`src` renderizzato e vanno adattati; altri due NON
vanno toccati (vedi sotto).

## Modifiche (2 sole)

### 1. `src/muya/lib/utils/index.js` — `getImageInfo`, rendere IDEMPOTENTE (riga ~261)
Attuale:
```js
const isUrl = URL_REG.test(src) || (imageExtension && /^file:\/\/.+/.test(src))
```
Nuovo (riconoscere anche `safe-file://` come URL già pronto):
```js
const isUrl = URL_REG.test(src) || (imageExtension && /^(?:safe-file|file):\/\/.+/.test(src))
```
Effetto: un input già `safe-file://` cade nel ramo `isUrl` (righe ~273-278) dove il ternario
`src.startsWith('file://') ? ... : src` lo restituisce **invariato** → funzione idempotente.
Serve a `printService.js:24` (export PDF, `renderStatic`) che ri-processa l'`src` già renderizzato:
senza questo fix `safe-file://` finirebbe nel ramo path e verrebbe corrotto. NON modificare
`printService.js` (si sistema da solo con l'idempotenza).

### 2. `src/muya/lib/contentState/copyCutCtrl.js` — strip anche `safe-file://` (riga ~140)
Nel fallback la sorgente è `image.getAttribute('src')` = `safe-file://...`. Attuale:
```js
finalSrc
  .replace('file://', '')
  .replace(/\?msec=\d+/, '')
```
`'safe-file://...'.replace('file://','')` produce `safe-/...` (rotto). Nuovo — strippare
`safe-file://` PRIMA di `file://`:
```js
finalSrc
  .replace('safe-file://', '')
  .replace('file://', '')
  .replace(/\?msec=\d+/, '')
```
Verificare l'ordine: `safe-file://` va rimosso per primo. Su `file://` puro il primo replace non
matcha (nessun `safe-file://` in un path `file://`), comportamento invariato.

## NON toccare (verificato: non impattati)
- **`src/renderer/src/components/editorWithTabs/tabs.vue:453`**: `file://` = URL del file DOCUMENTO
  reale per l'OLE Explorer (DownloadURL/CF_HDROP). `safe-file` non è risolvibile da Explorer →
  cambiarlo romperebbe il drag→desktop. Lasciare `file://`.
- **`src/muya/lib/ui/imageSelector/index.js:56`**: legge `token.attrs.src` (markdown grezzo =
  `file://`/path), non l'`src` renderizzato. Non impattato.
- **`src/muya/lib/utils/getImageInfo.js` `correctImageSrc`**: già escluso nell'inc.1 (scrive nel
  markdown persistito). Invariato.

## Vincoli
- Invarianti DnD (`drag-html5-dnd.md`): non toccare logica dragover/dragend/dropEffect. Qui non si
  tocca affatto quel codice.
- Se un'assunzione non regge, FERMARSI senza forzare e scriverlo nel worklog.

## Output atteso
- Applica le 2 modifiche.
- Aggiorna `warning-fix-task10-worklog.md`: spunta le voci inc.2, stato "DA TESTARE", ed elenca i
  test utente (copia immagine → path pulito senza `safe-`/`safe-file`; export PDF con immagini
  locali; drag tab→desktop crea il file; nessuna regressione DnD reorder/detach/migrazione).
- Riporta: file modificati, eventuali stop/assunzioni non verificabili, conferma di non aver
  toccato git né buildato né `tabs.vue`/`imageSelector`/`correctImageSrc`.
