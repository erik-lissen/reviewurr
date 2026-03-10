/** Parsed representation of a single file within a unified diff */
export interface DiffFile {
  filename: string
  additions: number
  deletions: number
  content: string
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
