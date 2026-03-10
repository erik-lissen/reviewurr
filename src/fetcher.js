import { execSync } from 'node:child_process';

/**
 * Parse a GitHub PR URL into its components.
 * Expected format: https://github.com/owner/repo/pull/123
 */
function parsePRUrl(url) {
  const match = url.match(
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)\/?$/
  );
  if (!match) {
    throw new Error(`Invalid PR URL: ${url}`);
  }
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

/**
 * Fetch metadata and diff for a single PR using the gh CLI.
 */
function fetchPR(url) {
  const { owner, repo, number } = parsePRUrl(url);
  const repoFlag = `${owner}/${repo}`;

  const metaRaw = execSync(
    `gh pr view ${number} --repo ${repoFlag} --json title,body,headRefName,baseRefName,files,additions,deletions,commits`,
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
  );

  const diff = execSync(`gh pr diff ${number} --repo ${repoFlag}`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });

  const meta = JSON.parse(metaRaw);

  return { url, owner, repo, number, meta, diff };
}

/**
 * Fetch all PRs in parallel-ish (sequential for simplicity with execSync).
 * Returns an array of PR data objects.
 */
export function fetchPRs(urls) {
  return urls.map((url) => fetchPR(url));
}
