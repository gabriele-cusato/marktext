<template>
  <div class="editor-with-tabs">
    <!-- v2: tab bar sempre visibile (forzata, ignora showTabBar) -->
    <tabs />
    <div class="editor-row">
      <div class="container" @wheel="onContainerWheel">
        <editor
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
          :platform="platform"
        />
        <source-code
          v-if="sourceCode"
          :markdown="markdown"
          :muya-index-cursor="muyaIndexCursor"
          :text-direction="textDirection"
        />
      </div>
      <!-- Sidebar di ricerca: a DESTRA, sotto la tab bar, non copre title/tab bar -->
      <side-bar />
    </div>
    <!-- Riquadro find/replace (Ctrl+F): montato sempre (position:fixed). Gestito da Muya
         in WYSIWYG e da CodeMirror in source (handler in sourceCode.vue). -->
    <editor-search />
    <tab-notifications />
    <file-changed-dialog />
  </div>
</template>

<script setup>
import bus from '../../bus'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import FileChangedDialog from './fileChangedDialog.vue'
import SideBar from '@/components/sideBar'
import EditorSearch from '@/components/search'

defineProps({
  markdown: {
    type: String,
    required: true
  },
  cursor: {
    validator(value) {
      return typeof value === 'object'
    },
    required: true
  },
  muyaIndexCursor: {
    type: Object,
    default: null
  },
  sourceCode: {
    type: Boolean,
    required: true
  },
  showTabBar: {
    type: Boolean,
    required: true
  },
  textDirection: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    required: true
  }
})

// Intercetta Ctrl+rotella sul container: applica zoom solo al testo, non all'intera pagina
const onContainerWheel = (e) => {
  if (!e.ctrlKey) return
  e.preventDefault()
  bus.emit('mt::window-zoom-direction', e.deltaY < 0 ? 'in' : 'out')
}
</script>

<style scoped>
.editor-with-tabs {
  position: relative;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--editorBgColor);
}

.editor-row {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-height: 0;
}

.editor-row > .container {
  flex: 1;
  overflow: hidden;
}
</style>
