# warning-fix — task10 — incremento 3 — istruzioni per Agent-Code

## Scope (SOLO questo)
Rendere la CSP dipendente dall'ambiente: in dev mantenere `'unsafe-eval'` e `ws:/wss:` (servono a
Vite/HMR), in build di produzione rimuoverli → elimina il warning "Insecure Content-Security-Policy
/ unsafe-eval" senza sopprimerlo. Ultimo incremento del task10.

Leggere prima: `warning-fix-task10-plan.md` (incremento 3, approccio DECISO). Skill: `coding-standard`.
**NON usare git** (commit li fa l'utente). **NON buildare** (bloccato da Group Policy; test utente
sul PC principale).

## Approccio (opzione A — CSP meta trasformata per ambiente)
Motivo della scelta (già deciso, non rivalutare): in prod la pagina si carica da `file://`
(`src/main/windows/base.js:81`), quindi un header CSP via `onHeadersReceived` NON verrebbe applicato.
Si usa la `<meta>` CSP con token sostituiti a build/serve da un plugin Vite.

## Modifiche (2 file)

### 1. `src/renderer/index.html` — token nella `<meta>` CSP (righe ~9-18)
Sostituire i valori solo-dev con token placeholder. Da:
```
content="default-src 'self' ws: wss:;
            script-src 'self' 'unsafe-inline' 'unsafe-eval';
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            img-src * data: file: blob: safe-file:;
            font-src 'self' data: https://fonts.gstatic.com;
            connect-src 'self' ws: wss: http: https:;
            "
```
A:
```
content="default-src 'self' __CSP_WS__;
            script-src 'self' 'unsafe-inline' __CSP_UNSAFE_EVAL__;
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            img-src * data: file: blob: safe-file:;
            font-src 'self' data: https://fonts.gstatic.com;
            connect-src 'self' __CSP_WS__ http: https:;
            "
```
(NON toccare img-src/style-src/font-src: restano identici. `safe-file:` resta.)

### 2. `electron.vite.config.mjs` — plugin di sostituzione token
Aggiungere un plugin locale e inserirlo in `renderer.plugins` (accanto a `vue()`, `svgLoader()`,
`renderer(...)`). Il plugin:
```js
const cspEnvPlugin = () => {
  let isServe = false
  return {
    name: 'mt-csp-env',
    config(_, { command }) {
      isServe = command === 'serve'
    },
    transformIndexHtml(html) {
      return html
        .replaceAll('__CSP_UNSAFE_EVAL__', isServe ? "'unsafe-eval'" : '')
        .replaceAll('__CSP_WS__', isServe ? 'ws: wss:' : '')
    }
  }
}
```
- Definirlo nel modulo (prima di `export default`) o inline; inserirlo in `renderer.plugins`.
- `transformIndexHtml` gira sia in serve sia in build: in serve `isServe=true` → reinserisce
  `'unsafe-eval'`/`ws: wss:`; in build `isServe=false` → li rimuove (stringa vuota).
- Usare `replaceAll` perché `__CSP_WS__` compare due volte (default-src e connect-src).
- Verificare che l'hook `config` riceva `{ command }` (API Vite): `command` vale `'serve'` con
  `electron-vite dev` e `'build'` con la build di produzione.

## Vincoli / cosa NON fare
- NON rimuovere `'unsafe-inline'` (script/style) né `http:`/`https:` da connect-src: servono a
  font Google e fetch immagini remote anche in prod. Si tolgono SOLO `'unsafe-eval'` e `ws:/wss:`.
- NON introdurre header CSP nel main (opzione scartata).
- Se `command` non fosse disponibile nell'hook `config` in questo setup electron-vite, FERMARSI e
  segnalarlo nel worklog invece di forzare un'euristica (es. NODE_ENV) non verificata.

## Output atteso
- Applica le 2 modifiche.
- Aggiorna `warning-fix-task10-worklog.md`: spunta le voci inc.3, stato "DA TESTARE", elenca i test
  utente (dev: HMR funzionante, immagini, editor; app **packaged**: nessun warning CSP in console +
  editor/preferenze/immagini locali/codemirror/KaTeX/font Google funzionanti). Segnalare che la
  conferma decisiva è sul pacchettizzato.
- Riporta: file modificati, eventuali stop/assunzioni non verificabili, conferma di non aver toccato
  git né buildato.
