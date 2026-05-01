<template>
  <div
    class="editor-container"
    @contextmenu="handleEditorContextMenu"
  >
    <side-bar v-if="init" />

    <div class="editor-middle">
      <!-- v2: title-bar legacy nascosta via CSS in v2-tokens.css.
           Rimane montata per non rompere refs/eventi esistenti. -->
      <title-bar
        :project="projectTree"
        :pathname="pathname"
        :filename="filename"
        :active="windowActive"
        :word-count="wordCount"
        :platform="platform"
        :is-saved="isSaved"
        :is-saving="isSaving"
      />

      <div
        v-if="!init"
        class="editor-placeholder"
      />
      <recent v-if="!hasCurrentFile && init" />
      <editor-with-tabs
        v-if="hasCurrentFile && init"
        :markdown="markdown"
        :cursor="cursor"
        :muya-index-cursor="muyaIndexCursor"
        :source-code="sourceCode"
        :show-tab-bar="showTabBar"
        :text-direction="textDirection"
        :platform="platform"
      />
      <!-- v2: Status bar in fondo -->
      <status-bar v-if="init" />

      <command-palette />
      <about-dialog />
      <export-setting-dialog />
      <rename />
      <tweet />
      <import-modal />

      <!-- v2: Settings modal (wrapping prefComponents esistenti) -->
      <settings-modal />

      <!-- v2: Editor context menu Vue custom (sostituisce Electron nativo) -->
      <editor-context-menu
        v-if="ctxOpen"
        :x="ctxPos.x"
        :y="ctxPos.y"
        @close="ctxOpen = false"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, watch, nextTick, onMounted, ref } from 'vue'
import { useMainStore } from '@/store'
import { storeToRefs } from 'pinia'
import { addStyles, addThemeStyle, addCustomStyle } from '@/util/theme'
import Recent from '@/components/recent'
import EditorWithTabs from '@/components/editorWithTabs'
import TitleBar from '@/components/titleBar'
import SideBar from '@/components/sideBar'
import AboutDialog from '@/components/about'
import CommandPalette from '@/components/commandPalette'
import ExportSettingDialog from '@/components/exportSettings'
import Rename from '@/components/rename'
import Tweet from '@/components/tweet'
import ImportModal from '@/components/import'
// v2: nuovi componenti
import StatusBar from '@/components/statusBar/index.vue'
import SettingsModal from '@/components/settingsModal/index.vue'
import EditorContextMenu from '@/components/contextMenu/EditorContextMenu.vue'
import bus from '@/bus'
import { DEFAULT_STYLE } from '@/config'
import { useTweetStore } from '@/store/tweet'
import { useLayoutStore } from '@/store/layout'
import { useListenForMainStore } from '@/store/listenForMain'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { useCommandCenterStore } from '@/store/commandCenter'
import { useProjectStore } from '@/store/project'
import { useAutoUpdatesStore } from '@/store/autoUpdates'
import { useNotificationStore } from '@/store/notification'

const mainStore = useMainStore()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const projectStore = useProjectStore()
const tweetStore = useTweetStore()
const listenForMainStore = useListenForMainStore()
const autoUpdateStore = useAutoUpdatesStore()
const commandCenterStore = useCommandCenterStore()
const notificationStore = useNotificationStore()

const timer = ref(null)

// v2: state context menu editor (sostituisce nativo Electron)
const ctxOpen = ref(false)
const ctxPos = ref({ x: 0, y: 0 })

// Handler context menu globale: mostra Vue custom solo per editor area.
// Esclude tab bar (ha proprio menu), settings/dialog/sidebar (richiedono comportamento default o no menu).
const handleEditorContextMenu = (e) => {
  // Se evento già gestito da componente figlio (preventDefault chiamato)
  if (e.defaultPrevented) return

  const target = e.target
  // Se siamo dentro tab bar / sidebar / dialog → ignora (usano altro menu o nessuno)
  if (target.closest('.v2-tabbar') || target.closest('.side-bar') ||
      target.closest('.el-dialog') || target.closest('.v2-cmd-backdrop') ||
      target.closest('.v2-settings-backdrop')) {
    return
  }

  // Mostra solo se siamo nell'area editor
  if (!target.closest('.editor-component') && !target.closest('.editor-wrapper') &&
      !target.closest('.CodeMirror')) {
    return
  }

  e.preventDefault()
  ctxPos.value = { x: e.clientX, y: e.clientY }
  ctxOpen.value = true
}

// States from Pini
const { windowActive, platform, init } = storeToRefs(mainStore)
const { showTabBar } = storeToRefs(layoutStore)
const { sourceCode, theme, customCss, textDirection, zoom } = storeToRefs(preferencesStore)
const { projectTree } = storeToRefs(projectStore)
const { currentFile, isSaving } = storeToRefs(editorStore)

const pathname = computed(() => currentFile.value?.pathname)
const filename = computed(() => currentFile.value?.filename)
const isSaved = computed(() => currentFile.value?.isSaved)
const markdown = computed(() => currentFile.value?.markdown)
const cursor = computed(() => currentFile.value?.cursor)
const wordCount = computed(() => currentFile.value?.wordCount)
const muyaIndexCursor = computed(() => currentFile.value?.muyaIndexCursor)

