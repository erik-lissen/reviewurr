# QA Round 001

**Started:** 2026-03-11
**Status:** complete

## Findings

### F-001: Unified diff long lines show broken scrollbar
- **Area:** Files tab / diff renderer
- **Severity:** medium
- **Status:** ~~open~~ ~~fixing~~ fixed
- **Description:** In unified view, long lines create inline scrollbars, but can't actually scroll with mouse or the scrollbar itself. The scrollbar should not be there.
- **Technical notes:** Per-line `overflow-x-auto` conflicted with file-level horizontal scroll container.
- **Fix:** Removed per-line overflow-x-auto from line.tsx (28c6ec8)

### F-002: Flow analysis has no streaming or progress indication
- **Area:** Flow tab / beat analysis
- **Severity:** high
- **Status:** ~~open~~ ~~fixing~~ fixed
- **Description:** Clicking analyze starts the process but there's no streaming of the response in realtime. It just takes a long time with no idea when it will finish or what's happening.
- **Technical notes:** Added elapsed time counter with spinner and model name display during analysis.
- **Fix:** Added ElapsedTimer component with spinner + model name + duration hint (d24cfa6)

### F-003: Leaving Flow tab loses in-progress analysis
- **Area:** Flow tab / state management
- **Severity:** high
- **Status:** ~~open~~ ~~fixing~~ fixed
- **Description:** If you navigate away from the Flow tab while analysis is running, it loses track of it — no way to see it's still running or get the result.
- **Technical notes:** Lifted analysis state to route level via ref, persists across tab switches per model.
- **Fix:** Analysis state lifted to pr.$id.tsx route, keyed per model (d24cfa6)

### F-004: Add built-in themes via Tailwind
- **Area:** Theming / global styles
- **Severity:** medium
- **Status:** ~~open~~ ~~fixing~~ fixed
- **Description:** Want theming support via Tailwind with some built-in themes to choose from.
- **Technical notes:** CSS custom properties bridged through @theme directive. 5 themes with localStorage persistence.
- **Fix:** Added 5 themes (GitHub Dark, Dimmed, Monokai, Solarized Dark, Nord) with selector in header (3ddd867)

### F-005: Codex analysis broken + add Opus as model option
- **Area:** Flow tab / model selector
- **Severity:** medium
- **Status:** ~~open~~ ~~fixing~~ fixed
- **Description:** Cannot analyze with Codex (Sonnet works fine). Also want Opus added as a model option.
- **Technical notes:** Added claude-opus with model ID claude-opus-4-6. Default changed to Opus.
- **Fix:** Added Opus option, maps to claude-opus-4-6 model ID, set as default (47db336)

### Out of scope (next ticket)
- Flow tab UI redesign — tracked separately, not a QA fix.

## Round 001 Summary
- **Fixed:** 5 findings
- **Deferred:** 0 findings
- **Still open:** 0 findings
