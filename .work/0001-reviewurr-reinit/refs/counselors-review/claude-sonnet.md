Here is the code review:

---

## Code Review: `0001-reviewurr-reinit`

### Critical

None.

---

### High

**1. Orphaned beats on PR re-fetch** (`src/server/db.ts:60-75`)

`upsertPR` manually deletes `diffs` and `commits` but never deletes `beats` or `beat_hunks`. The `ON DELETE CASCADE` on `beats.pr_id` is effectively a no-op because `PRAGMA foreign_keys = ON` is never set (SQLite foreign key enforcement is off by default). When a PR is re-fetched, the old row is deleted and a new row is inserted with a fresh auto-increment `id`. The old beats remain in the DB forever, orphaned. Every re-fetch leaks rows.

Fix: either add `db.run('PRAGMA foreign_keys = ON')` alongside WAL mode, or add explicit `DELETE FROM beats WHERE pr_id = ?` in the existing delete block.

**2. Non-atomic upsert in `upsertPR`** (`src/server/db.ts:59-75`)

Three separate statements (DELETE diffs, DELETE commits, DELETE pr, INSERT pr) run without a transaction. If the process crashes between the deletes and the insert, the PR data is permanently gone with no way to recover.

Fix: wrap in `db.transaction(...)`.

---

### Medium

**3. `PRAGMA foreign_keys` never enabled** (`src/server/db.ts:6`)

All `ON DELETE CASCADE` declarations across `diffs`, `commits`, `beats`, and `beat_hunks` are inert. The manual cascade handling in `upsertPR` and `deleteBeats` papers over this today, but any future code that deletes a `prs` row directly will silently orphan related rows.

**4. Greedy regex for beats JSON extraction** (`src/server/analysis.ts:257`)

```ts
const jsonMatch = resultText.match(/\{[\s\S]*"beats"[\s\S]*\}/)
```

This is maximally greedy — it'll capture from the first `{` to the last `}` in the entire response. If the model outputs any explanatory text before/after the JSON (despite the prompt saying not to), or if the Codex path returns something with preamble, this match either fails or captures garbage. A simple `JSON.parse` in a try-catch with a fallback to regex-trimming would be more robust.

**5. `handleReanalyze` double-clears beats** (`src/components/flow/beat-list.tsx:51-53`)

```ts
await clearBeats({ data: { prId, model } })
setBeats(null)
await handleAnalyze()
```

`handleAnalyze` calls `analyzePR` which internally calls `deleteBeats(prId, model)` (analysis.ts:270). The `clearBeats` call in `handleReanalyze` is redundant. Not a correctness bug but an unnecessary server round-trip, and if `clearBeats` fails with an exception, `handleAnalyze` is never reached (the error is unhandled here since `handleReanalyze` has no try/catch).

**6. `FileTree` renders in Flow tab** (`src/routes/pr.$id.tsx:181`)

The `<FileTree>` is always rendered regardless of `activeTab`. In the Flow tab, clicking a file in the tree has no effect (no scroll-to-beat behavior is wired). This isn't broken but it's probably unintentional — the tree was designed to anchor into the diff renderer's file sections.

---

### Low

**7. `codexAvailableCache` is a permanent module-level cache** (`src/server/analysis.ts:149`)

Once set to `false`, it never resets. If a user installs Codex while the server is running, the selector will keep showing "not installed" until server restart. Acceptable limitation but undocumented.

**8. `setPreferredModel` accepts arbitrary strings** (`src/server/analysis.ts:182-186`)

The validator is a pass-through: `(d: { model: string }) => d`. Any string gets persisted. The retrieval logic handles it gracefully (`'codex' : 'claude-sonnet'`), but an explicit allowlist would be cleaner.

**9. N+1 query in `getBeats`** (`src/server/db.ts:248-261`)

Fetches hunks in a separate query per beat. Fine at the scale this tool operates (a few beats per PR), but a single `JOIN` query would be cleaner.

---

### Summary

The two items worth fixing before shipping:
1. **Orphaned beats leak** — re-fetching a PR accumulates garbage in the DB indefinitely
2. **Non-atomic upsert** — potential for PR data loss on crash

Both are one-line fixes. The rest are acceptable for a local tool at this stage.
