**Scope Note**
`git diff HEAD` is empty in this worktree, so I reviewed the feature branch delta (`main...HEAD`) plus current source state.

**Critical**
1. `createServerFn(...).validator(...)` is a broken API call and will throw at runtime (`...validator is not a function`).
Files: [src/server/pr.ts:17](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/pr.ts:17), [src/server/pr.ts:18](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/pr.ts:18), [src/server/analysis.ts:181](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/analysis.ts:181), [src/server/analysis.ts:182](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/analysis.ts:182).  
Fix: replace `.validator(...)` with `.inputValidator(...)` everywhere.

**High**
1. Re-fetch on PR detail can invalidate the page with a stale route ID.  
`upsertPR` deletes/reinserts and changes internal `id`, but the page keeps old `/pr/$id`.  
Files: [src/server/db.ts:64](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/db.ts:64), [src/server/db.ts:70](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/db.ts:70), [src/routes/pr.$id.tsx:64](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/routes/pr.$id.tsx:64), [src/routes/pr.$id.tsx:65](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/routes/pr.$id.tsx:65).  
Fix: update PR row in place (keep same id) or navigate to returned new id after refetch.

2. Foreign-key cascades are declared but disabled by default in SQLite (Bun shows `PRAGMA foreign_keys=0`), so deletes can leave orphan data.  
Files: [src/server/db.ts:6](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/db.ts:6), [src/server/db.ts:187](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/db.ts:187), [src/server/db.ts:200](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/db.ts:200).  
Fix: execute `PRAGMA foreign_keys = ON` at startup and keep deletes transactional.

**Medium**
1. Beat shape mismatch: fresh analysis returns `readingOrder`, UI reads `reading_order`, so ordering badge can render blank until reload from DB.
Files: [src/server/analysis.ts:296](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/analysis.ts:296), [src/components/flow/beat-card.tsx:15](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/components/flow/beat-card.tsx:15), [src/components/flow/beat-card.tsx:38](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/components/flow/beat-card.tsx:38).  
Fix: normalize to one field name across API/UI.

2. File tree is computed once and becomes stale when `files` changes.
File: [src/components/file-tree.tsx:10](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/components/file-tree.tsx:10).  
Fix: derive with `useMemo(() => buildFileTree(files), [files])`.

3. External CLI calls have no timeout/abort path, so requests can hang indefinitely.
Files: [src/server/pr.ts:5](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/pr.ts:5), [src/server/analysis.ts:216](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/analysis.ts:216), [src/server/analysis.ts:232](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/server/analysis.ts:232).  
Fix: enforce timeout and kill process on expiry.

**Low**
1. PR URL parser is permissive and can accept malformed suffixes.
File: [src/lib/diff-types.ts:134](/Users/e/.superset/worktrees/reviewurr/initialize-project/src/lib/diff-types.ts:134).  
Fix: tighten regex or parse URL path segments strictly.

2. Test coverage misses server-function chains and refetch-id behavior; that’s why the `validator` break and stale-id flow slipped through.
Files: [tests/model-settings.test.ts:1](/Users/e/.superset/worktrees/reviewurr/initialize-project/tests/model-settings.test.ts:1), [tests/smoke.test.tsx:1](/Users/e/.superset/worktrees/reviewurr/initialize-project/tests/smoke.test.tsx:1).

Could not run `npm test` in this sandbox because it needs filesystem writes (`EPERM` in `node_modules/.vite-temp`). I did run `npx tsc --noEmit`, which reports multiple compile/type errors consistent with the issues above.
