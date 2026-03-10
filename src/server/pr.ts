import { createServerFn } from '@tanstack/react-start'
import { upsertPR, insertCommit, insertDiff, getPRById, getFullDiff, getCommits } from './db'
import { parseDiff } from '@/lib/diff-types'

async function runGh(args: string[]): Promise<string> {
  const proc = Bun.spawn(['gh', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`gh command failed: gh ${args.join(' ')}\n${stderr}`)
  }
  return output
}

/** Fetch a PR from GitHub and store it in SQLite. Returns the internal PR id. */
export const fetchPR = createServerFn({ method: 'POST' })
  .validator((d: { owner: string; repo: string; number: number }) => d)
  .handler(async ({ data }) => {
    const { owner, repo, number } = data
    const repoSlug = `${owner}/${repo}`

    // Fetch PR metadata
    const prJson = await runGh([
      'pr', 'view', String(number), '-R', repoSlug,
      '--json', 'number,title,body,headRefOid,baseRefName,headRefName,files,additions,deletions',
    ])
    const prData = JSON.parse(prJson)

    // Fetch full diff
    const fullDiff = await runGh(['pr', 'diff', String(number), '-R', repoSlug])

    // Fetch commits
    const commitsJson = await runGh([
      'pr', 'view', String(number), '-R', repoSlug,
      '--json', 'commits',
    ])
    const commitsData = JSON.parse(commitsJson)

    // Store PR
    const prId = upsertPR({
      owner,
      repo,
      number: prData.number,
      title: prData.title,
      body: prData.body || null,
      head_sha: prData.headRefOid,
      base_branch: prData.baseRefName,
      head_branch: prData.headRefName,
      additions: prData.additions,
      deletions: prData.deletions,
    })

    // Store full diff
    insertDiff(prId, null, fullDiff)

    // Store commits and their diffs
    const commits = commitsData.commits || []
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i]
      const sha = commit.oid
      const message = commit.messageHeadline || commit.message || ''

      const commitId = insertCommit(prId, sha, message, i)

      // Fetch per-commit diff
      try {
        const commitDiff = await runGh([
          'api', `repos/${owner}/${repo}/commits/${sha}`,
          '-H', 'Accept: application/vnd.github.diff',
        ])
        insertDiff(prId, commitId, commitDiff)
      } catch {
        // Non-fatal: skip commit diff if it fails
      }
    }

    return { id: prId }
  })

/** Get PR data from SQLite for display */
export const getPRData = createServerFn({ method: 'GET' })
  .validator((d: number) => d)
  .handler(async ({ data: id }) => {
    const pr = getPRById(id)
    if (!pr) throw new Error(`PR not found: ${id}`)

    const diffRow = getFullDiff(pr.id)
    const commits = getCommits(pr.id)
    const files = diffRow ? parseDiff(diffRow.content) : []

    return { pr, files, commits }
  })
