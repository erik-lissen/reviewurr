# Task 008: Prompt Engineering for Beat Quality

## Status: complete
TASK_STATUS: complete
## Type: HITL
## Depends on: 006

## Objective
Refine the beat analysis prompt for Claude Sonnet (and Codex) to produce high-quality, well-bounded beats with accurate intent reconstruction.

## Details
- **Prompt refinement**: iterate on the system prompt and user prompt in `server/analysis.ts`
- **Input to model**: PR title, PR body/description, per-commit diffs with commit messages, file list with stats
- **Output format**: structured JSON beats — each with title, description, file hunks, reading order, detected references
- **Quality criteria**:
  - Beats represent coherent units of developer intent (not just file proximity)
  - Beat boundaries are meaningful — related changes grouped, unrelated changes separated
  - Titles are descriptive and actionable ("Add Stripe payment endpoint" not "Changes to payment files")
  - Descriptions explain WHY, not just WHAT
  - Reading order within a beat follows logical dependency (types before implementation before tests)
  - Hunk attribution is correct — each hunk belongs to the right beat
  - Cross-commit grouping works (changes spanning multiple commits correctly unified into one beat)
- **Test against real PRs**: 3-5 PRs of varying sizes (small 5-file, medium 20-file, large 50+ file)
- **Prompt for Codex**: may need adaptation — different model, different strengths
- **Iterate**: run analysis, review beats with user, adjust prompt, repeat

## Files
- `src/server/analysis.ts` (update — prompt refinement)

## Tests
- Manual: run against real PRs and evaluate beat quality with user

## Acceptance
- Analysis produces meaningful beats on 3+ real PRs of varying sizes
- Beats correctly group cross-commit related changes
- Titles are descriptive, descriptions explain intent
- Reading order within beats is logical
- User signs off on quality

## Notes
Completed 2026-03-11. Tested against lissengithub/lissen#2866 (26 commits, 60 files, 3294 additions).
Produced 15 well-bounded beats with cross-commit grouping, intent-driven titles, and correct reading order.
Key changes: per-commit diffs instead of flat diff, smart truncation (80KB budget), stronger beat definition
with good/bad examples, reading order guidance (types→impl→integration→tests→config).
FILES_CHANGED: src/server/analysis.ts, src/server/db.ts
