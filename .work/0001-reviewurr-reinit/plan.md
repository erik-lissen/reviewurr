# Reviewurr Reinit — Technical Implementation Plan

## Technical Approach

### Stack
- **Framework:** TanStack Start (React) + Bun runtime
- **Routing:** File-based routes via `@tanstack/react-router` + `createFileRoute`
- **Server logic:** `createServerFn` from `@tanstack/react-start` — no Express, no API routes
- **Streaming:** Async generator server functions (`yield` beats one-at-a-time)
- **Styling:** Tailwind CSS v4 (CSS-based config via `@import "tailwindcss"` in CSS, NOT `tailwind.config.ts`) + shadcn/ui components
- **DB:** `bun:sqlite` — PR metadata, commits, diffs, beat analysis, model preference
- **Syntax highlighting:** Shiki web bundle (`shiki/bundle/web`), cached highlighter instance, run in web worker
- **Diff rendering:** Custom renderer + `react-window` VariableSizeList for virtualization. NO diff2html.
- **Diff parsing:** Web worker parses unified diff text into structured hunks (off main thread)
- **CLI integration:** Shell out to `gh`, `claude`, `codex` via `Bun.spawn()` in server functions. Unset `CLAUDECODE` env var for claude.

### Architecture
```
src/
  routes/
    __root.tsx          — root layout (dark theme shell, nav)
    index.tsx           — landing page (URL input + cached PR list)
    pr.$id.tsx          — PR detail view (Files tab + Flow tab)
  server/
    pr.ts               — server functions: fetch PR, get cached PRs
    analysis.ts         — server functions: run beat analysis (streaming)
    db.ts               — bun:sqlite schema, queries, migrations
  components/
    pr-input.tsx        — URL input form
    pr-list.tsx         — cached PR cards
    diff-renderer/
      index.tsx         — orchestrator: file list, lazy expansion
      file-diff.tsx     — single file diff (virtualized lines)
      line.tsx          — single diff line (memoized)
      split-view.tsx    — side-by-side variant
      hunk-header.tsx   — @@ header rendering
    file-tree.tsx       — sidebar file navigator
    flow/
      beat-card.tsx     — single beat with title, description, hunks
      beat-list.tsx     — streaming beat list
      model-selector.tsx — Claude/Codex dropdown
    ui/                 — shadcn/ui primitives
  workers/
    diff-parser.worker.ts   — parse unified diff → structured hunks
    highlighter.worker.ts   — Shiki highlighting (cached instance)
  lib/
    diff-types.ts       — shared types for parsed diffs
    highlight.ts        — main-thread API to communicate with Shiki worker
    detect-refs.ts      — scan commit messages/files for Jira keys, URLs, doc paths
```

### Key Patterns
- **Server functions** replace all API routes. Each is `createServerFn({ method })` with `.handler()`.
- **Streaming** via async generator: `createServerFn().handler(async function* () { ... yield beat ... })`.
- **Web workers** for diff parsing and Shiki highlighting — main thread never blocks.
- **react-window VariableSizeList** for diff lines within each file. File list itself is a flat list (not virtualized at file level since files are collapsible and lazy-loaded).
- **Lazy expansion:** collapsed files have zero rendered diff lines. On expand, post diff text to worker for parsing, then render virtualized lines.
- **Shiki caching:** one `createHighlighter` instance per worker, reused across all files. Load languages on demand.

## Task Breakdown

### Task 001: project-scaffold
- Set up TanStack Start + Bun from scratch. File-based routing, root layout, two placeholder routes (index, pr.$id).
- Tailwind CSS v4 (CSS `@import "tailwindcss"`), shadcn/ui init, dark theme (GitHub Dark palette).
- bun:sqlite wired up with empty schema file. Dev scripts (`bun run dev`).
- Vitest configured for unit tests. One smoke test proving the app renders.
- Remove all existing code (src/, ui/, bin/, root package.json) and replace.
- **AFK**
- **Depends on:** nothing
- **Acceptance:** `bun run dev` starts the app, renders dark-themed shell with placeholder routes, test passes.

### Task 002: pr-fetch-store-display
- Landing page: URL input form + empty "recent PRs" section (populated in task 005).
- Server function shells out to `gh pr view` and `gh pr diff` (+ per-commit diffs) via `Bun.spawn()`.
- SQLite schema: `prs`, `commits`, `diffs` tables. Store fetched data.
- PR detail route (`pr.$id.tsx`): Files tab displays raw parsed diff with basic styling (pre-formatted, no Shiki yet). Collapsible files with +/- stats in headers.
- Navigate from landing page to PR detail after fetch.
- **AFK**
- **Depends on:** 001
- **Acceptance:** Paste PR URL → data fetched via gh → stored in SQLite → navigate to PR page → see file diffs with collapsible headers and +/- stats.

