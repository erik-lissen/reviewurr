export type ModelOption = 'claude-haiku' | 'claude-sonnet' | 'claude-opus'

interface ModelSelectorProps {
  value: ModelOption
  onChange: (model: ModelOption) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ModelOption)}
      className="px-2 py-1 text-xs rounded border border-gh-text/20 bg-gh-secondary text-gh-text focus:outline-none focus:border-gh-accent"
      title="Select analysis model"
    >
      <option value="claude-haiku">Claude Haiku</option>
      <option value="claude-sonnet">Claude Sonnet</option>
      <option value="claude-opus">Claude Opus</option>
    </select>
  )
}
