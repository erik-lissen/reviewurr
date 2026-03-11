import { createFileRoute } from '@tanstack/react-router'
import { spawn } from 'node:child_process'
import {
  getPRById,
  getCommitDiffs,
  getFullDiff,
  deleteBeats,
  insertBeat,
  insertBeatHunk,
} from '@/server/db'
import { buildPrompt, parseBeatsFromOutput, type RawBeat } from '@/server/analysis'
import { detectRefs } from '@/lib/detect-refs'

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

        const env = { ...process.env } as Record<string, string | undefined>
        delete env.CLAUDECODE

        // Determine CLI command and args
        let cmd: string
        let args: string[]

        if (model === 'codex') {
          cmd = 'codex'
          args = ['exec', '-']
        } else {
          cmd = 'claude'
          const modelId = model === 'claude-opus' ? 'claude-opus-4-6' : 'claude-sonnet-4-6'
          args = ['-p', '--model', modelId, '--output-format', 'json']
        }

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder()

            function send(event: string, data: unknown) {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            }

            const proc = spawn(cmd, args, {
              env: env as NodeJS.ProcessEnv,
              stdio: ['pipe', 'pipe', 'pipe'],
            })

            let fullOutput = ''

            proc.stdout.on('data', (chunk: Buffer) => {
              const text = chunk.toString()
              fullOutput += text
              send('chunk', { text })
            })

            proc.stderr.on('data', (chunk: Buffer) => {
              // Send stderr as status updates (some CLIs write progress to stderr)
              const text = chunk.toString().trim()
              if (text) {
                send('status', { text })
              }
            })

            proc.on('close', (code) => {
              if (code !== 0) {
                send('error', { message: `${cmd} exited with code ${code}` })
                controller.close()
                return
              }

              try {
                // Parse the output into beats
                const beats = parseBeatsFromOutput(fullOutput)

                // Store in DB
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
                  // Send each beat as it's stored
                  send('beat', storedBeat)
                }

                send('done', { count: storedBeats.length })
              } catch (e) {
                send('error', { message: (e as Error).message })
              }

              controller.close()
            })

            proc.on('error', (err) => {
              send('error', { message: err.message })
              controller.close()
            })

            proc.stdin.on('error', () => {}) // ignore EPIPE
            proc.stdin.write(prompt)
            proc.stdin.end()
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
