<template>
  <div class="side-bar-search">
    <div class="search-header">
      <span class="search-title">{{ t('sideBar.search.searchInTabsTitle', 'Cerca in tutte le tab') }}</span>
      <span
        class="search-close"
        :title="t('common.close', 'Chiudi')"
        @click="closeSidebar"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
        >
          <line
            x1="0"
            y1="0"
            x2="10"
            y2="10"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <line
            x1="10"
            y1="0"
            x2="0"
            y2="10"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </span>
    </div>
    <div class="search-wrapper">
      <input
        ref="searchEl"
        v-model="keyword"
        type="text"
        class="search-input"
        :placeholder="t('sideBar.search.searchInTabsPlaceholder', 'Search in all tabs...')"
        @input="onInput"
        @keydown.enter.prevent="onEnter"
      >
      <div class="controls">
        <span
          :title="t('search.caseSensitive')"
          class="is-case-sensitive"
          :class="{ active: isCaseSensitive }"
          @click.stop="caseSensitiveClicked()"
        >
          <FindCaseIcon aria-hidden="true" />
        </span>
        <span
          :title="t('search.wholeWord')"
          class="is-whole-word"
          :class="{ active: isWholeWord }"
          @click.stop="wholeWordClicked()"
        >
          <FindWordIcon aria-hidden="true" />
        </span>
        <span
          :title="t('search.useRegex')"
          class="is-regex"
          :class="{ active: isRegexp }"
          @click.stop="regexpClicked()"
        >
          <FindRegexIcon aria-hidden="true" />
        </span>
      </div>
    </div>

    <div
      v-if="showNoResultFoundMessage"
      class="search-message-section"
    >
      {{ t('sideBar.search.noResultsFound') }}
    </div>
    <div
      v-if="searchErrorString"
      class="search-message-section"
    >
      {{ searchErrorString }}
    </div>
    <div
      v-if="searchTruncated"
      class="search-message-section search-truncated-warning"
    >
      {{ t('search.tooManyResults', 'Too many results — refine your search') }}
    </div>

    <div
      v-if="searchResult.length"
      class="search-result-info"
    >
      {{ searchResultInfo }}
    </div>
    <div
      v-if="searchResult.length"
      class="search-result"
    >
      <search-result-item
        v-for="(item, index) of searchResult"
        :key="index"
        :search-result="item"
      />
    </div>
    <div
      v-else
      class="empty"
    >
      <div class="no-data" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'
import bus from '../../bus'
import SearchResultItem from './searchResultItem.vue'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const layoutStore = useLayoutStore()
const editorStore = useEditorStore()

const keyword = ref('')
const searchResult = ref([])
const searchErrorString = ref('')
// P-REV5: cap flag — set when results are truncated to avoid DOM freeze on broad searches
const searchTruncated = ref(false)
const isCaseSensitive = ref(false)
const isWholeWord = ref(false)
const isRegexp = ref(false)
const searchEl = ref(null)

const { rightColumn, showSideBar } = storeToRefs(layoutStore)
const { tabs, currentFile } = storeToRefs(editorStore)

const searchMatches = computed(() => currentFile.value?.searchMatches)

const searchResultInfo = computed(() => {
  const fileCount = searchResult.value.length
  const matchCount = searchResult.value.reduce((acc, item) => acc + item.matches.length, 0)
  return t('search.searchResultInfo', { matchCount, fileCount })
})

const showNoResultFoundMessage = computed(() => {
  return searchResult.value.length === 0 && keyword.value.length > 0
})

// Evidenzia il termine cercato anche nell'editor attivo (source: mark giallo; Muya: blu).
// preserveCursor=true → l'highlight in Muya deve ripristinare il caret corrente dell'utente
// (render(true)). Usato quando la ri-evidenziazione parte dall'editing del documento, così
// l'highlight si aggiorna live senza spostare il cursore. Quando invece si digita nella sidebar
// (preserveCursor=false) Muya NON ripristina il caret editor → non ruba il focus all'input.
const emitEditorHighlight = (preserveCursor = false) => {
  // try/catch: un listener che lancia (es. editor non pronto) NON deve interrompere la search.
  try {
    bus.emit('sidebar-highlight', {
      value: keyword.value,
      opt: {
        isCaseSensitive: isCaseSensitive.value,
        isWholeWord: isWholeWord.value,
        isRegexp: isRegexp.value
      },
      preserveCursor
    })
  } catch (err) {
    // listener non pronto: ignora, la lista risultati è già aggiornata
  }
}

