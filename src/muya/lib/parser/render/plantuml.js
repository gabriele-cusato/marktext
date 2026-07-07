import { toHTML, h } from './snabbdom'

const PLANTUML_URL = 'https://www.plantuml.com/plantuml'

function replaceChar(tableIn, tableOut, char) {
  const charIndex = tableIn.indexOf(char)
  return tableOut[charIndex]
}

function maketrans(tableIn, tableOut, value) {
  return [...value].map((i) => replaceChar(tableIn, tableOut, i)).join('')
}

// Converte il risultato di deflateSync (Buffer o Uint8Array, a seconda del bridge) in base64,
// identico a `Buffer.toString('base64')` lato Node.
function uint8ToBase64(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export default class Diagram {
  encodedInput = ''

  /**
   * Builds a Diagram object storing the encoded input value
   */
  static parse(input) {
    const diagram = new Diagram()
    diagram.encodedInput = Diagram.encode(input)
    return diagram
  }

  /**
   * Encodes a diagram following PlantUML specs
   *
   * From https://plantuml.com/text-encoding
   * 1. Encoded in UTF-8
   * 2. Compressed using Deflate or Brotli algorithm
   * 3. Reencoded in ASCII using a transformation close to base64
   */
  static encode(value) {
    const tableIn = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const tableOut = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

    const utf8Value = decodeURIComponent(encodeURIComponent(value))
    const compressedValue = window.marktextEnv.deflateSync(utf8Value)
    const base64Value = uint8ToBase64(compressedValue)
    return maketrans(tableIn, tableOut, base64Value)
  }

  insertImgElement(container) {
    const div = typeof container === 'string' ? document.getElementById(container) : container
    if (div === null || !div.tagName) {
      throw new Error('Invalid container: ' + container)
    }
    const src = `${PLANTUML_URL}/svg/~1${this.encodedInput}`
    const node = h('img', { attrs: { src } })
    div.innerHTML = toHTML(node)
  }
}
