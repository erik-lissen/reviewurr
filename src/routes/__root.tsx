import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '@/styles/app.css?url'
import { ThemeSelector } from '@/components/theme-selector'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'reviewurr' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <div className="min-h-screen bg-gh-bg text-gh-text">
        <header className="border-b border-gh-secondary px-6 py-3 flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-gh-accent hover:opacity-80">
            reviewurr
          </Link>
          <nav className="flex gap-4 text-sm text-gh-text/70 flex-1">
            <Link to="/" className="hover:text-gh-text" activeProps={{ className: 'text-gh-text' }}>
              Home
            </Link>
          </nav>
          <ThemeSelector />
        </header>
        <main className="px-6 py-4">
          <Outlet />
        </main>
      </div>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
