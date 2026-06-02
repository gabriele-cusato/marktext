# MK-DOCS — guida d'uso e registro lavori

Documentazione del progetto **MarkTextDocs** (documentazione di MarkText, costruita con
MkDocs + Material). Questo file spiega **come si usa lo strumento** e **cosa è stato fatto**.

---

## ⚡ Avvio rapido (parti da qui)

Su un PC nuovo, dopo aver clonato il repo o fatto `git pull`:

```powershell
# 1. Installa lo strumento (una volta sola per PC)
python -m pip install mkdocs-material

# 2. Entra nella cartella della documentazione
cd C:\Projects\MarkText\marktext\MarkTextDocs

# 3. Avvia il server e apri http://127.0.0.1:8000/ nel browser
python -m mkdocs serve
```

Per generare la versione statica (cartella `site/`, condivisibile o apribile offline col
doppio clic su `site/index.html`):

```powershell
python -m mkdocs build
```

!!! warning "Due cose da sapere subito"
    - Su Windows usa sempre **`python -m mkdocs`** (non `mkdocs` nudo → vedi §2).
    - La cartella **`site/` è ignorata da git** (è rigenerabile): sull'altro PC dopo `git pull`
      non c'è, la ricrei con i comandi qui sopra. Il sorgente versionato è tutto testo.

---

## 1. Cos'è

- **MkDocs**: generatore di siti statici. Prende file Markdown + un file di config
  (`mkdocs.yml`) e produce un sito HTML navigabile. Niente database, niente server applicativo.
- **Material for MkDocs**: tema + estensioni sopra MkDocs. Dà ricerca full-text, layout
  responsive, evidenziazione codice, navigazione ad albero, breadcrumb, temi chiaro/scuro.

Pacchetto installato: `mkdocs-material` (tira dentro `mkdocs` come dipendenza).

---

## 2. Installazione (già fatta)

```powershell
python -m pip install mkdocs-material
```

> **Nota Windows**: usa sempre `python -m pip` / `python -m mkdocs`. Su questo PC il `pip`
> e `mkdocs` "nudi" sul PATH puntano a un'altra installazione Python (3.11); `python -m …`
> resta sull'interprete giusto (3.13).

Versioni: mkdocs-material **9.7.6**, mkdocs **1.6.1**.

---

## 3. Comandi quotidiani

Lanciali **dalla cartella `MarkTextDocs/`** (dove sta `mkdocs.yml`):

```powershell
cd C:\Projects\MarkText\marktext\MarkTextDocs

python -m mkdocs serve     # server di sviluppo con auto-reload → http://127.0.0.1:8000/
python -m mkdocs build     # genera la cartella site/ (HTML statico)
python -m mkdocs build --strict   # come sopra, ma ogni warning diventa errore (verifica)
```

> Il `base_path` degli snippet (vedi §6) è `..` (la root del repo): funziona **perché**
> lanci da dentro `MarkTextDocs/`. Da un'altra cartella gli snippet non troverebbero `src/`.

---

## 4. Struttura del progetto docs

```
MarkTextDocs/
├─ mkdocs.yml                 # configurazione (tema, ricerca, nav, estensioni)
├─ MK-DOCS.md                 # questo file
├─ docs/                      # i contenuti (Markdown)
│  ├─ index.md                # L0 — Home (anteprima cliente)
│  ├─ stylesheets/extra.css   # i badge di livello (👤/🔰/💻/🔧)
│  ├─ lvl1-salvataggio/       # un argomento (con sotto-livelli)
│  ├─ lvl1-finestre/
│  ├─ lvl1-editing/
│  └─ lvl1-ricarica/
└─ site/                      # output generato da `mkdocs build` (non si modifica a mano)
```

---

## 5. Il modello a livelli adottato

La **profondità nell'albero = pubblico crescente**. Ogni argomento è una cartella; più scendi,
più la spiegazione è tecnica:

