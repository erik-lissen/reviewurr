import type { DiffFile } from '@/lib/diff-types'
import { FileDiff } from './file-diff'
import { SplitView } from './split-view'

export type ViewMode = 'unified' | 'split'

interface DiffRendererProps {
  files: DiffFile[]
  viewMode?: ViewMode
}

export function DiffRenderer({ files, viewMode = 'unified' }: DiffRendererProps) {
  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div key={file.filename} id={`file-${encodeURIComponent(file.filename)}`}>
          {viewMode === 'split' ? (
            <SplitView file={file} />
          ) : (
            <FileDiff file={file} />
          )}
        </div>
      ))}
      {files.length === 0 && (
        <p className="text-gh-text/50">No file changes found.</p>
      )}
    </div>
  )
}
