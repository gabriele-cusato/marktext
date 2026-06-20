<template>
  <Teleport to="body">
    <div
      v-if="visible"
      :class="['fc-backdrop', { 'fc-closing': closing }]"
      @mousedown.self="dismiss"
    >
      <div
        :class="['fc-box', { 'fc-closing': closing }]"
        @mousedown.stop
      >
        <div class="fc-title">
          {{ titleText }}
        </div>
        <div class="fc-msg">
          {{ msgText }}
        </div>
        <div class="fc-actions">
          <button
            class="fc-btn fc-btn-primary"
            @click="dismiss"
          >
            {{ t('common.ok') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/editor'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const editorStore = useEditorStore()
const { tabs } = storeToRefs(editorStore)

const visible = ref(false)
const closing = ref(false)
const tabCount = ref(0)
let closeTimer = null

// Testi con default INLINE: le chiavi i18n sono solo in en.json; se il locale attivo non le ha
// (o l'app non ha ricaricato i locale dopo l'edit) il fallback en potrebbe mancare → mostrava la
// chiave grezza (`store.editor.tooManyTabs*`). Il default `t(key, '...')` garantisce sempre testo.
// L'interpolazione di {count} è fatta a mano: robusta sia che la chiave esista sia che manchi.
const DEFAULT_TITLE = 'Many tabs open'
const DEFAULT_MSG =
  'You have {count} tabs open. A large number of tabs may slow the editor down — consider closing some you no longer need.'
const titleText = computed(() => t('store.editor.tooManyTabsTitle', DEFAULT_TITLE))
const msgText = computed(() =>
  t('store.editor.tooManyTabsMsg', DEFAULT_MSG).replace('{count}', String(tabCount.value))
)

// Soglia: avviso a 15 tab, poi ripetuto ad ogni +10 (25, 35, ...). `lastWarnLevel` = ultima
// banda già avvisata; si ri-arma scendendo sotto, così risalendo riavvisa.
const FIRST = 15
const STEP = 10
let lastWarnLevel = 0

// Banda corrente per n tab: 0 se < FIRST, altrimenti il più grande FIRST+STEP*k <= n.
const bandFor = (n) => (n < FIRST ? 0 : FIRST + Math.floor((n - FIRST) / STEP) * STEP)

const show = (n) => {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  tabCount.value = n
  closing.value = false
  visible.value = true
}

// Fade-out coerente con fileChangedDialog (220ms).
const dismiss = () => {
  if (closing.value) return
  closing.value = true
  closeTimer = setTimeout(() => {
    visible.value = false
    closing.value = false
  }, 220)
}

const onKeydown = (e) => {
  if (visible.value && e.key === 'Escape') {
    e.stopPropagation()
    dismiss()
  }
}

watch(
  () => tabs.value.length,
  (n) => {
    const band = bandFor(n)
    if (band > lastWarnLevel) {
      // salita in una nuova banda → avvisa
      show(n)
      lastWarnLevel = band
    } else if (band < lastWarnLevel) {
      // sceso sotto la banda → ri-arma per la prossima salita
      lastWarnLevel = band
    }
  }
)

window.addEventListener('keydown', onKeydown, true)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<style scoped>
/* Stile IDENTICO a fileChangedDialog.vue (design system v2): stessa box, stesso fade. */
.fc-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3200;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--v2-sans);
  animation: v2fadeIn var(--v2-t-mid) ease-in-out;
  transition: opacity 200ms ease-in-out;
}
.fc-backdrop.fc-closing {
  opacity: 0;
  pointer-events: none;
}

.fc-box {
  width: 420px;
  max-width: 92vw;
  box-sizing: border-box;
  padding: 22px 22px 18px;
  background: var(--v2-surface);
  border: 1px solid var(--v2-border);
  border-radius: 14px;
  box-shadow: var(--v2-shadow-lg);
  animation: v2dropIn var(--v2-t-slow) var(--v2-ease-spring);
}
.fc-box.fc-closing {
  opacity: 0;
  transition: opacity 200ms ease-in-out;
}

.fc-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--v2-text);
  margin-bottom: 10px;
}
.fc-msg {
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--v2-text2);
  margin-bottom: 20px;
}

.fc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.fc-btn {
  height: 32px;
  padding: 0 16px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid var(--v2-border2);
  background: var(--v2-surface2);
  color: var(--v2-text);
  cursor: pointer;
  transition: background var(--v2-t-mid) ease-in-out, border-color var(--v2-t-mid) ease-in-out;
}
.fc-btn:hover {
  background: var(--v2-surface3);
}
.fc-btn-primary {
  background: var(--v2-accent);
  border-color: var(--v2-accent);
  color: #ffffff;
}
.fc-btn-primary:hover {
  filter: brightness(1.08);
  background: var(--v2-accent);
}
</style>
