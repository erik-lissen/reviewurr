import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-bold text-gh-text mb-4">Code Review</h1>
      <p className="text-gh-text/70 mb-8">
        Paste a GitHub PR URL to start reviewing.
      </p>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="https://github.com/owner/repo/pull/123"
          className="flex-1 bg-gh-secondary border border-gh-text/20 rounded-md px-4 py-2 text-gh-text placeholder:text-gh-text/40 focus:outline-none focus:ring-2 focus:ring-gh-accent/50"
        />
        <button
          type="button"
          className="bg-gh-accent text-white px-5 py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          Review
        </button>
      </div>
    </div>
  )
}
