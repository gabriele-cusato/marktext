import { defineStore } from 'pinia'
import bus from '../bus'
import { useLayoutStore } from './layout'
import { useEditorStore } from './editor'

const isHtmlPathname = (pathname) => {
  if (typeof pathname !== 'string') {
    return false
  }

  const lowerPathname = pathname.toLowerCase()
  return lowerPathname.endsWith('.html') || lowerPathname.endsWith('.htm')
}

export const useListenForMainStore = defineStore('listenForMain', {
  state: () => ({}),
  actions: {
    EDITOR_EDIT_ACTION(type) {
      const layoutStore = useLayoutStore()
      const editorStore = useEditorStore()
      const sidebarOpen = layoutStore.showSideBar && layoutStore.rightColumn === 'search'
      const sel = editorStore.currentSelection || ''

      // Ctrl+Shift+F: apri / chiudi / aggiorna la sidebar di ricerca in tutte le tab.
      if (type === 'findInFolder') {
        // Se il riquadro flottante Ctrl+F è aperto, chiudilo prima di gestire la sidebar.
        bus.emit('search-blur')
        if (sidebarOpen) {
          // Già aperta: con selezione aggiorna la ricerca, senza selezione chiude.
          if (sel) bus.emit('sidebar-search-set', sel)
          else layoutStore.SET_LAYOUT({ rightColumn: '', showSideBar: false })
        } else {
          // Chiusa: apri e (se c'è selezione) cerca subito su di essa.
          layoutStore.SET_LAYOUT({ rightColumn: 'search', showSideBar: true })
          bus.emit('findInFolder')
          if (sel) bus.emit('sidebar-search-set', sel)
        }
        return
      }

      // Ctrl+F: se la sidebar è aperta NON aprire il riquadro flottante.
      if (type === 'find') {
        if (sidebarOpen) {
          // Solo con selezione aggiorna la ricerca nella sidebar; altrimenti non fa nulla.
          if (sel) bus.emit('sidebar-search-set', sel)
          return
        }
        // Sidebar chiusa → find singola tab (Muya: riquadro flottante; source: Stage 2).
        bus.emit('find', 'find')
        return
      }

      if (type === 'openInBrowser') {
        const { pathname } = editorStore.currentFile || {}
        if (isHtmlPathname(pathname)) {
          window.electron.ipcRenderer.send('mt::open-file-in-browser', { pathname })
        }
        return
      }

      // Altri (replace, findNext, findPrev, ...) invariati.
      bus.emit(type, type)
    },

    LISTEN_FOR_EDIT() {
      window.electron.ipcRenderer.on('mt::editor-edit-action', (e, type) => {
        this.EDITOR_EDIT_ACTION(type)
      })
      bus.on('mt::editor-edit-action', (type) => {
        this.EDITOR_EDIT_ACTION(type)
      })
    },

    LISTEN_FOR_SHOW_DIALOG() {
      window.electron.ipcRenderer.on('mt::about-dialog', () => {
        bus.emit('aboutDialog')
      })
      window.electron.ipcRenderer.on('mt::show-export-dialog', (e, type) => {
        bus.emit('showExportDialog', type)
      })
    },

    LISTEN_FOR_PARAGRAPH_INLINE_STYLE() {
      window.electron.ipcRenderer.on('mt::editor-paragraph-action', (e, { type }) => {
        bus.emit('paragraph', type)
      })
      window.electron.ipcRenderer.on('mt::editor-format-action', (e, { type }) => {
        bus.emit('format', type)
      })
    }
  }
})
