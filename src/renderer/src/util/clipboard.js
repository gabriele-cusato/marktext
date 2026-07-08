import { isLinux, isOsx, isWindows } from './index'
import plist from 'plist'

const hasClipboardFiles = async () => {
  return window.electron.clipboard.has('NSFilenamesPboardType')
}

const getClipboardFiles = async () => {
  if (!(await hasClipboardFiles())) {
    return []
  }
  return plist.parse(await window.electron.clipboard.read('NSFilenamesPboardType'))
}

export const guessClipboardFilePath = async () => {
  if (isLinux) return ''
  if (isOsx) {
    const result = await getClipboardFiles()
    return Array.isArray(result) && result.length ? result[0] : ''
  } else if (isWindows) {
    const rawFilePath = await window.electron.clipboard.read('FileNameW')
    const filePath = rawFilePath.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    return filePath && typeof filePath === 'string' ? filePath : ''
  } else {
    return ''
  }
}
