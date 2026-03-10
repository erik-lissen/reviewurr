import React from 'react'

interface HunkHeaderProps {
  header: string
}

export const HunkHeader = React.memo(function HunkHeader({ header }: HunkHeaderProps) {
  return (
    <div className="flex items-center bg-gh-accent/10 text-gh-accent text-xs font-mono leading-6 select-none">
      <span className="w-[100px] shrink-0" />
      <span className="px-2">{header}</span>
    </div>
  )
})
