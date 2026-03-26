# Context: 0001-reviewurr-reinit

**Status:** shipped
**Tasks:** 8/8 complete
**Created:** 2026-03-10
**Ticket:** none (auto-numbered)
**PR:** https://github.com/erik-lissen/reviewurr/pull/1
**Shipped:** 2026-03-11

## Summary
Reinitializing reviewurr — a local PR review tool that groups code changes by developer intent ("beats") rather than alphabetically. Replacing existing Express + diff2html stack with TanStack Start + Bun + custom virtualized diff renderer + Shiki + bun:sqlite. Two views: Files (GitHub-faithful diff) and Flow (AI-reconstructed beats). Performance-first with virtualization, web workers, and lazy loading.

## Current State
Shipped. PR #1 created and pushed. No CI configured yet.

## Dependency Graph
```
001 → 002 → 003 → 004
              ↓      ↓
             005    006 → 007
                     ↓
                    008 (HITL)
```
