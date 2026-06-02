<span class="lvl-badge lvl-2"></span>

# Formato e fine riga

Un file di testo non è "solo testo": ha due proprietà invisibili che MarkText preserva
quando salvi.

## Codifica dei caratteri (encoding)

È il modo in cui le lettere accentate (è, à, ü…) e i simboli sono rappresentati in byte.
File diversi usano codifiche diverse (UTF-8, ANSI/Windows-1252…). Se MarkText sbagliasse
a interpretarla, vedresti caratteri strani (il classico `Ã¨` al posto di `è`). MarkText
**rileva** la codifica all'apertura e la **mantiene** al salvataggio.

## Fine riga (EOL)

È il carattere invisibile che segna "vai a capo": `LF` (Unix/Mac), `CRLF` (Windows), `CR`
(vecchi Mac). MarkText **conserva** quello già presente nel file, così aprendo su Windows
un file Unix non lo "sporca" cambiando tutti gli a-capo.

!!! note "Niente livello 3 qui"
    Per questo sotto-argomento la logica generale coincide quasi con il codice: saltiamo
    direttamente all'implementazione (🔧 livello 4). È un esempio di gerarchia **non lineare**:
    L2 → L4 senza L3.

[Vai all'implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }
