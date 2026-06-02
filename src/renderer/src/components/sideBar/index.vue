<template>
  <div
    v-show="showSideBar"
    ref="sideBar"
    class="side-bar"
    :style="[!rightColumn ? { 'min-width': '45px' } : {}, { width: `${finalSideBarWidth}px` }]"
  >
    <div class="left-column">
      <ul>
        <li
          v-for="(c, index) of sideBarIcons"
          :key="index"
          :class="{ active: c.id === rightColumn }"
          @click="handleLeftIconClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
      <ul class="bottom">
        <li
          v-for="(c, index) of sideBarBottomIcons"
          :key="index"
          @click="handleLeftBottomClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
    </div>
    <div
      v-show="rightColumn"
      class="right-column"
    >
      <side-bar-search />
    </div>
    <div
      v-show="rightColumn"
      ref="dragBar"
      class="drag-bar"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { useProjectStore } from '@/store/project'

import { sideBarIcons, sideBarBottomIcons } from './help'
import SideBarSearch from './search.vue'
import { storeToRefs } from 'pinia'

const layoutStore = useLayoutStore()
const projectStore = useProjectStore()

const sideBar = ref(null)
const dragBar = ref(null)

const sideBarViewWidth = ref(280)

const { rightColumn, showSideBar, sideBarWidth } = storeToRefs(layoutStore)

const finalSideBarWidth = computed(() => {
  if (!showSideBar.value) return 0
  if (rightColumn.value === '') return 45
  return sideBarViewWidth.value < 220 ? 220 : sideBarViewWidth.value
})

onMounted(() => {
  nextTick(() => {
    const dragBarEl = dragBar.value
    let startX = 0
    let currentSideBarWidth = +sideBarWidth.value
    let startWidth = currentSideBarWidth

    sideBarViewWidth.value = currentSideBarWidth

    const mouseUpHandler = () => {
      document.removeEventListener('mousemove', mouseMoveHandler, false)
      document.removeEventListener('mouseup', mouseUpHandler, false)
      layoutStore.CHANGE_SIDE_BAR_WIDTH(currentSideBarWidth < 220 ? 220 : currentSideBarWidth)
    }

    const mouseMoveHandler = (event) => {
      // Sidebar a destra con handle a sinistra: trascinare verso sinistra (clientX cala)
      // deve AUMENTARE la larghezza → offset invertito.
      const offset = event.clientX - startX
      currentSideBarWidth = startWidth - offset
      sideBarViewWidth.value = currentSideBarWidth
    }

    const mouseDownHandler = (event) => {
      startX = event.clientX
      startWidth = +sideBarWidth.value
      document.addEventListener('mousemove', mouseMoveHandler, false)
      document.addEventListener('mouseup', mouseUpHandler, false)
    }

    dragBarEl.addEventListener('mousedown', mouseDownHandler, false)
  })
})

const handleLeftIconClick = (name) => {
  if (showSideBar.value && rightColumn.value === name) {
    // secondo click sulla stessa icona → chiude del tutto la sidebar
    layoutStore.SET_LAYOUT({ rightColumn: '', showSideBar: false })
  } else {
    layoutStore.SET_LAYOUT({ rightColumn: name, showSideBar: true })
    sideBarViewWidth.value = +sideBarWidth.value
  }
}

const handleLeftBottomClick = (name) => {
  if (name === 'settings') {
    projectStore.OPEN_SETTING_WINDOW()
  }
}
</script>

<style scoped>
.side-bar {
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  width: 280px;
  height: 100%;
  min-width: 220px;
  position: relative;
  color: var(--sideBarColor);
  user-select: none;
  background: var(--sideBarBgColor);
  /* Sidebar ora ancorata a DESTRA → bordo sul lato sinistro (verso l'editor) */
  border-left: 1px solid var(--itemBgColor);
}

.side-bar .left-column svg {
  fill: var(--iconColor);
}

.left-column {
  height: 100%;
  width: 45px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

.left-column > ul {
  opacity: 1;
}

.left-column ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}

.left-column ul > li {
  width: 45px;
  height: 45px;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  cursor: pointer;
}

.left-column ul > li > svg {
  width: 18px;
  height: 18px;
  fill: var(--sideBarIconColor);
  opacity: 1;
  transition: transform 0.25s ease-in-out;
}

.left-column ul > li.active > svg {
  fill: var(--themeColor);
}

.side-bar:hover .left-column ul li svg {
  opacity: 1;
}

.right-column {
  flex: 1;
  width: calc(100% - 50px);
  overflow: hidden;
}

.drag-bar {
  /* Sidebar a destra → handle di resize sul bordo SINISTRO */
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  height: 100%;
  width: 3px;
  cursor: col-resize;
}

.drag-bar:hover {
  border-left: 2px solid var(--iconColor);
}
</style>
