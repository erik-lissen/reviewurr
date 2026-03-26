# Decisions: 0001-reviewurr-reinit

| Date | Decision | Rationale | Changed From |
|------|----------|-----------|--------------|
| 2026-03-10 | TanStack Start + Bun over Express + Vite | Latest/fastest, server functions replace API routes | Express + Vite |
| 2026-03-10 | Tailwind CSS v4 + shadcn/ui | Modern styling, dark theme; CSS-based config (not tailwind.config.ts) | Vanilla CSS |
| 2026-03-10 | Shell out to CLIs (gh, claude, codex) | No direct API calls, no API key management | — |
| 2026-03-10 | bun:sqlite for persistence | Zero setup, fast, local-only | In-memory store |
| 2026-03-10 | "Beat" as core abstraction | Intent reconstruction, not file/commit grouping | "Chunk" naming |
| 2026-03-10 | Custom diff renderer + react-window | diff2html too slow for large PRs, can't virtualize | diff2html |
| 2026-03-10 | Shiki over highlight.js | WASM, VS Code accuracy, cacheable | highlight.js |
| 2026-03-10 | Web worker for diff parsing | Main thread stays free for UI | Main-thread parsing |
| 2026-03-10 | Commit-aware analysis | Per-commit diffs to model, not just flat diff | Flat diff only |
| 2026-03-10 | Claude Sonnet as default model | Beat reconstruction needs stronger reasoning | Originally Haiku |
| 2026-03-10 | Unset CLAUDECODE env var when spawning claude CLI | Avoid nested session conflicts | — |
| 2026-03-10 | Replace everything on branch | Fresh start, existing code doesn't match desired architecture | Incremental migration |