const hasCurrentFile = computed(() => {
  return markdown.value !== undefined
})

// v2: applica data-v2-theme su <html> per attivare i token v2 dark.
// Considera dark se il tema esistente è uno dei dark theme.
const applyV2ThemeAttr = (themeName) => {
  const darkThemes = ['dark', 'material-dark', 'one-dark', 'graphite']
  const isDark = darkThemes.includes(themeName)
  document.documentElement.setAttribute('data-v2-theme', isDark ? 'dark' : 'light')
}
applyV2ThemeAttr(theme.value)

// Watchers
watch(theme, (value, oldValue) => {
  if (value !== oldValue) {
    addThemeStyle(value)
    applyV2ThemeAttr(value)
  }
})

watch(customCss, (value, oldValue) => {
  if (value !== oldValue) {
    addCustomStyle({
      customCss: value
    })
  }
})

watch(zoom, (zoomValue) => {
  bus.emit('mt::window-zoom', zoomValue)
})

const setupDragDropHandler = () => {
  window.addEventListener(
    'dragover',
    (e) => {
      if (!e.dataTransfer.types.length) return

      if (e.dataTransfer.types.indexOf('Files') >= 0) {
        if (
          e.dataTransfer.items.length === 1 &&
          e.dataTransfer.items[0].type.indexOf('image') > -1
        ) {
          // Do nothing
        } else {
          e.preventDefault()
          if (timer.value) {
            clearTimeout(timer.value)
          }
          timer.value = setTimeout(() => {
            bus.emit('importDialog', false)
          }, 300)
          bus.emit('importDialog', true)
        }
        e.dataTransfer.dropEffect = 'copy'
      } else {
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'none'
      }
    },
    false
  )
}
onMounted(async () => {
  if (global.marktext.initialState) {
    preferencesStore.SET_USER_PREFERENCE(global.marktext.initialState)
  }

  mainStore.LISTEN_WIN_STATUS()
  await commandCenterStore.LISTEN_COMMAND_CENTER_BUS()
  tweetStore.LISTEN_FOR_TWEET()
  layoutStore.LISTEN_FOR_LAYOUT()
  listenForMainStore.LISTEN_FOR_EDIT()
  preferencesStore.LISTEN_FOR_VIEW()
  listenForMainStore.LISTEN_FOR_SHOW_DIALOG()
  listenForMainStore.LISTEN_FOR_PARAGRAPH_INLINE_STYLE()
  projectStore.LISTEN_FOR_UPDATE_PROJECT()
  projectStore.LISTEN_FOR_LOAD_PROJECT()
  projectStore.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
  autoUpdateStore.LISTEN_FOR_UPDATE()
  preferencesStore.ASK_FOR_USER_PREFERENCE()
  preferencesStore.LISTEN_TOGGLE_VIEW()
  editorStore.LISTEN_SCREEN_SHOT()
  editorStore.LISTEN_FOR_CLOSE()
  editorStore.LISTEN_FOR_SAVE_AS()
  editorStore.LISTEN_FOR_MOVE_TO()
  editorStore.LISTEN_FOR_SAVE()
  editorStore.LISTEN_FOR_SET_PATHNAME()
  editorStore.LISTEN_FOR_BOOTSTRAP_WINDOW()
  editorStore.LISTEN_FOR_SAVE_CLOSE()
  editorStore.LISTEN_FOR_RENAME()
  editorStore.LINTEN_FOR_SET_LINE_ENDING()
  editorStore.LINTEN_FOR_SET_ENCODING()
  editorStore.LINTEN_FOR_SET_FINAL_NEWLINE()
  editorStore.LISTEN_FOR_NEW_TAB()
  editorStore.LISTEN_FOR_CLOSE_TAB()
  editorStore.LISTEN_FOR_TAB_CYCLE()
  editorStore.LISTEN_FOR_SWITCH_TABS()
  editorStore.LINTEN_FOR_PRINT_SERVICE_CLEARUP()
  editorStore.LINTEN_FOR_EXPORT_SUCCESS()
  editorStore.LISTEN_FOR_FILE_CHANGE()
  editorStore.LISTEN_WINDOW_ZOOM()
  editorStore.LISTEN_FOR_RELOAD_IMAGES()
  editorStore.LISTEN_FOR_CONTEXT_MENU()

  // module: notification
  notificationStore.listenForNotification()

  setupDragDropHandler()

  nextTick(() => {
    const style = global.marktext.initialState || DEFAULT_STYLE
    addStyles(style)
  })
})
</script>

<style scoped>
.editor-placeholder,
.editor-container {
  display: flex;
  flex-direction: row;
  position: absolute;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.editor-container .hide {
  z-index: -1;
  opacity: 0;
  position: absolute;
  left: -10000px;
}
.editor-placeholder {
  background: var(--editorBgColor);
}
.editor-middle {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100vh;
  position: relative;
  & > .editor {
    flex: 1;
  }
}
</style>
