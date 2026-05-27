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

// Verifica se un buffer è UTF-8 valido (nessuna sequenza malformata).
const isValidUtf8 = (buffer) => {
  let i = 0
  while (i < buffer.length) {
    const b = buffer[i]
    let extra = 0
    if (b <= 0x7f) {
      extra = 0
    } else if ((b & 0xe0) === 0xc0) {
      extra = 1
    } else if ((b & 0xf0) === 0xe0) {
      extra = 2
    } else if ((b & 0xf8) === 0xf0) {
      extra = 3
    } else {
      return false // byte di continuazione fuori sequenza
    }
    for (let j = 1; j <= extra; j++) {
      if (i + j >= buffer.length || (buffer[i + j] & 0xc0) !== 0x80) {
        return false // byte di continuazione mancante o malformato
      }
    }
    i += 1 + extra
  }
  return true
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
    console.log('[ENC-DBG] ced loaded:', !!cedModule)
    if (cedModule) {
      try {
        const raw = cedModule(buffer)
        console.log('[ENC-DBG] ced raw result:', raw)
        if (CED_ICONV_ENCODINGS[raw]) {
          encoding = CED_ICONV_ENCODINGS[raw]
        } else {
          encoding = raw.toLowerCase().replace(/-_/g, '')
        }

        // ced riporta ASCII per file piccoli anche quando ci sono byte > 0x7F
        // (non abbastanza dati per rilevamento statistico). In questo caso:
        // - testa se il buffer è UTF-8 valido → usa utf8
        // - altrimenti assume windows-1252 (ANSI Western Europe, il caso più comune su Windows)
        if (encoding === 'utf8') {
          const hasNonAscii = buffer.some((b) => b > 0x7f)
          if (hasNonAscii && !isValidUtf8(buffer)) {
            encoding = 'windows-1252'
            console.log('[ENC-DBG] ced → ASCII ma byte non-ASCII presenti e UTF-8 non valido → windows-1252')
          }
        }

        console.log('[ENC-DBG] final encoding:', encoding)
      } catch (error) {
        console.warn('Failed to detect encoding using ced:', error.message)
        // Fall back to UTF-8
        encoding = 'utf8'
      }
    } else {
      console.warn('[ENC-DBG] ced non disponibile → fallback UTF-8')
    }
  } else {
    console.log('[ENC-DBG] autoGuessEncoding disabilitato → UTF-8 fisso')
  }
  return { encoding, isBom }
}
