import { useState } from 'react'
import type { DiffFile } from '@/lib/diff-types'
import type { RefLink } from '@/lib/detect-refs'
import { FileDiff } from '@/components/diff-renderer/file-diff'

interface BeatHunk {
  file_path: string
  hunk_spec: string
}

export interface Beat {
  id: number
  title: string
  description: string
  reading_order: number
  refs: RefLink[]
  hunks: BeatHunk[]
}

interface BeatCardProps {
  beat: Beat
  files: DiffFile[]
}

export function BeatCard({ beat, files }: BeatCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Match beat hunks to actual diff files
  const matchedFiles = beat.hunks
    .map((h) => files.find((f) => f.filename === h.file_path))
    .filter(Boolean) as DiffFile[]

  return (
    <div className="border border-gh-text/10 rounded-lg bg-gh-secondary overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-gh-accent/20 text-gh-accent text-xs font-bold flex items-center justify-center mt-0.5">
            {beat.reading_order}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gh-text mb-1">{beat.title}</h3>
            <p className="text-xs text-gh-text/70 leading-relaxed">{beat.description}</p>

            {beat.refs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {beat.refs.map((ref, i) => (
                  <span
                    key={`${ref.value}-${i}`}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                      ref.type === 'url'
                        ? 'bg-blue-900/30 text-blue-300 border border-blue-500/20'
                        : ref.type === 'jira'
                          ? 'bg-purple-900/30 text-purple-300 border border-purple-500/20'
                          : 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/20'
                    }`}
                  >
                    {ref.type === 'url' ? (
                      <a href={ref.value} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {ref.display.length > 50 ? `${ref.display.slice(0, 50)}...` : ref.display}
                      </a>
                    ) : (
                      ref.display
                    )}
                  </span>
                ))}
              </div>
            )}

            {matchedFiles.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="text-[11px] text-gh-accent hover:underline flex items-center gap-1"
                >
                  <span>{expanded ? '\u25BE' : '\u25B8'}</span>
                  {matchedFiles.length} file{matchedFiles.length !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && matchedFiles.length > 0 && (
        <div className="border-t border-gh-text/10">
          <div className="space-y-1">
            {matchedFiles.map((file) => (
              <FileDiff key={file.filename} file={file} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
