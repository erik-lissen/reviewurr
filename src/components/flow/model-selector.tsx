import { useState, useEffect } from 'react'
import { checkCodexAvailable } from '@/server/analysis'

export type ModelOption = 'claude-sonnet' | 'codex'

interface ModelSelectorProps {
  value: ModelOption
  onChange: (model: ModelOption) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [codexAvailable, setCodexAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    checkCodexAvailable()
      .then((result) => setCodexAvailable(result.available))
      .catch(() => setCodexAvailable(false))
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ModelOption)}
      className="px-2 py-1 text-xs rounded border border-gh-text/20 bg-gh-secondary text-gh-text focus:outline-none focus:border-gh-accent"
      title="Select analysis model"
    >
      <option value="claude-sonnet">Claude Sonnet</option>
      <option
        value="codex"
        disabled={codexAvailable === false}
      >
        Codex{codexAvailable === false ? ' (not installed)' : ''}
      </option>
    </select>
  )
}
