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
        <!-- Header sticky (F4: titolo grosso + icona settings a sinistra) -->
        <div class="v2-settings-hdr">
          <button
            v-if="activeSection !== 'menu'"
            class="v2-settings-back"
            @click="goBackToMenu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span
            v-if="activeSection === 'menu'"
            class="v2-settings-title-icon"
          >
            <!-- Icona settings (gear) -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </span>
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

        <!-- Body scrollabile (F3: transizione tra menu e sezioni) -->
        <div class="v2-settings-body">
          <Transition :name="navDirection" mode="out-in">
            <!-- Menu principale: lista sezioni -->
            <div
              v-if="activeSection === 'menu'"
              key="menu"
              class="v2-settings-pane"
            >
              <button
                v-for="s of SECTIONS"
                :key="s.id"
                class="v2-settings-row"
                @click="goToSection(s.id)"
              >
                <span class="v2-settings-row-icon" v-html="s.icon" />
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
              key="general"
              class="v2-pref-wrap v2-settings-pane"
            >
              <General />
            </div>

            <!-- Sezione: Editor -->
            <div
              v-else-if="activeSection === 'editor'"
              key="editor"
              class="v2-pref-wrap v2-settings-pane"
            >
              <Editor />
            </div>

            <!-- Sezione: Theme -->
            <div
              v-else-if="activeSection === 'theme'"
              key="theme"
              class="v2-pref-wrap v2-settings-pane"
            >
              <Theme />
            </div>

            <!-- Sezione: Markdown -->
            <div
              v-else-if="activeSection === 'markdown'"
              key="markdown"
              class="v2-pref-wrap v2-settings-pane"
            >
              <Markdown />
            </div>

            <!-- Sezione: Spellchecker -->
            <div
              v-else-if="activeSection === 'spellchecker'"
              key="spellchecker"
              class="v2-pref-wrap v2-settings-pane"
            >
              <Spellchecker />
            </div>

            <!-- Sezione: Keybindings -->
            <div
              v-else-if="activeSection === 'keybindings'"
              key="keybindings"
              class="v2-pref-wrap v2-settings-pane"
            >
              <Keybindings />
            </div>

            <!-- Sezione: Image -->
            <div
              v-else-if="activeSection === 'image'"
              key="image"
              class="v2-pref-wrap v2-settings-pane"
            >
              <Image />
            </div>
          </Transition>
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
const navDirection = ref('v2-slide-fwd') // F3: direzione transizione (avanti/indietro)
let closeTimer = null

// SVG icons (Lucide-style) inline per voci sottomenu (F4)
const ICON_GENERAL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
const ICON_EDITOR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>'
const ICON_THEME = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>'
const ICON_MD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13v-1h6v1"/><path d="M11 18h2"/><path d="M12 12v6"/></svg>'
const ICON_SPELL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/><path d="m16 20 2 2 4-4"/></svg>'
const ICON_KEY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>'
const ICON_IMG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'

const SECTIONS = computed(() => [
  { id: 'general', label: tFallback('preferences.general.title', 'General'), icon: ICON_GENERAL },
  { id: 'editor', label: tFallback('preferences.editor.title', 'Editor'), icon: ICON_EDITOR },
  { id: 'theme', label: tFallback('preferences.theme.title', 'Theme'), icon: ICON_THEME },
  { id: 'markdown', label: tFallback('preferences.markdown.title', 'Markdown'), icon: ICON_MD },
  { id: 'spellchecker', label: tFallback('preferences.spellchecker.title', 'Spell Checker'), icon: ICON_SPELL },
  { id: 'keybindings', label: tFallback('preferences.keybindings.title', 'Key Bindings'), icon: ICON_KEY },
  { id: 'image', label: tFallback('preferences.image.title', 'Image'), icon: ICON_IMG }
])

// F3: navigazione con direzione (per scegliere transizione slide)
const goToSection = (id) => {
  navDirection.value = 'v2-slide-fwd'
  activeSection.value = id
}

const goBackToMenu = () => {
  navDirection.value = 'v2-slide-bwd'
  activeSection.value = 'menu'
}

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
  /* NB7: backdrop trasparente — nessuno scurimento dello sfondo */
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: v2fadeIn var(--v2-t-mid) ease-in-out;
  font-family: var(--v2-sans);
  transition: opacity 220ms ease-in-out;
}

/* B9: fade-out del backdrop sincrono con quello del modal */
.v2-settings-backdrop.v2-closing {
  opacity: 0;
  pointer-events: none;
}

.v2-settings-modal {
  width: 600px;
  max-width: 92vw;
  /* N13: altezza fissa — elimina scatto tra sezioni di altezza diversa */
  height: 78vh;
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
  gap: 12px;
  /* F4: header più alto con titolo evidente */
  padding: 22px 22px 18px;
  border-bottom: 1px solid var(--v2-border);
  background: var(--v2-surface);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}

/* F4: icona settings a sinistra del titolo (solo nel menu principale) */
.v2-settings-title-icon {
  color: var(--v2-accent);
  display: flex;
  align-items: center;
  justify-content: center;
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
  /* F4: titolo più grande ed evidente */
  font-size: 20px;
  font-weight: 700;
  color: var(--v2-text);
  letter-spacing: -0.01em;
}

.v2-settings-body {
  overflow-y: auto;
  /* F4: distanziato dal titolo */
  padding: 18px 0 12px;
  flex: 1;
  /* F3: contenitore stabile per transizioni */
  position: relative;
}

/* F3: transizioni slide tra menu e sezioni */
.v2-settings-pane {
  /* base per transizioni */
}

.v2-slide-fwd-enter-active,
.v2-slide-fwd-leave-active,
.v2-slide-bwd-enter-active,
.v2-slide-bwd-leave-active {
  transition: opacity 220ms ease-in-out, transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.v2-slide-fwd-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.v2-slide-fwd-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.v2-slide-bwd-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.v2-slide-bwd-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.v2-settings-body::-webkit-scrollbar {
  width: 5px;
}

.v2-settings-body::-webkit-scrollbar-thumb {
  background: var(--v2-border);
  border-radius: 5px;
}

/* Lista voci menu principale (F4: con icone a sinistra) */
.v2-settings-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
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

/* F4: icona a sinistra di ogni voce sottomenu */
.v2-settings-row-icon {
  color: var(--v2-text2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
}

.v2-settings-row:hover .v2-settings-row-icon {
  color: var(--v2-accent);
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
