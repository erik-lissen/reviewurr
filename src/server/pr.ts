import { createServerFn } from '@tanstack/react-start'
import { execFile } from 'node:child_process'
import { upsertPR, insertCommit, insertDiff, getPRById, getFullDiff, getCommits, getAllPRs } from './db'
import { parseDiff } from '@/lib/diff-types'

function runGh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`gh command failed: gh ${args.join(' ')}\n${stderr}`))
      } else {
        resolve(stdout)
      }
    })
  })
}

/** Fetch a PR from GitHub and store it in SQLite. Returns the internal PR id. */
export const fetchPR = createServerFn({ method: 'POST' })
  .inputValidator((d: { owner: string; repo: string; number: number }) => d)
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
  .inputValidator((d: number) => d)
  .handler(async ({ data: id }) => {
    const pr = getPRById(id)
    if (!pr) throw new Error(`PR not found: ${id}`)

    const diffRow = getFullDiff(pr.id)
    const commits = getCommits(pr.id)
    const files = diffRow ? parseDiff(diffRow.content) : []

    return { pr, files, commits }
  })

/** Get all cached PRs for the landing page */
export const getCachedPRs = createServerFn({ method: 'GET' })
  .handler(async () => {
    return getAllPRs()
  })

/** Check if a PR has been updated since last fetch */
export const checkPRUpdate = createServerFn({ method: 'POST' })
  .inputValidator((d: { prId: number }) => d)
  .handler(async ({ data: { prId } }) => {
    const pr = getPRById(prId)
    if (!pr) throw new Error(`PR not found: ${prId}`)

    try {
      const output = await runGh([
        'pr', 'view', String(pr.number), '-R', `${pr.owner}/${pr.repo}`,
        '--json', 'headRefOid',
      ])
      const { headRefOid } = JSON.parse(output)
      return { updated: headRefOid !== pr.head_sha, currentSha: headRefOid }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('no pull requests found') || message.includes('Could not resolve')) {
        return { updated: false, currentSha: pr.head_sha, error: 'This PR may have been deleted or is no longer accessible.' }
      }
      return { updated: false, currentSha: pr.head_sha, error: `Failed to check for updates: ${message}` }
    }
  })
