import { describe, it, expect } from 'vitest'
import { parsePRUrl, parseDiff } from '@/lib/diff-types'

describe('parsePRUrl', () => {
  it('parses a standard GitHub PR URL', () => {
    const result = parsePRUrl('https://github.com/facebook/react/pull/42')
    expect(result).toEqual({ owner: 'facebook', repo: 'react', number: 42 })
  })

  it('parses URL with trailing path segments', () => {
    const result = parsePRUrl('https://github.com/owner/repo/pull/123/files')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 123 })
  })

  it('parses URL with query params', () => {
    const result = parsePRUrl('https://github.com/owner/repo/pull/5?diff=split')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 5 })
  })

  it('returns null for non-GitHub URLs', () => {
    expect(parsePRUrl('https://gitlab.com/owner/repo/pull/1')).toBeNull()
  })

  it('returns null for GitHub non-PR URLs', () => {
    expect(parsePRUrl('https://github.com/owner/repo/issues/1')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parsePRUrl('')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(parsePRUrl('not a url')).toBeNull()
  })
})

describe('parseDiff', () => {
  const sampleDiff = `diff --git a/src/app.ts b/src/app.ts
index abc1234..def5678 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 import express from 'express'
+import cors from 'cors'
 const app = express()
-app.listen(3000)
+app.listen(8080)
diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 # Hello
+World`

  it('parses multiple files from unified diff', () => {
    const files = parseDiff(sampleDiff)
    expect(files).toHaveLength(2)
  })

  it('extracts filenames correctly', () => {
    const files = parseDiff(sampleDiff)
    expect(files[0].filename).toBe('src/app.ts')
    expect(files[1].filename).toBe('README.md')
  })

  it('counts additions and deletions', () => {
    const files = parseDiff(sampleDiff)
    // app.ts: +cors, +listen(8080) = 2 additions; -listen(3000) = 1 deletion
    expect(files[0].additions).toBe(2)
    expect(files[0].deletions).toBe(1)
    // README.md: +World = 1 addition; 0 deletions
    expect(files[1].additions).toBe(1)
    expect(files[1].deletions).toBe(0)
  })

  it('returns empty array for empty diff', () => {
    expect(parseDiff('')).toEqual([])
    expect(parseDiff('  ')).toEqual([])
  })

  it('handles new file diffs (--- /dev/null)', () => {
    const newFileDiff = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,2 @@
+export const x = 1
+export const y = 2`
    const files = parseDiff(newFileDiff)
    expect(files).toHaveLength(1)
    expect(files[0].filename).toBe('newfile.ts')
    expect(files[0].additions).toBe(2)
    expect(files[0].deletions).toBe(0)
  })
})
