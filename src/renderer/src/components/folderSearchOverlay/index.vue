<template>
  <Teleport to="body">
    <div
      v-if="show"
      :class="['v2-fs-backdrop', { 'v2-closing': closing }]"
      @mousedown.self="close"
    >
      <div
        :class="['v2-fs', { 'v2-closing': closing }]"
        @mousedown.stop
      >
        <div class="v2-fs-header">
          <span class="v2-fs-title">Search in Folder</span>
          <button
            class="v2-fs-close"
            title="Chiudi (Esc)"
            @click="close"
          >
            ✕
          </button>
        </div>

        <div class="v2-fs-body">
          <label
            class="v2-fs-label"
            for="v2-fs-directory"
          >Cartella</label>
          <!-- folder-search-task4 (fix runtime): bottone "Sfoglia" aggiunto in fondo al campo,
               apre il dialog di sistema via canale IPC dedicato `mt::folder-search-select-directory`
               (invoke generico che ritorna il percorso al chiamante, distinto dagli altri dialog
               `.on` fire-and-forget che scrivono direttamente in una preferenza). -->
          <div class="v2-fs-directory-row">
            <input
              id="v2-fs-directory"
              ref="directoryInput"
              v-model="directory"
              class="v2-fs-input"
              type="text"
              placeholder="Percorso della cartella..."
              :disabled="busy"
              @keydown.enter="submit"
            >
            <button
              class="v2-fs-browse"
              type="button"
              title="Sfoglia..."
              :disabled="busy"
              @click="browseDirectory"
            >
              …
            </button>
          </div>

          <label
            class="v2-fs-label"
            for="v2-fs-query"
          >Cerca</label>
          <input
            id="v2-fs-query"
            v-model="query"
            class="v2-fs-input"
            type="text"
            placeholder="Testo o pattern da cercare..."
            :disabled="busy"
            @keydown.enter="submit"
          >

          <div class="v2-fs-checks">
            <label class="v2-fs-check">
              <input
                v-model="isCaseSensitive"
                type="checkbox"
                :disabled="busy"
              >
              Case sensitive
            </label>
            <label class="v2-fs-check">
              <input
                v-model="isWholeWord"
                type="checkbox"
                :disabled="busy"
              >
              Whole word
            </label>
            <label class="v2-fs-check">
              <input
                v-model="isRegexp"
                type="checkbox"
                :disabled="busy"
              >
              Regex
            </label>
          </div>

          <label
            class="v2-fs-label"
            for="v2-fs-exclusions"
          >Esclusioni (opzionale)</label>
          <textarea
            id="v2-fs-exclusions"
            v-model="exclusionsText"
            class="v2-fs-textarea"
            rows="2"
            placeholder="Es: *.log, *.min.js&#10;*.log&#10;node_modules/**&#10;(vuoto = usa la preferenza)"
            :disabled="busy"
          />

          <p
            v-if="errorMessage"
            class="v2-fs-error"
          >
            {{ errorMessage }}
          </p>
          <p
            v-if="emptyMessage"
            class="v2-fs-empty"
          >
            {{ emptyMessage }}
          </p>
        </div>

        <div class="v2-fs-footer">
          <span class="v2-fs-hint">esc close</span>
          <button
            class="v2-fs-run"
            :disabled="!canSubmit || busy"
            @click="submit"
          >
            <span
              v-if="busy"
              class="v2-fs-spinner"
              aria-hidden="true"
            />
            <span>{{ busy ? 'Ricerca...' : 'Esegui' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import bus from '../../bus'

// folder-search-task4: il campo esclusioni resta precompilato vuoto — la preferenza
// `searchExclusions` si applica lato main quando `exclusions` è assente dalla richiesta
// (vedi task1/task2), qui non serve leggerla.
const show = ref(false)
const closing = ref(false)
const directory = ref('')
const query = ref('')
const isCaseSensitive = ref(false)
const isWholeWord = ref(false)
const isRegexp = ref(false)
const exclusionsText = ref('')
const busy = ref(false)
const errorMessage = ref('')
const emptyMessage = ref('')
const directoryInput = ref(null)
let closeTimer = null

const canSubmit = computed(() => directory.value.trim().length > 0 && query.value.trim().length > 0)

// Apertura: azzera solo i messaggi di esito della ricerca precedente, i campi
// (cartella/query/opzioni) restano valorizzati tra un'apertura e l'altra per
// comodità (ricerche successive sulla stessa cartella).
const open = () => {
  closing.value = false
  show.value = true
  errorMessage.value = ''
  emptyMessage.value = ''
  nextTick(() => {
    if (directoryInput.value) directoryInput.value.focus()
  })
}

// Chiusura bloccata mentre la ricerca è in corso (evita di perdere l'invoke pendente
// senza feedback): stesso principio del busy-state sul bottone Esegui.
const close = () => {
  if (busy.value) return
  closing.value = true
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    show.value = false
    closing.value = false
  }, 220)
}

// folder-search-task4 (fix runtime): bottone "Sfoglia" — invoca il dialog di sistema e
// valorizza il campo cartella col percorso scelto (nessuna azione se l'utente annulla).
const browseDirectory = async () => {
  if (busy.value) return
  try {
    const selectedPath = await window.electron.ipcRenderer.invoke('mt::folder-search-select-directory')
    if (selectedPath) directory.value = selectedPath
  } catch (error) {
    errorMessage.value = (error && error.message) || 'Selezione cartella non riuscita.'
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && show.value) {
    e.preventDefault()
    close()
  }
}

