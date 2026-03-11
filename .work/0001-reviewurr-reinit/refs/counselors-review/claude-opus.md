I've now read all the source files. Here's my code review.

---

# Code Review: reviewurr reinit

## Critical

### 1. Command injection via `gh` CLI args — `src/server/pr.ts:5-13`

`runGh` passes user-derived values (`owner`, `repo`, `number`) directly to `Bun.spawn`. While `Bun.spawn` with an array avoids shell injection, the values still flow directly into `gh` CLI arguments. A malicious PR URL could inject `gh` flags (e.g., owner = `--help` or `--json`). The `parsePRUrl` regex mitigates this somewhat (requires `[^/]+`), but it doesn't prevent strings starting with `-`.

**Fix:** Validate that `owner`/`repo` match `^[a-zA-Z0-9._-]+$` before passing to `gh`.

### 2. Arbitrary command execution via model parameter — `src/server/analysis.ts:216-218`

The `model` parameter from `analyzePR` is only checked for `=== 'codex'` vs fallback to Claude. If someone passes `model: 'codex'`, the server spawns `codex -q --model codex-mini-latest` with the full diff as stdin. This relies on `codex` being a trusted binary. Not critical since it's a local tool, but worth noting the server trusts whatever binary is on `$PATH` named `codex`.

## High

### 3. Unbounded diff storage — `src/server/db.ts:38-44`

The `diffs.content` column stores arbitrarily large diffs as TEXT. A PR with a huge diff (e.g., a vendor commit with 50MB of changes) could bloat the SQLite database significantly. There's no size limit or warning.

### 4. `upsertPR` is a delete-then-insert, not a true upsert — `src/server/db.ts:58-76`

The function deletes diffs, commits, and the PR row, then re-inserts. This means the PR `id` changes on every re-fetch, which will break any external references to the old id (bookmarks, URLs). It also loses all associated beat analysis data because of `ON DELETE CASCADE`... except cascade isn't enabled by default in SQLite.

**Bug:** SQLite doesn't enforce foreign keys by default. You need `PRAGMA foreign_keys = ON`. Without it, `ON DELETE CASCADE` is silently ignored, meaning orphaned `commits`, `diffs`, and `beats` rows will accumulate when you delete a PR.

### 5. Race condition in beat deletion — `src/server/db.ts:265-284`

`deleteBeats` first queries beat IDs, then deletes hunks in a loop, then deletes beats. This isn't wrapped in a transaction, so concurrent requests could leave orphaned `beat_hunks`. Same issue in `upsertPR`.

### 6. Regex-based JSON extraction is fragile — `src/server/analysis.ts:257`

```ts
const jsonMatch = resultText.match(/\{[\s\S]*"beats"[\s\S]*\}/)
```

This greedy regex will match from the first `{` to the last `}` in the entire output. If the model output contains any text after the JSON (which it often does), or nested objects with `}`, this could capture garbage. A more robust approach: find the first `{` and then use a bracket-counting parser to find the matching `}`.

## Medium

### 7. `react-window` List API mismatch — `src/components/diff-renderer/file-diff.tsx:114-120`

You're passing `rowComponent`, `rowProps`, `rowCount`, `rowHeight` to `<List>`. The standard `react-window` `FixedSizeList`/`VariableSizeList` uses `children` as a render function, `itemCount`, `itemSize`, etc. — not `rowComponent`/`rowProps`. This either won't work with stock `react-window`, or you're using a fork/wrapper (react-window v2.2.7 may have a different API). Worth verifying this actually renders.

### 8. Highlight worker memory leak potential — `src/lib/highlight.ts:12-13`

The `pending` Map is only cleaned up on success or on fatal worker error. If the worker silently drops a message (no `onerror`, no response), the promise will never resolve and the entry stays in `pending` forever. The `requestId` counter also grows unboundedly (though practically harmless).

### 9. No error boundary in PR detail route — `src/routes/pr.$id.tsx`

The loader calls `getPRData` which can throw. If it throws (e.g., PR deleted from DB), there's no error boundary or `errorComponent` on the route. TanStack Router will show a blank screen or an unhandled error.

### 10. `stderr` read after `proc.exited` — `src/server/analysis.ts:227-228`

```ts
exitCode = await proc.exited
// ...
const stderr = await new Response(proc.stderr).text()
```

After `proc.exited` resolves, the stderr pipe may already be closed or drained. You should read both stdout and stderr before awaiting `proc.exited`, or at least concurrently. Same pattern at line 239-244.

### 11. Hardcoded model version — `src/server/analysis.ts:233`

`claude-sonnet-4-6` is hardcoded. When newer models ship, this becomes stale.

## Low

### 12. `PRAGMA foreign_keys = ON` missing — `src/server/db.ts`

Already mentioned as part of #4 but worth separate callout: you should add `db.run('PRAGMA foreign_keys = ON')` right after creating the database.

### 13. `timeAgo` timezone assumption — `src/lib/time-ago.ts:4`

```ts
const then = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z')).getTime()
```

Assumes all non-Z dates from SQLite are UTC. This is correct for `datetime('now')` but could be wrong if the system timezone leaks in elsewhere.

### 14. FileTree always renders — `src/routes/pr.$id.tsx:181`

`<FileTree>` renders even on the Flow tab where it's less useful. Consider hiding it or making it tab-aware.

### 15. No `.gitignore` for `reviewurr.db` — `src/server/db.ts:3`

The SQLite database is created in the working directory. It (and its WAL/SHM files) should be gitignored.

### 16. Missing key in `react-window` — split-view and file-diff

The `List` component renders items by index. The `key` prop isn't explicitly managed for row components, which is fine for `react-window` but worth noting.

---

## Summary

The most actionable items:
1. **Add `PRAGMA foreign_keys = ON`** — Without this, your cascade deletes are no-ops and you're silently accumulating orphaned rows.
2. **Wrap multi-statement DB operations in transactions** — `upsertPR` and `deleteBeats` need `BEGIN/COMMIT`.
3. **Validate owner/repo inputs** against a safe pattern before passing to `gh`.
4. **Fix the JSON extraction regex** — use bracket counting instead of greedy `[\s\S]*`.
5. **Verify `react-window` v2 API** — the prop names (`rowComponent`, `rowProps`, `rowCount`) look non-standard.
