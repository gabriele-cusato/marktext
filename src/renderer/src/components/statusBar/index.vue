<template>
  <div class="v2-status">
    <!-- Sinistra: dot saved + Ln/Col -->
    <div class="v2-status-l">
      <span :class="['v2-saved', { 'v2-unsaved-dot': !isSaved }]" />
      <span class="v2-si">{{ positionLabel }}</span>
    </div>

    <!-- Destra: Settings/Theme / Wrap / Zoom / EOL / Encoding -->
    <div class="v2-status-r">
      <!-- F5: Settings + Theme spostati qui dalla tab bar, prima di Wrap -->
      <button
        class="v2-sb-icon"
        title="Settings"
        @click="openSettings"
      >⚙</button>
      <button
        class="v2-sb-icon"
        :title="`Toggle theme (current: ${themeValue})`"
        @click="toggleTheme"
      >{{ themeValue === 'dark' ? '◐' : '◑' }}</button>

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
          @mousedown.stop
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

      <!-- Encoding chip + dropdown a due livelli -->
      <div class="v2-chip-wrap">
        <button
          class="v2-chip"
          @click.stop="toggleEncMenu"
        >{{ encodingDisplay }}</button>
        <div
          v-if="encOpen"
          class="v2-chip-drop v2-chip-drop-wide"
          @mousedown.stop
        >
          <!-- Voci top-level -->
          <div
            v-for="item of TOP_ENC"
            :key="item.label"
            :class="['v2-drop-i', { 'v2-drop-on': isEncSelected(item) }]"
            @click.stop="changeEnc(item)"
          >
            <span>{{ item.label }}</span>
            <span v-if="isEncSelected(item)">✓</span>
          </div>

          <!-- Separator -->
          <div class="v2-drop-sep" />

          <!-- Voce espandibile "Altri set di caratteri" -->
          <div
            class="v2-drop-i v2-drop-submenu"
            @click.stop="encGroupsOpen = !encGroupsOpen"
          >
            <span>Altri set di caratteri</span>
            <span class="v2-drop-arrow">{{ encGroupsOpen ? '▾' : '▸' }}</span>
          </div>

          <!-- Sottomenu categorie -->
          <div
            v-if="encGroupsOpen"
            class="v2-drop-groups"
          >
            <div
              v-for="group of ENC_GROUPS"
              :key="group.label"
              class="v2-drop-group"
            >
              <div class="v2-drop-group-label">{{ group.label }}</div>
              <div
                v-for="item of group.items"
                :key="item.encoding"
                :class="['v2-drop-i', 'v2-drop-i-nested', { 'v2-drop-on': isEncSelected(item) }]"
                @click.stop="changeEnc(item)"
              >
                <span>{{ item.label }}</span>
                <span v-if="isEncSelected(item)">✓</span>
              </div>
            </div>
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
const { zoom, sourceCode, theme: themeValue } = storeToRefs(preferencesStore)

// F5: handler settings + theme spostati dalla tab bar
const openSettings = () => bus.emit('show-settings-modal')
const toggleTheme = () => {
  const next = themeValue.value === 'dark' ? 'light' : 'dark'
  preferencesStore.SET_SINGLE_PREFERENCE({ type: 'theme', value: next })
}

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

