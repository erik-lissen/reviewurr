import { Database } from 'bun:sqlite'

const db = new Database('reviewurr.db')

// Enable WAL mode for better concurrent read performance
db.run('PRAGMA journal_mode = WAL')

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS prs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    head_sha TEXT NOT NULL,
    base_branch TEXT NOT NULL,
    head_branch TEXT NOT NULL,
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(owner, repo, number)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    message TEXT NOT NULL,
    order_num INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS diffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
    commit_id INTEGER REFERENCES commits(id) ON DELETE CASCADE,
    content TEXT NOT NULL
  )
`)

/** Insert or update a PR, returning its id */
export function upsertPR(pr: {
  owner: string
  repo: string
  number: number
  title: string
  body: string | null
  head_sha: string
  base_branch: string
  head_branch: string
  additions: number
  deletions: number
}): number {
  // Delete existing data if re-fetching
  const existing = db.query<{ id: number }, [string, string, number]>(
    'SELECT id FROM prs WHERE owner = ? AND repo = ? AND number = ?'
  ).get(pr.owner, pr.repo, pr.number)

  if (existing) {
    db.run('DELETE FROM diffs WHERE pr_id = ?', [existing.id])
    db.run('DELETE FROM commits WHERE pr_id = ?', [existing.id])
    db.run('DELETE FROM prs WHERE id = ?', [existing.id])
  }

  const result = db.run(
    `INSERT INTO prs (owner, repo, number, title, body, head_sha, base_branch, head_branch, additions, deletions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pr.owner, pr.repo, pr.number, pr.title, pr.body, pr.head_sha, pr.base_branch, pr.head_branch, pr.additions, pr.deletions]
  )
  return Number(result.lastInsertRowid)
}

/** Insert a commit for a PR */
export function insertCommit(prId: number, sha: string, message: string, orderNum: number): number {
  const result = db.run(
    'INSERT INTO commits (pr_id, sha, message, order_num) VALUES (?, ?, ?, ?)',
    [prId, sha, message, orderNum]
  )
  return Number(result.lastInsertRowid)
}

/** Insert a diff (full PR diff or per-commit diff) */
export function insertDiff(prId: number, commitId: number | null, content: string): void {
  db.run(
    'INSERT INTO diffs (pr_id, commit_id, content) VALUES (?, ?, ?)',
    [prId, commitId, content]
  )
}

/** Get a PR by its internal id */
export function getPRById(id: number) {
  return db.query<{
    id: number
    owner: string
    repo: string
    number: number
    title: string
    body: string | null
    head_sha: string
    base_branch: string
    head_branch: string
    additions: number
    deletions: number
    fetched_at: string
  }, [number]>('SELECT * FROM prs WHERE id = ?').get(id)
}

/** Get the full diff for a PR */
export function getFullDiff(prId: number) {
  return db.query<{ content: string }, [number, null]>(
    'SELECT content FROM diffs WHERE pr_id = ? AND commit_id IS ?'
  ).get(prId, null)
}

/** Get all commits for a PR */
export function getCommits(prId: number) {
  return db.query<{ id: number; sha: string; message: string; order_num: number }, [number]>(
    'SELECT * FROM commits WHERE pr_id = ? ORDER BY order_num'
  ).all(prId)
}

export { db }