### Task 003: custom-diff-renderer
- Web worker: parse unified diff text into structured hunks (file path, old/new line numbers, added/removed/context lines, hunk headers).
- Shiki web worker: create cached highlighter instance (`shiki/bundle/web`), expose `highlight(code, lang)` API via `postMessage`.
- Custom diff renderer replacing the basic view from task 002: `react-window VariableSizeList` for diff lines within each expanded file.
- Line component (memoized): line numbers (old + new), +/- gutter, syntax-highlighted code via Shiki.
- Hunk headers (`@@ -X,Y +A,B @@`) rendered as separator rows.
- File headers with filename, change stats, collapse/expand toggle.
- Lazy expansion: collapsed files render nothing; expanding triggers worker parse + highlight.
- Unified view only (split view in task 004).
- **AFK**
- **Depends on:** 002
- **Acceptance:** Expand a file → diff lines render virtualized with Shiki syntax highlighting, line numbers, +/- coloring. Scroll a 1000-line file smoothly. Main thread stays responsive.

### Task 004: file-tree-and-split-view
- File tree sidebar: changed files grouped by directory, single-child path compression, +/- stats per file, click-to-scroll.
- Sidebar visible on PR detail page (both tabs).
- Split (side-by-side) diff view: toggle button switches between unified and split. Split view renders old and new side-by-side with synchronized scrolling.
- Persist view preference in component state (not DB — ephemeral).
- **AFK**
- **Depends on:** 003
- **Acceptance:** File tree shows all changed files with directory grouping and compressed paths. Click file → scrolls to it. Toggle split view → see side-by-side diffs with aligned line numbers.

### Task 005: cached-prs-and-update-detection
- Landing page "Recent PRs" section: query SQLite for previously-fetched PRs, display as cards (repo, PR number, title, date fetched).
- Click card → navigate to PR detail, loads from cache (no re-fetch).
- PR update detection: on PR detail load, server function runs `gh pr view --json headRefOid` and compares with stored SHA.
- "PR updated" banner with re-fetch button. Re-fetch updates SQLite and refreshes UI.
- **AFK**
- **Depends on:** 002
- **Acceptance:** Fetch a PR, go back to landing → see it listed. Click → loads instantly from cache. Push a commit to the PR → re-visit → see "PR updated" indicator. Re-fetch works.

### Task 006: flow-tab-beat-analysis
- Flow tab on PR detail page (tab switcher: Files | Flow).
- "Analyze" button triggers server function that shells out to `claude` CLI with per-commit diffs and commit messages.
- Streaming: async generator server function yields beats one-at-a-time as the model produces them.
- Beat card UI: title, AI-synthesized description, ordered list of relevant file hunks rendered with the diff renderer from task 003.
- Opportunistic reference detection (`lib/detect-refs.ts`): scan commit messages and file paths for Jira keys (LSN-123), Linear URLs, in-repo doc paths (PRDs, ADRs). Show as badges/links on beats when found.
- Store analysis results in SQLite. Re-visits load cached beats.
- Unset `CLAUDECODE` env var when spawning claude CLI.
- **AFK**
- **Depends on:** 003
- **Acceptance:** Click Analyze → beats stream in one-at-a-time with title, description, and syntax-highlighted hunks. Cached on re-visit. Ticket refs shown when detected.

### Task 007: model-selector-codex
- Model selector dropdown in Flow tab header: Claude Sonnet (default), Codex.
- Persist selection in SQLite (`settings` table).
- Codex CLI invocation via `Bun.spawn()` with appropriate flags.
- Graceful fallback: check if `codex` CLI exists on startup. If not, hide option or show disabled with tooltip.
- Analysis reuses the same streaming pattern from task 006, just different CLI + prompt adaptation.
- **AFK**
- **Depends on:** 006
- **Acceptance:** Switch to Codex → analysis runs via codex CLI. Switch back to Claude → uses claude CLI. Missing codex CLI → option disabled. Selection persists across sessions.

### Task 008: prompt-engineering
- Refine the beat analysis prompt for Claude Sonnet and Codex.
- Feed per-commit diffs with commit messages, PR description, file list.
- Tune for: accurate intent reconstruction, good beat boundaries, useful titles/descriptions, correct hunk attribution, logical reading order.
- Test against 3-5 real PRs of varying sizes and verify beat quality.
- **HITL** — needs human evaluation of beat quality, iterative prompt tuning.
- **Depends on:** 006
- **Acceptance:** Analysis produces meaningful, well-bounded beats on real PRs. Beats correctly group related changes across commits/files. Titles are descriptive. Reading order makes sense.
