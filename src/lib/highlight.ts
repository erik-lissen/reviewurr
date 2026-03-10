export interface HighlightToken {
  content: string
  color?: string
}

type PendingRequest = {
  resolve: (tokens: HighlightToken[][]) => void
  reject: (err: Error) => void
}

let worker: Worker | null = null
let requestId = 0
const pending = new Map<string, PendingRequest>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(
    new URL('../workers/highlighter.worker.ts', import.meta.url),
    { type: 'module' }
  )
  worker.onmessage = (e: MessageEvent<{ id: string; tokens: HighlightToken[][] }>) => {
    const req = pending.get(e.data.id)
    if (req) {
      pending.delete(e.data.id)
      req.resolve(e.data.tokens)
    }
  }
  worker.onerror = (err) => {
    // Reject all pending on fatal error
    for (const [id, req] of pending) {
      req.reject(new Error(String(err)))
      pending.delete(id)
    }
  }
  return worker
}

/** Highlight code using the Shiki web worker. Returns tokens per line. */
export function highlight(code: string, lang: string): Promise<HighlightToken[][]> {
  return new Promise((resolve, reject) => {
    const id = String(++requestId)
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, code, lang })
  })
}
