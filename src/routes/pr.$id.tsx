import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getPRData } from '@/server/pr'
import { DiffRenderer, type ViewMode } from '@/components/diff-renderer'
import { FileTree } from '@/components/file-tree'

export const Route = createFileRoute('/pr/$id')({
  component: PrDetail,
  loader: async ({ params }) => await getPRData({ data: parseInt(params.id) }),
})

function PrDetail() {
  const { pr, files } = Route.useLoaderData()
  const [viewMode, setViewMode] = useState<ViewMode>('unified')

  return (
    <div className="py-8 px-6">
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

      <div className="flex items-center justify-between border-b border-gh-secondary mb-6">
        <div className="flex gap-4">
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
        <div className="flex gap-1 mb-1">
          <button
            type="button"
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1 text-xs rounded-l border ${
              viewMode === 'unified'
                ? 'bg-gh-tertiary text-gh-text border-gh-text/20'
                : 'bg-gh-secondary text-gh-text/50 border-gh-text/10 hover:text-gh-text'
            }`}
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-xs rounded-r border ${
              viewMode === 'split'
                ? 'bg-gh-tertiary text-gh-text border-gh-text/20'
                : 'bg-gh-secondary text-gh-text/50 border-gh-text/10 hover:text-gh-text'
            }`}
          >
            Split
          </button>
        </div>
      </div>

      <div className="flex gap-0">
        <div className="flex-1 min-w-0">
          <DiffRenderer files={files} viewMode={viewMode} />
        </div>
        <FileTree files={files} />
      </div>
    </div>
  )
}
