import copyIcon from '../../assets/pngicon/copy/2.png'
import newIcon from '../../assets/pngicon/plus/2.png'
import deleteIcon from '../../assets/pngicon/delete/2.png'

// 创建菜单的函数，接收翻译函数作为参数
// `commandId` associa esplicitamente ogni voce al comando reale (vedi keybindings*.js in
// src/main/keyboard): la label shortcut visualizzata viene calcolata a runtime dal chiamante
// tramite `muya.options.getShortcut(commandId)`, non più hardcoded qui.
export const createMenu = (t) => {
  // 如果没有翻译函数，直接返回键名
  const translate = t || ((key) => key)

  return [
    {
      icon: newIcon,
      label: 'new',
      text: translate('frontMenu.newParagraph'),
      commandId: 'edit.create-paragraph'
    },
    {
      icon: copyIcon,
      label: 'duplicate',
      text: translate('frontMenu.duplicate'),
      commandId: 'edit.duplicate'
    },
    {
      icon: deleteIcon,
      label: 'delete',
      text: translate('frontMenu.delete'),
      commandId: 'edit.delete-paragraph'
    }
  ]
}

// 为了向后兼容，保留默认的 menu 导出
export const menu = createMenu()
