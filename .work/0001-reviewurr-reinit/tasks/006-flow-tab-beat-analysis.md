# Task 006: Flow Tab + Beat Analysis with Streaming

## Status: pending
## Type: AFK
## Depends on: 003

## Objective
Flow tab where user clicks "Analyze" and beats stream in one-at-a-time from the AI model, each showing intent title, description, and relevant syntax-highlighted hunks.

## Details
- **Tab switcher** in PR detail page: Files | Flow. Default to Files.

- **Flow tab UI** (`components/flow/beat-list.tsx`):
  - "Analyze" button (disabled during analysis, shows progress)
  - Beats render as cards streaming in one-at-a-time
  - If cached analysis exists in SQLite, load immediately (no re-analysis)
  - "Re-analyze" button to clear cache and re-run

- **Beat card** (`components/flow/beat-card.tsx`):
  - Title (AI-generated, e.g. "New Stripe payment endpoint with UI integration")
  - Description (AI-generated explanation of developer intent)
  - Ordered list of relevant file hunks — rendered with the diff renderer from task 003
  - Opportunistic reference badges: Jira keys, Linear URLs, doc paths (when detected)
  - Expandable/collapsible

- **Reference detection** (`lib/detect-refs.ts`):
  - Scan commit messages for Jira keys (regex: `[A-Z]+-\d+`)
  - Scan for Linear URLs/keys
  - Scan changed file paths for doc patterns (e.g. `docs/`, `*.md` matching PRD/ADR patterns)
  - Scan PR body for URLs
  - Return array of `{ type: 'jira'|'linear'|'url'|'doc', value, display }` per beat
  - Best-effort: most beats will have none, and that's fine

- **Server function** (`server/analysis.ts`):
  - `analyzePR` — async generator server function
  - Build prompt: PR title, PR body, per-commit diffs with commit messages (commit-aware)
  - Shell out to `claude` CLI via `Bun.spawn()`: `claude -p --model claude-sonnet-4-6 --output-format stream-json`
  - **Critical:** unset `CLAUDECODE` env var in spawn options
  - Parse streaming JSON output, extract beats as they complete
  - `yield` each beat to the client as it's ready
  - Prompt asks model to output structured JSON beats: `{ title, description, files: [{ path, hunks }], readingOrder, refs }`

- **SQLite**: `beats` table (id, pr_id, title, description, reading_order, refs_json, created_at) + `beat_hunks` table (id, beat_id, file_path, hunk_index)
- Store analysis results after completion for cache on re-visit.

## Files
- `src/routes/pr.$id.tsx` (update — add tab switcher, Flow tab)
- `src/components/flow/beat-list.tsx` (new)
- `src/components/flow/beat-card.tsx` (new)
- `src/server/analysis.ts` (new)
- `src/lib/detect-refs.ts` (new)
- `src/server/db.ts` (update — beats + beat_hunks tables)

## Tests
- Unit test: detect-refs extracts Jira keys and URLs from sample commit messages
- Unit test: beat card renders title, description, and hunk count

## Acceptance
- Click "Analyze" → beats stream in one-at-a-time (visible incremental rendering)
- Each beat shows title, description, and relevant syntax-highlighted hunks
- Jira keys in commit messages appear as badges on relevant beats
- Re-visit → cached beats load instantly
- Re-analyze clears cache and re-runs

## Notes
