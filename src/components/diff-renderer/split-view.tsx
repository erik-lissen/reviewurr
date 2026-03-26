import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import { List } from 'react-window'
import { parseHunks, langFromFilename, type DiffFile } from '@/lib/diff-types'
import { hunksToSplitRows, type SplitRow } from '@/lib/split-diff'
import { highlight, type HighlightToken } from '@/lib/highlight'
import { HunkHeader } from './hunk-header'

const LINE_HEIGHT = 24
const HUNK_HEADER_HEIGHT = 24

interface SplitViewProps {
  file: DiffFile
}

interface SplitRowComponentProps {
  index: number
  style: React.CSSProperties
  rows: SplitRow[]
  leftTokenMap: Map<number, HighlightToken[]>
  rightTokenMap: Map<number, HighlightToken[]>
}

function SplitRowComponent({ index, style, rows, leftTokenMap, rightTokenMap }: SplitRowComponentProps) {
  const row = rows[index]
  if (!row) return null

  if (row.kind === 'hunk-header') {
    return (
      <div style={style}>
        <HunkHeader header={row.header} />
      </div>
    )
  }

  const { left, right } = row

  return (
    <div style={style} className="flex">
      {/* Left side (old) */}
      <div className={`flex-1 flex items-start font-mono text-xs leading-6 min-w-0 ${
        left?.type === 'del' ? 'bg-gh-red/10' : left === null ? 'bg-gh-tertiary/50' : ''
      }`}>
        <span className="w-[50px] shrink-0 text-right pr-2 text-gh-text/30 select-none">
          {left?.oldLine ?? ''}
        </span>
        <span className={`w-[16px] shrink-0 text-center select-none ${
          left?.type === 'del' ? 'text-gh-red' : 'text-gh-text/30'
        }`}>
          {left?.type === 'del' ? '-' : left ? ' ' : ''}
        </span>
        <span className="whitespace-pre overflow-x-auto pr-2 min-w-0">
          {left ? renderTokens(left.content, leftTokenMap.get(index)) : ''}
        </span>
      </div>
      {/* Right side (new) */}
      <div className={`flex-1 flex items-start font-mono text-xs leading-6 min-w-0 border-l border-gh-text/10 ${
        right?.type === 'add' ? 'bg-gh-green/10' : right === null ? 'bg-gh-tertiary/50' : ''
      }`}>
        <span className="w-[50px] shrink-0 text-right pr-2 text-gh-text/30 select-none">
          {right?.newLine ?? ''}
        </span>
        <span className={`w-[16px] shrink-0 text-center select-none ${
          right?.type === 'add' ? 'text-gh-green' : 'text-gh-text/30'
        }`}>
          {right?.type === 'add' ? '+' : right ? ' ' : ''}
        </span>
        <span className="whitespace-pre overflow-x-auto pr-2 min-w-0">
          {right ? renderTokens(right.content, rightTokenMap.get(index)) : ''}
        </span>
      </div>
    </div>
  )
}

function renderTokens(content: string, tokens?: HighlightToken[]) {
  if (tokens) {
    return tokens.map((token, i) => (
      <span key={i} style={token.color ? { color: token.color } : undefined}>
        {token.content}
      </span>
    ))
  }
  return <span className="text-gh-text/70">{content}</span>
}

export function SplitView({ file }: SplitViewProps) {
  const [expanded, setExpanded] = useState(false)
  const [rows, setRows] = useState<SplitRow[]>([])
  const [leftTokenMap, setLeftTokenMap] = useState<Map<number, HighlightToken[]>>(new Map())
  const [rightTokenMap, setRightTokenMap] = useState<Map<number, HighlightToken[]>>(new Map())

  useEffect(() => {
    if (!expanded) return
    const hunks = parseHunks(file.content)
    const splitRows = hunksToSplitRows(hunks)
    setRows(splitRows)

    const lang = langFromFilename(file.filename)
    if (lang === 'text') return

    // Collect left-side and right-side code lines for highlighting
    const leftLines: { rowIdx: number; content: string }[] = []
    const rightLines: { rowIdx: number; content: string }[] = []

    for (let i = 0; i < splitRows.length; i++) {
      const row = splitRows[i]
      if (row.kind === 'pair') {
        if (row.left) leftLines.push({ rowIdx: i, content: row.left.content })
        if (row.right) rightLines.push({ rowIdx: i, content: row.right.content })
      }
    }

    // Highlight left side
    if (leftLines.length > 0) {
      const code = leftLines.map((l) => l.content).join('\n')
      highlight(code, lang)
        .then((tokens) => {
          const map = new Map<number, HighlightToken[]>()
          for (let j = 0; j < leftLines.length && j < tokens.length; j++) {
            map.set(leftLines[j].rowIdx, tokens[j])
          }
          setLeftTokenMap(map)
        })
        .catch(() => {})
    }

    // Highlight right side
    if (rightLines.length > 0) {
      const code = rightLines.map((l) => l.content).join('\n')
      highlight(code, lang)
        .then((tokens) => {
          const map = new Map<number, HighlightToken[]>()
          for (let j = 0; j < rightLines.length && j < tokens.length; j++) {
            map.set(rightLines[j].rowIdx, tokens[j])
          }
          setRightTokenMap(map)
        })
        .catch(() => {})
    }
  }, [expanded, file.content, file.filename])

  const getRowHeight = useCallback(
    (index: number) => {
      const row = rows[index]
      return row?.kind === 'hunk-header' ? HUNK_HEADER_HEIGHT : LINE_HEIGHT
    },
    [rows]
  )

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
            rowComponent={SplitRowComponent}
            rowProps={{ rows, leftTokenMap, rightTokenMap }}
            overscanCount={20}
          />
        </div>
      )}
    </div>
  )
}
