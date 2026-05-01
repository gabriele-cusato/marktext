<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="v2-ctx"
      :class="{ 'v2-closing': closing }"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      @mousedown.stop
      @contextmenu.prevent
    >
      <template
        v-for="(it, i) in items"
        :key="i"
      >
        <div
          v-if="it === '---' || it.type === 'separator'"
          class="v2-ctx-sep"
        />
        <div
          v-else
          class="v2-ctx-item"
          :class="{ 'is-disabled': it.disabled }"
          @click.stop="handleClick(it)"
        >
          <span class="v2-ctx-icon">
            <component
              :is="it.iconComponent"
              v-if="it.iconComponent"
            />
            <span
              v-else-if="it.iconKey"
              v-html="ICONS[it.iconKey] || ''"
            />
          </span>
          <span class="v2-ctx-label">{{ it.label }}</span>
          <span
            v-if="it.shortcut"
            class="v2-ctx-sc"
          >{{ it.shortcut }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
// Base context menu Vue v2 — sostituisce menu Electron nativi.
// Items: array di { label, iconKey?, iconComponent?, shortcut?, action(), disabled? } | '---'
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { ICONS } from './icons'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  items: { type: Array, required: true }
})

const emit = defineEmits(['close'])

const menuRef = ref(null)
const closing = ref(false)
const pos = ref({ x: props.x, y: props.y })

let closeTimer = null

// Aggiusta posizione per evitare overflow viewport
const adjustPosition = async () => {
  await nextTick()
  if (!menuRef.value) return
  const r = menuRef.value.getBoundingClientRect()
  const padX = 8, padY = 8
  pos.value = {
    x: Math.min(props.x, window.innerWidth - r.width - padX),
    y: Math.min(props.y, window.innerHeight - r.height - padY)
  }
}

// Click esterno chiude (ritardato per evitare close immediato sul contextmenu trigger)
const handleOutside = (e) => {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    closeWithAnim()
  }
}

const handleEsc = (e) => {
  if (e.key === 'Escape') closeWithAnim()
}

const closeWithAnim = () => {
  closing.value = true
  closeTimer = setTimeout(() => emit('close'), 220)
}

const handleClick = (item) => {
  if (item.disabled) return
  if (typeof item.action === 'function') item.action()
  closeWithAnim()
}

watch(() => [props.x, props.y], adjustPosition)

onMounted(() => {
  adjustPosition()
  // Ritarda listener click esterno per non auto-chiudere subito
  setTimeout(() => {
    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('contextmenu', handleOutside)
  }, 50)
  window.addEventListener('keydown', handleEsc)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleOutside)
  window.removeEventListener('contextmenu', handleOutside)
  window.removeEventListener('keydown', handleEsc)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<style scoped>
.v2-ctx {
  position: fixed;
  min-width: 232px;
  background: var(--v2-surface);
  border: 1px solid var(--v2-border);
  border-radius: 10px;
  box-shadow: var(--v2-shadow-lg);
  padding: 4px;
  z-index: 4000;
  animation: v2scaleIn var(--v2-t-mid) var(--v2-ease-spring);
  font-family: var(--v2-sans);
}

.v2-ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 6px;
  cursor: default;
  font-size: 12.5px;
  color: var(--v2-text);
  transition:
    background var(--v2-t-fast) ease-in-out,
    color var(--v2-t-fast) ease-in-out;
}

.v2-ctx-item:hover {
  background: var(--v2-accent-dim);
  color: var(--v2-accent);
}

.v2-ctx-item.is-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.v2-ctx-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v2-text3);
  transition: color var(--v2-t-fast) ease-in-out;
}

.v2-ctx-item:hover .v2-ctx-icon {
  color: var(--v2-accent);
}

.v2-ctx-label {
  flex: 1;
}

.v2-ctx-sc {
  font-family: var(--v2-mono);
  font-size: 11px;
  color: var(--v2-text3);
  flex-shrink: 0;
}

.v2-ctx-sep {
  height: 1px;
  background: var(--v2-border);
  margin: 3px 0;
}
</style>
