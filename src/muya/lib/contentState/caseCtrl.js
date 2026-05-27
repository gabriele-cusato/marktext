const caseCtrl = (ContentState) => {
  // Trasforma il case della selezione corrente (single-block).
  // Ritorna true se la trasformazione è avvenuta, false altrimenti.
  ContentState.prototype.changeSelectionCase = function (type) {
    const { start, end } = this.cursor
    if (!start || !end || start.key !== end.key) return false

    let s = start.offset
    let e = end.offset
    if (s > e) [s, e] = [e, s]
    if (s === e) return false

    const block = this.getBlock(start.key)
    if (!block) return false

    const sel = block.text.substring(s, e)
    const out = type === 'upper' ? sel.toUpperCase() : sel.toLowerCase()
    block.text = block.text.substring(0, s) + out + block.text.substring(e)
    this.partialRender()
    this.muya.dispatchChange()
    return true
  }
}

export default caseCtrl
