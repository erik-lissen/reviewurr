import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

// Smoke test: verify React renders and core dependencies work
describe('smoke', () => {
  it('renders a basic React component', () => {
    function App() {
      return createElement('h1', null, 'reviewurr')
    }
    render(createElement(App))
    expect(screen.getByText('reviewurr')).toBeInTheDocument()
  })

  it('cn utility merges classes correctly', async () => {
    const { cn } = await import('@/lib/utils')
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
  })
})
