import { createFileRoute } from '@tanstack/react-router'
import {
  getPRById,
  getCommitDiffs,
  getFullDiff,
  deleteBeats,
  insertBeat,
  insertBeatHunk,
} from '@/server/db'
import { buildPrompt, type RawBeat } from '@/server/analysis'
import { detectRefs } from '@/lib/detect-refs'

const MODEL_IDS: Record<string, string> = {
  'claude-opus': 'claude-opus-4-6',
  'claude-sonnet': 'claude-sonnet-4-6',
  'claude-haiku': 'claude-haiku-4-5-20251001',
}

/**
 * Incrementally extract complete beat JSON objects from a growing text buffer.
 * Returns newly found beats (those after `alreadyFound` count).
 */
function extractNewBeats(text: string, alreadyFound: number): RawBeat[] {
  const newBeats: RawBeat[] = []

  // Find all JSON objects that have "title" and "files" — likely beats
  // Use a balanced-brace approach to find complete objects
  let depth = 0
  let objStart = -1
  let inString = false
  let escape = false
  let found = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        const candidate = text.slice(objStart, i + 1)
        // Quick check before expensive parse
        if (candidate.includes('"title"') && candidate.includes('"files"')) {
          try {
            const parsed = JSON.parse(candidate) as RawBeat
            if (parsed.title && Array.isArray(parsed.files)) {
              found++
              if (found > alreadyFound) {
                newBeats.push(parsed)
              }
            }
          } catch {
            // Incomplete or malformed, skip
          }
        }
        objStart = -1
      }
    }
  }

  return newBeats
}

function storeBeat(prId: number, model: string, beat: RawBeat) {
  const allText = [beat.title, beat.description, ...(beat.refs || [])].join(' ')
  const detectedRefs = detectRefs(allText)

  const beatId = insertBeat(
    prId,
    beat.title,
    beat.description,
    beat.readingOrder || 0,
    detectedRefs.length > 0 ? JSON.stringify(detectedRefs) : null,
    model
  )

  for (const file of beat.files) {
    insertBeatHunk(beatId, file.path, file.relevantHunks || 'all')
  }

  return {
    id: beatId,
    title: beat.title,
    description: beat.description,
    reading_order: beat.readingOrder || 0,
    refs: detectedRefs,
    hunks: beat.files.map((f) => ({
      file_path: f.path,
      hunk_spec: f.relevantHunks || 'all',
    })),
  }
}

export const Route = createFileRoute('/api/analyze')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prId, model } = (await request.json()) as { prId: number; model: string }

        const pr = getPRById(prId)
        if (!pr) {
          return new Response(JSON.stringify({ error: 'PR not found' }), { status: 404 })
        }

        const commitDiffs = getCommitDiffs(prId)
        const diffRow = getFullDiff(prId)
        if (!diffRow) {
          return new Response(JSON.stringify({ error: 'No diff found' }), { status: 404 })
        }

        const fileList: string[] = []
        const fileMatches = diffRow.content.matchAll(/^\+\+\+ b\/(.+)$/gm)
        for (const m of fileMatches) {
          if (m[1] && m[1] !== '/dev/null') fileList.push(m[1])
        }

        const prompt = buildPrompt(pr, commitDiffs, diffRow.content, fileList)
        const modelId = MODEL_IDS[model]

        if (!modelId) {
          return new Response(JSON.stringify({ error: `Unsupported model: ${model}` }), { status: 400 })
        }

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()

            function send(event: string, data: unknown) {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            }

            let textOutput = ''
            let thinkingOutput = ''
            let emittedBeatCount = 0

            try {
              const { query } = await import('@anthropic-ai/claude-agent-sdk')

              deleteBeats(prId, model)

              const conversation = query({
                prompt,
                options: {
                  model: modelId,
                  includePartialMessages: true,
                  maxTurns: 1,
                  allowedTools: [],
                  env: {
                    ...process.env,
                    CLAUDECODE: '',
                  },
                },
              })

              for await (const message of conversation) {
                if (message.type === 'stream_event') {
                  const event = (message as any).event
                  if (event?.type === 'content_block_delta') {
                    const delta = event.delta
                    if (delta?.type === 'text_delta') {
                      textOutput += delta.text
                      send('chunk', { text: delta.text })

                      // Try to extract beats from text output too
                      const newBeats = extractNewBeats(textOutput, emittedBeatCount)
                      for (const beat of newBeats) {
                        const stored = storeBeat(prId, model, beat)
                        send('beat', stored)
                        emittedBeatCount++
                      }
                    } else if (delta?.type === 'thinking_delta' && delta.thinking) {
                      thinkingOutput += delta.thinking
                      send('thinking', { text: delta.thinking })

                      // Parse beats from thinking stream as they appear!
                      const newBeats = extractNewBeats(thinkingOutput, emittedBeatCount)
                      for (const beat of newBeats) {
                        const stored = storeBeat(prId, model, beat)
                        send('beat', stored)
                        emittedBeatCount++
                      }
                    }
                  }
                } else if (message.type === 'result') {
                  const result = (message as any).result
                  if (result && !textOutput) {
                    textOutput = result
                  }
                }
              }

              // Final fallback — parse any remaining beats from text or thinking
              if (emittedBeatCount === 0) {
                const outputToParse = textOutput || thinkingOutput
                if (outputToParse) {
                  const remaining = extractNewBeats(outputToParse, 0)
                  for (const beat of remaining) {
                    const stored = storeBeat(prId, model, beat)
                    send('beat', stored)
                    emittedBeatCount++
                  }
                }
              }

              if (emittedBeatCount === 0) {
                send('error', { message: 'No beats found in model output' })
              } else {
                send('done', { count: emittedBeatCount })
              }
            } catch (e) {
              send('error', { message: (e as Error).message })
            }

            controller.close()
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
