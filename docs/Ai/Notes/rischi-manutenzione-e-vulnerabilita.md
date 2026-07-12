# Rischi di manutenzione e vulnerabilità del progetto

Analisi del 2026-07-08. Origine: riassunti `docs/Ai/Completed/`, DECISIONS.md, verifiche dirette
sul codice (package.json, preload, muya, node_modules). Ogni voce indica gravità e contenimento.
Le voci marcate con riferimento (A1, B2, M1…) rimandano a `idee-features-e-miglioramenti.md`.

---

## 1. Vulnerabilità di sicurezza

### 1.1 Renderer con accesso filesystem totale — RISCHIO N.1

Catena d'attacco: contenuto markdown ostile → Muya renderizza HTML → un eventuale bypass di
DOMPurify esegue JS nel renderer → da lì:
- `window.fileUtils` (preload) espone `fs` completo: read/write/unlink su **qualunque path**;
- `window.electron.ipcRenderer` generico: send/invoke su qualunque canale;
- `sandbox:false` in config.

DOMPurify è usato correttamente (12+ siti: link, htmlTag, paste, export) e la CSP è solida
(warning-fix task10), ma la difesa è a **un solo strato**. Aprire un `.md` ostile è lo scenario
d'attacco tipico di un editor markdown.

**Contenimento:** feature B2 — I/O spostato in main via IPC scoped, preload senza Node,
`sandbox:true`. Costo alto, feature dedicata.

### 1.2 `npm audit` — RISOLTO 2026-07-05, mantenere il rituale

Eseguito il 2026-07-05 (vedi `packages-update-fix.md`): da 30 vulnerabilità a **0** (rimozione
`languine`, `audit fix`, `npm update`). Ricontrollato 2026-07-12: ancora 0.

**Azione residua:** rieseguire `npm audit` periodicamente (a ogni giro npm) — vedi "Come rifare
questi controlli in futuro" in `packages-update-fix.md`; valutare Dependabot/Renovate sul fork.

---

## 2. Bombe a orologeria — dipendenze

### 2.1 `iconv-lite` FANTASMA — RISOLTO 2026-07-12

Era importata da `src/main/filesystem/markdown.js` senza essere dichiarata in package.json
(transitiva). Dichiarata esplicitamente il 2026-07-12 (`iconv-lite ^0.7.3` in dependencies).

### 2.2 CodeMirror 5 = EOL di fatto

CM6 è il successore dal 2021; CM5 riceve solo manutenzione minima. Integrazione profonda:
`sourceCode.vue` ~1400 righe, addon (comment, fold, search, merge), helper custom.
Migrazione a CM6 = riscrittura enorme, NON proponibile.

**Contenimento:** accettare CM5 congelato; tenere l'API CM confinata in
`sourceCode.vue`/`codeMirror/` (già abbastanza vero oggi); non spargerla nelle feature nuove.
Ogni incompatibilità futura con Chromium andrà patchata in casa.

### 2.3 Muya = motore orfano

Fork del marktext originale (morto), con dentro un **fork di marked.js modificato**
(`muya/lib/parser/marked/`, es. lexer.js token space con `lines`). Nessun fix upstream arriverà
mai: ogni bug di parsing markdown è nostro per sempre. È il singolo asset più costoso da mantenere.

**Contenimento:** regola "DO NOT MODIFY LIGHTLY" + invarianti documentate (già in atto);
manca la copertura test (vedi 4.1). Sostituirlo = riscrivere l'editor, non realistico.

### 2.4 Treadmill Electron + moduli nativi

E43 EOL ~2027-01 → upgrade ricorrente obbligatorio (fix sicurezza). Ogni major può:
- rompere l'ABI dei nativi keytar/ced (rebuild);
- deprecare API (clipboard v40→44 già gestito; altre arriveranno).

**Contenimento:** A1 (keytar→safeStorage) + A2 (ced→JS) eliminano lo step rebuild e riducono
il costo di ogni ciclo di upgrade.

### 2.5 Dipendenze morte upstream ma in uso

| Dep | Stato upstream | Uso |
|---|---|---|
| `snapsvg-cjs` | Snap.svg abbandonato ~2017 | sequence-diagram in muya |
| `webfontloader` | archiviato da Google | sequence-diagram-snap.js |
| `underscore` | legacy | muya utils, search |
| `element-resize-detector` | morto (ResizeObserver nativo lo sostituisce) | muya baseFloat |
| `@hfelix/electron-localshortcut` | fork di progetto morto | keyboard |
| `fuzzaldrin` | ferma al 2016 | 5 siti (vedi A3) |
| `electron-window-state` | semi-morto | window state |

Nessuna urgente; superficie di rischio a ogni major Electron/Vite. Valutare sostituzioni
opportunistiche quando si tocca l'area.

### 2.6 Residuo: `vite-plugin-electron-renderer` — RISOLTO 2026-07-12

Rimosso da devDependencies (`npm uninstall`) dopo grep di conferma: zero riferimenti in
src/config/scripts.

### 2.7 Element Plus v3 in arrivo

