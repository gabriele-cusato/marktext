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
        // SPIKE-IMG-DRAG: consentire il dragstart alle immagini del documento
        // (dentro .ag-inline-image) per verificare a runtime il gesto completo
        // (dragstart/dragover/drop/dragend, famiglia electron#42252). Nessuna
        // mutazione del documento in questo spike, solo log e stato locale.
        const imageWrapper = event.target.closest('.ag-inline-image')
        if (imageWrapper) {
          const imageInfo = getImageInfo(imageWrapper)
          event.dataTransfer.setData('text/mt-image-move', imageInfo.key)
          event.dataTransfer.effectAllowed = 'move'
          contentState.internalImageDrag = imageInfo
          contentState.internalImageDragHandled = false
          console.log('[SPIKE-IMG-DRAG] dragstart', {
            key: imageInfo.key,
            range: imageInfo.token && imageInfo.token.range,
            raw: imageInfo.token && imageInfo.token.raw
          })
          return
        }
        return event.preventDefault()
      }
    }

    eventCenter.attachDOMEvent(container, 'dragstart', dragStartHandler)

    // SPIKE-IMG-DRAG: osservare l'esito del gesto al dragend (l'evento che su
    // Windows arriva sempre, a differenza del drop interno) e ripulire lo stato.
    const dragendHandler = (event) => {
      if (!contentState.internalImageDrag) {
        return
      }
      const rect = container.getBoundingClientRect()
      const inContainer =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      console.log('[SPIKE-IMG-DRAG] dragend', {
        clientX: event.clientX,
        clientY: event.clientY,
        dropEffect: event.dataTransfer && event.dataTransfer.dropEffect,
        dropConsegnato: contentState.internalImageDragHandled,
        dropAnchor: contentState.dropAnchor
          ? {
              key: contentState.dropAnchor.anchor.key,
              position: contentState.dropAnchor.position
            }
          : null,
        rilascioNellEditor: inContainer
      })
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
