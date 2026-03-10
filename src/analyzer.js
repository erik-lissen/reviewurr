import { execSync } from 'node:child_process';

/**
 * Build the prompt that asks Claude to group diff changes into logical chunks.
 */
function buildPrompt(prData) {
  let prompt = `You are a senior code reviewer. You are given the diffs from one or more GitHub pull requests.

Your job is to group the changes into logical chunks ordered by CODE FLOW — how the code actually executes — NOT alphabetically by file name.

Ordering guidance (data flows from top to bottom):
1. Data layer (models, schemas, migrations, DB access)
2. Business logic / domain services
3. API layer (routes, controllers, handlers)
4. UI components (views, templates, frontend)
5. Configuration / infrastructure (env, CI, docker)
6. Tests

Within each layer, order by dependency: if chunk A's code is called by chunk B's code, chunk A comes first.

Each chunk should represent a single logical concern (e.g. "Add user validation", "Update API response format", "New dashboard component").

Output ONLY valid JSON matching this exact schema — no markdown fences, no extra text:

{
  "summary": "string - overall feature summary across all PRs",
  "chunks": [
    {
      "id": "string - unique short id like chunk-1",
      "name": "string - short name for this logical group",
      "description": "string - why this chunk exists and what it does",
      "order": number,
      "hunks": [
        {
          "file": "string - file path",
          "startLine": number,
          "endLine": number,
          "pr": "string - PR URL this came from"
        }
      ]
    }
  ]
}

Here are the PR diffs:

`;

  for (const pr of prData) {
    prompt += `--- PR: ${pr.url} ---\n`;
    prompt += `Title: ${pr.meta.title}\n`;
    if (pr.meta.body) {
      prompt += `Description: ${pr.meta.body}\n`;
    }
    prompt += `Branch: ${pr.meta.headRefName} → ${pr.meta.baseRefName}\n`;
    prompt += `Files changed: ${pr.meta.files?.length ?? 'unknown'}, +${pr.meta.additions} -${pr.meta.deletions}\n\n`;
    prompt += pr.diff;
    prompt += '\n\n';
  }

  return prompt;
}

/**
 * Extract the JSON result text from Claude CLI --output-format json response.
 * The CLI wraps output in a JSON envelope with a "result" field.
 */
/**
 * Strip markdown code fences from a string (e.g. ```json ... ```)
 */
function stripCodeFences(str) {
  return str.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function extractResult(raw) {
  try {
    const envelope = JSON.parse(raw);
    // --output-format json returns { result: "..." } where result is the text
    if (envelope.result) {
      const cleaned = stripCodeFences(envelope.result);
      return JSON.parse(cleaned);
    }
    if (envelope.summary && envelope.chunks) {
      return envelope;
    }
    throw new Error('Unexpected response shape from Claude CLI');
  } catch (e) {
    try {
      const cleaned = stripCodeFences(raw);
      const direct = JSON.parse(cleaned);
      if (direct.summary && direct.chunks) {
        return direct;
      }
    } catch {
      // ignore
    }
    throw new Error(`Failed to parse Claude response: ${e.message}\nRaw: ${raw.slice(0, 500)}`);
  }
}

/**
 * Analyze PR diffs by shelling out to the Claude CLI.
 * Returns the structured chunks JSON.
 */
export function analyze(prData) {
  const prompt = buildPrompt(prData);

  // Escape the prompt for shell: write to a temp approach via stdin
  // Unset CLAUDECODE env var to allow spawning from within a Claude Code session
  const env = { ...process.env };
  delete env.CLAUDECODE;

  let result;
  try {
    result = execSync(
      `claude --model claude-haiku-4-5-20251001 --output-format json -p`,
      {
        input: prompt,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120_000,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    throw new Error(
      `Claude CLI failed (exit ${err.status}):\nstderr: ${stderr.slice(0, 1000)}\nstdout: ${stdout.slice(0, 500)}`
    );
  }

  return extractResult(result);
}
