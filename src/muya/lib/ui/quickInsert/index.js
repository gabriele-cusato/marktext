import { filter } from 'fuzzaldrin'
import { patch, h } from '../../parser/render/snabbdom'
import { deepCopy } from '../../utils'
import BaseScrollFloat from '../baseScrollFloat'
import { createQuickInsertObj } from './config'
import './index.css'

class QuickInsert extends BaseScrollFloat {
  static pluginName = 'quickInsert'

  constructor(muya) {
    const name = 'ag-quick-insert'
    super(muya, name)
    this.reference = null
    this.oldVnode = null
    this._renderObj = null
    this.renderArray = null
    this.activeItem = null
    this.block = null
    // Esito dell'ultimo `checkQuickInsert` (vedi contentState/inputCtrl.js): null quando il menu
    // è nascosto, altrimenti `{ atLineStart, tokenStart, tokenEnd }`. Usato per filtrare le voci
    // (solo inline a metà paragrafo) e per sapere dove rimuovere il token `@parola` alla selezione.
    this.matchInfo = null
    // 从muya.options中获取翻译函数，如果没有则使用默认配置
    const translateFn = muya.options && muya.options.t ? muya.options.t : null
    // riferimento pristino con l'elenco completo, usato come base da search() invece del sottoinsieme filtrato
    this.fullRenderObj = createQuickInsertObj(translateFn)
    this.renderObj = this.fullRenderObj
    this.render()
    this.listen()
  }

  get renderObj() {
    return this._renderObj
  }

  set renderObj(obj) {
    this._renderObj = obj
    const renderArray = []
    Object.keys(obj).forEach((key) => {
      renderArray.push(...obj[key])
    })
    this.renderArray = renderArray
    if (this.renderArray.length > 0) {
      this.activeItem = this.renderArray[0]
      const activeEle = this.getItemElement(this.activeItem)
      this.activeEleScrollIntoView(activeEle)
    }
  }

  render() {
    const { scrollElement, activeItem, _renderObj } = this
    let children = Object.keys(_renderObj)
      .filter((key) => {
        return _renderObj[key].length !== 0
      })
      .map((key) => {
        const titleVnode = h('div.title', key.toUpperCase())
        const items = []
        for (const item of _renderObj[key]) {
          const { title, subTitle, label, icon, commandId } = item
          // Label shortcut derivata dal binding reale (vuota se il comando non ne ha uno).
          const shortCut = commandId ? this.muya.options.getShortcut(commandId) : ''
          const iconVnode = h(
            'div.icon-container',
            h(
              'i.icon',
              h(
                `i.icon-${label.replace(/\s/g, '-')}`,
                {
                  style: {
                    background: `url(${icon}) no-repeat`,
                    'background-size': '100%'
                  }
                },
                ''
              )
            )
          )

          const description = h('div.description', [
            h('div.big-title', title),
            h('div.sub-title', subTitle)
          ])
          const shortCutVnode = h('div.short-cut', [h('span', shortCut)])
          const selector = activeItem.label === label ? 'div.item.active' : 'div.item'
          items.push(
            h(
              selector,
              {
                dataset: { label },
                on: {
                  click: () => {
                    this.selectItem(item)
                  }
                }
              },
              [iconVnode, description, shortCutVnode]
            )
          )
        }

        return h('section', [titleVnode, ...items])
      })

    if (children.length === 0) {
      children = h('div.no-result', 'No result')
    }
    const vnode = h('div', children)

    if (this.oldVnode) {
      patch(this.oldVnode, vnode)
    } else {
      patch(scrollElement, vnode)
    }
    this.oldVnode = vnode
  }

