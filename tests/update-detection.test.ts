import { describe, it, expect } from 'vitest'
import { timeAgo, hasShaChanged } from '@/lib/time-ago'

describe('hasShaChanged', () => {
  it('returns false when SHAs are identical', () => {
    const sha = 'abc123def456'
    expect(hasShaChanged(sha, sha)).toBe(false)
  })

  it('returns true when SHAs differ', () => {
    expect(hasShaChanged('abc123', 'def456')).toBe(true)
  })

  it('returns true for prefix match (not full match)', () => {
    expect(hasShaChanged('abc123', 'abc1234')).toBe(true)
  })

  it('handles empty strings', () => {
    expect(hasShaChanged('', '')).toBe(false)
    expect(hasShaChanged('abc', '')).toBe(true)
  })
})

describe('timeAgo', () => {
  it('returns "just now" for recent dates', () => {
    const now = new Date().toISOString()
    expect(timeAgo(now)).toBe('just now')
  })

  it('returns minutes for dates within the hour', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(timeAgo(tenMinAgo)).toBe('10m ago')
  })

  it('returns hours for dates within the day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(timeAgo(threeHoursAgo)).toBe('3h ago')
  })

  it('returns days for dates within the month', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(timeAgo(fiveDaysAgo)).toBe('5d ago')
  })

  it('returns months for older dates', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    expect(timeAgo(sixtyDaysAgo)).toBe('2mo ago')
  })

  it('handles SQLite datetime format (no Z suffix)', () => {
    // SQLite datetime('now') produces "2024-01-15 12:00:00" without Z
    const now = new Date()
    const sqliteFormat = now.toISOString().replace('T', ' ').replace('Z', '').split('.')[0]
    expect(timeAgo(sqliteFormat)).toBe('just now')
  })
})
