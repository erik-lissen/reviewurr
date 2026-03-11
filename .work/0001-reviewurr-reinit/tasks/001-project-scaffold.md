# Task 001: Project Scaffold

## Status: complete
TASK_STATUS: complete
## Type: AFK
## Depends on: nothing

## Objective
Remove all existing code and set up TanStack Start + Bun + Tailwind CSS v4 + shadcn/ui from scratch with dark theme, file-based routing, bun:sqlite, and Vitest.

## Details
- Delete existing `src/`, `ui/`, `bin/`, root `package.json`, `pnpm-lock.yaml`
- Initialize TanStack Start project with Bun runtime
- File-based routing: `__root.tsx` (root layout), `index.tsx` (landing), `pr.$id.tsx` (PR detail placeholder)
- Tailwind CSS v4: CSS-based config (`@import "tailwindcss"` in CSS file, NOT `tailwind.config.ts`)
- shadcn/ui: init and configure with dark theme
- Dark theme: GitHub Dark palette (bg `#0d1117`, secondary `#161b22`, text `#c9d1d9`, accent `#58a6ff`)
- bun:sqlite: create `server/db.ts` with empty schema (tables created in task 002)
- Vitest: configure for unit tests, one smoke test that renders the app
- Dev script: `bun run dev` starts the app
- Root layout: dark shell with app title, minimal nav

## Files
- `package.json` (new)
- `app.config.ts` (TanStack Start config)
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/routes/pr.$id.tsx`
- `src/styles/app.css` (Tailwind v4 imports + dark theme tokens)
- `src/server/db.ts`
- `src/lib/utils.ts` (shadcn cn utility)
- `components.json` (shadcn config)
- `tsconfig.json`
- `vitest.config.ts`
- `tests/smoke.test.tsx`
- `.gitignore`

## Tests
- Smoke test: app renders root layout without errors

## Acceptance
- `bun run dev` starts the app and serves at localhost
- Dark-themed shell renders with placeholder routes
- Tailwind classes work (verified visually in the shell)
- `bun run test` passes smoke test

## Notes
Completed 2026-03-10. Scaffolded TanStack Start + Bun + Tailwind v4 + shadcn/ui. Uses vite.config.ts (not app.config.ts) per latest TanStack Start docs.
FILES_CHANGED: package.json, bun.lock, vite.config.ts, tsconfig.json, vitest.config.ts, components.json, .gitignore, src/router.tsx, src/routeTree.gen.ts, src/routes/__root.tsx, src/routes/index.tsx, src/routes/pr.$id.tsx, src/styles/app.css, src/lib/utils.ts, src/server/db.ts, tests/setup.ts, tests/smoke.test.tsx
