import { createHighlighter, type Highlighter } from 'shiki/bundle/web'

let highlighter: Highlighter | null = null
let initPromise: Promise<Highlighter> | null = null
const loadedLangs = new Set<string>()

async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter
  if (initPromise) return initPromise
  initPromise = createHighlighter({
    themes: ['github-dark'],
    langs: [],
  })
  highlighter = await initPromise
  return highlighter
}

self.onmessage = async (
  e: MessageEvent<{ id: string; code: string; lang: string }>
) => {
  const { id, code, lang } = e.data
  try {
    const hl = await getHighlighter()

    // Load language on demand
    if (lang !== 'text' && !loadedLangs.has(lang)) {
      try {
        await hl.loadLanguage(lang as Parameters<typeof hl.loadLanguage>[0])
        loadedLangs.add(lang)
      } catch {
        // Language not supported, fall back to text
      }
    }

    const actualLang = loadedLangs.has(lang) ? lang : 'text'

    if (actualLang === 'text') {
      // No highlighting, return plain tokens
      self.postMessage({
        id,
        tokens: code.split('\n').map((line) => [{ content: line, color: undefined }]),
      })
      return
    }

    const result = hl.codeToTokens(code, {
      lang: actualLang,
      theme: 'github-dark',
    })

    // Send tokens (array of arrays of {content, color})
    const tokens = result.tokens.map((line) =>
      line.map((token) => ({ content: token.content, color: token.color }))
    )
    self.postMessage({ id, tokens })
  } catch {
    // On error, return unhighlighted
    self.postMessage({
      id,
      tokens: code.split('\n').map((line) => [{ content: line, color: undefined }]),
    })
  }
}
