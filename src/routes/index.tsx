import { createFileRoute } from '@tanstack/react-router'
import { PRInput } from '@/components/pr-input'
import { PRList } from '@/components/pr-list'
import { getCachedPRs } from '@/server/pr'

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => await getCachedPRs(),
})

function Home() {
  const prs = Route.useLoaderData()

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-bold text-gh-text mb-4">Code Review</h1>
      <p className="text-gh-text/70 mb-8">
        Paste a GitHub PR URL to start reviewing.
      </p>
      <PRInput />
      <div className="mt-12">
        <h2 className="text-lg font-semibold text-gh-text/80 mb-3">Recent PRs</h2>
        <PRList prs={prs} />
      </div>
    </div>
  )
}
