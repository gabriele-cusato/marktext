import { getImageInfo } from '../utils/getImageInfo'

class DragDrop {
  constructor(muya) {
    this.muya = muya
    this.dragOverBinding()
    this.dropBinding()
    this.dragendBinding()
    this.dragStartBinding()
  }

  dragStartBinding() {
    const { container, eventCenter, contentState } = this.muya

    const dragStartHandler = (event) => {
      if (event.target.tagName === 'IMG') {
        const imageWrapper = event.target.closest('.ag-inline-image')
        if (imageWrapper) {
          // immagine del documento: consentire il drag per lo spostamento (move)
          const imageInfo = getImageInfo(imageWrapper)
          // rimuovere il payload nativo che Chromium aggiunge al drag di un'IMG:
          // senza clearData(), trascinando verso un'app esterna viene incollato
          // testo/URL indesiderato (il move è consentito solo dentro lo stesso
          // documento, vedi vincoli di scope nel plan).
          event.dataTransfer.clearData()
          event.dataTransfer.setData('text/mt-image-move', imageInfo.key)
          event.dataTransfer.effectAllowed = 'move'
          contentState.internalImageDrag = imageInfo
          contentState.internalImageDragHandled = false
          return
        }
        return event.preventDefault()
      }
    }

    eventCenter.attachDOMEvent(container, 'dragstart', dragStartHandler)

    // Fallback electron#42252: il drop stessa-finestra non è affidabile su tutte le
    // piattaforme, il dragend arriva sempre. Esegue il move solo se il drop non l'ha
    // già fatto (flag anti-doppia-esecuzione) e solo se il rilascio cade dentro
    // l'area editabile del documento (guardia di scope).
    const dragendHandler = (event) => {
      if (!contentState.internalImageDrag) {
        return
      }
      if (!contentState.internalImageDragHandled && contentState.dropAnchor) {
        const rect = container.getBoundingClientRect()
        const inContainer =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        if (inContainer) {
          contentState.moveImageToDropAnchor()
        }
      }
      contentState.hideGhost()
      contentState.internalImageDrag = null
      contentState.internalImageDragHandled = false
    }

    eventCenter.attachDOMEvent(container, 'dragend', dragendHandler)
  }

  dragOverBinding() {
    const { container, eventCenter, contentState } = this.muya

    const dragoverHandler = (event) => {
      contentState.dragoverHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'dragover', dragoverHandler)
  }

  dropBinding() {
    const { container, eventCenter, contentState } = this.muya

    const dropHandler = (event) => {
      contentState.dropHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'drop', dropHandler)
  }

  dragendBinding() {
    const { eventCenter, contentState } = this.muya

    const dragleaveHandler = (event) => {
      contentState.dragleaveHandler(event)
    }

    eventCenter.attachDOMEvent(window, 'dragleave', dragleaveHandler)
  }
}

export default DragDrop
