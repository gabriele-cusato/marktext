import { readlinkSync, outputFile, rename, remove } from 'fs-extra'
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
  // outputFile writes the temp file (creates parent dirs if needed), poi rename() lo sostituisce
  // alla destinazione in una singola syscall atomica (MoveFileExW con MOVEFILE_REPLACE_EXISTING su
  // Windows, rename(2) su POSIX) — nessuno step remove(dest) separato prima, a differenza di
  // fs-extra's move({overwrite:true}) che internamente farebbe remove(dest) poi rename in due
  // operazioni distinte, con finestra di race in cui entrambi i file potrebbero andare persi se il
  // rename fallisce dopo che il remove è già riuscito. rename è importato da 'fs-extra' (non da
  // fs/promises nativo) per preservare i retry Windows su EACCES/EPERM/EBUSY di graceful-fs (fino a
  // 60s, utile contro lock transitori di AV/indicizzazione): graceful-fs patcha solo l'API a
  // callback di fs, non fs/promises, quindi fs-extra la espone già promisificata sopra graceful-fs.
  // Il watcher ignora l'evento di rename tramite ignoreChangedEvent.
  const tmpPath = `${pathname}.tmp`
  return outputFile(tmpPath, content, options)
    .then(() => rename(tmpPath, pathname))
    .catch((err) => {
      // Se il rename è già andato a buon fine, il tmp non esiste più: remove fallisce silenziosamente
      // (ENOENT ignorato) senza toccare il file di destinazione appena scritto. Se invece il rename
      // fallisce (inclusi i casi già ritentati da graceful-fs, es. EXDEV se tmp e destinazione
      // finissero su volumi diversi — non atteso dato che il tmp è nella stessa directory), il file
      // originale non è mai stato toccato: cancellare il tmp qui non causa perdita di dati.
      remove(tmpPath).catch(() => {})
      throw err
    })
}
