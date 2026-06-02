<span class="lvl-badge lvl-3"></span>

# Come funzionano le operazioni-riga

L'editor sorgente è **CodeMirror 5**. Alcuni comandi (duplica, elimina) sono built-in;
altri (sposta riga su/giù) **non lo sono** e vanno registrati a mano.

## Due ostacoli

1. **`swapLineUp`/`swapLineDown` non sono built-in**[^builtin] in CodeMirror 5. Esistono nell'addon[^addon]
   `keymap/sublime.js`, ma importarlo porterebbe ~40 keybinding Sublime in conflitto con
   MarkText. Soluzione: registrare **solo** quei due comandi, copiati dall'originale.
2. **Conflitto con gli accelerator di menu Electron**[^accelerator]: gli accelerator del menu
   **precedono** gli `extraKeys` di CodeMirror. Per i tasti in conflitto il routing è
   mode-aware e passa per il `bus`, così in modalità testo l'azione è quella giusta.

!!! note "extraKeys e normalizeKeyMap"
    Gli `extraKeys` vanno passati a `codeMirror.normalizeKeyMap({...})`: al dispatch CodeMirror
    costruisce la stringa nell'ordine `Shift-Ctrl-Up`, non `Ctrl-Shift-Up`.

[Vedi il codice: implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }

## Dizionario

[^builtin]: *Built-in* = funzione già inclusa nella libreria, pronta all'uso senza aggiungere altro.
[^addon]: *Addon* = modulo aggiuntivo opzionale di CodeMirror che porta funzioni extra.
[^accelerator]: *Accelerator* = scorciatoia da tastiera associata a una voce di menu di Electron.
