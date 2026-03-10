import { useState, useEffect } from 'react'
import type { DiffFile } from '@/lib/diff-types'
import { BeatCard, type Beat } from './beat-card'
import { analyzePR, getCachedBeats, clearBeats } from '@/server/analysis'

interface BeatListProps {
  prId: number
  files: DiffFile[]
  model?: string
}

export function BeatList({ prId, files, model = 'claude-sonnet' }: BeatListProps) {
  const [beats, setBeats] = useState<Beat[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for cached beats on mount and when model changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getCachedBeats({ data: { prId, model } })
      .then((cached) => {
        if (cancelled) return
        setBeats(cached as Beat[] | null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [prId, model])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      const result = await analyzePR({ data: { prId, model } })
      setBeats(result as Beat[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReanalyze = async () => {
    await clearBeats({ data: { prId, model } })
    setBeats(null)
    await handleAnalyze()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gh-text/50 text-sm">
        Loading...
      </div>
    )
  }

  if (!beats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-gh-text/50 text-sm">
          Analyze this PR to break it into logical beats for easier review.
        </p>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gh-accent text-white hover:bg-gh-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? 'Analyzing...' : 'Analyze'}
        </button>
        {analyzing && (
          <p className="text-gh-text/40 text-xs">
            This may take a minute. Claude is reading the diff...
          </p>
        )}
        {error && (
          <div className="mt-2 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-xs max-w-md">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gh-text/60">
          {beats.length} beat{beats.length !== 1 ? 's' : ''}
        </h2>
        <button
          type="button"
          onClick={handleReanalyze}
          disabled={analyzing}
          className="px-3 py-1 text-xs font-medium rounded bg-gh-tertiary text-gh-text/70 hover:text-gh-text border border-gh-text/10 disabled:opacity-50"
        >
          {analyzing ? 'Analyzing...' : 'Re-analyze'}
        </button>
      </div>
      {beats.map((beat) => (
        <BeatCard key={beat.id} beat={beat} files={files} />
      ))}
      {error && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-xs">
          {error}
        </div>
      )}
    </div>
  )
}
