import copyIcon from '../../assets/pngicon/copy/2.png'
import newIcon from '../../assets/pngicon/plus/2.png'
import deleteIcon from '../../assets/pngicon/delete/2.png'
import { isOsx } from '../../config'

const COMMAND_KEY = isOsx ? '⌘' : '⌃'

// 创建菜单的函数，接收翻译函数作为参数
export const createMenu = (t) => {
  // 如果没有翻译函数，直接返回键名
  const translate = t || ((key) => key)

  return [
    {
      icon: newIcon,
      label: 'new',
      text: translate('frontMenu.newParagraph'),
      shortCut: `⇧${COMMAND_KEY}N`
    },
    {
      icon: copyIcon,
      label: 'duplicate',
      text: translate('frontMenu.duplicate'),
      shortCut: `⇧${COMMAND_KEY}P`
    },
    {
      icon: deleteIcon,
      label: 'delete',
      text: translate('frontMenu.delete'),
      shortCut: `⇧${COMMAND_KEY}D`
    }
  ]
}

// 为了向后兼容，保留默认的 menu 导出
export const menu = createMenu()
