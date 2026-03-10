import { createServerFn } from '@tanstack/react-start'
import {
  getPRById,
  getCommits,
  getFullDiff,
  getBeats,
  insertBeat,
  insertBeatHunk,
  deleteBeats,
  getSetting,
  setSetting,
} from './db'
import { detectRefs } from '@/lib/detect-refs'

interface BeatFile {
  path: string
  relevantHunks: string
}

interface RawBeat {
  title: string
  description: string
  files: BeatFile[]
  readingOrder: number
  refs?: string[]
}

function buildPrompt(pr: {
  title: string
  body: string | null
  owner: string
  repo: string
  number: number
}, commits: { sha: string; message: string }[], fullDiff: string): string {
  let prompt = `You are a code review assistant. Analyze this pull request and group the changes into logical "beats" — units of developer intent that tell the story of what was built and why.

## PR: ${pr.title}
**Repo:** ${pr.owner}/${pr.repo}#${pr.number}
`

  if (pr.body) {
    prompt += `\n**Description:**\n${pr.body}\n`
  }

  prompt += `\n## Commits\n`
  for (const commit of commits) {
    prompt += `- ${commit.sha.slice(0, 7)}: ${commit.message}\n`
  }

  prompt += `\n## Full Diff\n\`\`\`diff\n${fullDiff}\n\`\`\`\n`

  prompt += `
## Instructions
Group the changes into beats. Each beat should represent a coherent unit of work — a feature, a refactor, a fix, etc. Order them by the best reading order for a reviewer.

Output ONLY valid JSON (no markdown fencing, no explanation) in this exact format:
{
  "beats": [
    {
      "title": "Short title of what this beat accomplishes",
      "description": "A paragraph explaining the developer intent, what was changed and why.",
      "files": [
        { "path": "src/example.ts", "relevantHunks": "all" }
      ],
      "readingOrder": 1,
      "refs": []
    }
  ]
}

Rules:
- Every changed file must appear in at least one beat
- Beats should be ordered for optimal reviewer comprehension
- Keep titles concise (under 60 chars)
- descriptions should be 1-3 sentences
- refs: include any Jira/Linear ticket keys (e.g. PROJ-123) or URLs found in commit messages or PR description
- relevantHunks should be "all" (for now)
`

  return prompt
}

// Cached codex availability check (once per server lifetime)
let codexAvailableCache: boolean | null = null

async function checkCodexInstalled(): Promise<boolean> {
  if (codexAvailableCache !== null) return codexAvailableCache
  try {
    const proc = Bun.spawn(['codex', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    await proc.exited
    codexAvailableCache = proc.exitCode === 0
  } catch {
    codexAvailableCache = false
  }
  return codexAvailableCache
}

/** Check if codex CLI is available */
export const checkCodexAvailable = createServerFn({ method: 'GET' })
  .handler(async () => {
    const available = await checkCodexInstalled()
    return { available }
  })

/** Get the preferred model from settings */
export const getPreferredModel = createServerFn({ method: 'GET' })
  .handler(async () => {
    const model = getSetting('preferred_model')
    return (model === 'codex' ? 'codex' : 'claude-sonnet') as 'claude-sonnet' | 'codex'
  })

/** Set the preferred model */
export const setPreferredModel = createServerFn({ method: 'POST' })
  .validator((d: { model: string }) => d)
  .handler(async ({ data: { model } }) => {
    setSetting('preferred_model', model)
    return { ok: true }
  })

/** Run analysis on a PR using Claude CLI or Codex */
export const analyzePR = createServerFn({ method: 'POST' })
  .validator((d: { prId: number; model?: string }) => d)
  .handler(async ({ data: { prId, model: requestedModel } }) => {
    const pr = getPRById(prId)
    if (!pr) throw new Error(`PR not found: ${prId}`)

    const commits = getCommits(prId)
    const diffRow = getFullDiff(prId)
    if (!diffRow) throw new Error(`No diff found for PR: ${prId}`)

    const prompt = buildPrompt(pr, commits, diffRow.content)
    const model = requestedModel || 'claude-sonnet'

    // Shell out to CLI — unset CLAUDECODE env var regardless of model
    const env = { ...process.env }
    delete (env as Record<string, string | undefined>).CLAUDECODE

    let output: string
    let exitCode: number

    if (model === 'codex') {
      // Use Codex CLI
      const proc = Bun.spawn(['codex', '-q', '--model', 'codex-mini-latest'], {
        stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env,
      })
      proc.stdin.write(prompt)
      proc.stdin.end()
      output = await new Response(proc.stdout).text()
      exitCode = await proc.exited

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`Codex CLI failed (exit ${exitCode}): ${stderr}`)
      }
    } else {
      // Use Claude CLI
      const proc = Bun.spawn(
        ['claude', '-p', '--model', 'claude-sonnet-4-6', '--output-format', 'json'],
        { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env }
      )
      proc.stdin.write(prompt)
      proc.stdin.end()
      output = await new Response(proc.stdout).text()
      exitCode = await proc.exited

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`Claude CLI failed (exit ${exitCode}): ${stderr}`)
      }
    }

    // Parse CLI output — Claude wraps the response in { result: "..." }, Codex returns raw
    let resultText: string
    try {
      const cliOutput = JSON.parse(output)
      resultText = cliOutput.result || output
    } catch {
      resultText = output
    }

    // Extract the beats JSON from the response
    const jsonMatch = resultText.match(/\{[\s\S]*"beats"[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error(`Failed to parse beats from model output. Raw: ${resultText.slice(0, 500)}`)
    }

    let parsed: { beats: RawBeat[] }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      throw new Error(`Invalid JSON in model output: ${(e as Error).message}`)
    }

    // Clear any existing beats for this PR+model
    deleteBeats(prId, model)

    // Store beats in SQLite
    const storedBeats = []
    for (const beat of parsed.beats) {
      // Detect refs from title, description, and any explicit refs
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

      storedBeats.push({
        id: beatId,
        title: beat.title,
        description: beat.description,
        readingOrder: beat.readingOrder,
        refs: detectedRefs,
        hunks: beat.files.map((f) => ({
          file_path: f.path,
          hunk_spec: f.relevantHunks || 'all',
        })),
      })
    }

    return storedBeats
  })

/** Get cached beats for a PR */
export const getCachedBeats = createServerFn({ method: 'GET' })
  .validator((d: { prId: number; model?: string }) => d)
  .handler(async ({ data: { prId, model } }) => {
    const beats = getBeats(prId, model)
    return beats.length > 0 ? beats : null
  })

/** Clear cached beats for a PR */
export const clearBeats = createServerFn({ method: 'POST' })
  .validator((d: { prId: number; model?: string }) => d)
  .handler(async ({ data: { prId, model } }) => {
    deleteBeats(prId, model)
    return { ok: true }
  })
