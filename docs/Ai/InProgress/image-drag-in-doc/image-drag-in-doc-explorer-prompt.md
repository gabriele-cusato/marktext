# image-drag-in-doc — prompt pronto per Agent-Explorer (indagine pre-plan)

Preparato il 2026-07-13; l'agente era stato lanciato e poi fermato su richiesta utente
(ripresa rimandata). Rilanciare Agent-Explorer con il prompt sotto, invariato, come primo
passo della feature.

---

Esplorazione READ-ONLY del progetto MarkText in C:\Projects\MarkText\marktext. Obiettivo: raccogliere i fatti necessari a scrivere il plan della feature "image-drag-in-doc": trascinare un'immagine GIÀ presente nel documento in un'altra posizione del documento per spostarla (oggi il drag è disabilitato e il browser seleziona).

Contesto già verificato (2026-07-08, plan in docs/Ai/InProgress/image-drag-in-doc/image-drag-in-doc-plan.md — leggilo per primo):
- src/muya/lib/eventHandler/dragDrop.js:13-17 — dragStartHandler: se event.target.tagName === 'IMG' → event.preventDefault().
- src/muya/lib/ui/transformer/index.js:61 — overlay immagine: dragstart → preventDefault().
- src/muya/lib/contentState/dragDropCtrl.js — dropHandler gestisce SOLO file immagine esterni e text/uri-list; nessun ramo per blocchi interni.
- Vincolo permanente progetto (DECISIONS 2026-07-03, electron#42252): mai preventDefault/dropEffect/stopPropagation in handler dragover per gesti che non si intende accettare (rifiuto passivo); l'evento drop stessa-finestra è INAFFIDABILE su Windows per drag HTML5 interni — le decisioni si prendono su dragend (che porta clientX/clientY), con handler drop tenuto come percorso preferenziale + flag anti-doppia-esecuzione.

Domande a cui rispondere (per ciascuna: file, righe, fatti, citazioni brevi di codice):
1. Come è rappresentata un'immagine nel modello a blocchi di Muya (inline token in un paragrafo? blocco dedicato?): struttura del block/token, dove sta il src, come si identifica il blocco che contiene l'immagine partendo dal nodo IMG del DOM.
2. Transformer (src/muya/lib/ui/transformer/): come funziona (quando appare, come gestisce i mousedown per il resize, quali handler ha su immagine e maniglie), e come distinguere il gesto resize dal potenziale gesto drag sull'immagine.
3. Come funziona la selezione dell'immagine al click (chi la fa: transformer? clickCtrl? selectionCtrl?) e cosa succede oggi al mousedown+move su un'IMG.
4. dragDropCtrl.js completo: struttura di dragoverHandler/dropHandler, come funziona il ghost/dropAnchor (createGhost, dropAnchor: dove sono definiti, che API hanno, up/before vs down/after), e i commenti storici del "round 8" su electron#42252.
5. Come si fa programmaticamente in contentState: rimuovere un blocco/token immagine e reinserirlo in un altro punto (metodi esistenti: removeBlock? insertBlock? insertImage? getBlock? esempi di altri ctrl che spostano blocchi, es. drag di tabelle/list item se esiste), più render() e stateChange/dispatchChange per persistere.
6. eventHandler/dragDrop.js completo: quali eventi binda, su quale elemento, e come interagisce con contentState.dragDropCtrl.
7. Esistono già MIME custom interni usati nel progetto (es. text/mt-tab-id per il drag delle tab)? Dove sono definiti e come vengono gestiti, come riferimento di pattern.
8. Il drop di immagini ESTERNE (da Explorer) che flusso segue oggi esattamente (handler, funzioni chiamate, dove viene inserita l'immagine)? Questo ramo NON deve rompersi.

Output: sintesi organizzata per domanda, con percorsi file:riga precisi e fatti verificati (niente supposizioni; se qualcosa non esiste, dirlo esplicitamente). Non modificare nulla.
