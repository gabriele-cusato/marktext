/**
 * Unified undo/redo history for markdown tabs (Muya ↔ source).
 * Non-reactive Map (same pattern as cmStatePerTab) — avoids Pinia overhead on large strings.
 * Scope: only markdown files (isUnifiedTarget). Source-only files (.txt/.js/…) are unchanged.
 */
import { isMarkdownPath } from '@/util'

const UNDO_DEPTH = 500

// ---- DEBUG (H8) -----------------------------------------------------------
// Metti DEBUG = false per spegnere tutti i log. Servono a diagnosticare il bug
// undo/redo Muya↔source (normalizzazione markdown + push spuri). Rimuovere a fix chiuso.
const DEBUG = false
const _s = (s) =>
  JSON.stringify((s ?? '').slice(0, 40)) + (s && s.length > 40 ? '…' : '')
const _log = (...a) => {
  if (DEBUG) console.log('[H8]', ...a)
}
// ---------------------------------------------------------------------------

// Map<tabId, { stack: [{markdown, muyaIndexCursor}], index: number }>
const undoPerTab = new Map()

/**
 * Seeds baseline for a tab. Idempotent: no-op if entry already exists.
 * Must be called before the first edit so the FIRST Ctrl+Z can revert to this state.
 */
export const seedUnified = (tabId, markdown, muyaIndexCursor) => {
  if (!tabId || undoPerTab.has(tabId)) {
    _log('seed SKIP (exists or no tab)', tabId)
    return
  }
  undoPerTab.set(tabId, {
    stack: [{ markdown: markdown ?? '', muyaIndexCursor: muyaIndexCursor ?? null }],
    index: 0
  })
  _log('seed', tabId, 'md=', _s(markdown))
}

/**
 * Pushes a new snapshot. Gate: no-op if markdown is identical to current top (anti-loop).
 * If tab has no entry yet, seeds it (fallback — prefer explicit seedUnified at load time).
 * `origin` è solo per i log di debug.
 */
export const pushUnified = (tabId, markdown, muyaIndexCursor, origin = '?') => {
  if (!tabId) return
  if (!undoPerTab.has(tabId)) {
    // Lazy fallback seed (tab existed before H8 was active, e.g. first session run)
    undoPerTab.set(tabId, {
      stack: [{ markdown: markdown ?? '', muyaIndexCursor: muyaIndexCursor ?? null }],
      index: 0
    })
    _log('push LAZY-SEED', origin, tabId, 'md=', _s(markdown))
    return
  }
  const entry = undoPerTab.get(tabId)
  // Anti-loop gate: identical markdown → no push (covers replay, switch, cursor-only events)
  if (entry.stack[entry.index]?.markdown === markdown) {
    _log('push SKIP=equal', origin, 'idx=', entry.index, 'len=', entry.stack.length)
    return
  }
  // DEBUG: top ≠ new → spia di normalizzazione (se è un flush dopo un replay, è il bug).
  _log(
    'push OK',
    origin,
    'idx',
    entry.index,
    '→',
    entry.index + 1,
    'lenBefore=',
    entry.stack.length,
    '\n      top=',
    _s(entry.stack[entry.index]?.markdown),
    '\n      new=',
    _s(markdown)
  )
  // Truncate redo branch
  entry.stack.splice(entry.index + 1)
  entry.stack.push({ markdown, muyaIndexCursor: muyaIndexCursor ?? null })
  entry.index++
  // Cap depth
  if (entry.stack.length > UNDO_DEPTH) {
    entry.stack.shift()
    entry.index--
  }
  _log('      → after push len=', entry.stack.length, 'idx=', entry.index)
}

/**
 * Moves index back one step and returns the snapshot, or null if already at bottom.
 */
export const unifiedUndo = (tabId) => {
  const entry = undoPerTab.get(tabId)
  if (!entry || entry.index <= 0) {
    _log('undo NULL (bottom) idx=', entry?.index, 'len=', entry?.stack.length)
    return null
  }
  entry.index--
  _log(
    'undo → idx=',
    entry.index,
    'len=',
    entry.stack.length,
    'md=',
    _s(entry.stack[entry.index].markdown)
  )
  return entry.stack[entry.index]
}

/**
 * Moves index forward one step and returns the snapshot, or null if already at top.
 */
export const unifiedRedo = (tabId) => {
  const entry = undoPerTab.get(tabId)
  if (!entry || entry.index >= entry.stack.length - 1) {
    _log('redo NULL (top) idx=', entry?.index, 'len=', entry?.stack.length)
    return null
  }
  entry.index++
  _log(
    'redo → idx=',
    entry.index,
    'len=',
    entry.stack.length,
    'md=',
    _s(entry.stack[entry.index].markdown)
  )
  return entry.stack[entry.index]
}

/**
 * Clears history for a tab (tab close or reload from disk).
 */
export const clearUnified = (tabId) => {
  if (tabId) {
    undoPerTab.delete(tabId)
    _log('clear', tabId)
  }
}

/**
 * Returns true if this file should participate in unified undo (markdown + untitled only).
 */
export const isUnifiedTarget = (pathname) => isMarkdownPath(pathname || '')
