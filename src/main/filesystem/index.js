import { readlinkSync, outputFile, move, remove } from 'fs-extra'
import path from 'path'
import { isDirectory, isFile, isSymbolicLink } from 'common/filesystem'

/**
 * Normalize the path into an absolute path and resolves the link target if needed.
 *
 * @param {string} pathname The path or link path.
 * @returns {string} Returns the absolute path and resolved link. If the link target
 *                   cannot be resolved, an empty string is returned.
 */
export const normalizeAndResolvePath = (pathname) => {
  if (isSymbolicLink(pathname)) {
    const absPath = path.dirname(pathname)
    const targetPath = path.resolve(absPath, readlinkSync(pathname))
    if (isFile(targetPath) || isDirectory(targetPath)) {
      return path.resolve(targetPath)
    }
    console.error(`Cannot resolve link target "${pathname}" (${targetPath}).`)
    return ''
  }
  return path.resolve(pathname)
}

export const writeFile = (pathname, content, extension, options = 'utf-8') => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  // R7: atomic write via temp-file + rename. Prevents file corruption on crash/power-loss.
  // outputFile writes the temp file (creates parent dirs if needed), then move renames it
  // atomically on the same volume. On network volumes rename may not be atomic — acceptable
  // (best effort). The watcher ignores the final rename event via ignoreChangedEvent.
  const tmpPath = `${pathname}.tmp`
  return outputFile(tmpPath, content, options)
    .then(() => move(tmpPath, pathname, { overwrite: true }))
    .catch((err) => {
      remove(tmpPath).catch(() => {})
      throw err
    })
}
