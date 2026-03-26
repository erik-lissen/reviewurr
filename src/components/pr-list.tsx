import { Link } from '@tanstack/react-router'
import { timeAgo } from '@/lib/time-ago'

interface CachedPR {
  id: number
  owner: string
  repo: string
  number: number
  title: string
  additions: number
  deletions: number
  fetched_at: string
}

export function PRList({ prs }: { prs: CachedPR[] }) {
  if (prs.length === 0) {
    return <p className="text-gh-text/40 text-sm">No recent reviews yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {prs.map((pr) => (
        <Link
          key={pr.id}
          to="/pr/$id"
          params={{ id: String(pr.id) }}
          className="block p-4 rounded-lg bg-gh-secondary hover:bg-gh-tertiary transition-colors border border-gh-text/10"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gh-text/60 text-xs mb-1">
                {pr.owner}/{pr.repo}
              </p>
              <p className="text-gh-text font-medium text-sm truncate">
                #{pr.number} {pr.title}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex gap-2 text-xs">
                <span className="text-gh-green">+{pr.additions}</span>
                <span className="text-gh-red">-{pr.deletions}</span>
              </div>
              <span className="text-gh-text/40 text-xs">
                {timeAgo(pr.fetched_at)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
