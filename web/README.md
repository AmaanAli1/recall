# web

The Recall frontend: Next.js App Router + TypeScript + Tailwind CSS 4.

- Design system "Paper · Red": tokens in `src/app/globals.css` (`@theme`).
- Fonts are self-hosted via `next/font/local` (Schibsted Grotesk, Fragment Mono).
- `src/lib/api` is the typed client for the backend. With
  `NEXT_PUBLIC_USE_MOCK_API=true` it serves mock data, so every screen works
  before its endpoint exists.
- Unit tests: `src/**/*.test.ts(x)` (Vitest). E2E: `e2e/` (Playwright).

See the root README for commands.