// Position label — F1: ora aggiornato anche in WYSIWYG (linea = ordine blocco)
// N1: Prg (paragrafo) in modalità markdown/Muya, Ln in modalità CodeMirror
const positionLabel = computed(() => {
  const lineLabel = sourceCode.value ? 'Ln' : 'Prg'
  return `${lineLabel} ${line.value}, Col ${col.value}`
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
const encodingBom = computed(() => !!currentFile.value?.encoding?.isBom)
const encodingDisplay = computed(() => {
  const v = encodingValue.value
  const bom = encodingBom.value
  // Display speciale per voci top con BOM
  if (v === 'utf8' && bom) return 'UTF-8 BOM'
  if (v === 'utf16be' && bom) return 'UTF-16 BE BOM'
  if (v === 'utf16le' && bom) return 'UTF-16 LE BOM'
  return ENCODING_NAME_MAP[v] || v.toUpperCase()
})
const encOpen = ref(false)
const encGroupsOpen = ref(false)

// Voci top-level visibili sempre
const TOP_ENC = [
  { label: 'ANSI', encoding: 'cp1252', isBom: false },
  { label: 'UTF-8', encoding: 'utf8', isBom: false },
  { label: 'UTF-8 BOM', encoding: 'utf8', isBom: true },
  { label: 'UTF-16 BE BOM', encoding: 'utf16be', isBom: true },
  { label: 'UTF-16 LE BOM', encoding: 'utf16le', isBom: true }
]

// Sottomenu "Altri set di caratteri" - categorie con relative chiavi
const ENC_GROUPS = [
  { label: 'Arabo', items: [
    { label: ENCODING_NAME_MAP.arabic, encoding: 'arabic', isBom: false },
    { label: ENCODING_NAME_MAP.cp1256, encoding: 'cp1256', isBom: false }
  ]},
  { label: 'Baltico', items: [
    { label: ENCODING_NAME_MAP.latin4, encoding: 'latin4', isBom: false },
    { label: ENCODING_NAME_MAP.cp1257, encoding: 'cp1257', isBom: false }
  ]},
  { label: 'Cirillico', items: [
    { label: ENCODING_NAME_MAP.cp866, encoding: 'cp866', isBom: false },
    { label: ENCODING_NAME_MAP.iso88595, encoding: 'iso88595', isBom: false },
    { label: ENCODING_NAME_MAP.koi8r, encoding: 'koi8r', isBom: false },
    { label: ENCODING_NAME_MAP.koi8u, encoding: 'koi8u', isBom: false },
    { label: ENCODING_NAME_MAP.cp1251, encoding: 'cp1251', isBom: false }
  ]},
  { label: 'Europa Centrale', items: [
    { label: ENCODING_NAME_MAP.iso88592, encoding: 'iso88592', isBom: false },
    { label: ENCODING_NAME_MAP.windows1250, encoding: 'windows1250', isBom: false }
  ]},
  { label: 'Cinese', items: [
    { label: ENCODING_NAME_MAP.gb2312, encoding: 'gb2312', isBom: false },
    { label: ENCODING_NAME_MAP.gb18030, encoding: 'gb18030', isBom: false },
    { label: ENCODING_NAME_MAP.gbk, encoding: 'gbk', isBom: false },
    { label: ENCODING_NAME_MAP.big5, encoding: 'big5', isBom: false },
    { label: ENCODING_NAME_MAP.big5hkscs, encoding: 'big5hkscs', isBom: false }
  ]},
  { label: 'Europa Orientale', items: [
    { label: ENCODING_NAME_MAP.iso885913, encoding: 'iso885913', isBom: false }
  ]},
  { label: 'Greco', items: [
    { label: ENCODING_NAME_MAP.greek, encoding: 'greek', isBom: false },
    { label: ENCODING_NAME_MAP.cp1253, encoding: 'cp1253', isBom: false }
  ]},
  { label: 'Ebraico', items: [
    { label: ENCODING_NAME_MAP.hebrew, encoding: 'hebrew', isBom: false },
    { label: ENCODING_NAME_MAP.cp1255, encoding: 'cp1255', isBom: false }
  ]},
  { label: 'Giapponese', items: [
    { label: ENCODING_NAME_MAP.shiftjis, encoding: 'shiftjis', isBom: false },
    { label: ENCODING_NAME_MAP.eucjp, encoding: 'eucjp', isBom: false }
  ]},
  { label: 'Coreano', items: [
    { label: ENCODING_NAME_MAP.euckr, encoding: 'euckr', isBom: false }
  ]},
  { label: 'Europa del Nord', items: [
    { label: ENCODING_NAME_MAP.latin6, encoding: 'latin6', isBom: false }
  ]},
  { label: 'Turco', items: [
    { label: ENCODING_NAME_MAP.latin5, encoding: 'latin5', isBom: false },
    { label: ENCODING_NAME_MAP.cp1254, encoding: 'cp1254', isBom: false }
  ]},
  { label: 'Europa Occidentale', items: [
    { label: ENCODING_NAME_MAP.ascii, encoding: 'ascii', isBom: false },
    { label: ENCODING_NAME_MAP.latin3, encoding: 'latin3', isBom: false },
    { label: ENCODING_NAME_MAP.iso885915, encoding: 'iso885915', isBom: false }
  ]}
]

const toggleEncMenu = () => {
  encOpen.value = !encOpen.value
  eolOpen.value = false
  encGroupsOpen.value = false
}

// Match voce attiva (encoding + isBom)
const isEncSelected = (item) => {
  return encodingValue.value === item.encoding && encodingBom.value === item.isBom
}

const changeEnc = (item) => {
  bus.emit('mt::set-file-encoding', { encoding: item.encoding, isBom: item.isBom })
  encOpen.value = false
  encGroupsOpen.value = false
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

/* F5: icone settings/theme nel footer (prima dei chip) */
.v2-sb-icon {
  width: 22px;
  height: 18px;
  font-size: 12px;
  color: var(--v2-text3);
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 2px;
  transition: all var(--v2-t-fast) ease-in-out;
}

.v2-sb-icon:hover {
  background: var(--v2-surface2);
  color: var(--v2-text);
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

/* Separator nel dropdown */
.v2-drop-sep {
  height: 1px;
  background: var(--v2-border);
  margin: 4px 8px;
}

/* Voce con sottomenu (freccia espansione) */
.v2-drop-submenu {
  font-weight: 500;
}

.v2-drop-arrow {
  color: var(--v2-text3);
  font-size: 10px;
}

/* Container categorie sottomenu */
.v2-drop-groups {
  border-top: 1px solid var(--v2-border);
  margin-top: 2px;
  padding-top: 4px;
}

.v2-drop-group {
  margin-bottom: 4px;
}

.v2-drop-group-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--v2-text3);
  padding: 4px 12px 2px;
  font-weight: 600;
}

.v2-drop-i-nested {
  padding-left: 20px;
  font-size: 11.5px;
}
</style>
