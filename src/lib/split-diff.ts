import type { DiffChange, DiffHunk } from './diff-types'

/** A row in the split (side-by-side) diff view */
export type SplitRow =
  | { kind: 'hunk-header'; header: string }
  | { kind: 'pair'; left: DiffChange | null; right: DiffChange | null }

/** Convert hunks into aligned split-view rows */
export function hunksToSplitRows(hunks: DiffHunk[]): SplitRow[] {
  const rows: SplitRow[] = []

  for (const hunk of hunks) {
    rows.push({ kind: 'hunk-header', header: hunk.header })

    let i = 0
    const changes = hunk.changes

    while (i < changes.length) {
      const change = changes[i]

      if (change.type === 'context') {
        rows.push({ kind: 'pair', left: change, right: change })
        i++
      } else if (change.type === 'del') {
        // Collect consecutive del lines, then pair with consecutive add lines
        const dels: DiffChange[] = []
        while (i < changes.length && changes[i].type === 'del') {
          dels.push(changes[i])
          i++
        }
        const adds: DiffChange[] = []
        while (i < changes.length && changes[i].type === 'add') {
          adds.push(changes[i])
          i++
        }
        const maxLen = Math.max(dels.length, adds.length)
        for (let j = 0; j < maxLen; j++) {
          rows.push({
            kind: 'pair',
            left: j < dels.length ? dels[j] : null,
            right: j < adds.length ? adds[j] : null,
          })
        }
      } else if (change.type === 'add') {
        // Standalone add (no preceding del)
        rows.push({ kind: 'pair', left: null, right: change })
        i++
      } else {
        i++
      }
    }
  }

  return rows
}
