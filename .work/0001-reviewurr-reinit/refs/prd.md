# Reviewurr — Product Requirements Document

## Problem Statement

GitHub's PR view sorts files alphabetically and shows commits chronologically. Neither reflects how a developer actually thinks. Reviewers jump between unrelated files trying to reconstruct intent, and large PRs are sluggish to navigate. There's no tool that groups changes by what the developer was *trying to do*.

## Solution

A local web app with two views of a PR's changes:

1. **Files tab** — faithful GitHub-style diff view (file tree, alphabetical, collapsible, syntax-highlighted). The baseline experience.
2. **Flow tab** — AI reconstructs the developer's thinking as a series of **beats**. A beat is a logical unit of developer intent that spans commits and files, showing *why* changes were made together.

**Example beat:** A developer adds a Stripe endpoint, updates a type definition, consumes it in the app, and writes a test — across 4 commits and 6 files. Reviewurr presents this as one beat: "New Stripe payment endpoint with UI integration", showing the endpoint, type, consumer, and test together in logical order.

## Users & Roles

Single user: a developer reviewing PRs locally. No auth, no multi-user.

## User Stories

- As a reviewer, I want to paste a PR URL and immediately see the full diff so I can start reviewing.
- As a reviewer, I want to click "Analyze" and see beats appear one-by-one so I understand the developer's intent without reconstructing it myself.
- As a reviewer, I want previously-fetched PRs to load instantly from cache so re-visits are free.
- As a reviewer, I want to toggle between unified and split diff views so I can use whichever suits the change.
- As a reviewer, I want a file tree sidebar so I can navigate large PRs quickly.
- As a reviewer, I want to know when a PR has been updated since I last fetched it so I don't review stale code.
- As a reviewer, I want beats to reference relevant tickets or docs when detectable so I have context on *why* the change exists.

## Functional Requirements

### FR-001: Landing Page
App opens to a page showing a PR URL input field and a list of previously-fetched PRs from SQLite. Previously-fetched PRs load from cache; clicking one opens it instantly.

### FR-002: PR Fetching
User pastes a GitHub PR URL. App fetches via `gh` CLI (server function, not direct API): PR metadata, full unified diff, and per-commit diffs with commit messages. Data stored in bun:sqlite. No duplicate fetches for the same PR.

### FR-003: Files Tab (Default)
GitHub-faithful diff view:
- File tree sidebar (changed files grouped by directory, path compression for single-child dirs, +/- stats per file, click to scroll)
- Collapsible file diffs with syntax highlighting (Shiki)
- Unified and split (side-by-side) view toggle
- Line numbers, +/- coloring, hunk headers, file headers with change stats
- Dark theme matching GitHub aesthetic

### FR-004: Diff Rendering (Performance)
Custom virtualized renderer — NOT diff2html:
- react-window for virtualized rendering (only visible lines in DOM)
- Web worker for diff parsing (main thread stays free)
- Shiki WASM for syntax highlighting (cacheable)
- Lazy file expansion (diff content parsed/rendered only when file is expanded)
- React.memo + useMemo aggressively on diff components
- Must handle large PRs (1000+ files, 10k+ lines) without jank

### FR-005: Flow Tab — Beat Analysis
User clicks "Analyze" to trigger AI analysis. The model receives per-commit diffs and commit messages (commit-aware, not flat diff). Beats stream back one-at-a-time to the UI (SSE or streaming server function).

A beat contains:
- AI-synthesized title and description of developer intent
- The set of file changes (hunks) belonging to this beat, shown with full diff rendering
- Logical ordering (the order the reviewer should read the code)
- Opportunistic linking: if commit messages or changed files reference Jira keys (e.g. LSN-123), Linear keys/URLs, or in-repo docs (PRDs, ADRs), surface those as context on the beat. Most beats will have no external reference — that's fine. The linking is best-effort, not required.

### FR-006: Model Selector
Dropdown in the UI: Claude Sonnet (default) or Codex. Selection persisted in SQLite. Graceful fallback if codex CLI is not installed (hide option or show disabled with explanation). When spawning `claude` CLI from server functions, unset the CLAUDECODE env var.

### FR-007: PR Update Detection
On re-visit, compare stored latest commit SHA with live PR (via `gh`). Show "PR updated" indicator with re-fetch button. User can re-fetch and re-analyze.

### FR-008: Persistence
bun:sqlite stores: PR metadata, commit data, raw diffs, beat analysis results. Re-visits load instantly from cache. Track latest commit SHA per PR for update detection.

## Non-Functional Requirements

- **Performance:** Large PRs (1000+ changed files) must render without jank. Diff parsing off main thread. Virtualized rendering. Lazy expansion.
- **Startup:** App should be ready in under 2 seconds.
- **Local only:** No network calls except `gh` CLI and AI CLI invocations. No auth, no deployment.

## Scope

### In Scope
- Single PR view with Files and Flow tabs
- Custom virtualized diff renderer with Shiki highlighting
- Beat analysis via claude/codex CLI with streaming
- bun:sqlite persistence and caching
- File tree sidebar
- Model selector (Claude Sonnet / Codex)
- PR update detection
- Opportunistic ticket/doc linking on beats
- Dark theme (GitHub aesthetic)
- Prompt engineering for beat analysis

### Out of Scope
- Multiple PRs in one view
- PR comments / review status / approval workflow
- Writing review comments back to GitHub
- Custom/user-editable analysis prompts
- Auth, deployment, hosting
- Light theme

## Assumptions
- User has bun, gh CLI (authenticated), claude CLI installed
- codex CLI is optional
- macOS primary target
- English commit messages

## Constraints
- TanStack Start + Bun + React 19 (server functions, no Express)
- Tailwind CSS v4 (CSS-based config) + shadcn/ui
- Shell out to CLIs only — no direct API calls, no API key management
- Must replace all existing code on this branch (fresh start)

## Dependencies
- `gh` CLI for GitHub data
- `claude` CLI for beat analysis (Sonnet)
- `codex` CLI (optional) for alternative analysis
- Shiki WASM for syntax highlighting
- react-window for virtualization

## Acceptance Criteria
- [ ] Paste a PR URL → see full diff with syntax highlighting in under 3 seconds (excluding network)
- [ ] File tree shows all changed files grouped by directory with +/- stats
- [ ] Unified and split diff views both work correctly
- [ ] Click "Analyze" → beats stream in one-at-a-time with title, description, and relevant hunks
- [ ] Beats reference tickets/docs when detectable in commit messages or file paths
- [ ] Model selector persists choice, gracefully handles missing codex
- [ ] Re-visit a PR → loads instantly from SQLite cache
- [ ] PR update detection shows indicator when commits have changed
- [ ] Large PR (500+ files) renders without jank — virtualized, lazy-loaded
- [ ] Dark theme, GitHub aesthetic
