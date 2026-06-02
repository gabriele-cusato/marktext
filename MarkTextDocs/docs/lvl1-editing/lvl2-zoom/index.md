<span class="lvl-badge lvl-2"></span>

# Zoom del testo

Con **Ctrl + rotella** ingrandisci/rimpicciolisci **solo il testo** dell'editor, non
l'intera finestra (menu, barre e schede restano della stessa dimensione).

Normalmente il browser/Electron, con Ctrl+rotella, fa lo zoom dell'intera pagina. MarkText
**intercetta** quel gesto e lo trasforma in zoom mirato al solo testo.

!!! note "Niente livello 3 qui"
    La logica è essenzialmente una riga di intercettazione dell'evento → andiamo dritti
    all'implementazione (🔧 L4). Esempio di salto L2 → L4.

[Vai all'implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }
