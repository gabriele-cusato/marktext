# MarkTextDocs

Documentazione del fork **MarkText** — editor Markdown desktop, cross-platform.

!!! abstract "In una riga"
    Editor Markdown con **doppia modalità** (WYSIWYG *Muya* + sorgente *CodeMirror*),
    costruito su **Electron + Vue 3 + Pinia**. Questo fork aggiunge UI v2, gestione
    encoding/EOL, zoom testo, word wrap, ricarica file esterni e molti fix.

## Come è organizzata questa documentazione

Ogni argomento è una **cartella esplorabile** nell'albero a sinistra. Più scendi, più la
spiegazione diventa tecnica:

👤 **L1 cliente** → 🔰 **L2 base** → 💻 **L3 sviluppatore** → 🔧 **L4 codice reale**

Usa la **barra di ricerca** in alto per saltare direttamente a un punto: cliccando un
risultato l'albero si apre da solo fino a lì.

## Funzioni principali (anteprima)

<div class="grid cards" markdown>

-   :material-content-save: **Salvataggio**

    Salvare i file, il pallino "non salvato", formato e codifica preservati. → [Apri](lvl1-salvataggio/index.md)

-   :material-tab: **Finestre e schede**

    Gestione tab, riordino, trascinare la finestra. → [Apri](lvl1-finestre/index.md)

-   :material-file-document-edit: **Editing testo**

    Zoom, word wrap, maiuscole/minuscole, operazioni riga. → [Apri](lvl1-editing/index.md)

-   :material-reload: **Ricarica file esterni**

    Cosa succede se un file cambia fuori dall'editor. → [Apri](lvl1-ricarica/index.md)

</div>

## Stack tecnologico

| Tecnologia | Ruolo |
|---|---|
| **Electron 39** | framework app desktop |
| **Vue 3** (Composition API) | UI del renderer |
| **Pinia** | state management (store `editor.js` il più grande) |
| **electron-vite** | build system (Vite) |
| **Muya** | engine editor WYSIWYG custom (`src/muya/`) |
| **CodeMirror 5** | editor sorgente (modalità "source") |

## Stato del progetto

!!! success "Design v2 — concluso"
    8 sessioni di fix (DESIGN-FIX-1 → 8) + sessione bug finale. Tutti i bug noti risolti.

!!! success "Task funzionali 1–10 — completati e testati"
    Verifiche utente, ultimo giro **2026-05-30**.

## Punti di attenzione (limitazioni / work-in-progress)

!!! warning "Da sapere prima di lavorare sul codice"
    - **Tab drag nativo** (trascinare una tab fuori per creare una finestra) — non implementato (alta complessità, vedi `TODO.md`).
    - **Patch `node_modules`** (CodeMirror, native-keymap) **non persistono** dopo `npm install` → usare `patch-package`.
    - **Split/Join riga** (`Ctrl+I`/`Ctrl+J`) in modalità source — non implementati (CM5 non ha built-in).
    - Funzionalità ancora aperte (selezione a colonna, multi-cursore, session restore…) → `TODO.md`.

## Come è scritta questa documentazione

I contenuti sono semplici file Markdown nella cartella `docs/`. Nei livelli 🔧 **L4** il
codice mostrato è **incluso dal repository** (non copia-incollato): quando il codice cambia,
la documentazione si aggiorna alla prossima generazione del sito. Vedi un esempio in
[Implementazione del pre-save flush](lvl1-salvataggio/lvl2-bollino/lvl3-come-funziona/lvl4-implementazione.md).
