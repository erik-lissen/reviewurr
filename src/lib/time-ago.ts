/** Returns a human-readable relative time string from a date string */
export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z')).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/** Pure comparison: returns true if the SHAs differ */
export function hasShaChanged(storedSha: string, currentSha: string): boolean {
  return storedSha !== currentSha
}
