import React from 'react'
import type { DiffChange } from '@/lib/diff-types'
import type { HighlightToken } from '@/lib/highlight'

interface LineProps {
  change: DiffChange
  tokens?: HighlightToken[]
}

export const Line = React.memo(function Line({ change, tokens }: LineProps) {
  const bgClass =
    change.type === 'add'
      ? 'bg-gh-green/10'
      : change.type === 'del'
        ? 'bg-gh-red/10'
        : ''

  const indicatorClass =
    change.type === 'add'
      ? 'text-gh-green'
      : change.type === 'del'
        ? 'text-gh-red'
        : 'text-gh-text/30'

  const indicator =
    change.type === 'add' ? '+' : change.type === 'del' ? '-' : ' '

  return (
    <div className={`flex items-start font-mono text-xs leading-6 ${bgClass}`}>
      {/* Old line number gutter */}
      <span className="w-[50px] shrink-0 text-right pr-2 text-gh-text/30 select-none">
        {change.oldLine ?? ''}
      </span>
      {/* New line number gutter */}
      <span className="w-[50px] shrink-0 text-right pr-2 text-gh-text/30 select-none">
        {change.newLine ?? ''}
      </span>
      {/* Indicator */}
      <span className={`w-[16px] shrink-0 text-center select-none ${indicatorClass}`}>
        {indicator}
      </span>
      {/* Code content */}
      <span className="whitespace-pre overflow-x-auto pr-4">
        {tokens ? (
          tokens.map((token, i) => (
            <span key={i} style={token.color ? { color: token.color } : undefined}>
              {token.content}
            </span>
          ))
        ) : (
          <span className="text-gh-text/70">{change.content}</span>
        )}
      </span>
    </div>
  )
})
