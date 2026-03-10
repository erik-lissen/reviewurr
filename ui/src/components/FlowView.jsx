import { useState, useMemo } from 'react';
import DiffRenderer from './DiffRenderer';

/**
 * Extract the diff block for a specific file from a full unified diff string.
 */
function extractFileDiff(fullDiff, filePath) {
  const lines = fullDiff.split('\n');
  let capture = false;
  const result = [];

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (capture) break;
      if (line.includes('b/' + filePath)) {
        capture = true;
      }
    }
    if (capture) {
      result.push(line);
    }
  }

  return result.length > 0 ? result.join('\n') : null;
}

/**
 * Given analyzer hunks and raw diffs, resolve each hunk to its actual diff content.
 */
function resolveHunks(hunks, diffs) {
  return (hunks || []).map((hunk) => {
    const file = hunk.file || hunk.filePath || '';
    const prUrl = hunk.pr || '';

    // Find matching diff by PR URL
    const diffEntry = diffs.find((d) => d.pr.url === prUrl);
    let diffStr = null;

    if (diffEntry) {
      diffStr = extractFileDiff(diffEntry.diff, file);
    } else {
      // Try all diffs
      for (const d of diffs) {
        diffStr = extractFileDiff(d.diff, file);
        if (diffStr) break;
      }
    }

    // Compute stats
    let adds = 0, dels = 0;
    if (diffStr) {
      for (const line of diffStr.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) adds++;
        if (line.startsWith('-') && !line.startsWith('---')) dels++;
      }
    }

    return {
      filePath: file,
      prUrl,
      prLabel: prUrl ? prUrl.replace('https://github.com/', '') : '',
      diff: diffStr,
      adds,
      dels,
    };
  });
}

function HunkSection({ hunk, showPrLabel, splitView }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="collapsible" style={{ marginLeft: 0 }}>
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <span className={`chevron ${open ? 'open' : ''}`}>&#9654;</span>
        <span className="file-path">{hunk.filePath}</span>
        <span className="file-stats">
          {hunk.adds > 0 && <span className="stat-add">+{hunk.adds}</span>}
          {hunk.dels > 0 && <span className="stat-del">-{hunk.dels}</span>}
        </span>
      </div>
      <div className={`collapsible-body ${open ? 'expanded' : 'collapsed'}`}>
        {open && (
          <div>
            {showPrLabel && hunk.prLabel && (
              <div style={{ padding: '6px 14px 0' }}>
                <span className="pr-label">{hunk.prLabel}</span>
              </div>
            )}
            {hunk.diff ? (
              <DiffRenderer diffString={hunk.diff} splitView={splitView} />
            ) : (
              <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '11px' }}>
                Could not resolve diff for this file
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChunkCard({ chunk, resolvedHunks, index, showPrLabels, splitView }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="chunk-card">
      <div className="chunk-header" onClick={() => setOpen(!open)}>
        <span className="order-badge">{index + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chunk-name">{chunk.name}</div>
          {chunk.description && (
            <div className="chunk-desc">{chunk.description}</div>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: 8 }}>
          {resolvedHunks.length} file{resolvedHunks.length !== 1 ? 's' : ''}
        </span>
        <span className={`chevron ${open ? 'open' : ''}`}>&#9654;</span>
      </div>
      {open && (
        <div className="chunk-body">
          {resolvedHunks.map((hunk, i) => (
            <HunkSection key={`${hunk.filePath}-${i}`} hunk={hunk} showPrLabel={showPrLabels} splitView={splitView} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlowView({ analysis, diffs, onAnalyze, analyzing, hasPRs, splitView }) {
  const showPrLabels = diffs && diffs.length > 1;

  // Pre-resolve all hunks
  const resolvedChunks = useMemo(() => {
    if (!analysis?.chunks) return [];
    return analysis.chunks
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((chunk) => ({
        ...chunk,
        resolvedHunks: resolveHunks(chunk.hunks, diffs || []),
      }));
  }, [analysis, diffs]);

  if (!analysis && !analyzing) {
    return (
      <div className="flow-center">
        {hasPRs ? (
          <>
            <div className="subtitle">
              Group changes by logical flow using Claude
            </div>
            <button className="btn btn-primary" onClick={onAnalyze}>
              Analyze Flow
            </button>
          </>
        ) : (
          <div className="subtitle">Add PRs first, then analyze the flow</div>
        )}
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="flow-center">
        <div className="spinner" />
        <div className="subtitle">Analyzing flow with Claude...</div>
      </div>
    );
  }

  if (resolvedChunks.length === 0) {
    return (
      <div className="empty-state">
        No flow chunks generated. Try adding more PRs.
      </div>
    );
  }

  return (
    <div>
      {analysis.summary && (
        <div style={{
          padding: '12px 14px',
          marginBottom: 12,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text-secondary)',
          fontSize: '12px',
          lineHeight: 1.5,
        }}>
          {analysis.summary}
        </div>
      )}
      {resolvedChunks.map((chunk, i) => (
        <ChunkCard
          key={chunk.id || i}
          chunk={chunk}
          resolvedHunks={chunk.resolvedHunks}
          index={i}
          showPrLabels={showPrLabels}
          splitView={splitView}
        />
      ))}
    </div>
  );
}
