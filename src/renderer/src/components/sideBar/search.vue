<template>
  <div class="side-bar-search">
    <div class="search-header">
      <span class="search-title">{{ t('sideBar.search.searchInTabs', 'Cerca in tutte le tab') }}</span>
      <span
        class="search-close"
        :title="t('common.close', 'Chiudi')"
        @click="closeSidebar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </span>
    </div>
    <div class="search-wrapper">
      <input
        ref="searchEl"
        v-model="keyword"
        type="text"
        class="search-input"
        :placeholder="t('sideBar.search.searchInTabs', 'Search in all tabs...')"
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
const emitEditorHighlight = () => {
  bus.emit('sidebar-highlight', {
    value: keyword.value,
    opt: {
      isCaseSensitive: isCaseSensitive.value,
      isWholeWord: isWholeWord.value,
      isRegexp: isRegexp.value
    }
  })
}

const search = () => {
  searchErrorString.value = ''
  if (!keyword.value) {
    searchResult.value = []
    emitEditorHighlight()
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
    emitEditorHighlight()
    return
  }

  const results = []
  for (const tab of tabs.value) {
    const text = tab.markdown || ''
    const lines = text.split('\n')
    const matches = []
    for (let i = 0; i < lines.length; i++) {
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
  searchResult.value = results
  emitEditorHighlight()
}

// Realtime: ogni cambio della keyword rilancia la ricerca (più affidabile di @keyup/@input).
watch(keyword, () => search())

// Alla chiusura della sidebar (qualsiasi via) pulisci le evidenziazioni nell'editor.
watch(showSideBar, (value) => {
  if (!value) bus.emit('sidebar-highlight', { value: '', opt: {} })
})

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

watch(showSideBar, (value, oldValue) => {
  if (rightColumn.value === 'search') {
    if (value && !oldValue) {
      handleFindInFolder(false)
    } else {
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
