# Salvataggio (pre-save flush, lightTouch)

`FILE_SAVE` emette `bus.emit('pre-save')` **prima** di leggere `tab.markdown` (B8).
`handlePreSave` (`sourceCode.vue`) cancella il `commitTimer` e committa sincrono il
contenuto reale di CodeMirror.

!!! warning "Invariante"
    `handlePreSave` **non deve avere guardie** che lo saltino (es. `isFirstLoad`): un
    Ctrl+S è sempre esplicito (B13).

## lightTouch (preferenza, default ON)

Se il contenuto è semanticamente uguale all'originale (`normalizeBlock` uguale),
`getMarkdownForSave` restituisce `originalMarkdown` (preserva la formattazione originale);
altrimenti `mergeWithOriginal`.

Conseguenza: ciò che si salva può differire in formattazione da `tab.markdown`. Per questo
`mt::tab-saved`, quando `normalizeBlock` coincide, imposta `originalMarkdown = tab.markdown`
→ confronti dirty apples-to-apples (B9).
