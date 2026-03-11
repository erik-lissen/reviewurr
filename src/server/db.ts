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

/** Get per-commit diffs for a PR, joined with commit info */
export function getCommitDiffs(prId: number) {
  return db.query<
    { sha: string; message: string; order_num: number; content: string },
    [number]
  >(
    `SELECT c.sha, c.message, c.order_num, d.content
     FROM commits c
     JOIN diffs d ON d.commit_id = c.id
     WHERE c.pr_id = ?
     ORDER BY c.order_num`
  ).all(prId)
}

/** Get all PRs ordered by most recently fetched */
export function getAllPRs() {
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
  }, []>('SELECT * FROM prs ORDER BY fetched_at DESC').all()
}

// Settings table
db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`)

/** Get a setting value by key */
export function getSetting(key: string): string | null {
  const row = db.query<{ value: string }, [string]>(
    'SELECT value FROM settings WHERE key = ?'
  ).get(key)
  return row?.value ?? null
}

/** Set a setting value */
export function setSetting(key: string, value: string): void {
  db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  )
}

// Beat analysis tables
db.run(`
  CREATE TABLE IF NOT EXISTS beats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reading_order INTEGER NOT NULL,
    refs_json TEXT,
    model TEXT NOT NULL DEFAULT 'claude-sonnet',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS beat_hunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beat_id INTEGER NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    hunk_spec TEXT NOT NULL DEFAULT 'all'
  )
`)

/** Insert a beat, returning its id */
export function insertBeat(
  prId: number,
  title: string,
  description: string,
  readingOrder: number,
  refsJson: string | null,
  model: string
): number {
  const result = db.run(
    'INSERT INTO beats (pr_id, title, description, reading_order, refs_json, model) VALUES (?, ?, ?, ?, ?, ?)',
    [prId, title, description, readingOrder, refsJson, model]
  )
  return Number(result.lastInsertRowid)
}

/** Insert a hunk reference for a beat */
export function insertBeatHunk(beatId: number, filePath: string, hunkSpec: string): void {
  db.run(
    'INSERT INTO beat_hunks (beat_id, file_path, hunk_spec) VALUES (?, ?, ?)',
    [beatId, filePath, hunkSpec]
  )
}

/** Get beats with their hunks for a PR */
export function getBeats(prId: number, model?: string) {
  const whereClause = model
    ? 'WHERE b.pr_id = ? AND b.model = ?'
    : 'WHERE b.pr_id = ?'
  const params = model ? [prId, model] : [prId]

  const beats = db.query<{
    id: number
    pr_id: number
    title: string
    description: string
    reading_order: number
    refs_json: string | null
    model: string
    created_at: string
  }, any[]>(`SELECT * FROM beats b ${whereClause} ORDER BY b.reading_order`).all(...params)

  return beats.map((beat) => {
    const hunks = db.query<{
      id: number
      beat_id: number
      file_path: string
      hunk_spec: string
    }, [number]>('SELECT * FROM beat_hunks WHERE beat_id = ?').all(beat.id)

    return {
      ...beat,
      refs: beat.refs_json ? JSON.parse(beat.refs_json) : [],
      hunks,
    }
  })
}

/** Delete cached beats for a PR */
export function deleteBeats(prId: number, model?: string): void {
  if (model) {
    // Delete hunks first (via beat ids)
    const beatIds = db.query<{ id: number }, [number, string]>(
      'SELECT id FROM beats WHERE pr_id = ? AND model = ?'
    ).all(prId, model)
    for (const { id } of beatIds) {
      db.run('DELETE FROM beat_hunks WHERE beat_id = ?', [id])
    }
    db.run('DELETE FROM beats WHERE pr_id = ? AND model = ?', [prId, model])
  } else {
    const beatIds = db.query<{ id: number }, [number]>(
      'SELECT id FROM beats WHERE pr_id = ?'
    ).all(prId)
    for (const { id } of beatIds) {
      db.run('DELETE FROM beat_hunks WHERE beat_id = ?', [id])
    }
    db.run('DELETE FROM beats WHERE pr_id = ?', [prId])
  }
}

export { db }
