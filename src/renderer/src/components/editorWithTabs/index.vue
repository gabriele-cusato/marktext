<template>
  <div
    class="editor-with-tabs"
    :style="{ 'max-width': showSideBar ? `calc(100vw - ${sideBarWidth}px` : '100vw' }"
  >
    <!-- v2: tab bar sempre visibile (forzata, ignora showTabBar) -->
    <tabs />
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
    <tab-notifications />
  </div>
</template>

<script setup>
import { useLayoutStore } from '@/store/layout'
import { storeToRefs } from 'pinia'
import bus from '../../bus'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'

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

const layoutStore = useLayoutStore()

const { showSideBar, sideBarWidth } = storeToRefs(layoutStore)

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
  & > .container {
    flex: 1;
    overflow: hidden;
  }
}
</style>
