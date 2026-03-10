import { describe, it, expect } from 'vitest'
import { parseHunks, hunksToRows, langFromFilename } from '@/lib/diff-types'

const sampleFileDiff = `diff --git a/src/app.ts b/src/app.ts
index abc1234..def5678 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 import express from 'express'
+import cors from 'cors'
 const app = express()
-app.listen(3000)
+app.listen(8080)`

describe('parseHunks', () => {
  it('parses a single hunk with add, del, and context lines', () => {
    const hunks = parseHunks(sampleFileDiff)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].oldStart).toBe(1)
    expect(hunks[0].oldLines).toBe(3)
    expect(hunks[0].newStart).toBe(1)
    expect(hunks[0].newLines).toBe(4)
    expect(hunks[0].header).toBe('@@ -1,3 +1,4 @@')
  })

  it('parses changes with correct types', () => {
    const hunks = parseHunks(sampleFileDiff)
    const changes = hunks[0].changes
    expect(changes).toHaveLength(5)
    expect(changes[0]).toEqual({ type: 'context', oldLine: 1, newLine: 1, content: "import express from 'express'" })
    expect(changes[1]).toEqual({ type: 'add', newLine: 2, content: "import cors from 'cors'" })
    expect(changes[2]).toEqual({ type: 'context', oldLine: 2, newLine: 3, content: 'const app = express()' })
    expect(changes[3]).toEqual({ type: 'del', oldLine: 3, content: 'app.listen(3000)' })
    expect(changes[4]).toEqual({ type: 'add', newLine: 4, content: 'app.listen(8080)' })
  })

  it('assigns correct line numbers', () => {
    const hunks = parseHunks(sampleFileDiff)
    const changes = hunks[0].changes

    // Context line: both old and new
    expect(changes[0].oldLine).toBe(1)
    expect(changes[0].newLine).toBe(1)

    // Add line: only new
    expect(changes[1].oldLine).toBeUndefined()
    expect(changes[1].newLine).toBe(2)

    // Delete line: only old
    expect(changes[3].oldLine).toBe(3)
    expect(changes[3].newLine).toBeUndefined()
  })

  it('parses multiple hunks', () => {
    const multiHunkDiff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line1
-line2
+line2-modified
 line3
@@ -10,2 +10,3 @@
 line10
+line10.5
 line11`

    const hunks = parseHunks(multiHunkDiff)
    expect(hunks).toHaveLength(2)
    expect(hunks[0].oldStart).toBe(1)
    expect(hunks[1].oldStart).toBe(10)
    expect(hunks[1].newLines).toBe(3)
  })

  it('returns empty array for diff with no hunks', () => {
    const noHunkDiff = `diff --git a/file.ts b/file.ts
index abc..def 100644`
    expect(parseHunks(noHunkDiff)).toEqual([])
  })

  it('handles new file diff', () => {
    const newFileDiff = `diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+export const x = 1
+export const y = 2`

    const hunks = parseHunks(newFileDiff)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].changes).toHaveLength(2)
    expect(hunks[0].changes[0].type).toBe('add')
    expect(hunks[0].changes[1].type).toBe('add')
  })

  it('handles hunk header without comma (single line)', () => {
    const singleLineDiff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`

    const hunks = parseHunks(singleLineDiff)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].oldLines).toBe(1)
    expect(hunks[0].newLines).toBe(1)
  })
})

describe('hunksToRows', () => {
  it('flattens hunks into rows with hunk-header and change kinds', () => {
    const hunks = parseHunks(sampleFileDiff)
    const rows = hunksToRows(hunks)

    // 1 hunk header + 5 changes = 6 rows
    expect(rows).toHaveLength(6)
    expect(rows[0].kind).toBe('hunk-header')
    if (rows[0].kind === 'hunk-header') {
      expect(rows[0].header).toBe('@@ -1,3 +1,4 @@')
    }
    expect(rows[1].kind).toBe('change')
    if (rows[1].kind === 'change') {
      expect(rows[1].change.type).toBe('context')
    }
  })

  it('returns empty array for empty hunks', () => {
    expect(hunksToRows([])).toEqual([])
  })
})

describe('langFromFilename', () => {
  it('maps common extensions', () => {
    expect(langFromFilename('app.ts')).toBe('typescript')
    expect(langFromFilename('app.tsx')).toBe('tsx')
    expect(langFromFilename('main.py')).toBe('python')
    expect(langFromFilename('style.css')).toBe('css')
    expect(langFromFilename('config.json')).toBe('json')
    expect(langFromFilename('Makefile')).toBe('text') // no extension
  })

  it('handles nested paths', () => {
    expect(langFromFilename('src/lib/utils.ts')).toBe('typescript')
  })
})
