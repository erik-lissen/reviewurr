import { useState, useEffect, useRef, useCallback } from 'react'
import type { DiffFile } from '@/lib/diff-types'
import { buildFileTree, type FileTreeNode } from '@/lib/file-tree'

interface FileTreeProps {
  files: DiffFile[]
}

export function FileTree({ files }: FileTreeProps) {
  const [tree] = useState(() => buildFileTree(files))
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Set up IntersectionObserver to track which file diff is visible
  useEffect(() => {
    const elements = files
      .map((f) => document.getElementById(`file-${encodeURIComponent(f.filename)}`))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the most recently intersecting entry
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id
            const filename = decodeURIComponent(id.replace('file-', ''))
            setActiveFile(filename)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    for (const el of elements) {
      observerRef.current.observe(el)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [files])

  const scrollToFile = useCallback((filename: string) => {
    const id = `file-${encodeURIComponent(filename)}`
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="w-[280px] shrink-0 border-l border-gh-text/10 overflow-y-auto sticky top-0 h-screen">
      <div className="p-3 text-xs font-medium text-gh-text/50 uppercase tracking-wider border-b border-gh-text/10">
        Files
      </div>
      <div className="py-1">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            onFileClick={scrollToFile}
          />
        ))}
      </div>
    </div>
  )
}

interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  activeFile: string | null
  onFileClick: (filename: string) => void
}

function TreeNode({ node, depth, activeFile, onFileClick }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const paddingLeft = 12 + depth * 16

  if (node.file) {
    // Leaf file node
    const isActive = activeFile === node.file.filename
    return (
      <button
        type="button"
        onClick={() => onFileClick(node.file!.filename)}
        className={`w-full text-left flex items-center gap-1 py-1 px-2 text-xs font-mono hover:bg-gh-tertiary transition-colors ${
          isActive ? 'bg-gh-tertiary text-gh-accent' : 'text-gh-text/80'
        }`}
        style={{ paddingLeft }}
      >
        <span className="truncate flex-1">{node.name}</span>
        <span className="flex gap-1.5 shrink-0 text-[10px]">
          {node.file.additions > 0 && (
            <span className="text-gh-green">+{node.file.additions}</span>
          )}
          {node.file.deletions > 0 && (
            <span className="text-gh-red">-{node.file.deletions}</span>
          )}
        </span>
      </button>
    )
  }

  // Directory node
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-1 py-1 px-2 text-xs font-mono text-gh-text/60 hover:bg-gh-tertiary transition-colors"
        style={{ paddingLeft }}
      >
        <span className="w-3 shrink-0 text-center text-[10px]">
          {expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
