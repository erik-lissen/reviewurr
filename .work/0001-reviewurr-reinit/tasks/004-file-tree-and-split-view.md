# Task 004: File Tree Sidebar + Split View Toggle

## Status: complete
TASK_STATUS: complete
## Type: AFK
## Depends on: 003

## Objective
Add a file tree sidebar for navigation and a split (side-by-side) diff view toggle.

## Details
- **File tree sidebar** (`components/file-tree.tsx`):
  - Render changed files grouped by directory in a tree structure
  - Single-child directory path compression (e.g. `src/lib/` collapses if only one child)
  - +/- stats per file (additions green, deletions red)
  - Click file → scroll to that file's diff in the main content area
  - Highlight currently-visible file in tree (intersection observer on file headers)
  - Directories sorted first, then files alphabetically
  - Sidebar fixed width (~280px), scrollable independently

- **Split view** (`components/diff-renderer/split-view.tsx`):
  - Toggle button in PR detail header: Unified | Split
  - Split view: two columns — old file (left) with deletions, new file (right) with additions
  - Aligned line numbers: context lines appear on both sides, add/del lines appear on their respective side with blank on the other
  - Synchronized vertical scrolling between left and right
  - Same virtualization via react-window (VariableSizeList per side, or single list with wide rows)
  - Same Shiki highlighting

- **Layout**: sidebar on right side of PR detail page, content on left. Visible in both Files and Flow tabs.

## Files
- `src/components/file-tree.tsx` (new)
- `src/components/diff-renderer/split-view.tsx` (new)
- `src/components/diff-renderer/index.tsx` (update — add view mode prop)
- `src/routes/pr.$id.tsx` (update — integrate sidebar + toggle)

## Tests
- Unit test: file tree builder — flat file list → nested tree with path compression
- Unit test: split view alignment — add/del lines correctly paired with blanks

## Acceptance
- File tree shows all changed files with directory grouping and compressed single-child paths
- Click file in tree → content scrolls to that file
- Toggle to split view → side-by-side diffs with aligned lines and synced scrolling
- Toggle back to unified → works correctly
- Sidebar visible and scrollable independently

## Notes
Completed 2026-03-10. 43 tests total (18 new). File tree with path compression, split view with aligned rows.
FILES_CHANGED: src/lib/file-tree.ts, src/lib/split-diff.ts, src/components/file-tree.tsx, src/components/diff-renderer/split-view.tsx, src/components/diff-renderer/index.tsx, src/routes/pr.$id.tsx, tests/file-tree.test.ts, tests/split-diff.test.ts
