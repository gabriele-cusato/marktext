<template>
  <BaseContextMenu
    :x="x"
    :y="y"
    :items="items"
    @close="$emit('close')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import BaseContextMenu from './BaseContextMenu.vue'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  tab: { type: Object, required: true }
})

defineEmits(['close'])

const { t } = useI18n()
const editorStore = useEditorStore()

// Mappa azioni context menu tab esistenti (vedi src/renderer/src/contextMenu/tabs/actions.js)
const items = computed(() => {
  const tab = props.tab
  return [
    // H4: pin/unpin tab — sempre disponibile, cambia label secondo lo stato corrente
    {
      label: tab.pinned ? t('contextMenu.tabs.unpin', 'Unpin Tab') : t('contextMenu.tabs.pin', 'Pin Tab'),
      iconKey: 'pin',
      action: () => editorStore.TOGGLE_PIN_TAB(tab.id)
    },
    // H5-1: sposta la tab in una nuova finestra (disabilitato se è l'unica tab → no-op).
    {
      label: t('contextMenu.tabs.moveToNewWindow', 'Move to New Window'),
      iconKey: 'newWindow',
      disabled: editorStore.tabs.length <= 1,
      action: () => editorStore.DETACH_TAB(tab)
    },
    '---',
    {
      label: t('contextMenu.tabs.close'),
      iconKey: 'close',
      action: () => editorStore.CLOSE_TAB(tab)
    },
    {
      label: t('contextMenu.tabs.closeOthers'),
      iconKey: 'closeOth',
      action: () => editorStore.CLOSE_OTHER_TABS(tab)
    },
    {
      label: t('contextMenu.tabs.closeSavedTabs'),
      iconKey: 'closeOth',
      action: () => editorStore.CLOSE_SAVED_TABS()
    },
    {
      label: t('contextMenu.tabs.closeAllTabs'),
      iconKey: 'closeOth',
      action: () => editorStore.CLOSE_ALL_TABS()
    },
    '---',
    {
      label: t('contextMenu.tabs.reload'),
      iconKey: 'refresh',
      // Solo file su disco: Untitled non ha nulla da ricaricare.
      disabled: !tab.pathname,
      action: () =>
        tab.pathname &&
        window.electron.ipcRenderer.send('mt::request-file-reload', tab.pathname)
    },
    {
      label: t('contextMenu.tabs.rename'),
      iconKey: 'edit',
      disabled: !tab.pathname,
      action: () => tab.pathname && editorStore.RENAME_FILE(tab)
    },
    {
      label: t('contextMenu.tabs.copyPath'),
      iconKey: 'copy',
      disabled: !tab.pathname,
      action: () => tab.pathname && window.electron.clipboard.writeText(tab.pathname)
    },
    {
      label: t('contextMenu.tabs.showInFolder'),
      iconKey: 'folder',
      disabled: !tab.pathname,
      action: () => tab.pathname && window.electron.shell.showItemInFolder(tab.pathname)
    }
  ]
})
</script>
