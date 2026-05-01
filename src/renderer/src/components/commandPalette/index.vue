<template>
  <Teleport to="body">
    <div
      v-if="showCommandPalette"
      :class="['v2-cmd-backdrop', { 'v2-closing': closing }]"
      @mousedown.self="close"
    >
      <div
        :class="['v2-cmd', { 'v2-closing': closing }]"
        @mousedown.stop
      >
        <div class="v2-cmd-search">
          <span class="v2-cmd-icon">⌘</span>
          <input
            ref="searchInput"
            v-model="query"
            class="v2-cmd-input"
            type="text"
            :placeholder="placeholderText"
            @keydown="handleBeforeInput"
            @keyup="handleInput"
          >
          <button
            v-if="query"
            class="v2-cmd-clear"
            @click="query = ''"
          >✕</button>
        </div>

        <loading v-if="searcherBusy" />

        <div
          v-else-if="availableCommands.length"
          class="v2-cmd-list"
        >
          <div
            v-for="(item, index) of availableCommands"
            :key="index"
            :ref="(el) => { if (el) commandItems[index] = el }"
            :class="['v2-cmd-item', { 'v2-cmd-sel': index === selectedCommandIndex }]"
            :title="item.title"
            @mouseenter="selectedCommandIndex = index"
            @mousedown="search(item.id)"
          >
            <span class="v2-cmd-item-icon">⌘</span>
            <span class="v2-cmd-item-label">{{ item.description }}</span>
            <span
              v-if="item.shortcut && item.shortcut.length"
              class="v2-cmd-shortcut"
            >
              <kbd
                v-for="(accel, i) of item.shortcut"
                :key="i"
              >{{ accel }}</kbd>
            </span>
          </div>
        </div>

        <div class="v2-cmd-footer">
          <span>↑↓ navigate</span>
          <span>·</span>
          <span>↵ run</span>
          <span>·</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, onBeforeUpdate, computed } from 'vue'
import { useCommandCenterStore } from '@/store/commandCenter'
import log from 'electron-log'
import bus from '../../bus'
import loading from '../loading'
import { useI18n } from 'vue-i18n'

const searchInput = ref(null)
let commandItems = []
let closeTimer = null

const { t } = useI18n()
const currentCommand = ref(null)
const defaultPlaceholderText = computed(() => {
  try {
    return t('commandPalette.placeholder')
  } catch (error) {
    console.warn('i18n not ready, using fallback placeholder')
    return 'Search commands...'
  }
})

const showCommandPalette = ref(false)
const closing = ref(false)
const placeholderText = ref('')
const query = ref('')
const selectedCommandIndex = ref(-1)
const availableCommands = ref([])
const searcherBusy = ref(false)

const commandCenterStore = useCommandCenterStore()

onBeforeUpdate(() => {
  commandItems = []
})

const handleShow = (command) => {
  currentCommand.value = command || commandCenterStore.rootCommand
  currentCommand.value
    .run()
    .then(() => {
      availableCommands.value = currentCommand.value.subcommands
      selectedCommandIndex.value = currentCommand.value.subcommandSelectedIndex
      placeholderText.value = currentCommand.value.placeholder || defaultPlaceholderText.value
      query.value = ''
      closing.value = false
      showCommandPalette.value = true
      bus.emit('editor-blur')
      nextTick(() => {
        const items = commandItems
        const selIndex = selectedCommandIndex.value
        if (items && items.length > 0 && selIndex >= 0 && items[selIndex]) {
          items[selIndex].scrollIntoView({ block: 'end' })
        }

        if (searchInput.value) {
          setTimeout(() => searchInput.value.focus(), 50)
        }
      })
    })
    .catch((error) => {
      if (error && error.message) {
        log.error('Unable to initialize command:', error)
      }
    })
}

const close = () => {
  closing.value = true
  closeTimer = setTimeout(() => {
    handleClose()
    showCommandPalette.value = false
    closing.value = false
  }, 270)
}

const handleClose = () => {
  selectedCommandIndex.value = -1
  query.value = ''
  availableCommands.value = []
  if (currentCommand.value && currentCommand.value.unload) {
    currentCommand.value.unload()
  }
  currentCommand.value = null
}

const handleBeforeInput = (event) => {
  const items = commandItems
  switch (event.key) {
    case 'Escape': {
      event.preventDefault()
      close()
      break
    }
    case 'ArrowUp': {
      event.preventDefault()
      event.stopPropagation()
      if (selectedCommandIndex.value <= 0) {
        selectedCommandIndex.value = availableCommands.value.length - 1
      } else {
        selectedCommandIndex.value--
      }
      if (items && items.length > 0 && items[selectedCommandIndex.value]) {
        items[selectedCommandIndex.value].scrollIntoView({ block: 'end' })
      }
      break
    }
    case 'ArrowDown': {
      event.preventDefault()
      event.stopPropagation()
      if (selectedCommandIndex.value + 1 >= availableCommands.value.length) {
        selectedCommandIndex.value = 0
      } else {
        selectedCommandIndex.value++
      }
      if (items && items.length > 0 && items[selectedCommandIndex.value]) {
        items[selectedCommandIndex.value].scrollIntoView({ block: 'end' })
      }
      break
    }
  }
}

