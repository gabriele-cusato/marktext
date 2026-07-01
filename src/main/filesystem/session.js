import path from 'path'
import { app } from 'electron'
import log from 'electron-log'
import {
  outputFile,
  rename,
  remove,
  readFile,
  readJson,
  readJsonSync,
  pathExists,
  pathExistsSync,
  ensureDir,
  readdir
} from 'fs-extra'
import { loadMarkdownFile } from './markdown'

// H2 — Session snapshot & periodic backup (stile Notepad++).
// Nella cartella di backup vivono:
//   session.json   → indice ordinato delle tab (quale è attiva, pinnata, salvata, ecc.)
//   <id>.snapshot  → contenuto delle SOLE tab non al sicuro su disco
//                    (untitled, oppure file con modifiche non salvate).
// Le tab già salvate su disco NON hanno snapshot: al restore si rileggono dal file vero.

const SESSION_FILE = 'session.json'
const SNAPSHOT_EXT = '.snapshot'

// Risolve la cartella di backup: preferenza utente se impostata, altrimenti <userData>/backup
// (analogo a %AppData%\Notepad++\backup — ma da noi è configurabile, NPP no: issue #3096).
export const resolveBackupDir = (preferences) => {
  const { sessionBackupPath } = preferences.getAll()
  return sessionBackupPath && sessionBackupPath.trim()
    ? sessionBackupPath
    : path.join(app.getPath('userData'), 'backup')
}

// Scrittura atomica (tmp + rename), stesso pattern di filesystem/index.js writeFile (R7).
// Protegge session.json e gli snapshot da troncamenti in caso di crash/power-loss a metà scrittura.
// rename() (da 'fs-extra', sopra graceful-fs) sostituisce il tmp alla destinazione in una singola
// syscall atomica, senza lo step remove(dest) separato che avrebbe fs-extra's move({overwrite:true})
// (race tra remove e rename che potrebbe perdere sia originale che tmp). Vedi commento dettagliato
// in filesystem/index.js writeFile per la motivazione completa.
const atomicWrite = async (filePath, content) => {
  const tmp = `${filePath}.tmp`
  try {
    await outputFile(tmp, content, 'utf-8')
    await rename(tmp, filePath)
  } catch (err) {
    // Se rename è già riuscito il tmp non esiste più: remove fallisce silenziosamente (ENOENT
    // ignorato). Se rename fallisce, filePath originale non è mai stato toccato: cancellare il tmp
    // qui è sicuro.
    remove(tmp).catch(() => {})
    throw err
  }
}

// Una tab ha bisogno di snapshot solo se il suo contenuto NON è già al sicuro su disco.
const tabNeedsBackup = (tab) => !(tab.isSaved && tab.pathname)

/**
 * Scrive la sessione corrente: snapshot dei contenuti non salvati + indice + cleanup orfani.
 * B (2026-06-25): riceve le tab GIÀ mergiate da tutte le finestre (vedi App._mergeSession),
 * ognuna con `_winId` per namespacizzare lo snapshot — evita collisioni di id tra renderer diversi
 * (getUniqueId è un contatore per-modulo: ogni finestra riparte da mt-0). Il cleanup orfani gira
 * sull'intera lista mergiata → non cancella più gli snapshot delle altre finestre.
 * @param {Preference} preferences
 * @param {Array} mergedTabs Lista piatta ordinata (finestra1-tab, poi finestra2-tab, ...).
 */
export const writeSession = async (preferences, mergedTabs) => {
  if (!Array.isArray(mergedTabs)) return
  const dir = resolveBackupDir(preferences)
  await ensureDir(dir)

  const referenced = new Set() // snapshot ancora vivi → tutto il resto è orfano e va cancellato
  const entries = []

  for (const tab of mergedTabs) {
    const needsBackup = tabNeedsBackup(tab)
    let backupName = null
    if (needsBackup) {
      // FIX 1 (B): namespacizza per finestra — gli id tab collidono tra renderer (getUniqueId per-modulo).
      backupName = `${tab._winId}-${tab.id}${SNAPSHOT_EXT}`
      referenced.add(backupName)
      await atomicWrite(path.join(dir, backupName), tab.markdown ?? '')
    }
    // Nell'indice NON salviamo il markdown delle tab da disco (si rilegge dal file) → indice leggero.
    entries.push({
      pathname: tab.pathname || '',
      filename: tab.filename || 'Untitled',
      isSaved: !!tab.isSaved,
      isActive: !!tab.isActive,
      pinned: !!tab.pinned,
      hasBackup: needsBackup,
      backupName,
      cursor: tab.cursor || null,
      encoding: tab.encoding,
      lineEnding: tab.lineEnding,
      adjustLineEndingOnSave: tab.adjustLineEndingOnSave,
      trimTrailingNewline: tab.trimTrailingNewline
    })
  }

  await atomicWrite(path.join(dir, SESSION_FILE), JSON.stringify({ version: 1, tabs: entries }))

  // Cleanup: rimuovi gli snapshot non più referenziati (tab salvate/chiuse) — simmetria create/delete.
  try {
    const files = await readdir(dir)
    await Promise.all(
      files
        .filter((f) => f.endsWith(SNAPSHOT_EXT) && !referenced.has(f))
        .map((f) => remove(path.join(dir, f)).catch(() => {}))
    )
  } catch (err) {
    log.error('[session] cleanup failed:', err)
  }
}