| Livello | Badge | Per chi | Dove sta |
|---|---|---|---|
| L0 | — | tutti (vetrina) | `docs/index.md` (Home) |
| L1 | 👤 | cliente, non sa nulla | `lvlN-<argomento>/index.md` |
| L2 | 🔰 | chi conosce un po' | sotto-cartella `lvl2-<sottoargomento>/index.md` |
| L3 | 💻 | sviluppatore esterno | `lvl3-come-funziona/index.md` |
| L4 | 🔧 | chi ha sviluppato (codice) | `lvl4-implementazione.md` |

Regole:
- **L4 è sempre la foglia** di ogni ramo (contiene codice reale).
- I livelli intermedi (L2/L3) esistono **solo se servono**: un ramo può saltare da L2 a L4
  (es. *Salvataggio › Formato e fine riga*, *Editing › Zoom*).

Come si vede la gerarchia:
- **Albero a sinistra** (cartelle collassabili) → posizione e navigazione.
- **Breadcrumb** sopra il titolo (`navigation.path`) → il percorso completo.
- **Badge colorato** in cima alla pagina → il pubblico (chi è la pagina).

!!! tip "Icone e nomi dei livelli: centralizzati"
    Icona e nome di ogni livello sono definiti **una sola volta** in `docs/stylesheets/extra.css`
    come custom property (`--lvl-ico`, `--lvl-name`). Cambiandoli lì si aggiornano ovunque
    (badge, link inline, bottoni). Nelle pagine non si scrive mai l'emoji a mano.

---

## 6. Come aggiungere contenuti

### Aggiungere una pagina

1. Crea il file `.md` dentro `docs/...`.
2. Mettilo nel `nav:` di `mkdocs.yml` (ogni pagina DEVE stare nel nav, altrimenti `--strict`
   protesta).
3. In cima, aggiungi il badge di livello — **span vuoto**, solo la classe del livello
   (icona e nome arrivano dal CSS):
   ```markdown
   <span class="lvl-badge lvl-2"></span>
   ```

### Aggiungere un nuovo argomento (cartella)

Crea `docs/lvlN-<nome>/index.md` (L1) e, se serve, le sotto-cartelle dei livelli. Poi aggiungi
il ramo nel `nav:`. La cartella diventa una voce espandibile a sinistra (grazie a
`navigation.indexes`, il nome è cliccabile e apre il suo `index.md`).

### Includere codice reale (snippet) — niente copia-incolla

Nei livelli L4, invece di incollare codice, scrivi:

```text
--8<-- "src/percorso/del/file.js"
```

- `--8<--` è il marcatore dell'estensione `pymdownx.snippets`.
- Il percorso è relativo a `base_path` (= `..`, la root del repo `marktext/`).
- Range di righe opzionale: `--8<-- "src/file.js:24:56"`.

Quando il codice nel repo cambia, alla prossima generazione la pagina è già aggiornata.

### Link tra livelli (con icona automatica)

Due casi, due stili:

- **Link contestuale** (sotto-argomento legato a una parola precisa): mettilo **inline** sulla
  parola, con le classi `lvl-link` + livello di destinazione. L'icona la mette il CSS.
  ```markdown
  [**Zoom del testo**](lvl2-zoom/index.md){ .lvl-link .lvl-2 }
  ```
- **Avanzamento dell'intero argomento** (es. "come funziona" / "implementazione"): bottone
  **in fondo** alla pagina, con `md-button` + `lvl-cta` + livello.
  ```markdown
  [Vai all'implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }
  ```

### Dizionario (termini tecnici)

Usa le **footnotes**: metti `[^slug]` dopo il termine nel testo, e la definizione in fondo
sotto un'intestazione `## Dizionario`. I numeri sono **auto-incrementali** (non scritti a mano):
cliccando l'apice si va in fondo, e una freccia ↩ riporta al punto.

```markdown
Il commit è **debounced[^debounce] di 1 secondo**.

## Dizionario

[^debounce]: *Debounce* = rimanda un'azione finché non passa un certo tempo senza nuovi eventi.
```

> Ogni `[^slug]` usato nel testo deve avere la sua definizione, altrimenti resta testo grezzo.

---

## 7. Cosa fa il `mkdocs.yml` (opzioni chiave)

