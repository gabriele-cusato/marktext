export const delay = (time) => {
  let timerId
  let rejectFn
  const p = new Promise((resolve, reject) => {
    rejectFn = reject
    timerId = setTimeout(() => {
      p.cancel = () => {}
      rejectFn = null
      resolve()
    }, time)
  })

  p.cancel = () => {
    clearTimeout(timerId)
    timerId = null
    rejectFn()
    rejectFn = null
  }
  return p
}

const ID_PREFEX = 'mt-'
let id = 0

export const serialize = function (params) {
  return Object.keys(params)
    .map((key) => `${key}=${encodeURI(params[key])}`)
    .join('&')
}

export const merge = function (...args) {
  return Object.assign({}, ...args)
}

export const dataURItoBlob = function (dataURI) {
  const data = dataURI.split(';base64,')
  const byte = window.atob(data[1])
  const mime = data[0].split(':')[1]
  const ab = new ArrayBuffer(byte.length)
  const ia = new Uint8Array(ab)
  const len = byte.length
  let i
  for (i = 0; i < len; i++) {
    ia[i] = byte.charCodeAt(i)
  }
  return new window.Blob([ab], { type: mime })
}

export const adjustCursor = (cursor, preline, line, nextline) => {
  let newCursor = Object.assign({}, { line: cursor.line, ch: cursor.ch })
  // It's need to adjust the cursor when cursor is at begin or end in table row.
  if (/\|[^|]+\|.+\|\s*$/.test(line)) {
    if (/\|\s*:?-+:?\s*\|[:-\s|]+\|\s*$/.test(line)) {
      // cursor in `| --- | :---: |` :the second line of table
      newCursor.line += 1 // reset the cursor to the next line
      newCursor.ch = nextline.indexOf('|') + 1
    } else {
      // cursor is not at the second line to table
      if (cursor.ch <= line.indexOf('|')) newCursor.ch = line.indexOf('|') + 1
      if (cursor.ch >= line.lastIndexOf('|')) newCursor.ch = line.lastIndexOf('|') - 1
    }
  }

  // Need to adjust the cursor when cursor in the first or last line of code/math block.
  if (/```[\S]*/.test(line) || /^\$\$$/.test(line)) {
    if (typeof nextline === 'string' && /\S/.test(nextline)) {
      newCursor.line += 1
      newCursor.ch = 0
    } else if (typeof preline === 'string' && /\S/.test(preline)) {
      newCursor.line -= 1
      newCursor.ch = preline.length
    }
  }

  // Need to adjust the cursor when cursor at the begin of the list
  if (/[*+-]\s.+/.test(line) && newCursor.ch <= 1) {
    newCursor.ch = 2
  }

  // Need to adjust the cursor when cursor at blank line or in a line contains HTML tag.
  // set the newCursor to null, the new cursor will at the last line of document.

  if (!/\S/.test(line)) {
    newCursor = null
  }
  return newCursor
}

export const animatedScrollTo = function (element, to, duration, callback) {
  const start = element.scrollTop
  const change = to - start
  const animationStart = +new Date()

  // Prevent animation on small steps or duration is 0
  if (Math.abs(change) <= 6 || duration === 0) {
    element.scrollTop = to
    return
  }

  const easeInOutQuad = function (t, b, c, d) {
    t /= d / 2
    if (t < 1) return (c / 2) * t * t + b
    t--
    return (-c / 2) * (t * (t - 2) - 1) + b
  }

  const animateScroll = function () {
    const now = +new Date()
    const val = Math.floor(easeInOutQuad(now - animationStart, start, change, duration))

    element.scrollTop = val

    if (now > animationStart + duration) {
      element.scrollTop = to
      if (callback) {
        callback()
      }
    } else {
      requestAnimationFrame(animateScroll)
    }
  }

  requestAnimationFrame(animateScroll)
}

export const getUniqueId = () => {
  return `${ID_PREFEX}${id++}`
}

export const hasKeys = (obj) => Object.keys(obj).length > 0

/**
 * Clone an object as a shallow or deep copy.
 *
 * @param {*} obj Object to clone
 * @param {Boolean} deepCopy Create a shallow (false) or deep copy (true)
 * @deprecated Use `cloneObject` (shallow copy) or `deepClone` (deep copy).
 */
export const cloneObj = (obj, deepCopy = true) => {
  return deepCopy ? JSON.parse(JSON.stringify(obj)) : Object.assign({}, obj)
}

/**
 * Shallow clone the given object.
 *
 * @param {*} obj Object to clone
 * @param {boolean} inheritFromObject Whether the clone should inherit from `Object`
 */
export const cloneObject = (obj, inheritFromObject = true) => {
  return Object.assign(inheritFromObject ? {} : Object.create(null), obj)
}

/**
 * Deep clone the given object.
 *
 * @param {*} obj Object to clone
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

export const isOsx = window.electron.process.platform === 'darwin'
export const isWindows = window.electron.process.platform === 'win32'
export const isLinux = window.electron.process.platform === 'linux'

// Estensioni trattate come markdown → editor WYSIWYG (Muya). Tutto il resto → CodeMirror (source).
// Fonte di verità unica per la scelta della modalità: usata da store/editor.js (_applySourceCodeForFile)
// e dalla ricerca in sidebar (searchResultItem.vue).
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn']

// True se il file va aperto in Muya (markdown). Untitled / senza pathname → Muya.
export const isMarkdownPath = (pathname) => {
  if (!pathname) return true
  const ext = (window.path.extname(pathname) || '').toLowerCase()
  return ext === '' || MARKDOWN_EXTENSIONS.includes(ext)
}

/**
 * Normalizza il markdown in base all'opzione trailing-newline dell'utente.
 * trimOption 0 = rimuovi tutti i trailing newlines; 1 = assicura esattamente uno; default = invariato.
 * Unica copia condivisa tra sourceCode.vue (N12 check) e store/editor.js (save/commit).
 */
export const adjustTrailingNewlines = (text, trimOption) => {
  if (!text) return ''
  const trimEnd = (s) => s.replace(/[\r\n]+$/, '')
  if (trimOption === 0) return trimEnd(text)
  if (trimOption === 1) {
    const last = text.length - 1
    if (text[last] === '\n') {
      if (text.length === 1) return ''
      if (text[last - 1] !== '\n') return text
    }
    const trimmed = trimEnd(text)
    return trimmed.length === 0 ? '' : trimmed + '\n'
  }
  return text
}