const handleInput = (event) => {
  if (event.isComposing) return
  switch (event.key) {
    case 'Control':
    case 'Alt':
    case 'Meta':
    case 'Shift':
    case 'Escape':
    case 'PageDown':
    case 'PageUp':
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
      break
    case 'Enter':
      search()
      break
    default:
      updateCommands()
      break
  }
}

const search = (commandId = null) => {
  if (commandId) {
    executeCommand(commandId)
    return
  } else if (
    selectedCommandIndex.value >= 0 &&
    selectedCommandIndex.value < availableCommands.value.length
  ) {
    executeCommand(availableCommands.value[selectedCommandIndex.value].id)
    return
  }
  updateCommands()
}

const updateCommands = () => {
  const queryString = query.value.trim()
  if (currentCommand.value.search) {
    searcherBusy.value = true
    currentCommand.value
      .search(queryString)
      .then((result) => {
        searcherBusy.value = false
        availableCommands.value = result || []
        selectedCommandIndex.value = availableCommands.value.length ? 0 : -1
      })
      .catch((error) => {
        if (error && error.message) {
          searcherBusy.value = false
          availableCommands.value = []
          selectedCommandIndex.value = -1
          log.error(error)
        }
      })
    return
  }

  if (!queryString) {
    availableCommands.value = currentCommand.value.subcommands
  } else {
    availableCommands.value = currentCommand.value.subcommands.filter(
      (c) => c.description.toLowerCase().indexOf(queryString.toLowerCase()) !== -1
    )
  }
  selectedCommandIndex.value = availableCommands.value.length ? 0 : -1
}

const executeCommand = (commandId) => {
  const command = availableCommands.value.find((c) => c.id === commandId)
  if (!command) {
    log.error(`Command not found: ${commandId}`)
    return
  }

  const { executeSubcommand } = currentCommand.value
  if (executeSubcommand) {
    close()
    setTimeout(() => executeSubcommand(commandId, command.value), 250)
  } else {
    const { execute, subcommands, run } = command
    if (execute === undefined && run === undefined && subcommands) {
      currentCommand.value = command
      selectedCommandIndex.value = -1
      query.value = ''
      updateCommands()
    } else {
      close()
      setTimeout(() => execute(), 250)
    }
  }
}

const handleLanguageChanged = () => {
  if (showCommandPalette.value && currentCommand.value) {
    currentCommand.value.run().then(() => {
      availableCommands.value = currentCommand.value.subcommands
      updateCommands()
    })
  }
}

onMounted(() => {
  bus.on('show-command-palette', handleShow)
  bus.on('language-changed', handleLanguageChanged)
})

onBeforeUnmount(() => {
  bus.off('show-command-palette', handleShow)
  bus.off('language-changed', handleLanguageChanged)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<style scoped>
/* ── v2 Command palette ──────────────────────────────────────── */
.v2-cmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 11vh;
  animation: v2fadeIn var(--v2-t-mid) ease-in-out;
  font-family: var(--v2-sans);
}

.v2-cmd {
  width: 560px;
  max-width: 92vw;
  max-height: 62vh;
  display: flex;
  flex-direction: column;
  background: var(--v2-surface);
  border: 1px solid var(--v2-border);
  border-radius: 14px;
  box-shadow: var(--v2-shadow-lg);
  overflow: hidden;
  animation: v2dropIn var(--v2-t-slow) var(--v2-ease-spring);
}

.v2-cmd-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--v2-border);
}

.v2-cmd-icon {
  font-size: 18px;
  color: var(--v2-accent);
}

.v2-cmd-input {
  flex: 1;
  font-size: 15px;
  color: var(--v2-text);
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
}

.v2-cmd-input::placeholder {
  color: var(--v2-text3);
}

.v2-cmd-clear {
  font-size: 12px;
  color: var(--v2-text3);
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  transition: all var(--v2-t-fast) ease-in-out;
}

.v2-cmd-clear:hover {
  background: var(--v2-surface2);
}

.v2-cmd-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.v2-cmd-list::-webkit-scrollbar {
  width: 5px;
}

.v2-cmd-list::-webkit-scrollbar-thumb {
  background: var(--v2-border);
  border-radius: 5px;
}

.v2-cmd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 7px;
  cursor: default;
  transition: background var(--v2-t-fast) ease-in-out;
  color: var(--v2-text);
}

.v2-cmd-item:hover,
.v2-cmd-sel {
  background: var(--v2-accent-dim);
}

.v2-cmd-sel .v2-cmd-item-label {
  color: var(--v2-accent);
}

.v2-cmd-item-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  flex-shrink: 0;
  background: var(--v2-surface2);
  border: 1px solid var(--v2-border);
  font-size: 11px;
  font-family: var(--v2-mono);
  color: var(--v2-text2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.v2-cmd-item-label {
  flex: 1;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.v2-cmd-shortcut {
  display: flex;
  gap: 2px;
  font-family: var(--v2-mono);
  font-size: 11px;
  color: var(--v2-text3);
  flex-shrink: 0;
}

.v2-cmd-shortcut kbd {
  font-family: var(--v2-mono);
  font-size: 10.5px;
  background: var(--v2-surface2);
  border: 1px solid var(--v2-border);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--v2-text2);
}

.v2-cmd-footer {
  padding: 8px 18px;
  border-top: 1px solid var(--v2-border);
  background: var(--v2-surface2);
  font-size: 11px;
  color: var(--v2-text3);
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  font-family: var(--v2-sans);
}
</style>
