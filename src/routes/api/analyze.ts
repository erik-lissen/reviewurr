import { createFileRoute } from '@tanstack/react-router'
import Anthropic from '@anthropic-ai/sdk'
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

        const client = new Anthropic()

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()

            function send(event: string, data: unknown) {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            }

            let fullOutput = ''

            try {
              const messageStream = client.messages.stream({
                model: modelId,
                max_tokens: 16384,
                messages: [{ role: 'user', content: prompt }],
              })

              messageStream.on('text', (text) => {
                fullOutput += text
                send('chunk', { text })
              })

              // Wait for the stream to complete
              await messageStream.finalMessage()

              // Parse and store beats
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
