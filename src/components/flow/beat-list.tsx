import { useState, useEffect, useRef } from 'react'
import type { DiffFile } from '@/lib/diff-types'
import { BeatCard, type Beat } from './beat-card'
import { getCachedBeats, clearBeats } from '@/server/analysis'
import {
  useStreamingAnalysis,
  initialStreamingState,
  type StreamingState,
} from '@/lib/use-streaming-analysis'

interface BeatListProps {
  prId: number
  files: DiffFile[]
  model?: string
  streamingState: StreamingState
  onStreamingStateChange: (state: StreamingState) => void
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

function StreamingOutput({ text }: { text: string }) {
  const containerRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  const displayText = text.length > 2000 ? '...' + text.slice(-2000) : text

  return (
    <pre
      ref={containerRef}
      className="text-[11px] leading-relaxed font-mono text-gh-text/40 bg-gh-bg/50 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-gh-text/5"
    >
      {displayText}
      <span className="animate-pulse">|</span>
    </pre>
  )
}

const MODEL_LABELS: Record<string, string> = {
  'claude-haiku': 'Claude Haiku',
  'claude-sonnet': 'Claude Sonnet',
  'claude-opus': 'Claude Opus',
  'codex': 'Codex',
}

export function BeatList({ prId, files, model = 'claude-opus', streamingState, onStreamingStateChange }: BeatListProps) {
  const { phase, streamedText, beats, error, startedAt } = streamingState
  const [cachedBeats, setCachedBeats] = useState<Beat[] | null>(null)
  const [cacheChecked, setCacheChecked] = useState(false)

  const stateRef = useRef(streamingState)
  stateRef.current = streamingState

  const { startAnalysis } = useStreamingAnalysis(onStreamingStateChange, stateRef)

  // Check for cached beats on mount (only if idle)
  useEffect(() => {
    if (phase !== 'idle') {
      setCacheChecked(true)
      return
    }

    let cancelled = false
    getCachedBeats({ data: { prId, model } })
      .then((cached) => {
        if (cancelled) return
        setCachedBeats(cached as Beat[] | null)
        setCacheChecked(true)
      })
      .catch(() => {
        if (cancelled) return
        setCacheChecked(true)
      })

    return () => { cancelled = true }
  }, [prId, model])

  const handleAnalyze = () => {
    setCachedBeats(null)
    startAnalysis(prId, model)
  }

  const handleReanalyze = async () => {
    await clearBeats({ data: { prId, model } })
    setCachedBeats(null)
    onStreamingStateChange(initialStreamingState)
    setTimeout(() => startAnalysis(prId, model), 0)
  }

  const isStreaming = phase === 'streaming'
  const isParsing = phase === 'parsing'
  const isActive = isStreaming || isParsing
  const isDone = phase === 'done'

  // Beats to display: cached OR streamed (streamed beats persist in state after done)
  const displayBeats = cachedBeats ?? (beats.length > 0 ? beats : null)

  // Loading cache check
  if (!cacheChecked && phase === 'idle') {
    return (
      <div className="flex items-center justify-center py-12 text-gh-text/50 text-sm">
        Loading...
      </div>
    )
  }

  // Empty state — no beats, not doing anything
  if (!displayBeats && !isActive && !isDone && phase !== 'error') {
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
          Analyze with {MODEL_LABELS[model] || model}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isActive && (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-gh-accent border-t-transparent animate-spin" />
          )}
          <h2 className="text-sm font-medium text-gh-text/60">
            {isStreaming
              ? `${MODEL_LABELS[model] || model} is thinking...`
              : isParsing
                ? `Parsing beats... (${beats.length} so far)`
                : displayBeats
                  ? `${displayBeats.length} beat${displayBeats.length !== 1 ? 's' : ''}`
                  : ''
            }
          </h2>
          {isActive && startedAt && (
            <span className="text-xs text-gh-text/30">
              <ElapsedTimer startedAt={startedAt} />
            </span>
          )}
        </div>
        {!isActive && displayBeats && (
          <button
            type="button"
            onClick={handleReanalyze}
            className="px-3 py-1 text-xs font-medium rounded bg-gh-tertiary text-gh-text/70 hover:text-gh-text border border-gh-text/10"
          >
            Re-analyze
          </button>
        )}
      </div>

      {/* Streaming raw output */}
      {isStreaming && streamedText && (
        <StreamingOutput text={streamedText} />
      )}

      {/* Beat cards */}
      {displayBeats && displayBeats.map((beat, i) => (
        <div
          key={beat.id || `stream-${i}`}
          className={isParsing && i === displayBeats.length - 1 ? 'animate-fade-in' : ''}
        >
          <BeatCard beat={beat} files={files} />
        </div>
      ))}

      {/* Error with retry */}
      {error && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-xs">
          {error}
          <button
            type="button"
            onClick={handleAnalyze}
            className="ml-3 underline hover:text-red-200"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
