// Lazy-loaded ced module for character encoding detection.
// This is optional - if it fails to load (e.g., due to native module issues on Windows),
// we'll fall back to UTF-8 encoding.
let ced = null
let cedLoadAttempted = false

async function getCed() {
  if (cedLoadAttempted) {
    return ced
  }
  
  cedLoadAttempted = true
  try {
    const cedModule = await import('ced')
    ced = cedModule.default
  } catch (error) {
    console.warn('Failed to load ced module for encoding detection:', error.message)
    console.warn('Will default to UTF-8 encoding when autoGuessEncoding is enabled')
    ced = null
  }
  
  return ced
}

const CED_ICONV_ENCODINGS = {
  'BIG5-CP950': 'big5',
  KSC: 'euckr',
  'ISO-2022-KR': 'euckr',
  GB: 'gb2312',
  ISO_2022_CN: 'gb2312',

  Unicode: 'utf8',

  // Map ASCII, subsets of utf-8 to UTF-8,
  JIS: 'utf8',
  SJS: 'utf8',
  shiftjis: 'utf8',
  'ASCII-7-bit': 'utf8',
  ASCII: 'utf8',
  MACINTOSH: 'utf8'
}

// Byte Order Mark's to detect endianness and encoding.
const BOM_ENCODINGS = {
  utf8: [0xef, 0xbb, 0xbf],
  utf16be: [0xfe, 0xff],
  utf16le: [0xff, 0xfe]
}

const checkSequence = (buffer, sequence) => {
  if (buffer.length < sequence.length) {
    return false
  }
  return sequence.every((v, i) => v === buffer[i])
}

/**
 * Guess the encoding from the buffer.
 *
 * @param {Buffer} buffer
 * @param {boolean} autoGuessEncoding
 * @returns {Promise<Encoding>}
 */
export const guessEncoding = async (buffer, autoGuessEncoding) => {
  let isBom = false
  let encoding = 'utf8'

  // Detect UTF8- and UTF16-BOM encodings.
  for (const [key, value] of Object.entries(BOM_ENCODINGS)) {
    if (checkSequence(buffer, value)) {
      return { encoding: key, isBom: true }
    }
  }

  // // Try to detect binary files. Text files should not containt four 0x00 characters.
  // let zeroSeenCounter = 0
  // for (let i = 0; i < Math.min(buffer.byteLength, 256); ++i) {
  //   if (buffer[i] === 0x00) {
  //     if (zeroSeenCounter >= 3) {
  //       return { encoding: 'binary', isBom: false }
  //     }
  //     zeroSeenCounter++
  //   } else {
  //     zeroSeenCounter = 0
  //   }
  // }

  // Auto guess encoding, otherwise use UTF8.
  if (autoGuessEncoding) {
    const cedModule = await getCed()
    if (cedModule) {
      try {
        encoding = cedModule(buffer)
        if (CED_ICONV_ENCODINGS[encoding]) {
          encoding = CED_ICONV_ENCODINGS[encoding]
        } else {
          encoding = encoding.toLowerCase().replace(/-_/g, '')
        }
      } catch (error) {
        console.warn('Failed to detect encoding using ced:', error.message)
        // Fall back to UTF-8
        encoding = 'utf8'
      }
    }
  }
  return { encoding, isBom }
}
