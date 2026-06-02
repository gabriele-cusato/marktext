<span class="lvl-badge lvl-3"></span>

# Come funziona il dirty flag

Il pallino è la proprietà `tab.isSaved === false`. La "verità" è il confronto tra il
**contenuto dell'editor** e `tab.originalMarkdown` (la baseline = ultima versione
salvata/caricata; `null` per un Untitled mai salvato).

## La differenza tra le due modalità

Qui sta la radice di diversi bug:

- **Muya (WYSIWYG[^wysiwyg])**: il listener `on('change')` chiama `LISTEN_FOR_CONTENT_CHANGE`
  **in modo sincrono** → lo store (`tab.markdown`) è sempre aggiornato.
- **CodeMirror (testo grezzo)**: il commit allo store è **debounced[^debounce] di 1 secondo**. Quindi
  per ~1s dopo aver digitato, `tab.markdown` può essere **stale** (vecchio). È il ritardo
  che si nota sul pallino.

## Il problema al salvataggio e la soluzione

Se premi `Ctrl+S` entro quel secondo, `FILE_SAVE` rischia di leggere il contenuto vecchio.
La soluzione è il **pre-save flush[^presave]**: prima di leggere `tab.markdown`, lo store emette
l'evento `pre-save`; il componente sorgente lo intercetta, **annulla il timer di debounce**
e committa subito il contenuto reale di CodeMirror.

!!! warning "Invariante"
    La funzione di flush **non deve avere guardie** che la saltino (es. `isFirstLoad`):
    un `Ctrl+S` è sempre esplicito.

[Vedi il codice: implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }

## Dizionario

[^wysiwyg]: *WYSIWYG* (what you see is what you get) = editor che mostra il testo già formattato, non il codice sorgente.
[^debounce]: *Debounce* = rimanda un'azione finché non passa un certo tempo senza nuovi eventi (qui: 1s dopo l'ultima digitazione).
[^presave]: *Pre-save flush* = forzare la scrittura del contenuto in attesa appena prima del salvataggio, per non salvare dati vecchi.
