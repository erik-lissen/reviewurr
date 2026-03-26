export interface RefLink {
  type: 'jira' | 'url' | 'doc'
  value: string
  display: string
}

/** Scan text for references: Jira/Linear keys, URLs, doc paths */
export function detectRefs(text: string): RefLink[] {
  const refs: RefLink[] = []
  const seen = new Set<string>()

  // URLs
  const urlRe = /https?:\/\/[^\s)]+/g
  for (const m of text.matchAll(urlRe)) {
    if (!seen.has(m[0])) {
      seen.add(m[0])
      refs.push({ type: 'url', value: m[0], display: m[0] })
    }
  }

  // Jira / Linear keys: PROJ-123
  const keyRe = /[A-Z][A-Z0-9]+-\d+/g
  for (const m of text.matchAll(keyRe)) {
    // Skip if it's part of a URL we already captured
    if (seen.has(m[0])) continue
    const idx = m.index!
    const preceding = text.slice(Math.max(0, idx - 10), idx)
    if (/https?:\/\//.test(preceding)) continue
    seen.add(m[0])
    refs.push({ type: 'jira', value: m[0], display: m[0] })
  }

  // Doc paths
  const docRe = /(?:docs\/[\w/.-]+\.md|[\w/.-]+\.(?:prd|adr)\.md)/g
  for (const m of text.matchAll(docRe)) {
    if (!seen.has(m[0])) {
      seen.add(m[0])
      refs.push({ type: 'doc', value: m[0], display: m[0] })
    }
  }

  return refs
}
