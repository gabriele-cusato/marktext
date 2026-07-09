import BaseFloat from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { createMenu } from './config'

import './index.css'

const defaultOptions = {
  placement: 'bottom',
  modifiers: {
    offset: {
      offset: '0, 10'
    }
  },
  showArrow: false
}

class FrontMenu extends BaseFloat {
  static pluginName = 'frontMenu'

  constructor(muya, options = {}) {
    const name = 'ag-front-menu'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.outmostBlock = null
    this.startBlock = null
    this.endBlock = null
    this.options = opts
    this.reference = null
    // 获取翻译函数
    this.t = opts.t || muya.options.t || ((key) => key)
    // 创建菜单
    this.menu = createMenu(this.t)
    const frontMenuContainer = (this.frontMenuContainer = document.createElement('div'))
    Object.assign(this.container.parentNode.style, {
      overflow: 'visible'
    })
    this.container.appendChild(frontMenuContainer)
    this.listen()
  }

  listen() {
    const { eventCenter } = this.muya
    super.listen()
    eventCenter.subscribe(
      'muya-front-menu',
      ({ reference, outmostBlock, startBlock, endBlock }) => {
        if (reference) {
          this.outmostBlock = outmostBlock
          this.startBlock = startBlock
          this.endBlock = endBlock
          this.reference = reference
          setTimeout(() => {
            this.show(reference)
            this.render()
          }, 0)
        } else {
          this.hide()
          this.reference = null
        }
      }
    )
  }

  render() {
    const { oldVnode, frontMenuContainer, outmostBlock } = this
    const { type, functionType } = outmostBlock
    const children = this.menu.map(({ icon, label, text, shortCut }) => {
      const iconWrapperSelector = 'div.icon-wrapper'
      const iconWrapper = h(
        iconWrapperSelector,
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
      const textWrapper = h('span', text)
      const shortCutWrapper = h('div.short-cut', [h('span', shortCut)])
      let itemSelector = `li.item.${label}`
      const itemChildren = [iconWrapper, textWrapper, shortCutWrapper]
      // front matter can not be duplicated.
      if (label === 'duplicate' && type === 'pre' && functionType === 'frontmatter') {
        itemSelector += '.disabled'
      }
      return h(
        itemSelector,
        {
          on: {
            click: (event) => {
              this.selectItem(event, { label })
            }
          }
        },
        itemChildren
      )
    })

    const vnode = h('ul', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(frontMenuContainer, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem(event, { label }) {
    event.preventDefault()
    event.stopPropagation()
    const { type, functionType } = this.outmostBlock
    // front matter can not be duplicated.
    if (label === 'duplicate' && type === 'pre' && functionType === 'frontmatter') {
      return
    }
    const { contentState } = this.muya
    contentState.selectedBlock = null
    switch (label) {
      case 'duplicate': {
        contentState.duplicate()
        break
      }
      case 'delete': {
        contentState.deleteParagraph()
        break
      }
      case 'new': {
        contentState.insertParagraph('after', '', true)
        break
      }
      default:
        contentState.updateParagraph(label)
        break
    }
    // delay hide to avoid dispatch enter hander
    setTimeout(this.hide.bind(this))
  }
}

export default FrontMenu
