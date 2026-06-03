# MK-DOCS — guida d'uso e registro lavori

Documentazione del progetto **MarkTextDocs** (documentazione di MarkText, costruita con
Zensical). Questo file spiega **come si usa lo strumento** e **cosa è stato fatto**.

---

## 0. Storia, migrazione e nuovo strumento

### Stato iniziale (fino a giugno 2026)

Progetto costruito originariamente con due pacchetti Python separati:

- **MkDocs** — motore base: prende file Markdown + `mkdocs.yml` e genera HTML statico.
- **Material for MkDocs** — tema + estensioni sopra MkDocs: ricerca full-text, layout responsive, badge di livello, navigazione ad albero.

### Perché si è migrato

A febbraio 2026 il team MkDocs ha annunciato **MkDocs 2.0**, una riscrittura totale incompatibile con tutto l'esistente:

- il sistema di plugin viene rimosso → tutti i plugin smettono di funzionare
- il sistema di temi viene riscritto da zero → tutti i temi si rompono
- nessun percorso di migrazione automatica verso la nuova versione
- modello di sviluppo chiuso → la community non può segnalare bug
- al lancio nessuna licenza open-source valida → non adatto alla produzione

Il team di Material for MkDocs ha risposto mettendo il progetto in **maintenance mode**
(patch di sicurezza garantite fino a novembre 2026) e avviando **Zensical** come successore.

### Cos'è Zensical

**Zensical** è il successore diretto di MkDocs + Material for MkDocs, sviluppato dallo
stesso team di Material for MkDocs. Differenze chiave:

| | MkDocs + Material | Zensical |
|---|---|---|
| Motore | Python | Rust (rebuild da zero, ordini di grandezza più veloce) |
| Licenza | Open source | FOSS — nessun "Insiders", nessuna funzione a pagamento |
| Plugin | Rimossi in v2 | Supportati |
| Stato | Maintenance mode fino a nov 2026 | Sviluppo attivo |

**Migrazione trasparente**: Zensical legge nativamente `mkdocs.yml` invariato. I file
Markdown, i link, gli snippet e i CSS personalizzati funzionano senza toccare nulla.
In futuro verrà rilasciato un convertitore automatico verso il formato nativo `zensical.toml`.