| Voce | A cosa serve |
|---|---|
| `theme.features: navigation.path` | breadcrumb sopra il titolo |
| *(niente)* `navigation.tabs` | tolto di proposito → un unico albero a cartelle a sinistra |
| *(niente)* `navigation.sections` | tolto → i rami sono cartelle collassabili (non aperte e piatte) |
| `navigation.indexes` | una cartella ha la sua pagina `index.md` cliccabile |
| `use_directory_urls: false` | il sito funziona anche aperto in locale (`file://`) |
| `plugins: search` | ricerca full-text integrata |
| `pymdownx.snippets` | include codice dal repo (`base_path: ..`, `check_paths: true`) |
| `pymdownx.emoji` | converte le icone `:material-...:` in icone vere |
| `footnotes` | apici `[^x]` → sezione "Dizionario" in fondo, numerati in automatico |
| `md_in_html` | consente Markdown dentro tag HTML (es. le grid cards della Home) |
| `extra_css: stylesheets/extra.css` | badge di livello + **icona/nome centralizzati** (`--lvl-ico`, `--lvl-name`) + classi `lvl-link`/`lvl-cta` |
| `exclude_docs` | pagine del vecchio modello **parcheggiate** (escluse dal build, non cancellate) |

---

## 8. Condivisione

- **Niente server obbligatorio**: `python -m mkdocs build` crea `site/` (solo HTML/CSS/JS).
- **Offline / disco di rete**: con `use_directory_urls: false` puoi zippare `site/` o metterla
  su una cartella condivisa; si apre `site/index.html` con doppio clic.
- **Intranet**: appoggia `site/` su un IIS/Nginx interno.

---

## 9. Registro lavori (cosa è stato fatto)

1. **Verifica prerequisiti**: Python 3.13 presente; scelto `python -m pip/mkdocs` per evitare
   il Python 3.11 sul PATH.
2. **Installazione** di `mkdocs-material` 9.7.6.
3. **Scaffold** con `mkdocs new MarkTextDocs` (creati `mkdocs.yml` + `docs/index.md` base).
4. **Configurazione** `mkdocs.yml`: tema Material, ricerca, navigazione, estensioni
   (snippets, admonition, details, tabbed, emoji, md_in_html…).
5. **Prima stesura contenuti** (organizzati per argomento) dai file `DESIGN-TASK.md` e
   `EASY-TASK.md`.
6. **Gerarchia visibile**: tolto `navigation.sections`, nav ad albero collassabile.
7. **Modello a livelli per pubblico** (L0→L4): ridisegnata la struttura a cartelle `lvlN-`,
   aggiunti **badge di livello** (CSS) e **breadcrumb** (`navigation.path`, verificato come
   feature ora gratuita da Material 9.7.0).
8. **Fix icone**: attivata `pymdownx.emoji` (le `:material-...:` apparivano come testo).
9. **Argomenti completati** sul nuovo modello: Salvataggio, Finestre e schede, Editing testo,
   Ricarica file esterni — ognuno con livelli e snippet di codice reale.
10. Vecchie pagine del primo modello **parcheggiate** in `exclude_docs` (riutilizzabili in
    futuro nei livelli L3/L4).
11. **Navigazione dalla pagina**: link contestuali inline sulle parole (`lvl-link`) e bottoni
    di avanzamento in fondo (`lvl-cta`), non solo dall'albero.
12. **Centralizzazione**: icona E nome di ogni livello spostati in custom property CSS
    (`--lvl-ico`, `--lvl-name`) → si cambiano da un punto solo; i badge in pagina sono span vuoti.
13. **Dizionario per pagina**: attivata l'estensione `footnotes`; apici `[^x]` auto-numerati e
    sezione "Dizionario" in fondo sulle pagine con termini tecnici (L2/L3/L4).

---

## 10. Avvertenze

- Usa `python -m mkdocs`, non `mkdocs` nudo (vedi §2).
- Lancia i comandi da dentro `MarkTextDocs/` (per via del `base_path` degli snippet).
- Non modificare a mano la cartella `site/`: è rigenerata a ogni `build`.
- Le pagine in `exclude_docs` esistono ancora su disco ma non sono pubblicate finché non le
  rimetti nel `nav` e le togli da `exclude_docs`.
