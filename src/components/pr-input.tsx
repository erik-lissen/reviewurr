import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { parsePRUrl } from '@/lib/diff-types'
import { fetchPR } from '@/server/pr'

export function PRInput() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = parsePRUrl(url)
    if (!parsed) {
      setError('Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123')
      return
    }

    setLoading(true)
    try {
      const result = await fetchPR({ data: parsed })
      navigate({ to: '/pr/$id', params: { id: String(result.id) } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch PR')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          className="flex-1 bg-gh-secondary border border-gh-text/20 rounded-md px-4 py-2 text-gh-text placeholder:text-gh-text/40 focus:outline-none focus:ring-2 focus:ring-gh-accent/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gh-accent text-white px-5 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Fetching...' : 'Review'}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-gh-red text-sm">{error}</p>
      )}
    </form>
  )
}
