<template>
  <Teleport to="body">
    <div
      v-if="open"
      :class="['v2-settings-backdrop', { 'v2-closing': closing }]"
      @mousedown.self="close"
    >
      <div
        :class="['v2-settings-modal', { 'v2-closing': closing }]"
        @mousedown.stop
      >
        <!-- Header sticky -->
        <div class="v2-settings-hdr">
          <button
            v-if="activeSection !== 'menu'"
            class="v2-settings-back"
            @click="activeSection = 'menu'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span class="v2-settings-title">{{ activeTitle }}</span>
          <button
            class="v2-settings-close"
            @click="close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body scrollabile -->
        <div class="v2-settings-body">
          <!-- Menu principale: lista sezioni -->
          <div v-if="activeSection === 'menu'">
            <button
              v-for="s of SECTIONS"
              :key="s.id"
              class="v2-settings-row"
              @click="activeSection = s.id"
            >
              <span class="v2-settings-row-label">{{ s.label }}</span>
              <span class="v2-settings-row-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </button>
          </div>

          <!-- Sezione: General -->
          <div
            v-else-if="activeSection === 'general'"
            class="v2-pref-wrap"
          >
            <General />
          </div>

          <!-- Sezione: Editor -->
          <div
            v-else-if="activeSection === 'editor'"
            class="v2-pref-wrap"
          >
            <Editor />
          </div>

          <!-- Sezione: Theme -->
          <div
            v-else-if="activeSection === 'theme'"
            class="v2-pref-wrap"
          >
            <Theme />
          </div>

          <!-- Sezione: Markdown -->
          <div
            v-else-if="activeSection === 'markdown'"
            class="v2-pref-wrap"
          >
            <Markdown />
          </div>

          <!-- Sezione: Spellchecker -->
          <div
            v-else-if="activeSection === 'spellchecker'"
            class="v2-pref-wrap"
          >
            <Spellchecker />
          </div>

          <!-- Sezione: Keybindings -->
          <div
            v-else-if="activeSection === 'keybindings'"
            class="v2-pref-wrap"
          >
            <Keybindings />
          </div>

          <!-- Sezione: Image -->
          <div
            v-else-if="activeSection === 'image'"
            class="v2-pref-wrap"
          >
            <Image />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import General from '@/prefComponents/general/index.vue'
import Editor from '@/prefComponents/editor/index.vue'
import Theme from '@/prefComponents/theme/index.vue'
import Markdown from '@/prefComponents/markdown/index.vue'
import Spellchecker from '@/prefComponents/spellchecker/index.vue'
import Keybindings from '@/prefComponents/keybindings/index.vue'
import Image from '@/prefComponents/image/index.vue'

const { t } = useI18n()

const open = ref(false)
const closing = ref(false)
const activeSection = ref('menu')
let closeTimer = null

const SECTIONS = computed(() => [
  { id: 'general', label: tFallback('preferences.general.title', 'General') },
  { id: 'editor', label: tFallback('preferences.editor.title', 'Editor') },
  { id: 'theme', label: tFallback('preferences.theme.title', 'Theme') },
  { id: 'markdown', label: tFallback('preferences.markdown.title', 'Markdown') },
  { id: 'spellchecker', label: tFallback('preferences.spellchecker.title', 'Spell Checker') },
  { id: 'keybindings', label: tFallback('preferences.keybindings.title', 'Key Bindings') },
  { id: 'image', label: tFallback('preferences.image.title', 'Image') }
])

const activeTitle = computed(() => {
  if (activeSection.value === 'menu') return tFallback('preferences.title', 'Settings')
  const s = SECTIONS.value.find((x) => x.id === activeSection.value)
  return s ? s.label : 'Settings'
})

function tFallback(key, fb) {
  try {
    const v = t(key)
    return v && v !== key ? v : fb
  } catch {
    return fb
  }
}

const show = () => {
  closing.value = false
  activeSection.value = 'menu'
  open.value = true
}

const close = () => {
  closing.value = true
  closeTimer = setTimeout(() => {
    open.value = false
    closing.value = false
  }, 270)
}

const handleKey = (e) => {
  if (e.key === 'Escape' && open.value) close()
}

// IPC dal main process (voce menu Preferences)
const handleIpcShow = () => show()

onMounted(() => {
  bus.on('show-settings-modal', show)
  window.addEventListener('keydown', handleKey)
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('mt::show-settings-modal', handleIpcShow)
  }
})

onBeforeUnmount(() => {
  bus.off('show-settings-modal', show)
  window.removeEventListener('keydown', handleKey)
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.removeListener('mt::show-settings-modal', handleIpcShow)
  }
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<style scoped>
.v2-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3500;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: v2fadeIn var(--v2-t-mid) ease-in-out;
  font-family: var(--v2-sans);
}

.v2-settings-modal {
  width: 600px;
  max-width: 92vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--v2-surface);
  border-radius: 16px;
  box-shadow: var(--v2-shadow-lg);
  overflow: hidden;
  animation: v2dropIn var(--v2-t-slow) var(--v2-ease-spring);
}

.v2-settings-hdr {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--v2-border);
  background: var(--v2-surface);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}

.v2-settings-back,
.v2-settings-close {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  color: var(--v2-text2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--v2-t-fast) ease-in-out;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
}

.v2-settings-back:hover,
.v2-settings-close:hover {
  background: var(--v2-surface2);
  color: var(--v2-text);
}

.v2-settings-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--v2-text);
}

.v2-settings-body {
  overflow-y: auto;
  padding: 12px 0;
  flex: 1;
}

.v2-settings-body::-webkit-scrollbar {
  width: 5px;
}

.v2-settings-body::-webkit-scrollbar-thumb {
  background: var(--v2-border);
  border-radius: 5px;
}

/* Lista voci menu principale */
.v2-settings-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--v2-sans);
  font-size: 14px;
  color: var(--v2-text);
  transition: background var(--v2-t-fast) ease-in-out;
  border-bottom: 1px solid var(--v2-border);
}

.v2-settings-row:last-child {
  border-bottom: none;
}

.v2-settings-row:hover {
  background: var(--v2-surface2);
}

.v2-settings-row-label {
  flex: 1;
  text-align: left;
  font-weight: 500;
}

.v2-settings-row-arrow {
  color: var(--v2-text3);
  display: flex;
  align-items: center;
}

/* Wrapper per prefComponents (override stili interni problematici) */
.v2-pref-wrap {
  padding: 8px 24px 24px;
  color: var(--v2-text);
  font-family: var(--v2-sans);
}

/* Override stili pref interne per integrarle nel modal v2 */
:deep(.pref-general h4),
:deep(.pref-editor h4),
:deep(.pref-theme h4),
:deep(.pref-markdown h4),
:deep(.pref-spellchecker h4),
:deep(.pref-keybindings h4),
:deep(.pref-image h4) {
  font-size: 16px;
  font-weight: 600;
  color: var(--v2-text);
  margin: 0 0 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--v2-border);
}

:deep(h6.title) {
  color: var(--v2-text);
}

:deep(.pref-switch-item) {
  color: var(--v2-text);
}

:deep(.description) {
  color: var(--v2-text2);
}
</style>
