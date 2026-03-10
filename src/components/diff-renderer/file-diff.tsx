import { useState, useEffect, useCallback } from 'react'
import { List } from 'react-window'
import { parseHunks, hunksToRows, langFromFilename, type DiffFile, type DiffRow } from '@/lib/diff-types'
import { highlight, type HighlightToken } from '@/lib/highlight'
import { Line } from './line'
import { HunkHeader } from './hunk-header'

const LINE_HEIGHT = 24 // leading-6 = 1.5rem = 24px
const HUNK_HEADER_HEIGHT = 24

interface FileDiffProps {
  file: DiffFile
}

interface RowComponentProps {
  index: number
  style: React.CSSProperties
  rows: DiffRow[]
  tokenMap: Map<number, HighlightToken[]>
}

function RowComponent({ index, style, rows, tokenMap }: RowComponentProps) {
  const row = rows[index]
  if (!row) return null

  if (row.kind === 'hunk-header') {
    return (
      <div style={style}>
        <HunkHeader header={row.header} />
      </div>
    )
  }

  return (
    <div style={style}>
      <Line change={row.change} tokens={tokenMap.get(index)} />
    </div>
  )
}

export function FileDiff({ file }: FileDiffProps) {
  const [expanded, setExpanded] = useState(false)
  const [rows, setRows] = useState<DiffRow[]>([])
  const [tokenMap, setTokenMap] = useState<Map<number, HighlightToken[]>>(new Map())

  useEffect(() => {
    if (!expanded) return
    const hunks = parseHunks(file.content)
    const r = hunksToRows(hunks)
    setRows(r)

    // Highlight all code lines in one batch
    const codeLines = r
      .filter((row): row is Extract<DiffRow, { kind: 'change' }> => row.kind === 'change')
      .map((row) => row.change.content)

    const lang = langFromFilename(file.filename)
    const fullCode = codeLines.join('\n')

    if (fullCode.trim() && lang !== 'text') {
      highlight(fullCode, lang)
        .then((tokens) => {
          const map = new Map<number, HighlightToken[]>()
          let tokenLineIdx = 0
          for (let i = 0; i < r.length; i++) {
            if (r[i].kind === 'change') {
              if (tokenLineIdx < tokens.length) {
                map.set(i, tokens[tokenLineIdx])
              }
              tokenLineIdx++
            }
          }
          setTokenMap(map)
        })
        .catch(() => {
          // Highlighting failed, use plain text
        })
    }
  }, [expanded, file.content, file.filename])

  const getRowHeight = useCallback(
    (index: number) => {
      const row = rows[index]
      return row?.kind === 'hunk-header' ? HUNK_HEADER_HEIGHT : LINE_HEIGHT
    },
    [rows]
  )

  // Compute total height, cap at 600px for scroll
  const totalHeight = rows.reduce(
    (sum, row) =>
      sum + (row.kind === 'hunk-header' ? HUNK_HEADER_HEIGHT : LINE_HEIGHT),
    0
  )
  const listHeight = Math.min(totalHeight, 600)

  return (
    <div className="border border-gh-text/10 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gh-secondary hover:bg-gh-tertiary transition-colors text-left"
      >
        <span className="text-sm text-gh-text font-mono truncate">
          {expanded ? '\u25BE' : '\u25B8'} {file.filename}
        </span>
        <span className="text-xs flex gap-2 shrink-0 ml-4">
          <span className="text-gh-green">+{file.additions}</span>
          <span className="text-gh-red">-{file.deletions}</span>
        </span>
      </button>
      {expanded && rows.length > 0 && (
        <div className="overflow-x-auto">
          <List
            height={listHeight}
            rowCount={rows.length}
            rowHeight={getRowHeight}
            rowComponent={RowComponent}
            rowProps={{ rows, tokenMap }}
            overscanCount={20}
          />
        </div>
      )}
    </div>
  )
}
