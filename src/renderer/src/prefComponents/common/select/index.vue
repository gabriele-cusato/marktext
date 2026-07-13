<template>
  <section
    class="pref-select-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div
      v-if="description"
      class="description"
      style="display: flex; align-items: center"
    >
      <span>{{ description }}:</span>
      <InfoFilled
        v-if="more"
        width="16"
        height="16"
        @click="handleMoreClick"
      />
    </div>
    <el-select
      v-model="selectValue"
      :disabled="disable"
      :teleported="false"
      :popper-options="popperOptions"
      @change="select"
    >
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  description: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  value: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  onChange: {
    type: Function,
    default: () => {}
  },
  more: {
    type: String,
    default: ''
  },
  disable: {
    type: Boolean,
    default: false
  }
})

const selectValue = ref(props.value)

// Il pannello Preferences è il settings modal v2 dentro la finestra principale, con body
// scrollabile (`.v2-settings-body`, overflow-y: auto). Con `teleported=false` il dropdown
// viene reso inline accanto al trigger invece che su body: così resta DENTRO il riquadro
// (clippato dai suoi bordi, segue lo scroll) e, se sborda in basso, allunga la scrollHeight
// del pannello — le voci in eccesso si raggiungono scrollando, senza coprire il contenuto.
// Il flip va disabilitato (apertura sempre verso il basso) e preventOverflow NON va usato:
// un clamp alla viewport contrasterebbe il comportamento "estendi sotto e scrolla".
const popperOptions = {
  placement: 'bottom-start',
  modifiers: [
    {
      name: 'flip',
      enabled: false
    }
  ]
}

watch(
  () => props.value,
  (value, oldValue) => {
    if (value !== oldValue) {
      selectValue.value = value
    }
  }
)

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

const select = (value) => {
  props.onChange(value)
}
</script>

<style>
.pref-select-item {
  margin: 20px 0;
  font-size: 14px;
  color: var(--editorColor);
  & .notes {
    margin-top: 10px;
    font-style: italic;
    font-size: 12px;
  }
  & .el-select {
    width: 100%;
  }
  & div {
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  & input.el-input__inner {
    height: 30px;
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  & .el-input__icon,
  & .el-input__inner {
    line-height: 30px;
  }
}
.pref-select-item .description {
  margin-bottom: 10px;
  & svg {
    margin-left: 4px;
    cursor: pointer;
    opacity: 0.7;
    color: var(--iconColor);
  }
  & svg:hover {
    color: var(--themeColor);
  }
}
li.el-select-dropdown__item {
  color: var(--editorColor);
  height: 30px;
}
/* `is-hovering` è la classe con cui Element Plus 2.x evidenzia la voce attiva (torna sulla
   voce selezionata quando il mouse esce dalla dropdown): senza questo override resterebbe
   il suo default chiaro --el-fill-color-light, illeggibile con i temi scuri */
li.el-select-dropdown__item.is-hovering,
li.el-select-dropdown__item:hover {
  background: var(--floatHoverColor);
}
div.el-select-dropdown {
  background: var(--floatBgColor);
  border-color: var(--floatBorderColor);
  & .popper__arrow {
    display: none;
  }
}
</style>
