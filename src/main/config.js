import path from 'path'
export const isOsx = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'

export const editorWinOptions = Object.freeze({
  // window-minwidth-hamburger (2026-07-12): 550px su TUTTE le piattaforme. La vecchia formula
  // 5×tab(min 88) + 4×gap(3) + ul-pad(6) + sezione-destra + offset/buffer non vincola più la
  // minima: sotto ~700px di larghezza la sezione destra della tab bar (command palette, cartella,
  // recent files) collassa in un unico bottone hamburger (tabs.vue, `.v2-topright`), quindi non
  // serve più riservare spazio per le tre icone singole. 550 resta il pavimento perché sotto
  // quella soglia le tab (min-width:88px) e il bottone hamburger non ci starebbero comunque.
  // Sotto questa soglia la finestra non si ridimensiona (Electron blocca, useContentSize:true →
  // vale sul content = tab bar a piena larghezza); sopra, le tab in eccesso vanno a capo (wrap
  // multi-row esistente).
  minWidth: 550,
  minHeight: 350,
  webPreferences: {
    contextIsolation: true,
    // WORKAROUND: We cannot enable spellcheck if it was disabled during
    // renderer startup due to a bug in Electron (Electron#32755). We'll
    // enable it always and set the HTML spelling attribute to false.
    spellcheck: true,
    nodeIntegration: false,
    // sandbox:false necessario: il preload usa API Node (fs-extra/os/command-exists/zlib). Con
    // nodeIntegration:false il default recente sarebbe sandbox:true, che romperebbe il preload.
    sandbox: false,
    webSecurity: true,
    preload: path.join(__dirname, '../preload/index.cjs')
  },
  useContentSize: true,
  show: true,
  frame: false,
  titleBarStyle: 'hiddenInset',
  // BUG-2 (SOLO macOS): centra verticalmente i traffic lights nativi sulla riga singola
  // della tab bar (alta --v2-tab-h=40px → centro tab a 20px). y=(40-16)/2≈12 centra i
  // bottoni (~16px); x=18 = inset dentro lo spazio riservato (padding-left:78 in tabs.vue).
  // ⚠️ VALORI DA TARARE SUL MAC (l'altezza reale dei bottoni varia per versione macOS).
  // Gated da isOsx → su Windows/Linux la chiave NON viene aggiunta: config invariata.
  ...(isOsx ? { trafficLightPosition: { x: 18, y: 12 } } : {}),
  // v2: nasconde menu bar nativa quando frame=true (Windows native titlebar).
  // Tasto Alt mostra/nasconde dinamicamente.
  autoHideMenuBar: true,
  zoomFactor: 1.0
})

export const preferencesWinOptions = Object.freeze({
  minWidth: 450,
  minHeight: 350,
  width: 950,
  height: 650,
  webPreferences: {
    contextIsolation: true,
    // Always true to access native spellchecker.
    spellcheck: true,
    nodeIntegration: false,
    // sandbox:false necessario: il preload usa API Node (vedi finestra editor sopra).
    sandbox: false,
    webSecurity: true,
    preload: path.join(__dirname, '../preload/index.cjs')
  },
  fullscreenable: false,
  fullscreen: false,
  minimizable: false,
  useContentSize: true,
  show: true,
  frame: false,
  thickFrame: !isOsx,
  zoomFactor: 1.0
})

export const PANDOC_EXTENSIONS = Object.freeze([
  'html',
  'docx',
  'odt',
  'latex',
  'tex',
  'ltx',
  'rst',
  'rest',
  'org',
  'wiki',
  'dokuwiki',
  'textile',
  'opml',
  'epub'
])

export const BLACK_LIST = Object.freeze(['$RECYCLE.BIN'])

export const EXTENSION_HASN = Object.freeze({
  styledHtml: '.html',
  pdf: '.pdf'
})

export const TITLE_BAR_HEIGHT = isOsx ? 21 : 32
// B14: estesa a CR puro (Mac OS pre-OSX). Usata da convertLineEndings per
// trasformare line endings al salvataggio. LF/CRLF detection regex restano invariate.
export const LINE_ENDING_REG = /(?:\r\n|\r|\n)/g
export const LF_LINE_ENDING_REG = /(?:[^\r]\n)|(?:^\n$)/
export const CRLF_LINE_ENDING_REG = /\r\n/

export const GITHUB_REPO_URL = 'https://github.com/Tkaixiang/marktext'
// copy from muya
export const URL_REG =
  /^http(s)?:\/\/([a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(:[0-9]{1,5})?(\/[\S]+)?/i
