# Task 007: Model Selector + Codex Integration

## Status: pending
## Type: AFK
## Depends on: 006

## Objective
Dropdown to select between Claude Sonnet and Codex for beat analysis, persisted in SQLite, with graceful fallback when codex is not installed.

## Details
- **Model selector** (`components/flow/model-selector.tsx`):
  - Dropdown in Flow tab header, next to Analyze button
  - Options: "Claude Sonnet" (default), "Codex"
  - Selection triggers re-analysis if cached analysis used a different model

- **Persistence**: `settings` table in SQLite (key-value: `preferred_model` → `claude-sonnet` | `codex`)
  - Server function to read/write setting
  - Load on app start, apply as default

- **Codex CLI detection**:
  - Server function checks `which codex` or `Bun.spawn(['codex', '--version'])` on startup
  - If not installed: show option as disabled with tooltip "codex CLI not installed"
  - Cache the check result (don't re-check every render)

- **Codex invocation** (in `server/analysis.ts`):
  - Adapt the analysis server function to accept a model parameter
  - Codex: `Bun.spawn(['codex', ...])` with appropriate flags and prompt
  - Same streaming pattern (async generator, yield beats)
  - Same output format expected from model (structured JSON beats)

- **Per-model cache**: analysis results in SQLite tagged with model used. Switching models shows cached results for that model if available, or prompts re-analysis.

## Files
- `src/components/flow/model-selector.tsx` (new)
- `src/server/analysis.ts` (update — model parameter, codex path)
- `src/server/db.ts` (update — settings table, model tag on beats)
- `src/routes/pr.$id.tsx` (update — wire model selector)
- `src/components/flow/beat-list.tsx` (update — model-aware cache)

## Tests
- Unit test: model selector renders correct options based on codex availability
- Unit test: settings persistence round-trip

## Acceptance
- Dropdown shows Claude Sonnet and Codex (or Codex disabled if not installed)
- Switch to Codex → analysis runs via codex CLI
- Switch back → uses claude CLI
- Selection persists across sessions (reload app → same selection)
- Per-model cached results (switching models doesn't discard other model's analysis)

## Notes
