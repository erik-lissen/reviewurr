import { describe, it, expect } from 'vitest'
import { buildFileTree } from '@/lib/file-tree'
import type { DiffFile } from '@/lib/diff-types'

function makeDiffFile(filename: string): DiffFile {
  return { filename, additions: 1, deletions: 1, content: '' }
}

describe('buildFileTree', () => {
  it('returns empty array for no files', () => {
    expect(buildFileTree([])).toEqual([])
  })

  it('creates flat file nodes for root-level files', () => {
    const files = [makeDiffFile('a.ts'), makeDiffFile('b.ts')]
    const tree = buildFileTree(files)

    expect(tree).toHaveLength(2)
    expect(tree[0].name).toBe('a.ts')
    expect(tree[0].file?.filename).toBe('a.ts')
    expect(tree[1].name).toBe('b.ts')
    expect(tree[1].file?.filename).toBe('b.ts')
  })

  it('groups files into directory nodes', () => {
    const files = [makeDiffFile('src/a.ts'), makeDiffFile('src/b.ts')]
    const tree = buildFileTree(files)

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('src')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children![0].name).toBe('a.ts')
    expect(tree[0].children![1].name).toBe('b.ts')
  })

  it('compresses single-child directory chains', () => {
    const files = [makeDiffFile('src/lib/utils.ts')]
    const tree = buildFileTree(files)

    // src/lib should be compressed into one node
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('src/lib')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children![0].name).toBe('utils.ts')
  })

  it('does not compress when directory has multiple children', () => {
    const files = [
      makeDiffFile('src/lib/a.ts'),
      makeDiffFile('src/lib/b.ts'),
    ]
    const tree = buildFileTree(files)

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('src/lib')
    expect(tree[0].children).toHaveLength(2)
  })

  it('compresses deep single-child chains', () => {
    const files = [makeDiffFile('a/b/c/d/file.ts')]
    const tree = buildFileTree(files)

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('a/b/c/d')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children![0].name).toBe('file.ts')
  })

  it('stops compression when a dir has a file child and dir child', () => {
    const files = [
      makeDiffFile('src/index.ts'),
      makeDiffFile('src/lib/utils.ts'),
    ]
    const tree = buildFileTree(files)

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('src')
    expect(tree[0].children).toHaveLength(2)
    // lib dir first (dirs before files)
    expect(tree[0].children![0].name).toBe('lib')
    expect(tree[0].children![0].children![0].name).toBe('utils.ts')
    // then file
    expect(tree[0].children![1].name).toBe('index.ts')
  })

  it('sorts directories before files, alphabetically', () => {
    const files = [
      makeDiffFile('z.ts'),
      makeDiffFile('a.ts'),
      makeDiffFile('src/x.ts'),
      makeDiffFile('lib/y.ts'),
    ]
    const tree = buildFileTree(files)

    // dirs first: lib, src; then files: a.ts, z.ts
    expect(tree[0].name).toBe('lib')
    expect(tree[1].name).toBe('src')
    expect(tree[2].name).toBe('a.ts')
    expect(tree[3].name).toBe('z.ts')
  })

  it('handles mixed depth files correctly', () => {
    const files = [
      makeDiffFile('README.md'),
      makeDiffFile('src/components/button.tsx'),
      makeDiffFile('src/components/input.tsx'),
      makeDiffFile('src/lib/utils.ts'),
      makeDiffFile('package.json'),
    ]
    const tree = buildFileTree(files)

    // src dir first, then files
    expect(tree[0].name).toBe('src')
    expect(tree[0].children).toHaveLength(2)
    // src/components has 2 children, not compressed
    expect(tree[0].children![0].name).toBe('components')
    expect(tree[0].children![0].children).toHaveLength(2)
    // src/lib has 1 file child, not compressed (lib is a dir with one file child, not one dir child)
    expect(tree[0].children![1].name).toBe('lib')
    expect(tree[0].children![1].children).toHaveLength(1)
    // Root files sorted by localeCompare: package.json < README.md
    expect(tree[1].name).toBe('package.json')
    expect(tree[2].name).toBe('README.md')
  })
})
