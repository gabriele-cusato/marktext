import strongIcon from '../../assets/pngicon/format_strong/2.png'
import emphasisIcon from '../../assets/pngicon/format_emphasis/2.png'
import underlineIcon from '../../assets/pngicon/format_underline/2.png'
import codeIcon from '../../assets/pngicon/code/2.png'
import imageIcon from '../../assets/pngicon/format_image/2.png'
import linkIcon from '../../assets/pngicon/format_link/2.png'
import strikeIcon from '../../assets/pngicon/format_strike/2.png'
import mathIcon from '../../assets/pngicon/format_math/2.png'
import highlightIcon from '../../assets/pngicon/highlight/2.png'
import clearIcon from '../../assets/pngicon/format_clear/2.png'

// `commandId` associa esplicitamente ogni voce al comando reale (vedi keybindings*.js in
// src/main/keyboard): la label shortcut nel tooltip viene calcolata a runtime dal chiamante
// tramite `muya.options.getShortcut(commandId)`, non più hardcoded qui.
const icons = [
  {
    type: 'strong',
    tooltip: 'Bold',
    commandId: 'format.strong',
    icon: strongIcon
  },
  {
    type: 'em',
    tooltip: 'Italic',
    commandId: 'format.emphasis',
    icon: emphasisIcon
  },
  {
    type: 'u',
    tooltip: 'Underline',
    commandId: 'format.underline',
    icon: underlineIcon
  },
  {
    type: 'del',
    tooltip: 'Strikethrough',
    commandId: 'format.strike',
    icon: strikeIcon
  },
  {
    type: 'mark',
    tooltip: 'Highlight',
    commandId: 'format.highlight',
    icon: highlightIcon
  },
  {
    type: 'inline_code',
    tooltip: 'Inline Code',
    commandId: 'format.inline-code',
    icon: codeIcon
  },
  {
    type: 'inline_math',
    tooltip: 'Inline Math',
    commandId: 'format.inline-math',
    icon: mathIcon
  },
  {
    type: 'link',
    tooltip: 'Link',
    commandId: 'format.hyperlink',
    icon: linkIcon
  },
  {
    type: 'image',
    tooltip: 'Image',
    commandId: 'format.image',
    icon: imageIcon
  },
  {
    type: 'clear',
    tooltip: 'Clear Formatting',
    commandId: 'format.clear-format',
    icon: clearIcon
  }
]

export default icons
