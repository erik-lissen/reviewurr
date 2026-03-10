import { useState, useMemo } from 'react';
import DiffRenderer from './DiffRenderer';

function parseStats(diffBlock) {
  const lines = diffBlock.split('\n');
  let adds = 0;
  let dels = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) adds++;
    if (line.startsWith('-') && !line.startsWith('---')) dels++;
  }
  return { adds, dels };
}

function DiffSection({ filePath, diffStr, splitView }) {
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => parseStats(diffStr), [diffStr]);
  const fileId = `file-${filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <div className="collapsible" id={fileId}>
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <span className={`chevron ${open ? 'open' : ''}`}>&#9654;</span>
        <span className="file-path">{filePath}</span>
        <span className="file-stats">
          {stats.adds > 0 && <span className="stat-add">+{stats.adds}</span>}
          {stats.dels > 0 && <span className="stat-del">-{stats.dels}</span>}
        </span>
      </div>
      <div className={`collapsible-body ${open ? 'expanded' : 'collapsed'}`}>
        {open && <DiffRenderer diffString={diffStr} splitView={splitView} />}
      </div>
    </div>
  );
}

export default function RawDiffView({ diffs, splitView }) {
  const fileMap = useMemo(() => {
    const map = new Map();

    for (const entry of (diffs || [])) {
      const rawDiff = entry.diff || '';
      const fileDiffs = rawDiff.split(/^(?=diff --git )/m).filter(Boolean);

      for (const fd of fileDiffs) {
        const headerMatch = fd.match(/^diff --git a\/(.+?) b\/(.+)/m);
        if (!headerMatch) continue;
        const filePath = headerMatch[2];

        if (!map.has(filePath)) {
          map.set(filePath, []);
        }
        map.set(filePath, map.get(filePath).concat(fd));
      }
    }

    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([path, chunks]) => ({
      filePath: path,
      diffStr: chunks.join('\n'),
    }));
  }, [diffs]);

  if (!diffs || diffs.length === 0) {
    return <div className="empty-state">Add PR URLs above to view diffs</div>;
  }

  if (fileMap.length === 0) {
    return <div className="empty-state">No file changes found in the fetched PRs</div>;
  }

  return (
    <div>
      {fileMap.map(({ filePath, diffStr }) => (
        <DiffSection key={filePath} filePath={filePath} diffStr={diffStr} splitView={splitView} />
      ))}
    </div>
  );
}
