import { useState, useEffect } from 'react'

const THEMES = [
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'github-dimmed', label: 'GitHub Dimmed' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'solarized-dark', label: 'Solarized Dark' },
  { id: 'nord', label: 'Nord' },
] as const

type ThemeId = (typeof THEMES)[number]['id']

const STORAGE_KEY = 'reviewurr-theme'

function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'github-dark'
  return (localStorage.getItem(STORAGE_KEY) as ThemeId) || 'github-dark'
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<ThemeId>('github-dark')

  useEffect(() => {
    const stored = getStoredTheme()
    setTheme(stored)
    applyTheme(stored)
  }, [])

  const handleChange = (t: ThemeId) => {
    setTheme(t)
    applyTheme(t)
  }

  return (
    <select
      value={theme}
      onChange={(e) => handleChange(e.target.value as ThemeId)}
      className="px-2 py-1 text-xs rounded border border-gh-text/20 bg-gh-secondary text-gh-text focus:outline-none focus:border-gh-accent"
      title="Select theme"
    >
      {THEMES.map((t) => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  )
}
