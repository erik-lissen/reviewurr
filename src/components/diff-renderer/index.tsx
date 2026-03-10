import type { DiffFile } from '@/lib/diff-types'
import { FileDiff } from './file-diff'

interface DiffRendererProps {
  files: DiffFile[]
}

export function DiffRenderer({ files }: DiffRendererProps) {
  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileDiff key={file.filename} file={file} />
      ))}
      {files.length === 0 && (
        <p className="text-gh-text/50">No file changes found.</p>
      )}
    </div>
  )
}