// Esiste una sessione ripristinabile (con almeno una tab)? Sync: serve al boot prima di creare la finestra.
export const hasSessionSync = (preferences) => {
  const file = path.join(resolveBackupDir(preferences), SESSION_FILE)
  if (!pathExistsSync(file)) return false
  try {
    const data = readJsonSync(file)
    return !!(data && Array.isArray(data.tabs) && data.tabs.length)
  } catch {
    return false
  }
}

/**
 * Carica e RISOLVE le tab della sessione, pronte per il renderer.
 * - File salvati: riletti dal disco (contenuto fresco + watcher).
 * - Tab con snapshot: contenuto dal backup; per i file esterni la baseline è il contenuto attuale
 *   su disco (così il bollino "non salvato" è corretto). File sparito → riaperto come Untitled.
 * @returns {Promise<{tabs: Array, missing: string[]} | null>}
 */
export const loadSessionTabs = async (preferences) => {
  const dir = resolveBackupDir(preferences)
  const file = path.join(dir, SESSION_FILE)
  if (!(await pathExists(file))) return null

  let data
  try {
    data = await readJson(file)
  } catch (err) {
    log.error('[session] invalid session.json:', err)
    return null
  }
  if (!data || !Array.isArray(data.tabs)) return null

  const eol = preferences.getPreferredEol()
  const { autoGuessEncoding, trimTrailingNewline } = preferences.getAll()

  const tabs = []
  const missing = []

  for (const e of data.tabs) {
    if (!e.hasBackup) {
      // Tab salvata: rileggi il file vero dal disco (contenuto fresco).
      if (!e.pathname) continue
      try {
        const raw = await loadMarkdownFile(e.pathname, eol, autoGuessEncoding, trimTrailingNewline)
        tabs.push({
          pathname: raw.pathname,
          filename: raw.filename,
          markdown: raw.markdown,
          originalMarkdown: raw.markdown,
          isSaved: true,
          isActive: !!e.isActive,
          pinned: !!e.pinned,
          cursor: e.cursor || null,
          encoding: raw.encoding,
          lineEnding: raw.lineEnding,
          adjustLineEndingOnSave: raw.adjustLineEndingOnSave,
          trimTrailingNewline: raw.trimTrailingNewline
        })
      } catch (err) {
        missing.push(e.filename || e.pathname)
      }
      continue
    }

    // Tab con snapshot (untitled o file esterno con modifiche non salvate).
    let markdown = ''
    try {
      markdown = await readFile(path.join(dir, e.backupName), 'utf-8')
    } catch (err) {
      missing.push(e.filename || 'Untitled')
      continue
    }

    let pathname = e.pathname || ''
    let originalMarkdown = null
    if (pathname) {
      try {
        const raw = await loadMarkdownFile(pathname, eol, autoGuessEncoding, trimTrailingNewline)
        originalMarkdown = raw.markdown // baseline = contenuto attuale su disco
      } catch (err) {
        // File eliminato/spostato tra le sessioni → riapri come Untitled col contenuto del backup.
        missing.push(`${e.filename || pathname} (riaperto come Untitled)`)
        pathname = ''
        originalMarkdown = null
      }
    }

    tabs.push({
      pathname,
      filename: e.filename || 'Untitled',
      markdown,
      originalMarkdown,
      isSaved: !!e.isSaved && (!!pathname === !!e.pathname), // file sparito → forza dirty
      isActive: !!e.isActive,
      pinned: !!e.pinned,
      cursor: e.cursor || null,
      encoding: e.encoding,
      lineEnding: e.lineEnding,
      adjustLineEndingOnSave: e.adjustLineEndingOnSave,
      trimTrailingNewline: e.trimTrailingNewline
    })
  }

  return { tabs, missing }
}
