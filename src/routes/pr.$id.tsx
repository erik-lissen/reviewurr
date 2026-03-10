import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pr/$id')({
  component: PrDetail,
})

function PrDetail() {
  const { id } = Route.useParams()

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-xl font-bold text-gh-text mb-4">PR #{id}</h1>
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
      <p className="text-gh-text/50">File diff view will appear here.</p>
    </div>
  )
}
