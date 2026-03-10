import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getPRData } from '@/server/pr'
import type { DiffFile } from '@/lib/diff-types'

export const Route = createFileRoute('/pr/$id')({
  component: PrDetail,
  loader: async ({ params }) => await getPRData({ data: parseInt(params.id) }),
})

function PrDetail() {
  const { pr, files } = Route.useLoaderData()

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-6">
        <Link to="/" className="text-gh-accent text-sm hover:underline">
          &larr; Back
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gh-text mb-1">
        {pr.title}
      </h1>
      <p className="text-gh-text/50 text-sm mb-4">
        {pr.owner}/{pr.repo}#{pr.number} &middot; {pr.base_branch} &larr; {pr.head_branch}
      </p>
      <div className="flex gap-3 text-sm mb-6">
        <span className="text-gh-green">+{pr.additions}</span>
        <span className="text-gh-red">-{pr.deletions}</span>
        <span className="text-gh-text/50">{files.length} files</span>
      </div>

      <div className="flex gap-4 border-b border-gh-secondary mb-6">
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-gh-accent border-b-2 border-gh-accent"
        >
          Files
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-gh-text/60 hover:text-gh-text"
        >
          Flow
        </button>
      </div>

      <div className="space-y-2">
        {files.map((file) => (
          <FileSection key={file.filename} file={file} />
        ))}
        {files.length === 0 && (
          <p className="text-gh-text/50">No file changes found.</p>
        )}
      </div>
    </div>
  )
}

function FileSection({ file }: { file: DiffFile }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gh-text/10 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gh-secondary hover:bg-gh-tertiary transition-colors text-left"
      >
        <span className="text-sm text-gh-text font-mono truncate">
          {expanded ? '▾' : '▸'} {file.filename}
        </span>
        <span className="text-xs flex gap-2 shrink-0 ml-4">
          <span className="text-gh-green">+{file.additions}</span>
          <span className="text-gh-red">-{file.deletions}</span>
        </span>
      </button>
      {expanded && (
        <pre className="overflow-x-auto text-xs leading-5 p-0 m-0">
          {file.content.split('\n').map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+') && !line.startsWith('+++')
                  ? 'bg-gh-green/10 text-gh-green px-4'
                  : line.startsWith('-') && !line.startsWith('---')
                    ? 'bg-gh-red/10 text-gh-red px-4'
                    : line.startsWith('@@')
                      ? 'bg-gh-accent/10 text-gh-accent px-4'
                      : 'text-gh-text/70 px-4'
              }
            >
              {line}
            </div>
          ))}
        </pre>
      )}
    </div>
  )
}
