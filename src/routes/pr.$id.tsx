import { useState, useEffect } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { getPRData, checkPRUpdate, fetchPR } from '@/server/pr'
import { DiffRenderer, type ViewMode } from '@/components/diff-renderer'
import { FileTree } from '@/components/file-tree'
import { BeatList } from '@/components/flow/beat-list'
import { ModelSelector, type ModelOption } from '@/components/flow/model-selector'
import { getPreferredModel, setPreferredModel } from '@/server/analysis'

export const Route = createFileRoute('/pr/$id')({
  component: PrDetail,
  loader: async ({ params }) => await getPRData({ data: parseInt(params.id) }),
})

function PrDetail() {
  const { pr, files } = Route.useLoaderData()
  const [activeTab, setActiveTab] = useState<'files' | 'flow'>('files')
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [selectedModel, setSelectedModel] = useState<ModelOption>('claude-sonnet')

  // Load preferred model from settings on mount
  useEffect(() => {
    getPreferredModel().then(setSelectedModel).catch(() => {})
  }, [])

  const handleModelChange = (model: ModelOption) => {
    setSelectedModel(model)
    setPreferredModel({ data: { model } }).catch(() => {})
  }

  const [updateStatus, setUpdateStatus] = useState<{
    checking: boolean
    updated: boolean
    error?: string
    refetching: boolean
  }>({ checking: true, updated: false, refetching: false })
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    setUpdateStatus({ checking: true, updated: false, refetching: false })

    checkPRUpdate({ data: { prId: pr.id } })
      .then((result) => {
        if (cancelled) return
        setUpdateStatus({
          checking: false,
          updated: result.updated,
          error: result.error,
          refetching: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setUpdateStatus({ checking: false, updated: false, refetching: false })
      })

    return () => { cancelled = true }
  }, [pr.id])

  const handleRefetch = async () => {
    setUpdateStatus((prev) => ({ ...prev, refetching: true }))
    try {
      await fetchPR({ data: { owner: pr.owner, repo: pr.repo, number: pr.number } })
      await router.invalidate()
    } catch {
      setUpdateStatus((prev) => ({
        ...prev,
        refetching: false,
        error: 'Failed to re-fetch PR.',
      }))
    }
  }

  return (
    <div className="py-8 px-6">
      <div className="mb-6">
        <Link to="/" className="text-gh-accent text-sm hover:underline">
          &larr; Back
        </Link>
      </div>

      {updateStatus.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
          {updateStatus.error}
        </div>
      )}

      {updateStatus.updated && !updateStatus.error && (
        <div className="mb-4 p-3 rounded-lg bg-amber-900/30 border border-amber-500/30 text-amber-300 text-sm flex items-center justify-between">
          <span>This PR has been updated since you last fetched it.</span>
          <button
            type="button"
            onClick={handleRefetch}
            disabled={updateStatus.refetching}
            className="ml-4 px-3 py-1 text-xs font-medium rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
          >
            {updateStatus.refetching ? 'Fetching...' : 'Re-fetch'}
          </button>
        </div>
      )}

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
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'files'
                ? 'text-gh-accent border-b-2 border-gh-accent'
                : 'text-gh-text/60 hover:text-gh-text'
            }`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flow')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'flow'
                ? 'text-gh-accent border-b-2 border-gh-accent'
                : 'text-gh-text/60 hover:text-gh-text'
            }`}
          >
            Flow
          </button>
        </div>
        {activeTab === 'flow' && (
          <div className="mb-1">
            <ModelSelector value={selectedModel} onChange={handleModelChange} />
          </div>
        )}
        {activeTab === 'files' && (
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
        )}
      </div>

      <div className="flex gap-0">
        <div className="flex-1 min-w-0">
          {activeTab === 'files' ? (
            <DiffRenderer files={files} viewMode={viewMode} />
          ) : (
            <BeatList prId={pr.id} files={files} model={selectedModel} />
          )}
        </div>
        <FileTree files={files} />
      </div>
    </div>
  )
}