// Validazione + invoke (folder-search-task4, sottoproblemi 3-4): cartella e query non
// vuote (gate già sul disabled del bottone, ribadito qui per il submit da Enter);
// esito ok:false → errore nel riquadro; empty:true → messaggio "nessun risultato";
// ok:true → chiude l'overlay (la finestra nuova la apre il main).
const submit = async () => {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  errorMessage.value = ''
  emptyMessage.value = ''

  // Esclusioni: se il campo è compilato, split su virgola/a-capo (override una-tantum
  // rispetto alla preferenza); se vuoto, `undefined` → il main usa `searchExclusions`.
  const trimmedExclusions = exclusionsText.value.trim()
  const exclusions = trimmedExclusions
    ? trimmedExclusions.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
    : undefined

  try {
    const result = await window.electron.ipcRenderer.invoke('mt::open-folder-search-window', {
      directory: directory.value.trim(),
      query: query.value,
      options: {
        isCaseSensitive: isCaseSensitive.value,
        isWholeWord: isWholeWord.value,
        isRegexp: isRegexp.value,
        exclusions
      }
    })
    if (!result || !result.ok) {
      errorMessage.value = (result && result.error) || 'Ricerca non riuscita.'
      return
    }
    if (result.empty) {
      emptyMessage.value = 'Nessun risultato.'
      return
    }
    close()
  } catch (error) {
    errorMessage.value = (error && error.message) || 'Ricerca non riuscita.'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  bus.on('show-folder-search', open)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  bus.off('show-folder-search', open)
  window.removeEventListener('keydown', handleKeydown)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<style scoped>
/* ── v2 Folder search overlay — stesso pattern del command palette (backdrop
     trasparente + pannello centrato, animazioni v2fadeIn/v2dropIn globali). ── */
.v2-fs-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: transparent;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 11vh;
  animation: v2fadeIn var(--v2-t-mid) ease-in-out;
  font-family: var(--v2-sans);
  transition: opacity 220ms ease-in-out;
}

.v2-fs-backdrop.v2-closing {
  opacity: 0;
  pointer-events: none;
}

.v2-fs {
  width: 440px;
  max-width: 92vw;
  display: flex;
  flex-direction: column;
  background: var(--v2-surface);
  border: 1px solid var(--v2-border);
  border-radius: 14px;
  box-shadow: var(--v2-shadow-lg);
  overflow: hidden;
  animation: v2dropIn var(--v2-t-slow) var(--v2-ease-spring);
}

.v2-fs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--v2-border);
}

.v2-fs-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v2-text);
}

.v2-fs-close {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: none;
  color: var(--v2-text3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: background var(--v2-t-fast) ease-in-out;
}

.v2-fs-close:hover {
  background: var(--v2-surface2);
}

.v2-fs-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
}

.v2-fs-label {
  font-size: 11.5px;
  color: var(--v2-text2);
  margin-top: 6px;
}

.v2-fs-label:first-child {
  margin-top: 0;
}

.v2-fs-input,
.v2-fs-textarea {
  font-size: 13px;
  color: var(--v2-text);
  background: var(--v2-surface2);
  border: 1px solid var(--v2-border);
  border-radius: 7px;
  padding: 7px 10px;
  outline: none;
  font-family: inherit;
  transition: border-color var(--v2-t-fast) ease-in-out;
}

.v2-fs-textarea {
  resize: vertical;
  min-height: 40px;
}

/* Riga cartella + bottone "Sfoglia" (folder-search-task4, fix runtime). */
.v2-fs-directory-row {
  display: flex;
  gap: 6px;
}

.v2-fs-directory-row .v2-fs-input {
  flex: 1;
  min-width: 0;
}

.v2-fs-browse {
  flex-shrink: 0;
  width: 32px;
  border-radius: 7px;
  border: 1px solid var(--v2-border);
  background: var(--v2-surface2);
  color: var(--v2-text2);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background var(--v2-t-fast) ease-in-out;
}

.v2-fs-browse:hover:not(:disabled) {
  background: var(--v2-surface);
}

.v2-fs-browse:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.v2-fs-input:focus,
.v2-fs-textarea:focus {
  border-color: var(--v2-accent);
}

.v2-fs-input:disabled,
.v2-fs-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.v2-fs-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 4px;
}

.v2-fs-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--v2-text2);
  cursor: pointer;
}

.v2-fs-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: #ef4444;
}

.v2-fs-empty {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--v2-text2);
}

.v2-fs-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--v2-border);
  background: var(--v2-surface2);
}

.v2-fs-hint {
  font-size: 11px;
  color: var(--v2-text3);
}

.v2-fs-run {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 7px;
  border: none;
  background: var(--v2-accent);
  color: #fff;
  font-size: 12.5px;
  cursor: pointer;
  transition: opacity var(--v2-t-fast) ease-in-out;
}

.v2-fs-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Busy state (folder-search-task4, sottoproblema 4): spinner CSS inline nel bottone
   Esegui, la ricerca su cartelle grandi può durare secondi. */
.v2-fs-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: v2-fs-spin 0.7s linear infinite;
}

@keyframes v2-fs-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
