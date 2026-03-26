# Task 003: Custom Virtualized Diff Renderer + Shiki

## Status: complete
TASK_STATUS: complete
## Type: AFK
## Depends on: 002

## Objective
Replace basic `<pre>` diff display with a custom virtualized diff renderer using react-window and Shiki syntax highlighting via web workers. Unified view only.

## Details
- **Diff parser web worker** (`workers/diff-parser.worker.ts`):
  - Input: raw unified diff text for a single file
  - Output: structured hunks — array of `{ oldStart, oldLines, newStart, newLines, changes: [{ type: 'add'|'del'|'context', oldLine?, newLine?, content }] }`
  - Parse `@@` hunk headers, `+`/`-`/` ` lines, file headers (`diff --git`, `---`, `+++`)
  - Communicate via `postMessage`

- **Shiki highlighter worker** (`workers/highlighter.worker.ts`):
  - Create one `createHighlighter` instance from `shiki/bundle/web` with `github-dark` theme
  - Load languages on demand (detect from file extension)
  - API: `highlight(code: string, lang: string) → html tokens`
  - Cache the highlighter instance — never recreate
  - Return Shiki tokens (not HTML strings) for custom rendering

- **Main-thread highlight API** (`lib/highlight.ts`):
  - Wraps worker communication with promises
  - Queue requests, resolve when worker responds

- **Diff renderer components** (`components/diff-renderer/`):
  - `index.tsx`: file list — maps files to `FileDiff` components. Not virtualized at file level (files are collapsible).
  - `file-diff.tsx`: single file. Header (filename, stats, collapse toggle). When expanded: sends raw diff to parser worker, gets structured hunks, then renders via `react-window VariableSizeList`.
  - `line.tsx`: single diff line. Memoized (`React.memo`). Renders: gutter (old line number | new line number), +/-/space indicator, syntax-highlighted code from Shiki. Tailwind classes for add (green bg), delete (red bg), context.
  - `hunk-header.tsx`: renders `@@ -X,Y +A,B @@` separator rows with muted styling.
  - Lazy expansion: collapsed files = zero DOM. Expand triggers worker parse + highlight pipeline.

- **Integration**: replace the basic `<pre>` rendering in `pr.$id.tsx` with the new diff renderer.

## Files
- `src/workers/diff-parser.worker.ts` (new)
- `src/workers/highlighter.worker.ts` (new)
- `src/lib/highlight.ts` (new)
- `src/lib/diff-types.ts` (update with full hunk types)
- `src/components/diff-renderer/index.tsx` (new)
- `src/components/diff-renderer/file-diff.tsx` (new)
- `src/components/diff-renderer/line.tsx` (new)
- `src/components/diff-renderer/hunk-header.tsx` (new)
- `src/routes/pr.$id.tsx` (update to use new renderer)
- `package.json` (add shiki, react-window)

## Tests
- Unit test: diff parser produces correct hunks from sample unified diff
- Unit test: line component renders correct classes for add/del/context

## Acceptance
- Expand a file → diff lines render with Shiki syntax highlighting, line numbers, +/- coloring, hunk headers
- Scroll a large file (1000+ lines) smoothly — virtualized, only visible lines in DOM
- Collapse/expand is instant (lazy — no work until expanded)
- Main thread stays responsive during parsing and highlighting (verify via DevTools)

## Notes
Completed 2026-03-10. 25 tests total (11 new). Workers + react-window + Shiki all wired up.
FILES_CHANGED: src/lib/diff-types.ts, src/lib/highlight.ts, src/workers/diff-parser.worker.ts, src/workers/highlighter.worker.ts, src/components/diff-renderer/index.tsx, src/components/diff-renderer/file-diff.tsx, src/components/diff-renderer/line.tsx, src/components/diff-renderer/hunk-header.tsx, src/routes/pr.$id.tsx, vite.config.ts, package.json, bun.lock, tests/diff-parser.test.ts