// emitHighlight=false → aggiorna SOLO la lista risultati, senza ri-evidenziare l'editor.
// Serve quando la ricerca riparte perché è cambiato il CONTENUTO della tab attiva: in Muya
// ri-evidenziare farebbe un render() che ricostruisce il DOM e ruberebbe il cursore mentre si scrive.
// P-REV5: caps to avoid DOM freeze on very broad searches (e.g. searching "e" across 30 tabs)
const MAX_MATCHES_PER_TAB = 500
const MAX_MATCHES_TOTAL = 2000

const search = (emitHighlight = true, preserveCursor = false) => {
  searchErrorString.value = ''
  searchTruncated.value = false
  if (!keyword.value) {
    searchResult.value = []
    if (emitHighlight) emitEditorHighlight(preserveCursor)
    return
  }

  let pattern
  try {
    if (isRegexp.value) {
      pattern = new RegExp(keyword.value, isCaseSensitive.value ? 'g' : 'gi')
    } else {
      const escaped = keyword.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const wb = isWholeWord.value ? '\\b' : ''
      pattern = new RegExp(`${wb}${escaped}${wb}`, isCaseSensitive.value ? 'g' : 'gi')
    }
  } catch (err) {
    searchErrorString.value = String(err)
    searchResult.value = []
    if (emitHighlight) emitEditorHighlight(preserveCursor)
    return
  }

  const results = []
  let totalMatches = 0
  let truncated = false
  for (const tab of tabs.value) {
    if (truncated) break
    const text = tab.markdown || ''
    const lines = text.split('\n')
    const matches = []
    for (let i = 0; i < lines.length; i++) {
      if (truncated) break
      const line = lines[i]
      pattern.lastIndex = 0
      let m
      while ((m = pattern.exec(line)) !== null) {
        matches.push({
          lineText: line,
          range: [[i, m.index], [i, m.index + m[0].length]]
        })
        // prevent infinite loop on zero-length match
        if (m[0].length === 0) pattern.lastIndex++
        totalMatches++
        if (matches.length >= MAX_MATCHES_PER_TAB || totalMatches >= MAX_MATCHES_TOTAL) {
          truncated = true
          break
        }
      }
    }
    if (matches.length) {
      results.push({
        filePath: tab.pathname || tab.filename,
        tabId: tab.id,
        matches
      })
    }
  }
  searchTruncated.value = truncated
  searchResult.value = results
  if (emitHighlight) emitEditorHighlight(preserveCursor)
}

// Realtime: ogni cambio della keyword rilancia la ricerca.
watch(keyword, () => search())

// Fallback diretto dall'evento DOM: garantisce la live search anche se il watch non scattasse
// (es. v-model/reattività non aggiornano keyword). onInput legge il valore reale dell'input.
const onInput = (event) => {
  // Se per qualche motivo v-model non ha aggiornato keyword, lo allineo a mano.
  // P-REV4: niente search() qui — watch(keyword) scatta già dall'assegnazione (evita doppia ricerca).
  if (keyword.value !== event.target.value) keyword.value = event.target.value
}

// Invio nell'input: lancia/riconferma la ricerca.
const onEnter = () => {
  search()
}

// P-REV3 + M-REV1: ri-lancia la ricerca live quando cambia il CONTENUTO delle tab. Invece di
// concatenare tutti i tab.markdown ad ogni keystroke (costoso con molte tab; conteneva anche un
// byte NUL grezzo nel sorgente), osserviamo un contatore O(1) bumpato in LISTEN_FOR_CONTENT_CHANGE,
// con debounce 250ms. NB: source mode e gia debounced ~1s a monte; Muya quasi immediato.
let contentDebounce = null
watch(
  () => editorStore.contentVersion,
  () => {
    if (!keyword.value || !showSideBar.value) return
    clearTimeout(contentDebounce)
    contentDebounce = setTimeout(() => search(true, true), 250)
  }
)

// M-REV9: merged into the watch(showSideBar) below (was duplicated)

const handleFindInFolder = (executeSearch = true) => {
  nextTick(() => {
    if (searchEl.value) {
      searchEl.value.focus()
      const { selectedText } = searchMatches.value || {}
      if (selectedText) {
        keyword.value = selectedText
        if (executeSearch) search()
      }
    }
  })
}

