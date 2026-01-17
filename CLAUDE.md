# personal-suite

Personal productivity and financial suite: stock portfolio watchlist (Yahoo Finance), Dutch supermarket price tracking (Albert Heijn & Jumbo), weather forecasts (Open-Meteo), and Excalidraw drawing canvas.

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # Protected dashboard pages
│   │   ├── portfolio/        # Stock portfolio tracker
│   │   ├── drawings/         # Excalidraw drawings
│   │   ├── shopper/          # Supermarket price tracker
│   │   └── weather/          # Weather forecasts
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth routes
│       └── trpc/[trpc]/      # tRPC endpoint
├── components/
│   ├── ui/                   # Reusable UI (shadcn/ui)
│   ├── layout/               # App shell, sidebar
│   ├── portfolio/            # Stock cards, watchlist
│   ├── drawing/              # Excalidraw wrapper, canvas
│   ├── shopper/              # Product search, tracking
│   └── weather/              # Weather display components
├── lib/
│   ├── api/                  # External API clients
│   │   ├── yahoo-finance.ts  # Stock quotes & news
│   │   ├── albert-heijn.ts   # AH product search
│   │   ├── jumbo.ts          # Jumbo product search
│   │   └── open-meteo.ts     # Weather data
│   ├── auth.ts               # NextAuth configuration
│   └── db.ts                 # Prisma client singleton
├── trpc/routers/             # tRPC API procedures
│   ├── portfolio.ts          # Watchlist & quotes
│   ├── drawing.ts            # Drawing CRUD & library
│   ├── shopper.ts            # Product tracking
│   └── weather.ts            # Location & forecasts
├── hooks/                    # Custom React hooks
└── generated/prisma/         # Prisma generated client

prisma/schema.prisma          # Database schema
__tests__/                    # Unit tests (Vitest)
tests/                        # E2E tests (Playwright)
```

## Organization Rules

**Keep code organized and modularized:**

- API procedures → `src/trpc/routers/`, one router per domain
- Components → `src/components/`, one component per file
- Utilities → `src/lib/`, grouped by functionality
- Types → `src/types/` or co-located with usage
- Unit tests → `__tests__/`, mirroring src/ structure
- E2E tests → `tests/`, one spec per feature

**Modularity principles:**

- Single responsibility per file
- Clear, descriptive file names
- Group related functionality together
- Avoid monolithic files

## Parallel Development

Features are isolated for parallel Claude Code sessions. Each feature has its own page, components, API client, and tRPC router.

**Safe for parallel work:** All feature-specific files (portfolio, drawing, shopper, weather)

**Coordinate changes to:** `src/trpc/routers/_app.ts`, `prisma/schema.prisma`, `src/components/layout/`

## Code Quality - Zero Tolerance

After editing ANY file, run:

```bash
bun run lint && bun run type-check
```

Fix ALL errors/warnings before continuing.

## Testing

After code changes, run tests:

```bash
bun run test:run          # Unit tests
bun run test:e2e          # E2E tests (requires dev server)
```

## Database

After schema changes:

```bash
bun db:generate           # Regenerate Prisma client
bun db:push               # Push to database
```

## Dev Server

```bash
bun dev                   # Start development server
```

If changes require server restart (env vars, next.config.ts):

1. Restart server
2. Check terminal for errors
3. Fix ALL warnings before continuing