Le deprecation già fixate (el-radio `label`→`value`, el-button `type="text"`→prop `text`,
size mini/medium) erano il preavviso; al major arriverà altro churn. Rischio basso, da mettere
in conto al prossimo bump.

---

## 3. Fragilità strutturali (ostacolano nuove feature)

### 3.1 `store/editor.js` god-store (~2270 righe)

Dirty flag, save, watcher, sessione, drag, untitled counter: tutto lì; ogni feature nuova lo
attraversa. Il rischio NON è la dimensione in sé: è **dimensione × assenza di test** sulle
invarianti (vedi 4.1). Lo split non è proposto (invarianti dense, rischio > beneficio —
regola no-forzature).

### 3.2 Protocolli impliciti via bus mitt

L'ordine degli eventi è load-bearing e invisibile a compile-time:
- `_applySourceCodeForFile` PRIMA di `bus.emit('file-changed')`;
- `bus.emit('pre-save')` PRIMA di leggere `tab.markdown` (flush del debounce source);
- guard simmetriche nei due editor (`sourceCode.value` / `!sourceCode.value`);
- ogni `bus.on` ⇒ `bus.off` in `onBeforeUnmount`.

Chi non ha letto i doc rompe tutto senza accorgersene. **Contenimento economico:** test unit
sulle invarianti (M2); eventuale wrapper bus che asserisce l'ordine in dev.

### 3.3 Costanti JS↔CSS accoppiate a mano (tabs.vue)

`158 / 26 / 10 / 12 / 6 / 3`, offset hint `85px = (158+12)/2`: documentate in
tab-bar-layout.md ma fragili — un ritocco CSS estetico rompe il layout in modo non ovvio.
Nessun check automatico possibile a basso costo; regola: chi tocca il CSS aggiorna il JS
(e viceversa), sempre.

### 3.4 Workaround pinnati a bug di piattaforma

- logica reorder/detach su `dragend` invece di `drop` (electron#42252);
- overlay `.v2-tabbar-drag-region` (app-region ancestor sopprime dragstart);
- rifiuto passivo su `dragover` (spring-loading taskbar);
- DEP0180 fs.Stats (interno Electron, documentato).

Ben gestiti (flag anti-doppia-esecuzione se Electron fixa upstream), ma vanno **ricontrollati a
ogni upgrade Electron**. → Aggiungere al rituale di upgrade una checklist di questi punti
(vedi §5, azione 4).

### 3.5 Deriva doc/realtà

Il sistema docs/Ai è il vero asset di manutenibilità; il rischio è la divergenza silenziosa.
Caso già trovato (2026-07-08): ui-v2.md dichiara patch a `node_modules/codemirror`
(guard mapFromLineView, posFromMouse) ma node_modules è **vanilla** — patch perse da qualche
`npm install`, patch-package (S3) mai fatto. Vedi B1: decidere se le guard servono ancora
(markRaw era il fix radice) o reimplementarle nel wrapper renderer; poi aggiornare ui-v2.md.

### 3.6 `common/` cross-env

`envPaths.js`/`keybinding.js` importabili sia da main sia da renderer con guard
`typeof process`/`navigator.userAgent`. Pattern fragile: un import sbagliato in un file common
nuovo rompe il renderer solo a runtime. Regola: niente Node builtins non-guardati in `common/`.

---

## 4. Processo

### 4.1 Test coverage sottile sulle invarianti + niente CI

- 11 e2e Playwright + unit Vitest esistono ma girano SOLO a mano sul PC principale
  (secondario bloccato da policy) → bus factor 1 sul canale di verifica.
- Le invarianti documentate (lightTouch merge, normalizeMarkdown vs normalizeBlock, baseline
  B9, getMarkdownForSave, dirty flag) sono funzioni pure NON testate: la storia B1-B14 e i
  bug a 6-9 round mostrano che le regressioni qui sono la norma, non l'eccezione.

**Contenimento:** M1 (CI GitHub Actions: lint+unit+e2e, gira fuori dalle macchine vincolate) +
M2 (test unit sulle invarianti, a lotti) + M4 (e2e sessione/drag).

### 4.2 i18n a 9 locale

Ogni feature con testo = 9 file + rigenerazione `.min`. Già causa storica di warning
(chiavi mancanti) e del fallback "hardcoded inglese" in perfWarningDialog/session UI.
Attrito piccolo ma costante; nessuna azione proposta, solo consapevolezza.

---

## 5. Azioni rapide consigliate (costo quasi zero)

1. ~~`npm install iconv-lite`~~ — FATTO 2026-07-12 (§2.1).
2. ~~Rimuovere `vite-plugin-electron-renderer`~~ — FATTO 2026-07-12 (§2.6).
3. ~~`npm audit`~~ — FATTO 2026-07-05, 0 vulnerabilità; rieseguire a ogni giro npm (§1.2).
4. **Checklist upgrade Electron**: rileggere §3.4 (workaround pinnati) a ogni bump di major.

Le azioni strutturali convergono su voci già in `idee-features-e-miglioramenti.md`:
**B2** (sandbox), **M1** (CI), **M2** (test invarianti), **A1/A2** (dipendenze native),
**B1** (ricognizione patch CM).
