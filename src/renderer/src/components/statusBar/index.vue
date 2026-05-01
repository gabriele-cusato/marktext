<template>
  <div class="v2-status">
    <!-- Sinistra: dot saved + Ln/Col -->
    <div class="v2-status-l">
      <span :class="['v2-saved', { 'v2-unsaved-dot': !isSaved }]" />
      <span class="v2-si">{{ positionLabel }}</span>
    </div>

    <!-- Destra: Wrap / Zoom / EOL / Encoding -->
    <div class="v2-status-r">
      <button
        :class="['v2-chip', { 'v2-chip-on': wordWrap }]"
        :title="t('statusBar.toggleWrap', 'Toggle Word Wrap')"
        @click="toggleWrap"
      >Wrap</button>
      <button
        class="v2-chip"
        :title="t('statusBar.resetZoom', 'Reset Zoom (Ctrl+0)')"
        @click="resetZoom"
      >{{ zoomDisplay }}</button>

      <!-- EOL chip + dropdown -->
      <div class="v2-chip-wrap">
        <button
          class="v2-chip"
          @click.stop="toggleEolMenu"
        >{{ eolDisplay }}</button>
        <div
          v-if="eolOpen"
          class="v2-chip-drop"
        >
          <div
            v-for="opt of EOL_OPTIONS"
            :key="opt.value"
            :class="['v2-drop-i', { 'v2-drop-on': eolValue === opt.value }]"
            @click.stop="changeEol(opt.value)"
          >
            <span>{{ opt.label }}</span>
            <span v-if="eolValue === opt.value">✓</span>
          </div>
        </div>
      </div>

      <!-- Encoding chip + dropdown -->
      <div class="v2-chip-wrap">
        <button
          class="v2-chip"
          @click.stop="toggleEncMenu"
        >{{ encodingDisplay }}</button>
        <div
          v-if="encOpen"
          class="v2-chip-drop v2-chip-drop-wide"
        >
          <div
            v-for="opt of ENC_OPTIONS"
            :key="opt.value"
            :class="['v2-drop-i', { 'v2-drop-on': encodingValue === opt.value }]"
            @click.stop="changeEnc(opt.value)"
          >
            <span>{{ opt.label }}</span>
            <span v-if="encodingValue === opt.value">✓</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { ENCODING_NAME_MAP } from 'common/encoding'
import bus from '@/bus'

const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const { currentFile } = storeToRefs(editorStore)
const { zoom, sourceCode } = storeToRefs(preferencesStore)

// i18n con fallback su default string
const i18n = useI18n()
const t = (k, fb) => {
  try {
    const v = i18n.t(k)
    return v && v !== k ? v : fb || k
  } catch {
    return fb || k
  }
}

// Cursor position (Ln/Col) — solo source mode da CodeMirror via bus
const line = ref(1)
const col = ref(1)

const handleCursorChange = (payload) => {
  if (payload && typeof payload.line === 'number') {
    line.value = payload.line
    col.value = payload.col
  }
}

// Word wrap — usa preferences.wordWrap (campo nuovo) con fallback true
const wordWrap = computed(() => {
  // Se non esiste in preferences, default true
  return preferencesStore.wordWrap !== false
})

const toggleWrap = () => {
  const next = !wordWrap.value
  preferencesStore.SET_SINGLE_PREFERENCE({ type: 'wordWrap', value: next })
  bus.emit('mt::wordwrap-change', next)
}

// Zoom display
const zoomDisplay = computed(() => `${Math.round((zoom.value || 1) * 100)}%`)
const resetZoom = () => {
  preferencesStore.SET_SINGLE_PREFERENCE({ type: 'zoom', value: 1.0 })
}

// Saved state
const isSaved = computed(() => {
  return currentFile.value?.isSaved !== false
})

// Position label — '—' in WYSIWYG mode (Muya non espone Ln/Col)
const positionLabel = computed(() => {
  if (sourceCode.value) {
    return `Ln ${line.value}, Col ${col.value}`
  }
  return 'Ln —, Col —'
})

// EOL
const eolValue = computed(() => currentFile.value?.lineEnding || 'lf')
const eolDisplay = computed(() => (eolValue.value || 'lf').toUpperCase())
const eolOpen = ref(false)

const EOL_OPTIONS = [
  { value: 'lf', label: 'LF' },
  { value: 'crlf', label: 'CRLF' }
]

const toggleEolMenu = () => {
  eolOpen.value = !eolOpen.value
  encOpen.value = false
}

const changeEol = (value) => {
  bus.emit('mt::set-line-ending', value)
  eolOpen.value = false
}

// Encoding
const encodingValue = computed(() => currentFile.value?.encoding?.encoding || 'utf8')
const encodingDisplay = computed(() => {
  const v = encodingValue.value
  return ENCODING_NAME_MAP[v] || v.toUpperCase()
})
const encOpen = ref(false)

const ENC_OPTIONS = Object.entries(ENCODING_NAME_MAP).map(([value, label]) => ({ value, label }))

const toggleEncMenu = () => {
  encOpen.value = !encOpen.value
  eolOpen.value = false
}

const changeEnc = (value) => {
  bus.emit('mt::set-file-encoding', value)
  encOpen.value = false
}

// Click outside chiude dropdown
const handleClickOutside = () => {
  eolOpen.value = false
  encOpen.value = false
}

onMounted(() => {
  bus.on('statusbar::cursor-change', handleCursorChange)
  window.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  bus.off('statusbar::cursor-change', handleCursorChange)
  window.removeEventListener('mousedown', handleClickOutside)
})
</script>

<style scoped>
.v2-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--v2-sb-h);
  padding: 0 12px;
  background: var(--v2-surface);
  border-top: 1px solid var(--v2-border);
  font-size: 11px;
  color: var(--v2-text3);
  flex-shrink: 0;
  font-family: var(--v2-mono);
  user-select: none;
}

.v2-status-l,
.v2-status-r {
  display: flex;
  align-items: center;
  gap: 2px;
}

.v2-saved {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--v2-success);
  flex-shrink: 0;
  margin-right: 6px;
}

.v2-unsaved-dot {
  background: var(--v2-unsaved) !important;
}

.v2-si {
  margin-right: 4px;
}

.v2-chip {
  padding: 0 7px;
  height: 18px;
  border-radius: 100px;
  font-size: 11px;
  font-family: var(--v2-mono);
  color: var(--v2-text3);
  border: none;
  background: none;
  cursor: pointer;
  transition: all var(--v2-t-fast) ease-in-out;
}

.v2-chip:hover {
  background: var(--v2-surface2);
  color: var(--v2-text2);
}

.v2-chip-on {
  color: var(--v2-accent) !important;
}

.v2-chip-wrap {
  position: relative;
}

.v2-chip-drop {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  background: var(--v2-surface);
  border: 1px solid var(--v2-border);
  border-radius: 9px;
  box-shadow: var(--v2-shadow-md);
  padding: 4px;
  min-width: 120px;
  z-index: 999;
  animation: v2scaleIn var(--v2-t-mid) var(--v2-ease-spring);
  font-family: var(--v2-sans);
}

.v2-chip-drop-wide {
  min-width: 220px;
  max-height: 280px;
  overflow-y: auto;
}

.v2-drop-i {
  padding: 6px 12px;
  border-radius: 5px;
  cursor: default;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  color: var(--v2-text);
  transition: background var(--v2-t-fast) ease-in-out;
}

.v2-drop-i:hover {
  background: var(--v2-surface2);
}

.v2-drop-on {
  color: var(--v2-accent);
  font-weight: 600;
}
</style>
