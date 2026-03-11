import { createFileRoute } from '@tanstack/react-router'
import {
  getPRById,
  getCommitDiffs,
  getFullDiff,
  deleteBeats,
  insertBeat,
  insertBeatHunk,
} from '@/server/db'
import { buildPrompt, parseBeatsFromOutput } from '@/server/analysis'
import { detectRefs } from '@/lib/detect-refs'

const MODEL_IDS: Record<string, string> = {
  'claude-opus': 'claude-opus-4-6',
  'claude-sonnet': 'claude-sonnet-4-6',
  'claude-haiku': 'claude-haiku-4-5-20251001',
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

            let fullOutput = ''

            try {
              const { query } = await import('@anthropic-ai/claude-agent-sdk')
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
                      fullOutput += delta.text
                      send('chunk', { text: delta.text })
                    } else if (delta?.type === 'thinking_delta' && delta.thinking) {
                      send('thinking', { text: delta.thinking })
                    }
                  }
                } else if (message.type === 'result') {
                  // Extract full text from the result if streaming missed it
                  const result = (message as any).result
                  if (result && !fullOutput) {
                    fullOutput = result
                  }
                }
              }

              // Parse and store beats
              if (!fullOutput) {
                send('error', { message: 'No output from model' })
                controller.close()
                return
              }

              try {
                const beats = parseBeatsFromOutput(fullOutput)

                deleteBeats(prId, model)
                const storedBeats = []

                for (const beat of beats) {
                  const allText = [beat.title, beat.description, ...(beat.refs || [])].join(' ')
                  const detectedRefs = detectRefs(allText)

                  const beatId = insertBeat(
                    prId,
                    beat.title,
                    beat.description,
                    beat.readingOrder,
                    detectedRefs.length > 0 ? JSON.stringify(detectedRefs) : null,
                    model
                  )

                  for (const file of beat.files) {
                    insertBeatHunk(beatId, file.path, file.relevantHunks || 'all')
                  }

                  const storedBeat = {
                    id: beatId,
                    title: beat.title,
                    description: beat.description,
                    reading_order: beat.readingOrder,
                    refs: detectedRefs,
                    hunks: beat.files.map((f) => ({
                      file_path: f.path,
                      hunk_spec: f.relevantHunks || 'all',
                    })),
                  }

                  storedBeats.push(storedBeat)
                  send('beat', storedBeat)
                }

                send('done', { count: storedBeats.length })
              } catch (e) {
                send('error', { message: `Parse error: ${(e as Error).message}` })
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
