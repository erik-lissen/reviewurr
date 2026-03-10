import { useMemo, useState } from 'react';

/**
 * Build a nested tree structure from flat file paths.
 * Returns array of { name, path, children, adds, dels }
 */
function buildTree(files) {
  const root = { name: '', path: '', children: [], adds: 0, dels: 0 };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join('/');

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: partPath, children: [], adds: 0, dels: 0 };
        current.children.push(child);
      }

      if (isFile) {
        child.adds = file.adds;
        child.dels = file.dels;
        child.isFile = true;
      }

      current = child;
    }
  }

  // Collapse single-child directories
  function collapse(node) {
    node.children.forEach(collapse);
    if (node.children.length === 1 && !node.children[0].isFile && node.name) {
      const child = node.children[0];
      node.name = node.name + '/' + child.name;
      node.path = child.path;
      node.children = child.children;
      collapse(node); // recurse in case of chain
    }
  }
  collapse(root);

  // Sort: directories first, then alphabetical
  function sort(node) {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sort);
  }
  sort(root);

  return root.children;
}

function TreeNode({ node, depth, activeFile, onSelect }) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = !node.isFile;

  if (isDir) {
    return (
      <>
        <div
          className="file-tree-item file-tree-dir"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen(!open)}
        >
          <span className={`tree-chevron ${open ? 'open' : ''}`}>&#9654;</span>
          <span className="tree-name">{node.name}</span>
        </div>
        {open && node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  return (
    <div
      className={`file-tree-item file-tree-file ${activeFile === node.path ? 'active' : ''}`}
      style={{ paddingLeft: 8 + depth * 12 }}
      onClick={() => onSelect(node.path)}
    >
      <span className="tree-name">{node.name}</span>
      <span className="tree-stats">
        {node.adds > 0 && <span className="stat-add">+{node.adds}</span>}
        {node.dels > 0 && <span className="stat-del">-{node.dels}</span>}
      </span>
    </div>
  );
}

export default function FileTree({ diffs, activeFile, onSelectFile }) {
  const files = useMemo(() => {
    const map = new Map();

    for (const entry of (diffs || [])) {
      const rawDiff = entry.diff || '';
      const fileDiffs = rawDiff.split(/^(?=diff --git )/m).filter(Boolean);

      for (const fd of fileDiffs) {
        const headerMatch = fd.match(/^diff --git a\/(.+?) b\/(.+)/m);
        if (!headerMatch) continue;
        const filePath = headerMatch[2];

        if (!map.has(filePath)) {
          let adds = 0, dels = 0;
          for (const line of fd.split('\n')) {
            if (line.startsWith('+') && !line.startsWith('+++')) adds++;
            if (line.startsWith('-') && !line.startsWith('---')) dels++;
          }
          map.set(filePath, { path: filePath, adds, dels });
        }
      }
    }

    return Array.from(map.values());
  }, [diffs]);

  const tree = useMemo(() => buildTree(files), [files]);

  if (files.length === 0) {
    return (
      <div className="file-tree-empty">No files</div>
    );
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        Files ({files.length})
      </div>
      <div className="file-tree-list">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            onSelect={onSelectFile}
          />
        ))}
      </div>
    </div>
  );
}
