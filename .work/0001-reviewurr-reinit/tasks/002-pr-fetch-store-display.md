# Task 002: PR Fetch, Store, and Basic Display

## Status: complete
TASK_STATUS: complete
## Type: AFK
## Depends on: 001

## Objective
User can paste a GitHub PR URL, fetch PR data via `gh` CLI, store it in bun:sqlite, and navigate to a PR detail page showing basic collapsible file diffs.

## Details
- **Landing page** (`index.tsx`): PR URL input form (parses GitHub PR URLs). On submit, calls server function to fetch. "Recent PRs" section is placeholder (populated in task 005).
- **Server function** (`server/pr.ts`): `fetchPR` shells out to `gh` CLI via `Bun.spawn()`:
  - `gh pr view <num> -R owner/repo --json number,title,body,headRefOid,baseRefName,headRefName,files,additions,deletions`
  - `gh pr diff <num> -R owner/repo` (full unified diff)
  - Per-commit: `gh pr view <num> -R owner/repo --json commits` then `gh api repos/owner/repo/commits/<sha>` for each commit's diff + message
- **SQLite schema** (`server/db.ts`):
  - `prs` table: id, owner, repo, number, title, body, head_sha, base_branch, head_branch, additions, deletions, fetched_at
  - `commits` table: id, pr_id, sha, message, order
  - `diffs` table: id, pr_id, commit_id (nullable for full diff), content
- **PR detail route** (`pr.$id.tsx`): loader fetches from SQLite. Files tab shows collapsible file sections parsed from the diff. Basic rendering: `<pre>` blocks with +/- line coloring via Tailwind classes. File headers show filename and +X/-Y stats. All files collapsed by default, click to expand.
- Navigate from landing to `pr/$id` after successful fetch.

## Files
- `src/routes/index.tsx` (update)
- `src/routes/pr.$id.tsx` (update)
- `src/server/pr.ts` (new)
- `src/server/db.ts` (update with schema)
- `src/components/pr-input.tsx` (new)
- `src/lib/diff-types.ts` (new — basic types for parsed diff files)

## Tests
- Unit test: diff text → parsed file list (filename, stats extraction)
- Unit test: GitHub PR URL parsing

## Acceptance
- Paste PR URL → loading state → data fetched → navigate to PR detail page
- PR detail shows collapsible files with +/- stats
- Expand file → see diff lines with basic coloring
- Data persists in SQLite (verify with `bun run` query or re-visit)

## Notes
Completed 2026-03-10. 14 tests passing (12 new + 2 existing).
FILES_CHANGED: src/server/pr.ts, src/server/db.ts, src/components/pr-input.tsx, src/lib/diff-types.ts, src/routes/index.tsx, src/routes/pr.$id.tsx, src/styles/app.css, tests/diff-types.test.ts
