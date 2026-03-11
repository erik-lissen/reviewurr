import { useState, useEffect, useRef } from 'react'
import type { DiffFile } from '@/lib/diff-types'
import { BeatCard, type Beat } from './beat-card'
import { analyzePR, getCachedBeats, clearBeats } from '@/server/analysis'

interface BeatListProps {
  prId: number
  files: DiffFile[]
  model?: string
  analysisState: AnalysisState
  onAnalysisStateChange: (state: AnalysisState) => void
}

export interface AnalysisState {
  analyzing: boolean
  startedAt: number | null
  beats: Beat[] | null
  error: string | null
  loaded: boolean
}

export const initialAnalysisState: AnalysisState = {
  analyzing: false,
  startedAt: null,
  beats: null,
  error: null,
  loaded: false,
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  return (
    <span className="tabular-nums">
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
    </span>
  )
}

export function BeatList({ prId, files, model = 'claude-opus', analysisState, onAnalysisStateChange }: BeatListProps) {
  const { analyzing, startedAt, beats, error, loaded } = analysisState
  const analysisPromiseRef = useRef<Promise<void> | null>(null)

  // Check for cached beats on mount and when model changes
  useEffect(() => {
    if (loaded) return
    let cancelled = false

    getCachedBeats({ data: { prId, model } })
      .then((cached) => {
        if (cancelled) return
        onAnalysisStateChange({ ...analysisState, beats: cached as Beat[] | null, loaded: true })
      })
      .catch(() => {
        if (cancelled) return
        onAnalysisStateChange({ ...analysisState, loaded: true })
      })

    return () => { cancelled = true }
  }, [prId, model])

  const handleAnalyze = () => {
    if (analysisPromiseRef.current) return

    const newState: AnalysisState = {
      analyzing: true,
      startedAt: Date.now(),
      beats: null,
      error: null,
      loaded: true,
    }
    onAnalysisStateChange(newState)

    const promise = analyzePR({ data: { prId, model } })
      .then((result) => {
        onAnalysisStateChange({
          analyzing: false,
          startedAt: null,
          beats: result as Beat[],
          error: null,
          loaded: true,
        })
      })
      .catch((e) => {
        onAnalysisStateChange({
          analyzing: false,
          startedAt: null,
          beats: null,
          error: e instanceof Error ? e.message : 'Analysis failed',
          loaded: true,
        })
      })
      .finally(() => {
        analysisPromiseRef.current = null
      })

    analysisPromiseRef.current = promise
  }

  const handleReanalyze = async () => {
    await clearBeats({ data: { prId, model } })
    onAnalysisStateChange({ ...initialAnalysisState, loaded: true })
    // Small delay so state settles before starting
    setTimeout(() => handleAnalyze(), 0)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-gh-text/50 text-sm">
        Loading...
      </div>
    )
  }

  if (!beats && !analyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-gh-text/50 text-sm">
          Analyze this PR to break it into logical beats for easier review.
        </p>
        <button
          type="button"
          onClick={handleAnalyze}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gh-accent text-white hover:bg-gh-accent/90"
        >
          Analyze
        </button>
        {error && (
          <div className="mt-2 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-xs max-w-md">
            {error}
          </div>
        )}
      </div>
    )
  }

  if (analyzing && startedAt) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-gh-accent border-t-transparent animate-spin" />
          <span className="text-sm text-gh-text/70">Analyzing with {model === 'claude-opus' ? 'Claude Opus' : model === 'claude-sonnet' ? 'Claude Sonnet' : 'Codex'}...</span>
        </div>
        <p className="text-gh-text/40 text-xs">
          Elapsed: <ElapsedTimer startedAt={startedAt} />
        </p>
        <p className="text-gh-text/30 text-xs">
          The model is reading the diff and reconstructing developer intent. This typically takes 30-90 seconds.
        </p>
      </div>
    )
  }

  if (!beats) return null

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
          Re-analyze
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
