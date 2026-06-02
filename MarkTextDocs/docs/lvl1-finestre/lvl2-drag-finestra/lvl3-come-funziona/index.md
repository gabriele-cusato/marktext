<span class="lvl-badge lvl-3"></span>

# Come funziona il drag finestra

Electron[^electron] (Chromium[^chromium]) espone una proprietà CSS speciale, `-webkit-app-region: drag`, che
marca un elemento come **zona di trascinamento della finestra OS-native**. Chromium gestisce
da solo il drag e il doppio-clic → toggle maximize/restore, senza JavaScript.

## I punti chiave

- La proprietà **si eredita** sui figli: se la metti sulla barra, tutta la barra trascina.
- I figli **interattivi** (schede, pulsante +, bottoni finestra) devono fare l'override con
  `-webkit-app-region: no-drag`, altrimenti i clic verrebbero "mangiati" dal drag.
- **Coesiste con il riordino drag delle schede**: `no-drag` sulle schede non blocca
  `mousedown`/`mousemove` (quindi la libreria di reorder funziona), blocca solo la cattura
  del drag-finestra da parte dell'OS.

!!! warning "Effetto collaterale"
    Sulle zone `drag`, Chromium può sopprimere alcuni eventi del mouse (hover/mouseenter).
    Elementi che fanno hover-expand o tracking devono essere `no-drag`.

[Vedi il codice: implementazione →](lvl4-implementazione.md){ .md-button .md-button--primary .lvl-cta .lvl-4 }

## Dizionario

[^electron]: *Electron* = framework per app desktop che usa tecnologie web (HTML/CSS/JS) con un motore Chromium.
[^chromium]: *Chromium* = il motore del browser (lo stesso di Chrome) usato da Electron per disegnare l'interfaccia.
