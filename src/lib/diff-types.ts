/** Parsed representation of a single file within a unified diff */
export interface DiffFile {
  filename: string
  additions: number
  deletions: number
  content: string
}

/** A parsed hunk from a unified diff */
export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  header: string
  changes: DiffChange[]
}

/** A single line change within a hunk */
export interface DiffChange {
  type: 'add' | 'del' | 'context'
  oldLine?: number
  newLine?: number
  content: string
}

/** A row in the virtualized diff list */
export type DiffRow =
  | { kind: 'hunk-header'; header: string }
  | { kind: 'change'; change: DiffChange }

/** Parse raw unified diff text for a single file into structured hunks */
export function parseHunks(diffContent: string): DiffHunk[] {
  const lines = diffContent.split('\n')
  const hunks: DiffHunk[] = []
  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
    if (hunkMatch) {
      currentHunk = {
        oldStart: parseInt(hunkMatch[1]),
        oldLines: hunkMatch[2] ? parseInt(hunkMatch[2]) : 1,
        newStart: parseInt(hunkMatch[3]),
        newLines: hunkMatch[4] ? parseInt(hunkMatch[4]) : 1,
        header: line,
        changes: [],
      }
      oldLine = currentHunk.oldStart
      newLine = currentHunk.newStart
      hunks.push(currentHunk)
      continue
    }

    if (!currentHunk) continue

    // Skip file headers
    if (line.startsWith('diff --git') || line.startsWith('index ') ||
        line.startsWith('---') || line.startsWith('+++') ||
        line.startsWith('new file') || line.startsWith('deleted file') ||
        line.startsWith('old mode') || line.startsWith('new mode') ||
        line.startsWith('similarity index') || line.startsWith('rename from') ||
        line.startsWith('rename to') || line.startsWith('copy from') ||
        line.startsWith('copy to')) {
      continue
    }

    if (line.startsWith('+')) {
      currentHunk.changes.push({
        type: 'add',
        newLine: newLine++,
        content: line.slice(1),
      })
    } else if (line.startsWith('-')) {
      currentHunk.changes.push({
        type: 'del',
        oldLine: oldLine++,
        content: line.slice(1),
      })
    } else if (line.startsWith(' ') || line === '') {
      // Context line (or empty trailing line within a hunk)
      if (line.startsWith(' ')) {
        currentHunk.changes.push({
          type: 'context',
          oldLine: oldLine++,
          newLine: newLine++,
          content: line.slice(1),
        })
      }
    }
  }

  return hunks
}

/** Flatten hunks into DiffRow[] for virtualized rendering */
export function hunksToRows(hunks: DiffHunk[]): DiffRow[] {
  const rows: DiffRow[] = []
  for (const hunk of hunks) {
    rows.push({ kind: 'hunk-header', header: hunk.header })
    for (const change of hunk.changes) {
      rows.push({ kind: 'change', change })
    }
  }
  return rows
}

/** Detect language from filename extension for Shiki */
export function langFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
    java: 'java', kt: 'kotlin', swift: 'swift',
    css: 'css', scss: 'scss', less: 'less',
    html: 'html', vue: 'vue', svelte: 'svelte',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', mdx: 'mdx',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', graphql: 'graphql', gql: 'graphql',
    xml: 'xml', svg: 'xml',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', php: 'php', lua: 'lua',
    dockerfile: 'dockerfile',
  }
  return map[ext] ?? 'text'
}

/** Parse a GitHub PR URL into owner, repo, number */
export function parsePRUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  )
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

/** Parse a unified diff string into per-file DiffFile objects */
export function parseDiff(diffText: string): DiffFile[] {
  if (!diffText.trim()) return []

  const files: DiffFile[] = []
  // Split on "diff --git" boundaries, keeping the delimiter
  const parts = diffText.split(/^(?=diff --git )/m)

  for (const part of parts) {
    if (!part.trim()) continue
    if (!part.startsWith('diff --git ')) continue

    // Extract filename from +++ b/path or --- a/path
    let filename = ''
    const plusMatch = part.match(/^\+\+\+ b\/(.+)$/m)
    const minusMatch = part.match(/^--- a\/(.+)$/m)
    if (plusMatch && plusMatch[1] !== '/dev/null') {
      filename = plusMatch[1]
    } else if (minusMatch && minusMatch[1] !== '/dev/null') {
      filename = minusMatch[1]
    } else {
      // Fallback: extract from diff --git line
      const gitMatch = part.match(/^diff --git a\/(.+?) b\/(.+)$/m)
      if (gitMatch) filename = gitMatch[2]
    }

    // Count additions and deletions (lines starting with + or - that aren't headers)
    let additions = 0
    let deletions = 0
    const lines = part.split('\n')
    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) continue
      if (line.startsWith('+')) additions++
      else if (line.startsWith('-')) deletions++
    }

    files.push({ filename, additions, deletions, content: part })
  }

  return files
}
