import { createServerFn } from '@tanstack/react-start'
import {
  getBeats,
  deleteBeats,
  getSetting,
  setSetting,
} from './db'

export interface BeatFile {
  path: string
  relevantHunks: string
}

export interface RawBeat {
  title: string
  description: string
  files: BeatFile[]
  readingOrder: number
  refs?: string[]
}

/** Parse raw CLI output into beats array */
export function parseBeatsFromOutput(output: string): RawBeat[] {
  // Claude wraps the response in { result: "..." }, Codex returns raw
  let resultText: string
  try {
    const cliOutput = JSON.parse(output)
    resultText = cliOutput.result || output
  } catch {
    resultText = output
  }

  const jsonMatch = resultText.match(/\{[\s\S]*"beats"[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Failed to parse beats from model output. Raw: ${resultText.slice(0, 500)}`)
  }

  const parsed: { beats: RawBeat[] } = JSON.parse(jsonMatch[0])
  return parsed.beats
}

export function buildPrompt(
  pr: {
    title: string
    body: string | null
    owner: string
    repo: string
    number: number
  },
  commitDiffs: { sha: string; message: string; content: string }[],
  fullDiff: string,
  fileList: string[]
): string {
  let prompt = `You are a senior code reviewer. Your job is to reconstruct the developer's intent from a pull request and present it as a sequence of "beats" — logical units of developer intent that tell the story of WHY changes were made, not just what changed.

## What is a beat?

A beat is a coherent unit of developer intent that may span multiple commits and multiple files. It groups changes that serve the same purpose, even if they touch different layers of the codebase.

**Good beat:** "Add Stripe payment endpoint with validation" — groups the route handler, the input validation schema, the type definition, and the test across 3 files and 2 commits. A reviewer reads this as one logical change.

**Bad beat:** "Changes to payment files" — this just describes which files changed, not WHY. Also bad: one beat per file, or one beat per commit. Those are just reformatting the diff, not adding insight.

**Bad beat:** "Update types" or "Add tests" — these are layers, not intent. Types were updated IN SERVICE OF something. Tests were written TO VERIFY something. Group them with the thing they serve.

## The PR

**${pr.title}**
${pr.owner}/${pr.repo}#${pr.number}
`

  if (pr.body) {
    prompt += `\n**PR Description:**\n${pr.body}\n`
  }

  // Per-commit diffs — this is the primary input
  // Budget: ~80KB total for diffs to stay within model context
  const DIFF_BUDGET = 80_000
  if (commitDiffs.length > 0) {
    prompt += `\n## Commits (in chronological order)\n`
    prompt += `The PR has ${commitDiffs.length} commit(s). Each commit includes the message and its diff. Use commit messages as strong signals for intent boundaries.\n\n`

    // Calculate per-commit budget
    const totalDiffSize = commitDiffs.reduce((sum, cd) => sum + cd.content.length, 0)
    const needsTruncation = totalDiffSize > DIFF_BUDGET

    for (const cd of commitDiffs) {
      prompt += `### Commit ${cd.sha.slice(0, 7)}: ${cd.message}\n`

      let diffContent = cd.content
      if (needsTruncation) {
        // Proportional budget per commit, minimum 2KB
        const budget = Math.max(2000, Math.floor((cd.content.length / totalDiffSize) * DIFF_BUDGET))
        if (cd.content.length > budget) {
          diffContent = cd.content.slice(0, budget) + `\n... [truncated — ${cd.content.length - budget} chars omitted]`
        }
      }

      prompt += `\`\`\`diff\n${diffContent}\n\`\`\`\n\n`
    }
  } else {
    // Fallback: flat diff only
    const diffContent = fullDiff.length > DIFF_BUDGET
      ? fullDiff.slice(0, DIFF_BUDGET) + `\n... [truncated — ${fullDiff.length - DIFF_BUDGET} chars omitted]`
      : fullDiff
    prompt += `\n## Diff\n\`\`\`diff\n${diffContent}\n\`\`\`\n`
  }

  prompt += `\n## All changed files\n`
  for (const f of fileList) {
    prompt += `- ${f}\n`
  }

  prompt += `
## Instructions

Analyze the commits and diffs above. Group the changes into beats that reconstruct the developer's thinking.

**How to identify beat boundaries:**
- A commit message often signals a new beat (but not always — small fixup commits belong with their parent intent)
- Changes to a type/interface + the code that uses it + the test that verifies it = ONE beat
- A refactor that touches many files for the same reason = ONE beat
- An unrelated config change alongside a feature = SEPARATE beat

**Reading order within each beat:**
Order files for maximum reviewer comprehension:
1. Types, interfaces, schemas (the "what")
2. Core implementation (the "how")
3. Integration points, routes, UI (the "where")
4. Tests (the "proof")
5. Config, docs, tooling (the "support")

**Output format — ONLY valid JSON, no markdown fencing, no explanation:**
{
  "beats": [
    {
      "title": "Concise intent description (under 60 chars)",
      "description": "1-3 sentences explaining the developer's intent — WHY this change exists, not just what files were touched. What problem does it solve? What does it enable?",
      "files": [
        { "path": "src/example.ts", "relevantHunks": "all" }
      ],
      "readingOrder": 1,
      "refs": ["PROJ-123", "https://..."]
    }
  ]
}

**Rules:**
- Every changed file must appear in at least one beat
- File paths must exactly match the paths in the "All changed files" list above
- Beats ordered for optimal reviewer comprehension (foundational changes first, dependent changes after)
- "refs": extract any ticket keys (e.g. LSN-123, PROJ-456) or URLs from commit messages, PR description, or code comments. Empty array if none found.
- "relevantHunks": use "all" for now
- If the PR is a single cohesive change, it's fine to have just 1 beat. Don't split artificially.
- If a commit is a typo fix or formatting cleanup, fold it into the nearest related beat rather than making a separate beat.
`

  return prompt
}

/** Get the preferred model from settings */
export const getPreferredModel = createServerFn({ method: 'GET' })
  .handler(async () => {
    const model = getSetting('preferred_model')
    if (model === 'claude-haiku') return 'claude-haiku' as const
    if (model === 'claude-sonnet') return 'claude-sonnet' as const
    return 'claude-opus' as const
  })

/** Set the preferred model */
export const setPreferredModel = createServerFn({ method: 'POST' })
  .inputValidator((d: { model: string }) => d)
  .handler(async ({ data: { model } }) => {
    setSetting('preferred_model', model)
    return { ok: true }
  })

/** Get cached beats for a PR */
export const getCachedBeats = createServerFn({ method: 'GET' })
  .inputValidator((d: { prId: number; model?: string }) => d)
  .handler(async ({ data: { prId, model } }) => {
    const beats = getBeats(prId, model)
    return beats.length > 0 ? beats : null
  })

/** Clear cached beats for a PR */
export const clearBeats = createServerFn({ method: 'POST' })
  .inputValidator((d: { prId: number; model?: string }) => d)
  .handler(async ({ data: { prId, model } }) => {
    deleteBeats(prId, model)
    return { ok: true }
  })
