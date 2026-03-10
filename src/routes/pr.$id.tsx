import { createFileRoute, Link } from '@tanstack/react-router'
import { getPRData } from '@/server/pr'
import { DiffRenderer } from '@/components/diff-renderer'

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

      <DiffRenderer files={files} />
    </div>
  )
}
