import { parseHunks } from '@/lib/diff-types'

self.onmessage = (e: MessageEvent<{ id: string; diffContent: string }>) => {
  const { id, diffContent } = e.data
  const hunks = parseHunks(diffContent)
  self.postMessage({ id, hunks })
}
