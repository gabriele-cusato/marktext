import { findNearestParagraph, findOutMostParagraph } from '../selection/dom'
import {
  verticalPositionInRect,
  getUniqueId,
  getImageInfo as getImageSrc,
  checkImageContentType
} from '../utils'
import { getImageInfo } from '../utils/getImageInfo'
import { URL_REG, IMAGE_EXT_REG } from '../config'

const GHOST_ID = 'mu-dragover-ghost'
const GHOST_HEIGHT = 3

const dragDropCtrl = (ContentState) => {
  ContentState.prototype.hideGhost = function () {
    this.dropAnchor = null
    const ghost = document.querySelector(`#${GHOST_ID}`)
    ghost && ghost.remove()
  }
  /**
   * create the ghost element.
   */
  ContentState.prototype.createGhost = function (event) {
    const target = event.target
    let ghost = null
    const nearestParagraph = findNearestParagraph(target)
    const outmostParagraph = findOutMostParagraph(target)

    if (!outmostParagraph) {
      return this.hideGhost()
    }

    const block = this.getBlock(nearestParagraph.id)
    let anchor = this.getAnchor(block)

    // dragover preview container
    if (!anchor && outmostParagraph) {
      anchor = this.getBlock(outmostParagraph.id)
    }

    if (anchor) {
      const anchorParagraph = this.muya.container.querySelector(`#${anchor.key}`)
      const rect = anchorParagraph.getBoundingClientRect()
      const position = verticalPositionInRect(event, rect)
      this.dropAnchor = {
        position,
        anchor
      }
      // create ghost
      ghost = document.querySelector(`#${GHOST_ID}`)
      if (!ghost) {
        ghost = document.createElement('div')
        ghost.id = GHOST_ID
        document.body.appendChild(ghost)
      }

      Object.assign(ghost.style, {
        width: `${rect.width}px`,
        left: `${rect.left}px`,
        top: position === 'up' ? `${rect.top - GHOST_HEIGHT}px` : `${rect.top + rect.height}px`
      })
    }
  }

  ContentState.prototype.dragoverHandler = function (event) {
    // Cancel to allow tab drag&drop.
    // Qui NON si tocca dropEffect: rifiuto passivo (dragover non cancellato), vedi
    // il commento nel ramo else in fondo (drag-html5-dnd-task3 round 8, 2026-07-03).
    if (!event.dataTransfer.types.length) {
      return
    }

    // SPIKE-IMG-DRAG: drag interno di un'immagine del documento — accettare il
    // gesto (preventDefault qui è legittimo: gesto che si intende accettare) e
    // mostrare il ghost. Gate sullo stato locale, non sul dataTransfer (illeggibile
    // in dragover). Solo osservazione, nessuna mutazione.
    if (this.internalImageDrag) {
      event.preventDefault()
      this.createGhost(event)
      event.dataTransfer.dropEffect = 'move'
      const anchorTag = this.dropAnchor
        ? `${this.dropAnchor.anchor.key}:${this.dropAnchor.position}`
        : 'nessun-anchor'
      if (this._spikeLastAnchor !== anchorTag) {
        this._spikeLastAnchor = anchorTag
        console.log('[SPIKE-IMG-DRAG] dragover anchor', anchorTag)
      }
      return
    }

    if (event.dataTransfer.types.includes('text/uri-list')) {
      const items = Array.from(event.dataTransfer.items)
      const hasUriItem = items.some((i) => i.type === 'text/uri-list')
      const hasTextItem = items.some((i) => i.type === 'text/plain')
      const hasHtmlItem = items.some((i) => i.type === 'text/html')
      if (hasUriItem && hasHtmlItem && !hasTextItem) {
        this.createGhost(event)
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    if (event.dataTransfer.types.indexOf('Files') >= 0) {
      if (
        event.dataTransfer.items.length === 1 &&
        event.dataTransfer.items[0].type.indexOf('image') > -1
      ) {
        event.preventDefault()
        this.createGhost(event)
        event.dataTransfer.dropEffect = 'copy'
      }
    } else {
      // Drag sconosciuti (non-Files, non-immagine): nessuna azione — DEFINITIVO
      // (drag-html5-dnd-task3 round 8, 2026-07-03). Marcare `dropEffect='none'` (+
      // stopPropagation) su ogni dragover sopra l'editor corrompe lo stato del drag
      // OLE per l'intero gesto su Windows (famiglia electron#42252): era una delle due
      // cause dello spring-loading taskbar morto (l'altra: handler window-level in
      // app.vue). Il rifiuto corretto è passivo: dragover non cancellato = target
      // non-accettante di default.
    }
  }

  ContentState.prototype.dragleaveHandler = function (event) {
    // SPIKE-IMG-DRAG: tracciare quando l'anchor viene azzerato durante il drag interno
    // (uscita dall'editor o passaggio tra paragrafi).
    if (this.internalImageDrag && this.dropAnchor) {
      console.log('[SPIKE-IMG-DRAG] dragleave: ghost/anchor azzerati')
    }
    return this.hideGhost()
  }

  ContentState.prototype.dropHandler = async function (event) {
    event.preventDefault()
    // SPIKE-IMG-DRAG: verificare se il drop interno viene consegnato (electron#42252
    // dice di no su Windows per i drag stessa-finestra). Nessuna azione sul documento.
    if (this.internalImageDrag) {
      this.internalImageDragHandled = true
      console.log('[SPIKE-IMG-DRAG] drop CONSEGNATO', {
        dropAnchor: this.dropAnchor
          ? { key: this.dropAnchor.anchor.key, position: this.dropAnchor.position }
          : null
      })
      this.hideGhost()
      return
    }
    const { dropAnchor } = this
    this.hideGhost()
    // handle drag/drop web link image.
    if (event.dataTransfer.items.length) {
      for (const item of event.dataTransfer.items) {
        if (item.kind === 'string' && item.type === 'text/uri-list') {
          item.getAsString(async (str) => {
            if (URL_REG.test(str) && dropAnchor) {
              let isImage = false
              if (IMAGE_EXT_REG.test(str)) {
                isImage = true
              }
              if (!isImage) {
                isImage = await checkImageContentType(str)
              }
              if (!isImage) return
              const text = `![](${str})`
              const imageBlock = this.createBlockP(text)
              const { anchor, position } = dropAnchor
              if (position === 'up') {
                this.insertBefore(imageBlock, anchor)
              } else {
                this.insertAfter(imageBlock, anchor)
              }

              const key = imageBlock.children[0].key
              const offset = 0
              this.cursor = {
                start: { key, offset },
                end: { key, offset }
              }
              this.render()
              this.muya.eventCenter.dispatch('stateChange')
            }
          })
        }
      }
    }

    if (event.dataTransfer.files) {
      const fileList = []
      for (const file of event.dataTransfer.files) {
        fileList.push(file)
      }
      const image = fileList.find((file) => /image/.test(file.type))
      if (image && dropAnchor) {
        const { name } = image
        const path = window.electron.webUtils.getPathForFile(image)
        const id = `loading-${getUniqueId()}`
        const text = `![${id}](${path})`
        const imageBlock = this.createBlockP(text)
        const { anchor, position } = dropAnchor
        if (position === 'up') {
          this.insertBefore(imageBlock, anchor)
        } else {
          this.insertAfter(imageBlock, anchor)
        }

        const key = imageBlock.children[0].key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.render()

        try {
          const newSrc = await this.muya.options.imageAction(path, id, name)
          const { src } = getImageSrc(path)
          if (src) {
            this.stateRender.urlMap.set(newSrc, src)
          }
          const imageWrapper = this.muya.container.querySelector(`span[data-id=${id}]`)

          if (imageWrapper) {
            const imageInfo = getImageInfo(imageWrapper)
            this.replaceImage(imageInfo, {
              alt: name,
              src: newSrc
            })
          }
        } catch (error) {
          // TODO: Notify user about an error.
          console.error('Unexpected error on image action:', error)
        }
      }
      this.muya.eventCenter.dispatch('stateChange')
    }
  }
}

export default dragDropCtrl
