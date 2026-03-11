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
                  if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    const text = event.delta.text
                    fullOutput += text
                    send('chunk', { text })
                  }
                } else if (message.type === 'assistant') {
                  // Complete assistant message — extract full text if we missed any
                  const content = (message as any).message?.content
                  if (content && Array.isArray(content)) {
                    const textBlocks = content.filter((b: any) => b.type === 'text')
                    const completeText = textBlocks.map((b: any) => b.text).join('')
                    if (completeText && !fullOutput) {
                      fullOutput = completeText
                    }
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
