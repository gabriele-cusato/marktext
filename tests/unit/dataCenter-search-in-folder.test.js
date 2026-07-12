import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { searchInFolder } from 'main_renderer/dataCenter'

// Radice temporanea con una sottocartella per ciascuno scenario, così ogni chiamata a
// `searchInFolder` cerca solo nei file pertinenti al proprio test (nessuna interferenza tra casi).
let tmpRoot

function writeFixture(subdir, fileName, content) {
  const dir = path.join(tmpRoot, subdir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, fileName), content, 'utf8')
  return dir
}

beforeAll(() => {
  tmpRoot = fs.mkdirSync(
    path.join(os.tmpdir(), `marktext-search-in-folder-${crypto.randomUUID()}`),
    { recursive: true }
  )
})

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

describe('searchInFolder', () => {
  it('trova un match semplice con line/start/end/lineText corretti', async () => {
    const dir = writeFixture('match-basic', 'file.txt', 'first line\nHello world\nthird line\n')

    const result = await searchInFolder(dir, 'Hello', {})

    expect(result.error).toBeUndefined()
    expect(result.truncated).toBe(false)
    expect(result.results).toHaveLength(1)
    const [file] = result.results
    expect(file.filePath.replace(/\\/g, '/')).toMatch(/file\.txt$/)
    expect(file.matches).toEqual([{ line: 2, start: 0, end: 5, lineText: 'Hello world' }])
  })

  it('converte correttamente gli offset byte->carattere su una riga non-ASCII', async () => {
    // 'caffè ' è 6 caratteri JS ma 7 byte UTF-8 ('è' = 2 byte): se la conversione byte->carattere
    // non venisse fatta, start risulterebbe 7 invece di 6.
    const dir = writeFixture('non-ascii', 'file.txt', 'caffè hello mondo\n')

    const result = await searchInFolder(dir, 'hello', {})

    expect(result.results).toHaveLength(1)
    const [match] = result.results[0].matches
    expect(match).toEqual({ line: 1, start: 6, end: 11, lineText: 'caffè hello mondo' })
  })

  it('rispetta isCaseSensitive: true (match esatto sul case)', async () => {
    const dir = writeFixture('case-sensitive', 'file.txt', 'Hello world\nHELLO CASETEST\n')

    const result = await searchInFolder(dir, 'Hello', { isCaseSensitive: true })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].matches).toEqual([
      { line: 1, start: 0, end: 5, lineText: 'Hello world' }
    ])
  })

  it('con isCaseSensitive: false (o assente) ignora il case', async () => {
    const dir = writeFixture('case-insensitive', 'file.txt', 'Hello world\nHELLO CASETEST\n')

    const result = await searchInFolder(dir, 'Hello', { isCaseSensitive: false })

    expect(result.results[0].matches).toHaveLength(2)
  })

  it('rispetta isWholeWord: true (esclude i match che sono sottostringa di un\'altra parola)', async () => {
    const dir = writeFixture('whole-word', 'file.txt', 'cat category catalog\n')

    const wholeWord = await searchInFolder(dir, 'cat', { isWholeWord: true })
    expect(wholeWord.results[0].matches).toEqual([{ line: 1, start: 0, end: 3, lineText: 'cat category catalog' }])

    const notWholeWord = await searchInFolder(dir, 'cat', { isWholeWord: false })
    expect(notWholeWord.results[0].matches).toHaveLength(3)
  })

  it('con isRegexp: true interpreta la query come pattern regex', async () => {
    const dir = writeFixture('regex-valid', 'file.txt', 'color1 color2 plain\n')

    const result = await searchInFolder(dir, 'color\\d', { isRegexp: true })

    expect(result.error).toBeUndefined()
    expect(result.results[0].matches).toHaveLength(2)
  })

  it('con isRegexp: true e pattern non valido ritorna un errore', async () => {
    const dir = writeFixture('regex-invalid', 'file.txt', 'irrelevant content\n')

    const result = await searchInFolder(dir, '(unclosed', { isRegexp: true })

    expect(result.results).toEqual([])
    expect(result.truncated).toBe(false)
    expect(typeof result.error).toBe('string')
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('con cartella inesistente ritorna un errore senza risultati', async () => {
    const missingDir = path.join(tmpRoot, 'this-folder-does-not-exist')

    const result = await searchInFolder(missingDir, 'qualsiasi', {})

    expect(result.results).toEqual([])
    expect(result.truncated).toBe(false)
    expect(typeof result.error).toBe('string')
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('con query vuota ritorna risultati vuoti senza errore', async () => {
    const dir = writeFixture('empty-query', 'file.txt', 'contenuto qualsiasi\n')

    const result = await searchInFolder(dir, '', {})

    expect(result).toEqual({ results: [], truncated: false })
  })

  it('esclude i file che corrispondono a un pattern glob utente', async () => {
    const dir = writeFixture('exclusions', 'included.txt', 'needle here\n')
    fs.writeFileSync(path.join(dir, 'excluded.log'), 'needle here too\n', 'utf8')

    const result = await searchInFolder(dir, 'needle', { exclusions: ['*.log'] })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].filePath.replace(/\\/g, '/')).toMatch(/included\.txt$/)
  })
})
