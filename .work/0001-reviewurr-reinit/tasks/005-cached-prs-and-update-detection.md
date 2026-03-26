# Task 005: Cached PRs List + PR Update Detection

## Status: pending
## Type: AFK
## Depends on: 002

## Objective
Landing page shows previously-fetched PRs from SQLite for instant re-visits. PR detail page detects when a PR has new commits and offers re-fetch.

## Details
- **Landing page recent PRs** (`components/pr-list.tsx`):
  - Server function queries SQLite for all stored PRs, ordered by fetched_at desc
  - Display as cards: repo (owner/repo), PR number, title, date fetched, +/- stats
  - Click card → navigate to `pr/$id`, loads entirely from SQLite (no network)
  - Empty state when no PRs cached yet

- **PR update detection** (in `pr.$id.tsx` loader or client-side effect):
  - Server function: `checkPRUpdate(prId)` → runs `gh pr view <num> -R owner/repo --json headRefOid` via `Bun.spawn()`
  - Compare returned SHA with stored `head_sha` in SQLite
  - If different: show banner "This PR has been updated since you last fetched it" with "Re-fetch" button
  - Re-fetch: re-run the full fetch flow from task 002, update SQLite, refresh UI
  - If same: no banner, load from cache silently

- **Edge cases**: PR deleted/merged since last fetch → handle gh CLI error gracefully with user-facing message.

## Files
- `src/routes/index.tsx` (update — integrate pr-list)
- `src/components/pr-list.tsx` (new)
- `src/server/pr.ts` (update — add getCachedPRs, checkPRUpdate server functions)
- `src/routes/pr.$id.tsx` (update — add update detection banner)

## Tests
- Unit test: update detection logic (SHA comparison)

## Acceptance
- Fetch a PR, go back to landing → see it in the recent list
- Click cached PR → loads instantly from SQLite, no gh CLI calls
- PR with new commits → "PR updated" banner appears → re-fetch works
- Deleted/merged PR → graceful error message

## Notes