  listen() {
    super.listen()
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-quick-insert', (reference, block, status, matchInfo) => {
      if (status) {
        this.block = block
        this.matchInfo = matchInfo
        this.show(reference)
        // Testo di ricerca = il `parola` digitato dopo `@`, tra il token e il cursore. A inizio
        // blocco `tokenStart` è 0 e `tokenEnd` è la lunghezza del testo: equivale al vecchio
        // `block.text.substring(1)`.
        const { tokenStart, tokenEnd } = matchInfo
        this.search(block.text.substring(tokenStart + 1, tokenEnd))
      } else {
        this.matchInfo = null
        this.hide()
      }
    })
  }

  search(text) {
    const { contentState } = this.muya
    const canInserFrontMatter = contentState.canInserFrontMatter(this.block)
    // parte sempre dall'elenco completo pristino, non dal sottoinsieme filtrato dell'ultima ricerca
    const obj = deepCopy(this.fullRenderObj)
    if (!canInserFrontMatter) {
      // 查找包含 front-matter 的基础块分组
      const basicBlockKey = Object.keys(obj).find((key) => {
        const items = obj[key]
        return Array.isArray(items) && items.some((item) => item.label === 'front-matter')
      })
      if (basicBlockKey && obj[basicBlockKey]) {
        // 找到 front-matter 项的索引并移除
        const frontMatterIndex = obj[basicBlockKey].findIndex(
          (item) => item.label === 'front-matter'
        )
        if (frontMatterIndex !== -1) {
          obj[basicBlockKey].splice(frontMatterIndex, 1)
        }
      }
    }
    // `@` a metà paragrafo: mostrare solo le voci inline (le voci block convertono l'intero
    // blocco e hanno senso solo quando `@` è a inizio riga).
    const atLineStart = this.matchInfo ? this.matchInfo.atLineStart : true
    if (!atLineStart) {
      Object.keys(obj).forEach((key) => {
        obj[key] = obj[key].filter((item) => item.scope === 'inline')
      })
    }
    let result = obj
    if (text !== '') {
      result = {}
      Object.keys(obj).forEach((key) => {
        result[key] = filter(obj[key], text, { key: 'title' })
      })
    }
    this.renderObj = result
    this.render()
  }

  selectItem(item) {
    const { contentState } = this.muya
    // 检查 block 是否存在，避免 null 引用错误
    if (!this.block) {
      console.warn('QuickInsert: block is null, cannot select item')
      this.hide()
      return
    }
    if (item.scope === 'inline') {
      this.selectInlineItem(item)
      return
    }
    // Voci `block`: consentite solo quando `@` è a inizio riga (già garantito dal filtro in
    // `search()`, guard difensivo qui contro selezioni residue via tastiera/mouse).
    if (this.matchInfo && !this.matchInfo.atLineStart) {
      this.hide()
      return
    }
    this.block.text = ''
    const { key } = this.block
    const offset = 0
    contentState.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    switch (item.label) {
      case 'paragraph':
        contentState.partialRender()
        break
      default:
        contentState.updateParagraph(item.label, true)
        break
    }
    // delay hide to avoid dispatch enter hander
    setTimeout(this.hide.bind(this))
  }

  // Voci `inline` (formati come grassetto, corsivo, link, ...): a differenza delle voci `block`
  // NON si converte il blocco. Si rimuove solo il token `@parola` digitato e si applica il format
  // riusando `contentState.format(type)`, la stessa API usata da formatPicker (vedi
  // `ui/formatPicker/index.js` `selectItem`). `contentState.format` legge la selezione DOM
  // corrente (non `contentState.cursor`): per questo si aggiorna prima il testo del blocco,
  // si posiziona il cursore (collassato) al punto in cui era il token, e si fa un
  // `partialRender()` che sincronizza la selezione DOM su quel cursore, prima di chiamare
  // `format`. Con selezione collassata `format` inserisce i marker vuoti col cursore in mezzo
  // (stesso comportamento del toggle format da toolbar/scorciatoia su selezione vuota).
  selectInlineItem(item) {
    const { contentState } = this.muya
    if (!this.matchInfo) {
      this.hide()
      return
    }
    const { tokenStart, tokenEnd } = this.matchInfo
    const { key } = this.block
    const text = this.block.text
    this.block.text = text.slice(0, tokenStart) + text.slice(tokenEnd)
    contentState.cursor = {
      start: { key, offset: tokenStart },
      end: { key, offset: tokenStart }
    }
    contentState.partialRender()
    contentState.format(item.type)
    // delay hide to avoid dispatch enter hander (stesso motivo del ramo block sopra)
    setTimeout(this.hide.bind(this))
  }

  getItemElement(item) {
    const { label } = item
    return this.scrollElement.querySelector(`[data-label="${label}"]`)
  }
}

export default QuickInsert
