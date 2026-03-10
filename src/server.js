import express from 'express';
import open from 'open';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPRs } from './fetcher.js';
import { analyze } from './analyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PR_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+\/?$/;

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const store = {
  /** @type {Array<{url,owner,repo,number,meta,diff}>} */
  prs: [],
  /** @type {null | object} */
  analysis: null,
  /** @type {"idle"|"fetching"|"analyzing"} */
  status: 'idle',
  /** @type {null | string} */
  error: null,
};

/** Build a slim metadata view for a PR (no diff). */
function prMeta(pr) {
  return {
    url: pr.url,
    owner: pr.owner,
    repo: pr.repo,
    number: pr.number,
    title: pr.meta.title,
    headRefName: pr.meta.headRefName,
    baseRefName: pr.meta.baseRefName,
    additions: pr.meta.additions,
    deletions: pr.meta.deletions,
    filesChanged: pr.meta.files?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
export async function startServer(port = 3456) {
  const app = express();
  app.use(express.json());

  const uiDist = path.resolve(__dirname, '..', 'ui', 'dist');

  // --- API routes ----------------------------------------------------------

  /**
   * POST /api/fetch
   * Body: { urls: ["https://github.com/..."] }
   * Fetches PR data, stores in memory, returns metadata + raw diffs.
   */
  app.post('/api/fetch', (req, res) => {
    const { urls } = req.body ?? {};

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls must be a non-empty array' });
    }

    // Validate URLs
    for (const url of urls) {
      if (!PR_URL_RE.test(url.replace(/\/$/, ''))) {
        return res.status(400).json({
          error: `Invalid PR URL: ${url}. Expected https://github.com/owner/repo/pull/123`,
        });
      }
    }

    // Deduplicate against already-fetched PRs
    const existing = new Set(store.prs.map((p) => p.url.replace(/\/$/, '')));
    const newUrls = urls.filter((u) => !existing.has(u.replace(/\/$/, '')));

    if (newUrls.length === 0) {
      return res.json({
        prs: store.prs.map(prMeta),
        diffs: Object.fromEntries(store.prs.map((p) => [p.url, p.diff])),
        added: 0,
      });
    }

    store.status = 'fetching';
    store.error = null;

    try {
      const fetched = fetchPRs(newUrls);
      store.prs.push(...fetched);
      // Clear stale analysis when new PRs arrive
      store.analysis = null;
      store.status = 'idle';

      return res.json({
        prs: store.prs.map(prMeta),
        diffs: Object.fromEntries(store.prs.map((p) => [p.url, p.diff])),
        added: fetched.length,
      });
    } catch (err) {
      store.status = 'idle';
      store.error = err.message;
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/analyze
   * No body required. Kicks off analysis in the background.
   * Returns immediately with { status: "analyzing" }.
   */
  app.post('/api/analyze', (_req, res) => {
    if (store.prs.length === 0) {
      return res.status(400).json({ error: 'No PRs loaded. Fetch PRs first.' });
    }

    if (store.status === 'analyzing') {
      return res.json({ status: 'analyzing', message: 'Analysis already in progress' });
    }

    store.status = 'analyzing';
    store.error = null;
    store.analysis = null;

    // Fire and forget -- caller polls GET /api/status
    const snapshot = [...store.prs];
    setImmediate(async () => {
      try {
        const result = analyze(snapshot);
        store.analysis = result;
        store.status = 'idle';
      } catch (err) {
        store.error = err.message;
        store.status = 'idle';
      }
    });

    return res.json({ status: 'analyzing' });
  });

  /**
   * GET /api/status
   * Returns current state for polling.
   */
  app.get('/api/status', (_req, res) => {
    res.json({
      prs: store.prs.map(prMeta),
      analysis: store.analysis,
      status: store.status,
      error: store.error,
    });
  });

  /**
   * GET /api/diff/:prIndex
   * Returns raw diff text for a specific PR (kept for the UI).
   */
  app.get('/api/diff/:prIndex', (req, res) => {
    const idx = parseInt(req.params.prIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= store.prs.length) {
      return res.status(404).send('PR not found');
    }
    res.type('text/plain').send(store.prs[idx].diff);
  });

  // --- Static files --------------------------------------------------------

  app.use(express.static(uiDist));

  // SPA fallback: serve index.html for any non-API route
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    const index = path.join(uiDist, 'index.html');
    res.sendFile(index, (err) => {
      if (err) {
        res.status(404).send('UI not built. Run: pnpm build:ui');
      }
    });
  });

  // --- Start ---------------------------------------------------------------

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`reviewurr running at ${url}`);
      open(url);
      resolve(server);
    });
  });
}
