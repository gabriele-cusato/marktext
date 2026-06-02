<span class="lvl-badge lvl-2"></span>

# Gestione delle schede

## Riordino

Le schede si riordinano trascinandole. Sotto c'è una piccola libreria di drag-and-drop;
quando rilasci, l'ordine viene salvato nello stato dell'app.

## Quando le schede vanno a capo (multi-riga)

Se apri molte schede e non entrano in una riga, la barra va su più righe. In quel caso,
se la scheda **attiva** finisce in una riga non visibile, ne compare un **clone** in alto
a destra (la "scheda agganciata"), così sai sempre qual è quella attiva e puoi raggiungerla.

Questo clone va calcolato di nuovo ogni volta che cambi scheda o trascini: la logica è
descritta nel livello implementativo.

[Vai all'implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }
