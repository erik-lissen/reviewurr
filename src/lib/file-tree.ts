import type { DiffFile } from './diff-types'

/** A node in the file tree */
export interface FileTreeNode {
  /** Display name (may be compressed path like "src/lib") */
  name: string
  /** Full path from root */
  path: string
  /** Child nodes (present for directories) */
  children?: FileTreeNode[]
  /** Associated diff file (present for leaf files) */
  file?: DiffFile
}

/** Build a file tree from a flat list of DiffFiles */
export function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', children: [] }

  for (const file of files) {
    const segments = file.filename.split('/')
    let current = root

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const isFile = i === segments.length - 1
      const currentPath = segments.slice(0, i + 1).join('/')

      if (!current.children) current.children = []

      let existing = current.children.find((c) => c.name === segment && (isFile ? !!c.file : !!c.children))
      if (!existing) {
        existing = {
          name: segment,
          path: currentPath,
          ...(isFile ? { file } : { children: [] }),
        }
        current.children.push(existing)
      }
      current = existing
    }
  }

  // Sort and compress
  sortTree(root.children!)
  compressTree(root.children!)

  return root.children!
}

/** Sort: directories first, then files, both alphabetical */
function sortTree(nodes: FileTreeNode[]) {
  nodes.sort((a, b) => {
    const aIsDir = !!a.children
    const bIsDir = !!b.children
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const node of nodes) {
    if (node.children) sortTree(node.children)
  }
}

/** Compress single-child directory chains */
function compressTree(nodes: FileTreeNode[]) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.children) {
      // Compress: if this dir has exactly one child that's also a dir, merge them
      while (
        node.children.length === 1 &&
        node.children[0].children
      ) {
        const child = node.children[0]
        node.name = `${node.name}/${child.name}`
        node.path = child.path
        node.children = child.children
      }
      // Recurse into children after compression
      compressTree(node.children)
    }
  }
}
