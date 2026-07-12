import { defineStore } from 'pinia'
import log from 'electron-log/renderer'
import bus from '../bus'
import staticCommands, { RootCommand, getCommandsWithDescriptions } from '../commands'
import { isOsx } from '../util'

export const useCommandCenterStore = defineStore('commandCenter', {
  state: () => ({
    rootCommand: new RootCommand(staticCommands),
    // Mappa commandId -> accelerator grezzo, ricevuta dal main via `mt::keybindings-response`.
    // Fonte unica anche per i menu Muya (front menu / quick insert / format picker), che la
    // leggono tramite il getter `getShortcut` invece di richiedere di nuovo i binding via IPC.
    keybindingMap: {}
  }),
  getters: {
    // Getter parametrico: restituisce la scorciatoia leggibile (es. "Ctrl+Shift+P") per un
    // commandId, oppure stringa vuota se il comando non ha un binding reale assegnato. Legge
    // `state` ad ogni chiamata, quindi resta valido anche se chiamato prima che i binding
    // arrivino via IPC (in quel caso ritorna '' finché la mappa non si popola).
    getShortcut: (state) => (commandId) => formatShortcutForDisplay(state.keybindingMap[commandId])
  },
  actions: {
    REGISTER_COMMAND(command) {
      this.rootCommand.subcommands.push(command)
    },
    SORT_COMMANDS() {
      this.rootCommand.subcommands.sort((a, b) => a.description.localeCompare(b.description))
    },
    async LISTEN_COMMAND_CENTER_BUS() {
      // Wait for initial language setup before initializing commands
      let isInitialized = false

      const initializeCommands = async () => {
        if (!isInitialized) {
          this.rootCommand.subcommands = await getCommandsWithDescriptions()
          this.SORT_COMMANDS()
          isInitialized = true
        }
      }

      // Listen for language changes and initialize/update command descriptions
      bus.on('language-changed', async () => {
        // Update all command descriptions when language changes
        this.rootCommand.subcommands = await getCommandsWithDescriptions()
        this.SORT_COMMANDS()
        isInitialized = true
      })

      // Delay initial setup to allow language initialization
      setTimeout(async () => {
        await initializeCommands()
      }, 100)

      // Init stuff
      bus.on('cmd::sort-commands', () => {
        this.SORT_COMMANDS()
      })
      window.electron.ipcRenderer.on('mt::keybindings-response', (e, keybindingMap) => {
        // Conserva la mappa grezza: è la fonte usata anche dal getter `getShortcut` (menu Muya).
        this.keybindingMap = keybindingMap
        const { subcommands } = this.rootCommand
        for (const entry of subcommands) {
          const value = keybindingMap[entry.id]
          if (value) {
            entry.shortcut = normalizeAccelerator(value)
          }
        }
      })

      // Register commands that are created at runtime.
      bus.on('cmd::register-command', (command) => {
        this.REGISTER_COMMAND(command)
      })

      // Allow other compontents to execute commands with predefined values.
      bus.on('cmd::execute', (commandId) => {
        executeCommand(this, commandId)
      })
      window.electron.ipcRenderer.on('mt::execute-command-by-id', (e, commandId) => {
        executeCommand(this, commandId)
      })
    }
  }
})

const executeCommand = (store, commandId) => {
  const { subcommands } = store.rootCommand
  const command = subcommands.find((c) => c.id === commandId)
  if (!command) {
    const errorMsg = `Cannot execute command "${commandId}" because it's missing.`
    log.error(errorMsg)
    throw new Error(errorMsg)
  }
  command.execute()
}

// Formatta un accelerator grezzo in una label leggibile per i menu Muya (es. "Ctrl+Shift+P"),
// senza glyph unicode. Gli accelerator dei file keybindings*.js usano già forme leggibili per
// piattaforma ("Ctrl"/"Command"); l'unico caso da normalizzare è l'alias "CmdOrCtrl" che un utente
// può usare nel proprio keybindings.json personalizzato (vedi shortcutHandler.js).
const formatShortcutForDisplay = (acc) => {
  if (!acc) {
    return ''
  }
  try {
    return acc.replace(/cmdorctrl/i, isOsx ? 'Cmd' : 'Ctrl')
  } catch (_) {
    return acc
  }
}

const normalizeAccelerator = (acc) => {
  try {
    return acc
      .replace(/cmdorctrl|cmd/i, 'Cmd')
      .replace(/ctrl/i, 'Ctrl')
      .split('+')
  } catch (_) {
    return [acc]
  }
}
