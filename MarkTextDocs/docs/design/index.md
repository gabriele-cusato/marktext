# Design UI v2 — riepilogo sessioni

Implementazione completa della UI v2 sul fork (Electron + Vue3 + Pinia + Muya).
8 sessioni di fix (DESIGN-FIX-1 → 8) + sessione bug finale. **Stato: concluso.**

Design di riferimento: `DESIGN/marktext/project/Markdown Editor v2.html` + `editor-v2.jsx`.

## Cosa è stato fatto (per categoria)

??? note "Foundation UI v2"
    Token CSS `--v2-*` (colori, shadow, timing, font) con tema chiaro/scuro. Google Fonts
    (Inter + JetBrains Mono). TitleBar nativa nascosta, `autoHideMenuBar: true`. Alt → toggle menu nativo.

??? note "Tab bar (`tabs.vue` — file più modificato)"
    Redesign pill style, multirow con hover expand. Zona topright con icone finestra (min/max/close).
    Pulsante "+" inline o nel topright. Tab clone (pinnedTab) quando la tab attiva è in riga 2+.
    Drag finestra OS-native (`-webkit-app-region: drag`) coesistente con dragula reorder.

??? note "Status bar (`statusBar/index.vue` — creato)"
    Mostra Prg/Ln, Col, saved dot, EOL (LF/CRLF/CR), encoding, Wrap, zoom%. Supporto CR (Macintosh).
    Encoding: 5 voci top-level + sottomenu. cp1252 rinominato "ANSI".

??? note "Editor CodeMirror (`sourceCode.vue`)"
    `markRaw(codeMirrorInstance)` — **FIX CRITICO**: evita il deep-reactive proxy di Vue3 sul doc
    tree di CodeMirror (causa root dei crash su click/cursore). ResizeObserver per la tiny line iniziale.

## Note tecniche importanti

!!! info "markRaw su librerie con stato mutabile"
    Vue3 `ref()` deep-proxifica il doc tree di CodeMirror → il loop manuale `indexOf` confronta
    raw vs proxy → restituisce -1 → crash. **Fix:** `editor.value = markRaw(instance)`. Pattern
    obbligatorio per qualsiasi libreria con stato mutabile (CodeMirror, Three.js, Monaco…).

!!! info "Doppio rAF"
    Un singolo `requestAnimationFrame` gira PRIMA del paint del browser. Pattern affidabile per
    misurazioni DOM: `nextTick → rAF → rAF → measure`.

!!! info "Magic margin di CodeMirror"
    `.CodeMirror-scroll { margin-bottom:-50px; padding-bottom:50px }` è pensato per CM con altezza
    **fissa** + scroll interno. Wrapparlo in una surface scroll esterna rompe lo scroll delle ultime
    righe. Regola: lasciare CM scrollare internamente (`height:100%` + parent `overflow:hidden`).
