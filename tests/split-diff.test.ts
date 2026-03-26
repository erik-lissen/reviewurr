import { describe, it, expect } from 'vitest'
import { hunksToSplitRows, type SplitRow } from '@/lib/split-diff'
import type { DiffHunk, DiffChange } from '@/lib/diff-types'

function ctx(oldLine: number, newLine: number, content: string): DiffChange {
  return { type: 'context', oldLine, newLine, content }
}
function add(newLine: number, content: string): DiffChange {
  return { type: 'add', newLine, content }
}
function del(oldLine: number, content: string): DiffChange {
  return { type: 'del', oldLine, content }
}

function makeHunk(changes: DiffChange[]): DiffHunk {
  return { oldStart: 1, oldLines: 10, newStart: 1, newLines: 10, header: '@@ -1,10 +1,10 @@', changes }
}

describe('hunksToSplitRows', () => {
  it('returns hunk header as first row', () => {
    const rows = hunksToSplitRows([makeHunk([])])
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('hunk-header')
  })

  it('places context lines on both sides', () => {
    const rows = hunksToSplitRows([makeHunk([ctx(1, 1, 'hello')])])
    expect(rows).toHaveLength(2)
    const pair = rows[1]
    expect(pair.kind).toBe('pair')
    if (pair.kind === 'pair') {
      expect(pair.left).toEqual(ctx(1, 1, 'hello'))
      expect(pair.right).toEqual(ctx(1, 1, 'hello'))
    }
  })

  it('places add lines on right with null left', () => {
    const rows = hunksToSplitRows([makeHunk([add(1, 'new line')])])
    expect(rows).toHaveLength(2)
    const pair = rows[1]
    if (pair.kind === 'pair') {
      expect(pair.left).toBeNull()
      expect(pair.right?.type).toBe('add')
      expect(pair.right?.content).toBe('new line')
    }
  })

  it('places del lines on left with null right', () => {
    const rows = hunksToSplitRows([makeHunk([del(1, 'old line')])])
    expect(rows).toHaveLength(2)
    const pair = rows[1]
    if (pair.kind === 'pair') {
      expect(pair.left?.type).toBe('del')
      expect(pair.left?.content).toBe('old line')
      expect(pair.right).toBeNull()
    }
  })

  it('pairs consecutive del+add lines side by side', () => {
    const changes = [
      del(1, 'old A'),
      del(2, 'old B'),
      add(1, 'new A'),
      add(2, 'new B'),
    ]
    const rows = hunksToSplitRows([makeHunk(changes)])
    // 1 header + 2 pairs
    expect(rows).toHaveLength(3)

    const pair1 = rows[1]
    if (pair1.kind === 'pair') {
      expect(pair1.left?.content).toBe('old A')
      expect(pair1.right?.content).toBe('new A')
    }

    const pair2 = rows[2]
    if (pair2.kind === 'pair') {
      expect(pair2.left?.content).toBe('old B')
      expect(pair2.right?.content).toBe('new B')
    }
  })

  it('handles uneven del/add pairs (more dels than adds)', () => {
    const changes = [
      del(1, 'old A'),
      del(2, 'old B'),
      del(3, 'old C'),
      add(1, 'new A'),
    ]
    const rows = hunksToSplitRows([makeHunk(changes)])
    // 1 header + 3 pairs (max of dels/adds)
    expect(rows).toHaveLength(4)

    if (rows[1].kind === 'pair') {
      expect(rows[1].left?.content).toBe('old A')
      expect(rows[1].right?.content).toBe('new A')
    }
    if (rows[2].kind === 'pair') {
      expect(rows[2].left?.content).toBe('old B')
      expect(rows[2].right).toBeNull()
    }
    if (rows[3].kind === 'pair') {
      expect(rows[3].left?.content).toBe('old C')
      expect(rows[3].right).toBeNull()
    }
  })

  it('handles uneven del/add pairs (more adds than dels)', () => {
    const changes = [
      del(1, 'old A'),
      add(1, 'new A'),
      add(2, 'new B'),
      add(3, 'new C'),
    ]
    const rows = hunksToSplitRows([makeHunk(changes)])
    // 1 header + 3 pairs
    expect(rows).toHaveLength(4)

    if (rows[1].kind === 'pair') {
      expect(rows[1].left?.content).toBe('old A')
      expect(rows[1].right?.content).toBe('new A')
    }
    if (rows[2].kind === 'pair') {
      expect(rows[2].left).toBeNull()
      expect(rows[2].right?.content).toBe('new B')
    }
  })

  it('handles mixed context, del, add sequence', () => {
    const changes = [
      ctx(1, 1, 'same'),
      del(2, 'removed'),
      add(2, 'added'),
      ctx(3, 3, 'same again'),
    ]
    const rows = hunksToSplitRows([makeHunk(changes)])
    // 1 header + 3 rows (ctx, del/add pair, ctx)
    expect(rows).toHaveLength(4)

    if (rows[1].kind === 'pair') {
      expect(rows[1].left?.content).toBe('same')
      expect(rows[1].right?.content).toBe('same')
    }
    if (rows[2].kind === 'pair') {
      expect(rows[2].left?.content).toBe('removed')
      expect(rows[2].right?.content).toBe('added')
    }
    if (rows[3].kind === 'pair') {
      expect(rows[3].left?.content).toBe('same again')
      expect(rows[3].right?.content).toBe('same again')
    }
  })

  it('handles multiple hunks', () => {
    const hunk1 = makeHunk([ctx(1, 1, 'line1')])
    const hunk2 = makeHunk([add(5, 'new line')])
    const rows = hunksToSplitRows([hunk1, hunk2])
    // 2 headers + 1 ctx + 1 add
    expect(rows).toHaveLength(4)
    expect(rows[0].kind).toBe('hunk-header')
    expect(rows[2].kind).toBe('hunk-header')
  })
})
