import Database from 'better-sqlite3'

const db = new Database('reviewurr.db')

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

// Initialize schema
db.exec(`
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

db.exec(`
  CREATE TABLE IF NOT EXISTS commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    message TEXT NOT NULL,
    order_num INTEGER NOT NULL
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS diffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
    commit_id INTEGER REFERENCES commits(id) ON DELETE CASCADE,
    content TEXT NOT NULL
  )
`)

// Settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`)

// Beat analysis tables
db.exec(`
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

db.exec(`
  CREATE TABLE IF NOT EXISTS beat_hunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beat_id INTEGER NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    hunk_spec TEXT NOT NULL DEFAULT 'all'
  )
`)

// Prepared statements
const stmts = {
  findPR: db.prepare('SELECT id FROM prs WHERE owner = ? AND repo = ? AND number = ?'),
  deleteDiffs: db.prepare('DELETE FROM diffs WHERE pr_id = ?'),
  deleteCommits: db.prepare('DELETE FROM commits WHERE pr_id = ?'),
  deletePR: db.prepare('DELETE FROM prs WHERE id = ?'),
  insertPR: db.prepare(
    `INSERT INTO prs (owner, repo, number, title, body, head_sha, base_branch, head_branch, additions, deletions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  insertCommit: db.prepare('INSERT INTO commits (pr_id, sha, message, order_num) VALUES (?, ?, ?, ?)'),
  insertDiff: db.prepare('INSERT INTO diffs (pr_id, commit_id, content) VALUES (?, ?, ?)'),
  getPRById: db.prepare('SELECT * FROM prs WHERE id = ?'),
  getFullDiff: db.prepare('SELECT content FROM diffs WHERE pr_id = ? AND commit_id IS NULL'),
  getCommits: db.prepare('SELECT * FROM commits WHERE pr_id = ? ORDER BY order_num'),
  getCommitDiffs: db.prepare(
    `SELECT c.sha, c.message, c.order_num, d.content
     FROM commits c
     JOIN diffs d ON d.commit_id = c.id
     WHERE c.pr_id = ?
     ORDER BY c.order_num`
  ),
  getAllPRs: db.prepare('SELECT * FROM prs ORDER BY fetched_at DESC'),
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ),
  insertBeat: db.prepare(
    'INSERT INTO beats (pr_id, title, description, reading_order, refs_json, model) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  insertBeatHunk: db.prepare('INSERT INTO beat_hunks (beat_id, file_path, hunk_spec) VALUES (?, ?, ?)'),
  getBeats: db.prepare('SELECT * FROM beats WHERE pr_id = ? ORDER BY reading_order'),
  getBeatsByModel: db.prepare('SELECT * FROM beats WHERE pr_id = ? AND model = ? ORDER BY reading_order'),
  getBeatHunks: db.prepare('SELECT * FROM beat_hunks WHERE beat_id = ?'),
  getBeatIds: db.prepare('SELECT id FROM beats WHERE pr_id = ?'),
  getBeatIdsByModel: db.prepare('SELECT id FROM beats WHERE pr_id = ? AND model = ?'),
  deleteBeatHunks: db.prepare('DELETE FROM beat_hunks WHERE beat_id = ?'),
  deleteAllBeats: db.prepare('DELETE FROM beats WHERE pr_id = ?'),
  deleteBeatsByModel: db.prepare('DELETE FROM beats WHERE pr_id = ? AND model = ?'),
}

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
  const existing = stmts.findPR.get(pr.owner, pr.repo, pr.number) as { id: number } | undefined

  if (existing) {
    stmts.deleteDiffs.run(existing.id)
    stmts.deleteCommits.run(existing.id)
    stmts.deletePR.run(existing.id)
  }

  const result = stmts.insertPR.run(
    pr.owner, pr.repo, pr.number, pr.title, pr.body, pr.head_sha, pr.base_branch, pr.head_branch, pr.additions, pr.deletions
  )
  return Number(result.lastInsertRowid)
}

/** Insert a commit for a PR */
export function insertCommit(prId: number, sha: string, message: string, orderNum: number): number {
  const result = stmts.insertCommit.run(prId, sha, message, orderNum)
  return Number(result.lastInsertRowid)
}

/** Insert a diff (full PR diff or per-commit diff) */
export function insertDiff(prId: number, commitId: number | null, content: string): void {
  stmts.insertDiff.run(prId, commitId, content)
}

/** Get a PR by its internal id */
export function getPRById(id: number) {
  return stmts.getPRById.get(id) as {
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
  } | undefined
}

/** Get the full diff for a PR */
export function getFullDiff(prId: number) {
  return stmts.getFullDiff.get(prId) as { content: string } | undefined
}

/** Get all commits for a PR */
export function getCommits(prId: number) {
  return stmts.getCommits.all(prId) as { id: number; sha: string; message: string; order_num: number }[]
}

/** Get per-commit diffs for a PR, joined with commit info */
export function getCommitDiffs(prId: number) {
  return stmts.getCommitDiffs.all(prId) as { sha: string; message: string; order_num: number; content: string }[]
}

/** Get all PRs ordered by most recently fetched */
export function getAllPRs() {
  return stmts.getAllPRs.all() as {
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
  }[]
}

/** Get a setting value by key */
export function getSetting(key: string): string | null {
  const row = stmts.getSetting.get(key) as { value: string } | undefined
  return row?.value ?? null
}

/** Set a setting value */
export function setSetting(key: string, value: string): void {
  stmts.setSetting.run(key, value)
}

/** Insert a beat, returning its id */
export function insertBeat(
  prId: number,
  title: string,
  description: string,
  readingOrder: number,
  refsJson: string | null,
  model: string
): number {
  const result = stmts.insertBeat.run(prId, title, description, readingOrder, refsJson, model)
  return Number(result.lastInsertRowid)
}

/** Insert a hunk reference for a beat */
export function insertBeatHunk(beatId: number, filePath: string, hunkSpec: string): void {
  stmts.insertBeatHunk.run(beatId, filePath, hunkSpec)
}

/** Get beats with their hunks for a PR */
export function getBeats(prId: number, model?: string) {
  const beats = model
    ? stmts.getBeatsByModel.all(prId, model) as any[]
    : stmts.getBeats.all(prId) as any[]

  return beats.map((beat) => {
    const hunks = stmts.getBeatHunks.all(beat.id) as {
      id: number
      beat_id: number
      file_path: string
      hunk_spec: string
    }[]

    return {
      ...beat,
      refs: beat.refs_json ? JSON.parse(beat.refs_json) : [],
      hunks,
    }
  })
}

/** Delete cached beats for a PR */
export function deleteBeats(prId: number, model?: string): void {
  const beatIds = model
    ? stmts.getBeatIdsByModel.all(prId, model) as { id: number }[]
    : stmts.getBeatIds.all(prId) as { id: number }[]

  for (const { id } of beatIds) {
    stmts.deleteBeatHunks.run(id)
  }

  if (model) {
    stmts.deleteBeatsByModel.run(prId, model)
  } else {
    stmts.deleteAllBeats.run(prId)
  }
}

export { db }
