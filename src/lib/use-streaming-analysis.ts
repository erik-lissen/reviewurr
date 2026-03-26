import { useRef, useCallback } from 'react'
import type { Beat } from '@/components/flow/beat-card'

export interface StreamingState {
  phase: 'idle' | 'thinking' | 'streaming' | 'parsing' | 'done' | 'error'
  thinkingText: string
  streamedText: string
  beats: Beat[]
  error: string | null
  startedAt: number | null
}

export const initialStreamingState: StreamingState = {
  phase: 'idle',
  thinkingText: '',
  streamedText: '',
  beats: [],
  error: null,
  startedAt: null,
}

export function useStreamingAnalysis(
  onStateChange: (state: StreamingState) => void,
  stateRef: React.RefObject<StreamingState>
) {
  const abortRef = useRef<AbortController | null>(null)

  const startAnalysis = useCallback(
    async (prId: number, model: string) => {
      abortRef.current?.abort()

      const controller = new AbortController()
      abortRef.current = controller

      onStateChange({
        phase: 'thinking',
        thinkingText: '',
        streamedText: '',
        beats: [],
        error: null,
        startedAt: Date.now(),
      })

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prId, model }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let eventType = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7)
            } else if (line.startsWith('data: ') && eventType) {
              const data = JSON.parse(line.slice(6))
              const current = stateRef.current!

              switch (eventType) {
                case 'thinking': {
                  onStateChange({
                    ...current,
                    phase: 'thinking',
                    thinkingText: current.thinkingText + data.text,
                  })
                  break
                }
                case 'chunk': {
                  onStateChange({
                    ...current,
                    phase: 'streaming',
                    streamedText: current.streamedText + data.text,
                  })
                  break
                }
                case 'beat': {
                  onStateChange({
                    ...current,
                    phase: 'parsing',
                    beats: [...current.beats, data as Beat],
                  })
                  break
                }
                case 'done': {
                  onStateChange({
                    ...current,
                    phase: 'done',
                  })
                  break
                }
                case 'error': {
                  onStateChange({
                    ...current,
                    phase: 'error',
                    error: data.message,
                  })
                  break
                }
              }

              eventType = ''
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return

        const current = stateRef.current
        onStateChange({
          phase: 'error',
          thinkingText: current?.thinkingText || '',
          streamedText: current?.streamedText || '',
          beats: current?.beats || [],
          error: (e as Error).message,
          startedAt: current?.startedAt || null,
        })
      }
    },
    [onStateChange, stateRef]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return { startAnalysis, cancel }
}