Fonti: [annuncio Material](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/) · [FAQ Zensical](https://zensical.org/docs/community/faqs/)

---

## ⚡ Avvio rapido (parti da qui)

Su un PC nuovo, dopo aver clonato il repo o fatto `git pull`:

```powershell
# 1. Installa lo strumento (una volta sola per PC)
pip install zensical

# 2. Entra nella cartella della documentazione
cd C:\Projects\MarkText\marktext\MarkTextDocs

# 3. Avvia il server e apri http://127.0.0.1:8000/ nel browser
zensical serve
```

Per generare la versione statica (cartella `site/`, condivisibile o apribile offline col
doppio clic su `site/index.html`):

```powershell
zensical build
```

!!! warning "Cosa sapere subito"
    La cartella **`site/` è ignorata da git** (è rigenerabile): sull'altro PC dopo `git pull`
    non c'è, la ricrei con i comandi qui sopra. Il sorgente versionato è tutto testo.

---

## 1. Cos'è

- **Zensical**: generatore di siti statici scritto in Rust. Prende file Markdown + un file
  di config (`mkdocs.yml` o `zensical.toml`) e produce un sito HTML navigabile. Niente
  database, niente server applicativo. Motore ordini di grandezza più veloce di MkDocs
  (Python): il live-reload è praticamente istantaneo.
- Include il tema e tutte le estensioni che in precedenza erano in Material for MkDocs
  (ricerca full-text, layout responsive, evidenziazione codice, navigazione ad albero,
  breadcrumb, temi chiaro/scuro), senza pacchetti separati.

Pacchetto installato: `zensical` (tutto in uno, nessuna dipendenza aggiuntiva).

---

## 2. Installazione (già fatta)

```powershell
pip install zensical
```

Versione: vedi `pip show zensical` dopo l'installazione.

---

## 3. Comandi quotidiani

Lanciali **dalla cartella `MarkTextDocs/`** (dove sta `mkdocs.yml`):

```powershell
cd C:\Projects\MarkText\marktext\MarkTextDocs

zensical serve          # server di sviluppo con auto-reload → http://127.0.0.1:8000/
zensical build          # genera la cartella site/ (HTML statico)
zensical build --strict # come sopra, ma ogni warning diventa errore (verifica)
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

### Riferimento classi CSS

Tutte le classi personalizzate vivono in `docs/stylesheets/extra.css`. Icone e nomi sono
custom property CSS — per cambiarli basta modificare `extra.css`, non le pagine.

**Livelli disponibili:**

| Livello | Classe | Colore badge | Icona | Nome nel badge |
|---|---|---|---|---|
| L1 | `lvl-1` | verde `#2e7d32` | 👤 | Livello 1 · per il cliente |
| L2 | `lvl-2` | blu `#1565c0` | 🔰 | Livello 2 · per chi conosce un po' |
| L3 | `lvl-3` | viola `#6a1b9a` | 💻 | Livello 3 · per sviluppatori esterni |
| L4 | `lvl-4` | rosso `#b71c1c` | 🔧 | Livello 4 · implementazione |

**Combinazioni di classi per ogni contesto:**

| Contesto | Classi | Codice |
|---|---|---|
| Badge in cima pagina | `lvl-badge lvl-N` | `<span class="lvl-badge lvl-2"></span>` |
| Link inline nel testo | `lvl-link lvl-N` | `[parola](path/index.md){ .lvl-link .lvl-2 }` |
| Bottone fine pagina | `md-button md-button--primary lvl-cta lvl-N` | `[Vai →](path){ .md-button .md-button--primary .lvl-cta .lvl-4 }` |

Regola: la classe `lvl-N` va **sempre** accoppiata alla classe di contesto (`lvl-badge`,
`lvl-link` o `lvl-cta`). Da sola non ha effetto visivo.

### Template pagine complete

Usare questi template come punto di partenza per ogni nuovo file.

---

**Pagina L0 — Home** (`docs/index.md`):

```markdown
# NomeProgetto

Descrizione breve del progetto in una riga.

!!! abstract "In una riga"
    Riassunto tecnico sintetico: stack, scopo, cosa aggiunge rispetto all'originale.

## Come è organizzata questa documentazione

Ogni argomento è una **cartella esplorabile** nell'albero a sinistra. Più scendi, più la
spiegazione diventa tecnica:

👤 **L1 cliente** → 🔰 **L2 base** → 💻 **L3 sviluppatore** → 🔧 **L4 codice reale**

## Funzioni principali (anteprima)

<div class="grid cards" markdown>

-   :material-icon-name: **Titolo funzione A**

    Descrizione breve. → [Apri](lvl1-argomento-a/index.md)

-   :material-icon-name: **Titolo funzione B**

    Descrizione breve. → [Apri](lvl1-argomento-b/index.md)

</div>

## Stack tecnologico

| Tecnologia | Ruolo |
|---|---|
| **Lib/Framework** | ruolo nel progetto |

## Stato del progetto

!!! success "Versione X — completata"
    Breve nota sullo stato attuale.

!!! warning "Da sapere prima di lavorare sul codice"
    - Limitazione nota A
    - Limitazione nota B
```

> Le grid cards richiedono `md_in_html` abilitato in `mkdocs.yml`.
> Ogni card inizia con `-   :material-icon:` (trattino + tre spazi), con tre spazi di indentazione.
> Icone disponibili: cerca su [Material Symbols](https://fonts.google.com/icons).

---

**Pagina L1** — panoramica cliente (`docs/lvl1-<argomento>/index.md`):

```markdown
<span class="lvl-badge lvl-1"></span>

# Titolo argomento

Descrizione breve in linguaggio cliente: cosa fa questa funzione, perché è utile.
Niente tecnicismi.

## Come si usa

Passi concreti dal punto di vista dell'utente finale.

## Approfondimenti

- [**Sotto-argomento A**](lvl2-sotto-a/index.md){ .lvl-link .lvl-2 }
- [**Sotto-argomento B**](lvl2-sotto-b/index.md){ .lvl-link .lvl-2 }
```

---

**Pagina L2** — dettaglio per chi conosce le basi (`docs/lvl1-x/lvl2-<sottoarg>/index.md`):

```markdown
<span class="lvl-badge lvl-2"></span>

# Titolo sotto-argomento

Descrizione per chi conosce già le basi. Spiega il concetto con più dettaglio di L1,
ma ancora senza entrare nel codice sorgente.

## Sezione principale

Contenuto con dettaglio tecnico moderato: comportamento, casi d'uso, effetti visibili.

## Un dettaglio non ovvio (opzionale)

Se c'è qualcosa di non intuitivo, spiegalo qui.

[Approfondisci: come funziona →](lvl3-come-funziona/index.md){ .md-button .md-button--primary .lvl-cta .lvl-3 }
```

> Se il ramo **salta L3** (direttamente L2→L4), cambia il CTA in:
> `[Vai all'implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }`

---

**Pagina L3** — spiegazione tecnica per sviluppatore esterno (`docs/.../lvl3-come-funziona/index.md`):

```markdown
<span class="lvl-badge lvl-3"></span>

# Come funziona — Titolo argomento

Spiegazione tecnica per uno sviluppatore esterno: logica, flusso, architettura.
Senza codice sorgente diretto, ma con riferimenti a file e funzioni.

## Flusso principale

Descrizione del flusso logico e delle interazioni tra componenti.

## Perché funziona così

Motivazioni architetturali o vincoli che spiegano le scelte.

[Vai all'implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }
```

---

**Pagina L4** — implementazione/codice reale (`docs/.../lvl4-implementazione.md`):

```markdown
<span class="lvl-badge lvl-4"></span>

# Implementazione — Titolo argomento

Breve intro: cosa implementa questo modulo e dove si inserisce nel flusso.

## File coinvolti

- `src/percorso/del/file.js` — descrizione ruolo

## Codice

```javascript
--8<-- "src/percorso/del/file.js:10:50"
```

## Dizionario

[^termine]: Definizione del termine tecnico usato sopra.
```

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
| `pymdownx.emoji` | converte le icone `:material-...:` in icone SVG; Zensical gestisce la conversione internamente ma richiede il blocco con opzioni per attivarla — `emoji_index`/`emoji_generator` restano nel file anche se il modulo Python non è installato |
| `footnotes` | apici `[^x]` → sezione "Dizionario" in fondo, numerati in automatico |
| `md_in_html` | consente Markdown dentro tag HTML (es. le grid cards della Home) |
| `extra_css: stylesheets/extra.css` | badge di livello + **icona/nome centralizzati** (`--lvl-ico`, `--lvl-name`) + classi `lvl-link`/`lvl-cta` |
| `exclude_docs` | pagine del vecchio modello **parcheggiate** (escluse dal build, non cancellate) |

---

## 8. Condivisione

- **Niente server obbligatorio**: `zensical build` crea `site/` (solo HTML/CSS/JS).
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
14. **Migrazione a Zensical** (giugno 2026): sostituito `mkdocs-material` con `zensical`
    (drop-in replacement, stesso `mkdocs.yml` invariato). Nessuna modifica a Markdown,
    CSS o nav. Motivazione: MkDocs 2.0 incompatibile con tutti i plugin/temi esistenti;
    Material for MkDocs in maintenance mode fino a nov 2026. Zensical è il successore
    ufficiale dello stesso team, FOSS, motore Rust.

---

## 10. Adattare questo modello a un altro progetto

Questo documento descrive la documentazione di **MarkText** come caso concreto, ma il modello
a livelli è riutilizzabile su qualsiasi progetto software. Passi per adattarlo:

### 1. Scaffold del nuovo progetto

Zensical ha un comando ufficiale per inizializzare un progetto:

```powershell
zensical new MioProgettoDocs
```

Crea automaticamente: `MioProgettoDocs/zensical.toml`, `docs/index.md`, `docs/markdown.md`,
`.github/workflows/docs.yml`. Se la cartella non esiste la crea; non sovrascrive file esistenti.

> **Per usare il modello di questo progetto** (badge livelli, nav gerarchico, snippet da repo)
> conviene partire dal `mkdocs.yml` di MarkTextDocs invece del `zensical.toml` generato:
>
> 1. Dopo `zensical new`, elimina `zensical.toml` e crea `mkdocs.yml` copiando quello di
>    `MarkTextDocs/` — adatta: `site_name`, `site_description`, `repo_url`, `repo_name`,
>    `base_path` degli snippet, `nav`.
> 2. Zensical legge `mkdocs.yml` nativamente (compatibilità garantita).

Se non hai accesso al repo MarkTextDocs, usa questo template minimale come punto di partenza:

```yaml
site_name: NomeProgetto
site_description: Descrizione del progetto
repo_url: https://github.com/utente/repo
repo_name: utente/repo
use_directory_urls: false

theme:
  name: material
  language: it
  features:
    - navigation.instant
    - navigation.path
    - navigation.top
    - navigation.indexes
    - toc.follow
    - search.suggest
    - search.highlight
    - content.code.copy
  palette:
    - scheme: default
      toggle: { icon: material/weather-night, name: Tema scuro }
    - scheme: slate
      toggle: { icon: material/weather-sunny, name: Tema chiaro }

extra_css:
  - stylesheets/extra.css

plugins:
  - search:
      lang: it

markdown_extensions:
  - admonition
  - attr_list
  - md_in_html
  - tables
  - footnotes
  - toc:
      permalink: true
  - pymdownx.details
  - pymdownx.superfences
  - pymdownx.highlight:
      anchor_linenums: true
      line_spans: __span
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.emoji:
      emoji_index: !!python/name:material.extensions.emoji.twemoji
      emoji_generator: !!python/name:material.extensions.emoji.to_svg
  - pymdownx.snippets:
      base_path:
        - ..
      check_paths: true

nav:
  - Home: index.md
  - Argomento A:
      - Panoramica: lvl1-argomento-a/index.md
```

### 2. Crea `docs/stylesheets/extra.css`

Crea il file `docs/stylesheets/extra.css` con questo contenuto esatto (identico per qualsiasi
progetto — cambia solo i valori `--lvl-ico` e `--lvl-name` se vuoi icone o nomi diversi):

```css
/* ============================================================
   LIVELLI — icona E nome definiti UNA volta sola qui.
   Vuoi cambiare l'icona o il nome? Modifica --lvl-ico / --lvl-name
   nella riga del livello: si aggiorna OVUNQUE (badge, link, bottoni).
   ============================================================ */
.lvl-1 { --lvl-ico: "👤"; --lvl-name: "Livello 1 · per il cliente"; }
.lvl-2 { --lvl-ico: "🔰"; --lvl-name: "Livello 2 · per chi conosce un po'"; }
.lvl-3 { --lvl-ico: "💻"; --lvl-name: "Livello 3 · per sviluppatori esterni"; }
.lvl-4 { --lvl-ico: "🔧"; --lvl-name: "Livello 4 · implementazione"; }

/* Badge in cima a ogni pagina. */
.lvl-badge {
  display: inline-block;
  padding: 0.15rem 0.65rem;
  margin: 0 0 1.2rem 0;
  border-radius: 1rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
}
.lvl-badge::before { content: var(--lvl-ico) " " var(--lvl-name); }

/* Colore badge per livello. */
.lvl-badge.lvl-1 { background: #2e7d32; }
.lvl-badge.lvl-2 { background: #1565c0; }
.lvl-badge.lvl-3 { background: #6a1b9a; }
.lvl-badge.lvl-4 { background: #b71c1c; }

/* Link inline verso sotto-livello: icona del livello di destinazione davanti al testo. */
a.lvl-link::before { content: var(--lvl-ico) " "; }

/* Bottoni "vai al livello": icona davanti al testo del bottone. */
.lvl-cta::before { content: var(--lvl-ico) " "; }
```

Assicurarsi che in `mkdocs.yml` sia presente:
```yaml
extra_css:
  - stylesheets/extra.css
```

### 3. Definisci gli argomenti del tuo progetto

Per ogni area funzionale del progetto:
- Crea `docs/lvl1-<argomento>/index.md` (usa il template L1 di §6)
- Aggiungi sotto-cartelle `lvl2-`, `lvl3-`, `lvl4-` solo dove servono (non sono obbligatori tutti i livelli)
- Aggiungi ogni file al `nav:` di `mkdocs.yml`

### 4. Adatta gli snippet al tuo repo

Nel tuo `mkdocs.yml`, imposta `base_path` alla root del tuo repo:
```yaml
- pymdownx.snippets:
    base_path:
      - ..     # o il percorso relativo corretto per il tuo progetto
    check_paths: true
```

Nei file L4, includi codice reale con `--8<-- "src/tuo/file.ext:rigaInizio:rigaFine"`.

### Progetto di riferimento

**MarkText** (`MarkTextDocs/`) è l'esempio pratico di questo modello:
- 4 argomenti completi: Salvataggio, Finestre e schede, Editing testo, Ricarica file esterni
- Struttura cartelle `lvlN-` con livelli L1→L4 (alcuni rami saltano L3)
- Snippet di codice reale da `src/` del repo Electron/Vue3
- Badge, link inline e bottoni CTA funzionanti

---

## 11. Avvertenze

- Lancia i comandi da dentro `MarkTextDocs/` (per via del `base_path` degli snippet).
- Non modificare a mano la cartella `site/`: è rigenerata a ogni `build`.
- Aggiungi `site/` al `.gitignore` del repo (non va versionata — è output rigenerabile):
  ```
  site/
  ```
- Le pagine in `exclude_docs` esistono ancora su disco ma non sono pubblicate finché non le
  rimetti nel `nav` e le togli da `exclude_docs`.
- Il file di config si chiama ancora `mkdocs.yml`: Zensical lo legge nativamente.
  Quando verrà rilasciato il convertitore ufficiale, si potrà migrare a `zensical.toml`,
  ma non è urgente.