const caseSensitiveClicked = () => {
  isCaseSensitive.value = !isCaseSensitive.value
  search()
}

const wholeWordClicked = () => {
  isWholeWord.value = !isWholeWord.value
  search()
}

const regexpClicked = () => {
  isRegexp.value = !isRegexp.value
  search()
}

// Chiude la sidebar di ricerca (X col mouse). Stesso effetto del 2° click sull'icona.
const closeSidebar = () => {
  bus.emit('sidebar-highlight', { value: '', opt: {} }) // pulisce le evidenziazioni nell'editor
  layoutStore.SET_LAYOUT({ rightColumn: '', showSideBar: false })
}

// M-REV9: single watch(showSideBar) covering both: close highlight clear + open focus/blur.
watch(showSideBar, (value, oldValue) => {
  if (!value) {
    // Sidebar closed: clear editor highlights regardless of column
    bus.emit('sidebar-highlight', { value: '', opt: {} })
  }
  if (rightColumn.value === 'search') {
    if (value && !oldValue) {
      handleFindInFolder(false)
    } else if (!value) {
      bus.emit('search-blur')
    }
  }
})

// Imposta la keyword dalla selezione editor (Ctrl+F/Ctrl+Shift+F su selezione) e cerca.
const handleSidebarSearchSet = (text) => {
  if (typeof text !== 'string' || !text) return
  const changed = keyword.value !== text
  keyword.value = text
  // Se il valore non cambia, il watch non scatta → forziamo la ricerca.
  if (!changed) search()
  nextTick(() => {
    if (searchEl.value) searchEl.value.focus()
  })
}

// Un editor source appena montato (cambio tab) chiede di ri-evidenziare i match, perché
// il remount ha perso i mark. Rispondiamo solo se la ricerca sidebar è attiva.
const handleRequestHighlight = () => {
  if (keyword.value && showSideBar.value && rightColumn.value === 'search') {
    emitEditorHighlight()
  }
}

onMounted(() => {
  handleFindInFolder()
  bus.on('findInFolder', handleFindInFolder)
  bus.on('sidebar-search-set', handleSidebarSearchSet)
  bus.on('request-search-highlight', handleRequestHighlight)
})

onBeforeUnmount(() => {
  bus.off('findInFolder', handleFindInFolder)
  bus.off('sidebar-search-set', handleSidebarSearchSet)
  bus.off('request-search-highlight', handleRequestHighlight)
  clearTimeout(contentDebounce)
})
</script>

<style scoped>
.side-bar-search {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.search-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px 0;
}
.search-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sideBarColor);
}
.search-close {
  cursor: pointer;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--sideBarColor);
}
.search-close:hover {
  background: var(--floatHoverColor);
  color: var(--highlightThemeColor);
}
.search-wrapper {
  display: flex;
  margin: 10px 15px;
  padding: 0 6px;
  border-radius: 14px;
  height: 28px;
  border: 1px solid var(--floatBorderColor);
  background: var(--inputBgColor);
  box-sizing: border-box;
  align-items: center;
  & > input {
    color: var(--sideBarColor);
    background: transparent;
    height: 100%;
    flex: 1;
    border: none;
    outline: none;
    padding: 0 8px;
    font-size: 13px;
    width: 50%;
  }
  & > .controls {
    display: flex;
    flex-shrink: 0;
    margin-top: 3px;
    & > span {
      cursor: pointer;
      width: 20px;
      height: 20px;
      margin-left: 2px;
      margin-right: 2px;
      &:hover {
        color: var(--sideBarIconColor);
      }
      & > svg {
        fill: var(--sideBarIconColor);
        &:hover {
          fill: var(--highlightThemeColor);
        }
      }
      &.active svg {
        fill: var(--highlightThemeColor);
      }
    }
  }

  & > svg {
    cursor: pointer;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-right: 10px;
    &:hover {
      color: var(--sideBarIconColor);
    }
  }
}
.search-message-section {
  overflow-wrap: break-word;
}
.search-result-info,
.search-message-section {
  padding-left: 15px;
  margin-bottom: 5px;
  font-size: 12px;
  color: var(--sideBarColor);
}
.empty,
.search-result {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  &::-webkit-scrollbar:vertical {
    width: 8px;
  }
}
.empty {
  font-size: 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding-bottom: 100px;
  & .no-data {
    display: flex;
    align-items: center;
    flex-direction: column;
  }
}
</style>
