import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock bun:sqlite before importing db module
const store = new Map<string, string>()

vi.mock('bun:sqlite', () => {
  class MockDatabase {
    run(sql: string, params?: any[]) {
      if (sql.includes('INSERT INTO settings') && params) {
        store.set(params[0], params[1])
      }
      return { lastInsertRowid: 1 }
    }
    query(sql: string) {
      return {
        get: (...args: any[]) => {
          if (sql.includes('SELECT value FROM settings')) {
            const val = store.get(args[0])
            return val != null ? { value: val } : null
          }
          return null
        },
        all: () => [],
      }
    }
  }
  return {
    default: { Database: MockDatabase },
    Database: MockDatabase,
  }
})

describe('settings helpers', () => {
  beforeEach(() => {
    store.clear()
  })

  it('getSetting returns null for missing key', async () => {
    const { getSetting } = await import('@/server/db')
    expect(getSetting('nonexistent')).toBeNull()
  })

  it('setSetting + getSetting round-trip', async () => {
    const { getSetting, setSetting } = await import('@/server/db')
    setSetting('preferred_model', 'codex')
    expect(getSetting('preferred_model')).toBe('codex')
  })

  it('setSetting overwrites existing value', async () => {
    const { getSetting, setSetting } = await import('@/server/db')
    setSetting('preferred_model', 'claude-sonnet')
    setSetting('preferred_model', 'codex')
    expect(getSetting('preferred_model')).toBe('codex')
  })
})
