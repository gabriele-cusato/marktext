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
import bus from '@/bus'
import BaseContextMenu from './BaseContextMenu.vue'

defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true }
})

defineEmits(['close'])

const { t } = useI18n()

// Bus events già wirati dallo store editor (LISTEN_FOR_CONTEXT_MENU).
// Mappatura IPC originale → bus:
//   mt::cm-copy-as-markdown   → copyAsMarkdown
//   mt::cm-copy-as-html       → copyAsHtml
//   mt::cm-paste-as-plain-text → pasteAsPlainText
//   mt::cm-insert-paragraph   → insertParagraph

const exec = (cmd) => {
  // Comandi clipboard standard (cut/copy/paste).
  document.execCommand(cmd)
}

const items = computed(() => [
  {
    label: t('contextMenu.insertParagraphBefore'),
    iconKey: 'insertBefore',
    action: () => bus.emit('insertParagraph', 'before')
  },
  {
    label: t('contextMenu.insertParagraphAfter'),
    iconKey: 'insertAfter',
    action: () => bus.emit('insertParagraph', 'after')
  },
  '---',
  {
    label: t('contextMenu.cut'),
    iconKey: 'cut',
    shortcut: 'Ctrl+X',
    action: () => exec('cut')
  },
  {
    label: t('contextMenu.copy'),
    iconKey: 'copy',
    shortcut: 'Ctrl+C',
    action: () => exec('copy')
  },
  {
    label: t('contextMenu.paste'),
    iconKey: 'paste',
    shortcut: 'Ctrl+V',
    action: () => exec('paste')
  },
  '---',
  {
    label: t('contextMenu.copyAsMarkdown'),
    iconKey: 'copy',
    action: () => bus.emit('copyAsMarkdown', 'copyAsMarkdown')
  },
  {
    label: t('contextMenu.copyAsHtml'),
    iconKey: 'copy',
    action: () => bus.emit('copyAsHtml', 'copyAsHtml')
  },
  {
    label: t('contextMenu.pasteAsPlainText'),
    iconKey: 'paste',
    action: () => bus.emit('pasteAsPlainText', 'pasteAsPlainText')
  }
])
</script>
