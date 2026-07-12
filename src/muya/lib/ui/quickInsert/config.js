import paragraphIcon from '../../assets/pngicon/paragraph/2.png'
import htmlIcon from '../../assets/pngicon/html/2.png'
import hrIcon from '../../assets/pngicon/horizontal_line/2.png'
import frontMatterIcon from '../../assets/pngicon/front_matter/2.png'
import header1Icon from '../../assets/pngicon/heading_1/2.png'
import header2Icon from '../../assets/pngicon/heading_2/2.png'
import header3Icon from '../../assets/pngicon/heading_3/2.png'
import header4Icon from '../../assets/pngicon/heading_4/2.png'
import header5Icon from '../../assets/pngicon/heading_5/2.png'
import header6Icon from '../../assets/pngicon/heading_6/2.png'
import newTableIcon from '../../assets/pngicon/new_table/2.png'
import bulletListIcon from '../../assets/pngicon/bullet_list/2.png'
import codeIcon from '../../assets/pngicon/code/2.png'
import quoteIcon from '../../assets/pngicon/quote_block/2.png'
import todoListIcon from '../../assets/pngicon/todolist/2.png'
import mathblockIcon from '../../assets/pngicon/math/2.png'
import orderListIcon from '../../assets/pngicon/order_list/2.png'
import flowchartIcon from '../../assets/pngicon/flowchart/2.png'
import sequenceIcon from '../../assets/pngicon/sequence/2.png'
import plantumlIcon from '../../assets/pngicon/plantuml/2.png'
import mermaidIcon from '../../assets/pngicon/mermaid/2.png'
import vegaIcon from '../../assets/pngicon/chart/2.png'
// Icone riusate da formatPicker (stesso set format inline) per la sezione "inline" del menu "@".
import strongIcon from '../../assets/pngicon/format_strong/2.png'
import emphasisIcon from '../../assets/pngicon/format_emphasis/2.png'
import underlineIcon from '../../assets/pngicon/format_underline/2.png'
import strikeIcon from '../../assets/pngicon/format_strike/2.png'
import highlightIcon from '../../assets/pngicon/highlight/2.png'
import formatMathIcon from '../../assets/pngicon/format_math/2.png'
import formatLinkIcon from '../../assets/pngicon/format_link/2.png'
import formatImageIcon from '../../assets/pngicon/format_image/2.png'
// 创建一个函数来生成配置对象，接收翻译函数作为参数
// `commandId` associa esplicitamente ogni voce al comando reale (vedi keybindings*.js in
// src/main/keyboard): la label shortcut visualizzata viene calcolata a runtime dal chiamante
// tramite `muya.options.getShortcut(commandId)`, non più hardcoded qui. Le voci senza commandId
// non hanno un binding assegnabile da tastiera (solo click/ricerca) e restano senza label.
// `scope` distingue le voci che convertono l'intero blocco (`block`, comportamento storico,
// consentito solo quando `@` è a inizio riga) da quelle che applicano un format inline al testo
// (`inline`, disponibili anche quando `@` compare a metà paragrafo). Vedi quickInsert/index.js.
export const createQuickInsertObj = (t) => {
  // 如果没有翻译函数，直接返回键名
  const translate = t || ((key) => key)

  return {
    [translate('quickInsert.basicBlock')]: [
      {
        title: translate('quickInsert.paragraph.title'),
        subTitle: translate('quickInsert.paragraph.subtitle'),
        label: 'paragraph',
        commandId: 'paragraph.paragraph',
        icon: paragraphIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.horizontalLine.title'),
        subTitle: translate('quickInsert.horizontalLine.subtitle'),
        label: 'hr',
        commandId: 'paragraph.horizontal-line',
        icon: hrIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.frontMatter.title'),
        subTitle: translate('quickInsert.frontMatter.subtitle'),
        label: 'front-matter',
        commandId: 'paragraph.front-matter',
        icon: frontMatterIcon,
        scope: 'block'
      }
    ],
    [translate('quickInsert.header')]: [
      {
        title: translate('quickInsert.header1.title'),
        subTitle: translate('quickInsert.header1.subtitle'),
        label: 'heading 1',
        commandId: 'paragraph.heading-1',
        icon: header1Icon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.header2.title'),
        subTitle: translate('quickInsert.header2.subtitle'),
        label: 'heading 2',
        commandId: 'paragraph.heading-2',
        icon: header2Icon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.header3.title'),
        subTitle: translate('quickInsert.header3.subtitle'),
        label: 'heading 3',
        commandId: 'paragraph.heading-3',
        icon: header3Icon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.header4.title'),
        subTitle: translate('quickInsert.header4.subtitle'),
        label: 'heading 4',
        commandId: 'paragraph.heading-4',
        icon: header4Icon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.header5.title'),
        subTitle: translate('quickInsert.header5.subtitle'),
        label: 'heading 5',
        commandId: 'paragraph.heading-5',
        icon: header5Icon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.header6.title'),
        subTitle: translate('quickInsert.header6.subtitle'),
        label: 'heading 6',
        commandId: 'paragraph.heading-6',
        icon: header6Icon,
        scope: 'block'
      }
    ],
    [translate('quickInsert.advancedBlock')]: [
      {
        title: translate('quickInsert.tableBlock.title'),
        subTitle: translate('quickInsert.tableBlock.subtitle'),
        label: 'table',
        commandId: 'paragraph.table',
        icon: newTableIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.mathFormula.title'),
        subTitle: translate('quickInsert.mathFormula.subtitle'),
        label: 'mathblock',
        commandId: 'paragraph.math-formula',
        icon: mathblockIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.htmlBlock.title'),
        subTitle: translate('quickInsert.htmlBlock.subtitle'),
        label: 'html',
        commandId: 'paragraph.html-block',
        icon: htmlIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.codeBlock.title'),
        subTitle: translate('quickInsert.codeBlock.subtitle'),
        label: 'pre',
        commandId: 'paragraph.code-fence',
        icon: codeIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.quoteBlock.title'),
        subTitle: translate('quickInsert.quoteBlock.subtitle'),
        label: 'blockquote',
        commandId: 'paragraph.quote-block',
        icon: quoteIcon,
        scope: 'block'
      }
    ],
    [translate('quickInsert.listBlock')]: [
      {
        title: translate('quickInsert.orderedList.title'),
        subTitle: translate('quickInsert.orderedList.subtitle'),
        label: 'ol-order',
        commandId: 'paragraph.order-list',
        icon: orderListIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.bulletList.title'),
        subTitle: translate('quickInsert.bulletList.subtitle'),
        label: 'ul-bullet',
        commandId: 'paragraph.bullet-list',
        icon: bulletListIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.todoList.title'),
        subTitle: translate('quickInsert.todoList.subtitle'),
        label: 'ul-task',
        commandId: 'paragraph.task-list',
        icon: todoListIcon,
        scope: 'block'
      }
    ],
    [translate('quickInsert.diagram')]: [
      {
        title: translate('quickInsert.vegaChart.title'),
        subTitle: translate('quickInsert.vegaChart.subtitle'),
        label: 'vega-lite',
        icon: vegaIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.flowChart.title'),
        subTitle: translate('quickInsert.flowChart.subtitle'),
        label: 'flowchart',
        icon: flowchartIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.sequenceChart.title'),
        subTitle: translate('quickInsert.sequenceChart.subtitle'),
        label: 'sequence',
        icon: sequenceIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.plantUMLChart.title'),
        subTitle: translate('quickInsert.plantUMLChart.subtitle'),
        label: 'plantuml',
        icon: plantumlIcon,
        scope: 'block'
      },
      {
        title: translate('quickInsert.mermaid.title'),
        subTitle: translate('quickInsert.mermaid.subtitle'),
        label: 'mermaid',
        icon: mermaidIcon,
        scope: 'block'
      }
    ],
    // Sezione inline: applica un format al testo esistente invece di convertire il blocco.
    // `type` è il valore passato a `contentState.format(type)` (stessa API di formatPicker).
    // sub/sup non inclusi: il motore li supporta (formatCtrl.js gestisce `sub`/`sup` come
    // html_tag `<sub>`/`<sup>`, stesso percorso di `u`/`mark`), ma non esiste in
    // `assets/pngicon` un'icona dedicata e questo task non può aggiungere nuovi asset binari
    // (fuori scope, vedi worklog-parteC.md). Riusare un'icona non pertinente sarebbe fuorviante:
    // da valutare in un task successivo con l'asset giusto.
    [translate('quickInsert.inlineFormat')]: [
      {
        title: translate('quickInsert.bold.title'),
        subTitle: translate('quickInsert.bold.subtitle'),
        label: 'strong',
        commandId: 'format.strong',
        icon: strongIcon,
        type: 'strong',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.italic.title'),
        subTitle: translate('quickInsert.italic.subtitle'),
        label: 'em',
        commandId: 'format.emphasis',
        icon: emphasisIcon,
        type: 'em',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.underline.title'),
        subTitle: translate('quickInsert.underline.subtitle'),
        label: 'u',
        commandId: 'format.underline',
        icon: underlineIcon,
        type: 'u',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.strikethrough.title'),
        subTitle: translate('quickInsert.strikethrough.subtitle'),
        label: 'del',
        commandId: 'format.strike',
        icon: strikeIcon,
        type: 'del',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.highlight.title'),
        subTitle: translate('quickInsert.highlight.subtitle'),
        label: 'mark',
        commandId: 'format.highlight',
        icon: highlightIcon,
        type: 'mark',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.inlineCode.title'),
        subTitle: translate('quickInsert.inlineCode.subtitle'),
        label: 'inline-code',
        commandId: 'format.inline-code',
        icon: codeIcon,
        type: 'inline_code',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.inlineMath.title'),
        subTitle: translate('quickInsert.inlineMath.subtitle'),
        label: 'inline-math',
        commandId: 'format.inline-math',
        icon: formatMathIcon,
        type: 'inline_math',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.inlineLink.title'),
        subTitle: translate('quickInsert.inlineLink.subtitle'),
        label: 'link',
        commandId: 'format.hyperlink',
        icon: formatLinkIcon,
        type: 'link',
        scope: 'inline'
      },
      {
        title: translate('quickInsert.inlineImage.title'),
        subTitle: translate('quickInsert.inlineImage.subtitle'),
        label: 'image',
        commandId: 'format.image',
        icon: formatImageIcon,
        type: 'image',
        scope: 'inline'
      }
    ]
  }
}

// 保持向后兼容性，导出默认配置
// 移除旧的导出，所有地方都应该使用createQuickInsertObj函数
