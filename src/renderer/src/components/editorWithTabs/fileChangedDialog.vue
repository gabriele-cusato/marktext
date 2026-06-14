<template>
  <Teleport to="body">
    <div
      v-if="visible"
      :class="['fc-backdrop', { 'fc-closing': closing }]"
      @mousedown.self="cancel"
    >
      <div
        :class="['fc-box', { 'fc-closing': closing }]"
        @mousedown.stop
      >
        <div class="fc-title">
          {{ t('store.editor.fileChangedTitle') }}
        </div>
        <!-- messaggio adattivo: avverte della perdita modifiche solo se ce ne sono -->
        <div class="fc-msg">
          {{ message }}
        </div>
        <div class="fc-actions">
          <button
            class="fc-btn"
            @click="cancel"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="fc-btn fc-btn-primary"
            @click="reload"
          >
            {{ t('store.editor.reloadFromDisk') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import bus from '@/bus'
import { useEditorStore } from '@/store/editor'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const editorStore = useEditorStore()

const visible = ref(false)
const closing = ref(false)
const filename = ref('')
const hasUnsaved = ref(false)
// change da applicare; confirmed distingue Ricarica da Annulla/click-fuori/ESC
let pendingChange = null
let confirmed = false
let closeTimer = null

// Avverte della perdita modifiche solo se il tab ha contenuto non salvato.
const message = computed(() =>
  hasUnsaved.value
    ? t('store.editor.fileChangedReloadWarn', { name: filename.value })
    : t('store.editor.fileChangedReloadNoWarn', { name: filename.value })
)

const handleExternalChange = ({ change, filename: name, hasUnsavedChanges }) => {
  // B-REV12: un nuovo evento esterno durante il fade-out (220ms) deve annullare il timer pendente,
  // altrimenti il timer scatta dopo e auto-tratta il NUOVO change come "Annulla" senza mostrarlo.
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  pendingChange = change
  filename.value = name
  hasUnsaved.value = hasUnsavedChanges
  confirmed = false
  closing.value = false
  visible.value = true
}

// Avvia il fade-out, poi esegue l'azione (reload o diverge) a animazione finita.
const startClose = () => {
  if (closing.value) return
  closing.value = true
  closeTimer = setTimeout(() => {
    visible.value = false
    closing.value = false
    onClosed()
  }, 220)
}

const reload = () => {
  confirmed = true
  startClose()
}

const cancel = () => {
  confirmed = false
  startClose()
}

const onClosed = () => {
  if (pendingChange) {
    if (confirmed) {
      // Ricarica: contenuto dal disco entra nell'editor.
      editorStore.loadChange(pendingChange)
    } else {
      // Annulla (Opzione A): teniamo la versione in editor ma il bollino deve comparire,
      // perché ora differisce dal file su disco.
      editorStore.markDivergedFromDisk(pendingChange)
    }
  }
  pendingChange = null
  confirmed = false
}

const onKeydown = (e) => {
  if (visible.value && e.key === 'Escape') {
    e.stopPropagation()
    cancel()
  }
}

onMounted(() => {
  bus.on('file-changed-externally', handleExternalChange)
  window.addEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  bus.off('file-changed-externally', handleExternalChange)
  window.removeEventListener('keydown', onKeydown, true)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<style scoped>
/* Stile coerente con command palette / preferences (design system v2).
   Backdrop trasparente = non-modale: non oscura l'editor; click fuori = Annulla. */
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
