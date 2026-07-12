import selection from '../selection'
import { findNearestParagraph, findOutMostParagraph } from '../selection/dom'
import { tokenizer, generator } from '../parser/'
import { getImageInfo } from '../utils/getImageInfo'

const backspaceCtrl = (ContentState) => {
  ContentState.prototype.checkBackspaceCase = function () {
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const outMostParagraph = findOutMostParagraph(node)
    let block = this.getBlock(paragraph.id)
    if (block.type === 'span' && block.preSibling) {
      return false
    }
    if (block.type === 'span') {
      block = this.getParent(block)
    }
    const preBlock = this.getPreSibling(block)
    const outBlock = this.findOutMostBlock(block)
    const parent = this.getParent(block)

    const { left: outLeft } = selection.getCaretOffsets(outMostParagraph)
    const { left: inLeft } = selection.getCaretOffsets(paragraph)

    if (
      (parent && parent.type === 'li' && inLeft === 0 && this.isFirstChild(block)) ||
      (parent &&
        parent.type === 'li' &&
        inLeft === 0 &&
        parent.listItemType === 'task' &&
        preBlock.type === 'input') // handle task item
    ) {
      if (this.isOnlyChild(parent)) {
        /**
         * <ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         * <ul>
         * ===>
         * <p>|text</p>
         * <p>maybe has other paragraph</p>
         */
        return { type: 'LI', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(parent)) {
        /**
         * <ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         * ===>
         * <p>|text</p>
         * <p>maybe has other paragraph</p>
         * <ul>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         */
        return { type: 'LI', info: 'REMOVE_INSERT_BEFORE' }
      } else {
        /**
         * <ul>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         * ===>
         * <ul>
         *   <li>
         *     <p>other list item|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         */
        return { type: 'LI', info: 'INSERT_PRE_LIST_ITEM' }
      }
    }
    if (parent && parent.type === 'blockquote' && inLeft === 0) {
      if (this.isOnlyChild(block)) {
        return { type: 'BLOCKQUOTE', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(block)) {
        return { type: 'BLOCKQUOTE', info: 'INSERT_BEFORE' }
      }
    }
    if (!outBlock.preSibling && outLeft === 0) {
      return { type: 'STOP' }
    }
  }

  ContentState.prototype.docBackspaceHandler = function (event) {
    // handle delete selected image
    if (this.selectedImage) {
      event.preventDefault()
      return this.deleteImage(this.selectedImage)
    }
    if (this.selectedTableCells) {
      event.preventDefault()
      return this.deleteSelectedTableCells()
    }
  }

  ContentState.prototype.backspaceHandler = function (event) {
    const { start, end } = selection.getCursorRange()

    // [PARTE-F-DEBUG] log temporaneo: ingresso backspaceHandler, stato cursore grezzo.
    console.log(
      `[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ingresso ctrlKey=${event.ctrlKey} metaKey=${event.metaKey} hasStart=${!!start} hasEnd=${!!end} startOffset=${start && start.offset} endOffset=${end && end.offset}`
    )

    if (!start || !end) {
      // [PARTE-F-DEBUG] log temporaneo: uscita anticipata, nessun cursore valido.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: uscita anticipata !start || !end')
      return
    }

    // handle delete selected image
    if (this.selectedImage) {
      // [PARTE-F-DEBUG] log temporaneo: ramo selectedImage.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: selectedImage')
      event.preventDefault()
      return this.deleteImage(this.selectedImage)
    }

    // Handle select all content.
    if (this.isSelectAll()) {
      // [PARTE-F-DEBUG] log temporaneo: ramo selectAll.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: isSelectAll')
      event.preventDefault()
      this.blocks = [this.createBlockP()]
      this.init()

      this.render()

      this.muya.dispatchSelectionChange()
      this.muya.dispatchSelectionFormats()
      return this.muya.dispatchChange()
    }

    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    // [PARTE-F-DEBUG] log temporaneo: contesto blocchi risolti (start/end).
    console.log(
      `[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler contesto blocchi startBlockType=${startBlock && startBlock.type} startBlockFunctionType=${startBlock && startBlock.functionType} endBlockKey=${endBlock && endBlock.key} endBlockFunctionType=${endBlock && endBlock.functionType}`
    )
    const maybeLastRow = this.getParent(endBlock)
    const startOutmostBlock = this.findOutMostBlock(startBlock)
    const endOutmostBlock = this.findOutMostBlock(endBlock)
    // Just for fix delete the last `#` or all the atx heading cause error @fixme
    if (
      start.key === end.key &&
      startBlock.type === 'span' &&
      startBlock.functionType === 'atxLine'
    ) {
      if (
        (start.offset === 0 && end.offset === startBlock.text.length) ||
        (start.offset === end.offset && start.offset === 1 && startBlock.text === '#')
      ) {
        // [PARTE-F-DEBUG] log temporaneo: ramo atxLine heading fix.
        console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: atxLine heading fix')
        event.preventDefault()
        startBlock.text = ''
        this.cursor = {
          start: { key: start.key, offset: 0 },
          end: { key: end.key, offset: 0 }
        }
        this.updateToParagraph(this.getParent(startBlock), startBlock)
        return this.partialRender()
      }
    }
    // fix: #897
    const { text } = startBlock
    const tokens = tokenizer(text, {
      options: this.muya.options
    })
    let needRender = false
    let preToken = null
    for (const token of tokens) {
      // handle delete the second $ in inline_math.
      if (token.range.end === start.offset && token.type === 'inline_math') {
        needRender = true
        token.raw = token.raw.substr(0, token.raw.length - 1)
        break
      }
      // handle pre token is a <ruby> html tag, need preventdefault.
      if (
        token.range.start + 1 === start.offset &&
        preToken &&
        preToken.type === 'html_tag' &&
        preToken.tag === 'ruby'
      ) {
        needRender = true
        token.raw = token.raw.substr(1)
        break
      }
      preToken = token
    }
    if (needRender) {
      // [PARTE-F-DEBUG] log temporaneo: ramo needRender (inline_math/ruby).
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: needRender inline_math/ruby')
      startBlock.text = generator(tokens)
      event.preventDefault()
      start.offset--
      end.offset--
      this.cursor = {
        start,
        end
      }
      return this.partialRender()
    }

    // fix bug when the first block is table, these two ways will cause bugs.
    // 1. one paragraph bollow table, selectAll, press backspace.
    // 2. select table from the first cell to the last cell, press backsapce.
    const maybeCell = this.getParent(startBlock)
    if (/th/.test(maybeCell.type) && start.offset === 0 && !maybeCell.preSibling) {
      if (
        (end.offset === endBlock.text.length &&
          startOutmostBlock === endOutmostBlock &&
          !endBlock.nextSibling &&
          !maybeLastRow.nextSibling) ||
        startOutmostBlock !== endOutmostBlock
      ) {
        // [PARTE-F-DEBUG] log temporaneo: ramo table th prima cella.
        console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: table th prima cella')
        event.preventDefault()
        // need remove the figure block.
        const figureBlock = this.getBlock(this.closest(startBlock, 'figure'))
        // if table is the only block, need create a p block.
        const p = this.createBlockP(endBlock.text.substring(end.offset))
        this.insertBefore(p, figureBlock)
        const cursorBlock = p.children[0]
        if (startOutmostBlock !== endOutmostBlock) {
          this.removeBlocks(figureBlock, endBlock)
        }

        this.removeBlock(figureBlock)
        const { key } = cursorBlock
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        return this.render()
      }
    }
    // Fixed #1456 existed bugs `Select one cell and press backspace will cause bug`
    if (
      startBlock.functionType === 'cellContent' &&
      this.cursor.start.offset === 0 &&
      this.cursor.end.offset !== 0 &&
      this.cursor.end.offset === startBlock.text.length
    ) {
      // [PARTE-F-DEBUG] log temporaneo: ramo cellContent selezione intera.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: cellContent selezione intera')
      event.preventDefault()
      event.stopPropagation()
      startBlock.text = ''
      const { key } = startBlock
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.singleRender(startBlock)
    }

    if (
      startBlock.functionType === 'codeContent' &&
      startBlock.key === endBlock.key &&
      !(this.cursor.start.offset === 0 && this.cursor.end.offset === 0)
    ) {
      // [PARTE-F-DEBUG] log temporaneo: ramo codeContent, candidato principale per il bug
      // Ctrl+Backspace — questo ramo non controlla event.ctrlKey e fa sempre preventDefault +
      // cancellazione manuale di 1 carattere (o tabSize), bloccando la word-delete nativa.
      console.log(
        `[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: codeContent preso ctrlKey=${event.ctrlKey} metaKey=${event.metaKey} startOffset=${this.cursor.start.offset} endOffset=${this.cursor.end.offset} blockFunctionType=${startBlock.functionType}`
      )
      event.preventDefault()
      event.stopPropagation()
      const { key } = startBlock
      let offset
      const startOffset = this.cursor.start.offset
      const endOffset = this.cursor.end.offset
      // Ctrl+Backspace (o Alt+Backspace su macOS) cancella la parola precedente invece del singolo
      // carattere: è lo stesso comportamento word-delete già disponibile fuori dai code block.
      const isWordDelete = (event.ctrlKey || event.altKey) && startOffset === endOffset && startOffset > 0
      // Fix: https://github.com/marktext/marktext/issues/2013
      // Also fix the codeblock crashed when the code content is '\n' and press backspace.
      if (
        startOffset === endOffset &&
        (/\n.$/.test(startBlock.text) || startBlock.text === '\n') &&
        startBlock.text.length === startOffset
      ) {
        startBlock.text = /\n.$/.test(startBlock.text) ? startBlock.text.slice(0, -1) : ''
        offset = startBlock.text.length
      } else if (isWordDelete) {
        // Cancella la parola prima del cursore, includendo gli spazi tra la parola e il cursore
        // (stile VSCode); se prima del cursore ci sono solo spazi, cancella quelli.
        const pre = startBlock.text.substring(0, startOffset)
        const match = pre.match(/\S+\s*$/) || pre.match(/\s+$/)
        const deleteLen = match ? match[0].length : 1
        offset = startOffset - deleteLen
        startBlock.text =
          startBlock.text.substring(0, offset) + startBlock.text.substring(endOffset)
      } else {
        // backspace at tabwidth within a codeblock if no text highlighted
        // and cursor is after a tabWidth of whitespace
        const regexUnindent = new RegExp(`\n.*(${String.fromCharCode(32).repeat(this.tabSize)})$`)
        const shouldUnindent = regexUnindent.test(startBlock.text.substring(0, startOffset))
        const backspaceSize = shouldUnindent ? this.tabSize : 1
        offset = startOffset === endOffset ? startOffset - backspaceSize : startOffset
        startBlock.text =
          startBlock.text.substring(0, offset) + startBlock.text.substring(endOffset)
      }
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      // [PARTE-F-DEBUG] log temporaneo: fine ramo codeContent, riporta anche se il percorso preso
      // era word-delete (Ctrl/Alt+Backspace) e quanti caratteri sono stati cancellati.
      console.log(
        `[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: codeContent completato isWordDelete=${isWordDelete} deleteLen=${startOffset - offset} nuovoOffset=${offset}`
      )
      return this.singleRender(startBlock)
    }
    // If select multiple paragraph or multiple characters in one paragraph, just let
    // inputCtrl to handle this case.
    if (start.key !== end.key || start.offset !== end.offset) {
      // [PARTE-F-DEBUG] log temporaneo: uscita anticipata, selezione multipla delegata a inputCtrl.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: uscita anticipata selezione multipla (start!==end)')
      return
    }

    const node = selection.getSelectionStart()
    const parentNode = node && node.nodeType === 1 ? node.parentNode : null
    const paragraph = findNearestParagraph(node)
    const id = paragraph.id
    let block = this.getBlock(id)
    let parent = this.getBlock(block.parent)
    const preBlock = this.findPreBlockInLocation(block)
    const { left, right } = selection.getCaretOffsets(paragraph)
    const inlineDegrade = this.checkBackspaceCase()
    // Handle backspace when the previous is an inline image.
    if (parentNode && parentNode.classList.contains('ag-inline-image')) {
      if (selection.getCaretOffsets(node).left === 0) {
        // [PARTE-F-DEBUG] log temporaneo: ramo inline-image cancellazione immagine.
        console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: inline-image cancellazione immagine')
        event.preventDefault()
        event.stopPropagation()
        const imageInfo = getImageInfo(parentNode)
        return this.deleteImage(imageInfo)
      }
      if (selection.getCaretOffsets(node).left === 1 && right === 0) {
        // [PARTE-F-DEBUG] log temporaneo: ramo inline-image merge testo adiacente.
        console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: inline-image merge testo adiacente')
        event.stopPropagation()
        event.preventDefault()
        const key = startBlock.key
        const text = startBlock.text

        startBlock.text = text.substring(0, start.offset - 1) + text.substring(start.offset)
        const offset = start.offset - 1
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        return this.singleRender(startBlock)
      }
    }

    // handle backspace when cursor at the end of inline image.
    if (node.classList.contains('ag-image-container')) {
      const imageWrapper = node.parentNode
      const imageInfo = getImageInfo(imageWrapper)
      if (start.offset === imageInfo.token.range.end) {
        // [PARTE-F-DEBUG] log temporaneo: ramo cursore fine immagine inline.
        console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: cursore fine immagine inline')
        event.preventDefault()
        event.stopPropagation()
        return this.selectImage(imageInfo)
      }
    }

    // Fix issue #1218
    if (startBlock.functionType === 'cellContent' && /<br\/>.{1}$/.test(startBlock.text)) {
      // [PARTE-F-DEBUG] log temporaneo: ramo cellContent fix <br/>.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: cellContent fix <br/>')
      event.preventDefault()
      event.stopPropagation()

      const { text } = startBlock
      startBlock.text = text.substring(0, text.length - 1)
      const key = startBlock.key
      const offset = startBlock.text.length

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.singleRender(startBlock)
    }

    // Fix delete the last character in table cell, the default action will delete the cell content if not preventDefault.
    if (startBlock.functionType === 'cellContent' && left === 1 && right === 0) {
      // [PARTE-F-DEBUG] log temporaneo: ramo cellContent ultimo carattere.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: cellContent ultimo carattere')
      event.stopPropagation()
      event.preventDefault()
      startBlock.text = ''
      const { key } = startBlock
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.singleRender(startBlock)
    }

    const tableHasContent = (table) => {
      const tHead = table.children[0]
      const tBody = table.children[1]
      const tHeadHasContent = tHead.children[0].children.some((th) => th.children[0].text.trim())
      const tBodyHasContent = tBody.children.some((row) =>
        row.children.some((td) => td.children[0].text.trim())
      )
      return tHeadHasContent || tBodyHasContent
    }

    if (
      block.type === 'span' &&
      block.functionType === 'paragraphContent' &&
      left === 0 &&
      preBlock &&
      preBlock.functionType === 'footnoteInput'
    ) {
      // [PARTE-F-DEBUG] log temporaneo: ramo paragraphContent dopo footnoteInput.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: paragraphContent dopo footnoteInput')
      event.preventDefault()
      event.stopPropagation()
      if (!parent.nextSibling) {
        const pBlock = this.createBlockP(block.text)
        const figureBlock = this.closest(block, 'figure')
        this.insertBefore(pBlock, figureBlock)
        this.removeBlock(figureBlock)
        const key = pBlock.children[0].key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }

        this.partialRender()
      }
    } else if (
      block.type === 'span' &&
      block.functionType === 'codeContent' &&
      left === 0 &&
      !block.preSibling
    ) {
      // [PARTE-F-DEBUG] log temporaneo: ramo codeContent inizio blocco senza preSibling.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: codeContent inizio blocco senza preSibling')
      event.preventDefault()
      event.stopPropagation()
      if (!block.nextSibling) {
        const preBlock = this.getParent(parent)
        const pBlock = this.createBlock('p')
        const lineBlock = this.createBlock('span', { text: block.text })
        const key = lineBlock.key
        const offset = 0
        this.appendChild(pBlock, lineBlock)
        let referenceBlock = null
        switch (preBlock.functionType) {
          case 'fencecode':
          case 'indentcode':
          case 'frontmatter':
            referenceBlock = preBlock
            break
          case 'multiplemath':
          case 'flowchart':
          case 'mermaid':
          case 'sequence':
          case 'plantuml':
          case 'vega-lite':
          case 'html':
            referenceBlock = this.getParent(preBlock)
            break
        }
        this.insertBefore(pBlock, referenceBlock)
        this.removeBlock(referenceBlock)

        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.partialRender()
      }
    } else if (left === 0 && block.functionType === 'cellContent') {
      // [PARTE-F-DEBUG] log temporaneo: ramo cellContent inizio cella.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: cellContent inizio cella')
      event.preventDefault()
      event.stopPropagation()
      const table = this.closest(block, 'table')
      const figure = this.closest(table, 'figure')
      const hasContent = tableHasContent(table)
      let key
      let offset

      if ((!preBlock || preBlock.functionType !== 'cellContent') && !hasContent) {
        const paragraphContent = this.createBlock('span')
        delete figure.functionType
        figure.children = []
        this.appendChild(figure, paragraphContent)
        figure.text = ''
        figure.type = 'p'
        key = paragraphContent.key
        offset = 0
      } else if (preBlock) {
        key = preBlock.key
        offset = preBlock.text.length
      }

      if (key !== undefined && offset !== undefined) {
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }

        this.partialRender()
      }
    } else if (inlineDegrade) {
      // [PARTE-F-DEBUG] log temporaneo: ramo inlineDegrade.
      console.log(
        `[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: inlineDegrade tipo=${inlineDegrade.type} info=${inlineDegrade.info}`
      )
      event.preventDefault()
      if (block.type === 'span') {
        block = this.getParent(block)
        parent = this.getParent(parent)
      }

      let key = block.type === 'p' ? block.children[0].key : block.key
      let offset = 0

      switch (inlineDegrade.type) {
        case 'STOP': // Cursor at begin of article and nothing need to do
          break
        case 'OL':
        case 'LI': {
          // Note: The current block is the 'p' item, not the 'li' item
          block = this.getParent(block) // let's get the 'li' item instead
          parent = this.getBlock(block.parent) // parent is the 'ul' item

          let newBlock

          const grandpa = this.getParent(parent)
          const greatGrandpaBlock = this.getParent(grandpa)
          // console.log('block', JSON.parse(JSON.stringify(block)))
          // console.log('parent', JSON.parse(JSON.stringify(parent)))
          // console.log('grandParent', JSON.parse(JSON.stringify(grandpa)))
          // console.log('greatGrandParent', JSON.parse(JSON.stringify(greatGrandpaBlock)))
          // console.log('newBlock', JSON.parse(JSON.stringify(newBlock)))
          if (
            greatGrandpaBlock &&
            (greatGrandpaBlock.type === 'ul' || greatGrandpaBlock.type === 'ol')
          ) {
            if (block.listItemType === 'task') {
              const { checked } = parent.children[0]
              newBlock = this.createTaskItemBlock(null, checked)
              newBlock.children[1].children[0].text += block.children[1].children[0].text
              key = newBlock.children[1].key
            } else {
              newBlock = this.createBlockLi()
              newBlock.listItemType = parent.listItemType
              newBlock.bulletMarkerOrDelimiter = parent.bulletMarkerOrDelimiter
              newBlock.children[0].children[0].text += block.children[0].children[0].text
              key = newBlock.children[0].key
            }
            // Insert the new list item after the grandparent (the parent list item of the current list)
            this.insertAfter(newBlock, grandpa)

            block.children.forEach((child) => {
              if (child.type === 'ul' || child.type === 'ol') this.appendChild(newBlock, child)
            })
            if (block.nextSibling) {
              // Also append all the nextSibilings of the current list item to a ul
              // under the newBlock
              const newULBlock =
                parent.type === 'ul'
                  ? this.createBlock('ul', {
                    listType: 'bullet'
                  })
                  : this.createBlock('ol', {
                    listType: 'order'
                  })

              let probe = this.getBlock(block.nextSibling)
              const addedChildKeys = []
              while (probe && probe.parent && probe.parent === parent.key) {
                const nextSibilingSaved = probe.nextSibling // save it before we overwrite it by appending it
                this.appendChild(newULBlock, probe)
                addedChildKeys.push(probe.key)
                probe = this.getBlock(nextSibilingSaved)
              }
              if (newULBlock.children.length > 0) {
                this.appendChild(newBlock, newULBlock)
                // Remove all the added siblings from the current parent
                parent.children = parent.children.filter(
                  (child) => !addedChildKeys.includes(child.key)
                )
              }
            }
            // Remove list item from the current parent
            this.removeBlock(block, this.blocks, true)
          } else {
            // We have reached end of indent level, so we should exit the list
            newBlock = this.createBlockP()
            if (block.listItemType === 'task') {
              newBlock.children[0].text += block.children[1].children[0].text
            } else {
              newBlock.children[0].text += block.children[0].children[0].text
            }
            key = newBlock.children[0].key
            this.insertAfter(newBlock, parent)
            // Any sublists it has should be added after the new paragraph
            let prevBlock = newBlock
            block.children.forEach((child) => {
              if (child.type === 'ul' || child.type === 'ol') {
                this.insertAfter(child, prevBlock)
                prevBlock = child
              }
            })
            // Also append all the nextSibilings of the current list item to a ul
            // under the newBlock
            if (block.nextSibling) {
              const newULBlock =
                parent.type === 'ul'
                  ? this.createBlock('ul', {
                    listType: 'bullet'
                  })
                  : this.createBlock('ol', {
                    listType: 'order'
                  })
              let probe = this.getBlock(block.nextSibling)
              const addedChildKeys = []
              while (probe && probe.parent && probe.parent === parent.key) {
                const nextSibilingSaved = probe.nextSibling // save it before we overwrite it by appending it
                this.appendChild(newULBlock, probe)
                addedChildKeys.push(probe.key)
                probe = this.getBlock(nextSibilingSaved)
              }
              if (newULBlock.children.length > 0) {
                // Remove all the added siblings from the current parent
                parent.children = parent.children.filter(
                  (child) => !addedChildKeys.includes(child.key)
                )
                this.insertAfter(newULBlock, prevBlock)
              }
            }
            this.removeBlock(block)
          }
          // If the parent list is now empty, we also need to remove it
          if (parent.children.length === 0) {
            this.removeBlock(parent)
          }

          break
        }
        case 'BLOCKQUOTE':
          if (inlineDegrade.info === 'REPLACEMENT') {
            this.insertBefore(block, parent)
            this.removeBlock(parent)
          } else if (inlineDegrade.info === 'INSERT_BEFORE') {
            this.removeBlock(block)
            this.insertBefore(block, parent)
          }
          break
      }

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      if (inlineDegrade.type !== 'STOP') {
        this.partialRender()
      }
    } else if (left === 0 && preBlock) {
      // [PARTE-F-DEBUG] log temporaneo: ramo merge con blocco precedente.
      console.log('[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: merge con blocco precedente')
      event.preventDefault()
      const { text } = block
      const key = preBlock.key
      const offset = preBlock.text.length
      preBlock.text += text
      // If block is a line block and its parent paragraph only has one text line,
      // also need to remove the paragrah
      if (this.isOnlyChild(block) && block.type === 'span') {
        this.removeBlock(parent)
      } else if (block.functionType !== 'languageInput' && block.functionType !== 'footnoteInput') {
        this.removeBlock(block)
      }

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      let needRenderAll = false

      if (
        this.isCollapse() &&
        preBlock.type === 'span' &&
        preBlock.functionType === 'paragraphContent'
      ) {
        this.checkInlineUpdate(preBlock)
        needRenderAll = true
      }

      needRenderAll ? this.render() : this.partialRender()
    } else {
      // [PARTE-F-DEBUG] log temporaneo: nessuna condizione del blocco principale (righe ~436+)
      // corrisponde, uscita implicita di backspaceHandler.
      console.log(
        '[PARTE-F-DEBUG] backspaceCtrl.js backspaceHandler ramo: nessun ramo del blocco principale preso (uscita implicita a fine funzione)'
      )
    }
  }
}

export default backspaceCtrl
