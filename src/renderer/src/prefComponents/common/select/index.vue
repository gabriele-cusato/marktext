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
      :fallback-placements="fallbackPlacements"
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

// Il pannello Preferences vive dentro `.pref-container` (position: fixed): il modifier flip di
// popper.js in questo contesto calcola male lo spazio disponibile e ribalta il dropdown a
// `top`/`top-start`, facendolo finire sopra il bordo alto della finestra (verificato a runtime:
// i popper "buggati" restano con data-popper-placement=top-start). Limitare i fallback o il
// rootBoundary non basta: qui si DISABILITA il flip — il dropdown si apre sempre verso il basso
// e preventOverflow (vincolato alla viewport) lo tiene comunque dentro la finestra.
const fallbackPlacements = ['bottom-start']
const popperOptions = {
  placement: 'bottom-start',
  modifiers: [
    {
      name: 'flip',
      enabled: false
    },
    {
      name: 'preventOverflow',
      options: {
        rootBoundary: 'viewport',
        // altAxis: per un popper piazzato in basso l'asse verticale è quello "alternativo" —
        // senza questo flag il dropdown può sforare il bordo basso della finestra Preferences
        // (misurato a runtime: popper 618→692 in una finestra alta 650) e restare tagliato
        altAxis: true,
        // consentire lo scorrimento oltre il trigger pur di restare visibile (liste lunghe
        // con trigger vicino al fondo della finestra)
        tether: false
      }
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
li.el-select-dropdown__item.hover,
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
