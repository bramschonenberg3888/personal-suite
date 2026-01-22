# personal-suite

Personal productivity and financial suite: stock portfolio watchlist (Yahoo Finance), Dutch supermarket price tracking (Albert Heijn & Jumbo), weather forecasts (Open-Meteo), Excalidraw drawing canvas, and revenue tracking (Notion integration).

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # Dashboard pages (portfolio, drawings, shopper, weather, finance)
│   └── api/                  # Auth (NextAuth) & tRPC endpoints
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── layout/               # App shell, sidebar
│   ├── theme/                # Theme provider (next-themes)
│   └── [feature]/            # Feature-specific components
├── lib/
│   ├── api/                  # External API clients (yahoo-finance, notion, notion-costs, open-meteo, etc.)
│   ├── auth.ts               # NextAuth config
│   └── db.ts                 # Prisma client
├── trpc/routers/             # tRPC procedures (one router per feature)
├── hooks/                    # Custom React hooks
├── types/                    # Custom TypeScript type definitions
├── env.ts                    # Environment variable validation (t3-env)
└── generated/prisma/         # Prisma client (auto-generated)

prisma/schema.prisma          # Database schema
__tests__/                    # Unit tests (Vitest)
tests/                        # E2E tests (Playwright)
```

## Organization Rules

- tRPC routers → `src/trpc/routers/`, one per feature
- Components → `src/components/[feature]/`, one per file
- API clients → `src/lib/api/`, one per external service
- Tests → `__tests__/` (unit) or `tests/` (E2E)

## Parallel Development

Features are isolated. Safe for parallel work: portfolio, drawing, shopper, weather, finance (revenue, invoices, costs).
Coordinate changes to: `src/trpc/routers/_app.ts`, `prisma/schema.prisma`, `src/components/layout/`

## Code Quality

After editing ANY file, run:

```bash
bun run lint && bun run type-check && bun run format:check
```

Fix ALL errors/warnings before continuing. Auto-fix formatting: `bun run format`

## Commands

```bash
bun dev                   # Dev server
bun run test:run          # Unit tests
bun run test:e2e          # E2E tests
bun db:generate           # Regenerate Prisma client
bun db:push               # Push schema to database
```

## Design System (Ocean + Plus Jakarta Sans)

**Use shadcn/ui components.** Install: `npx shadcn@latest add [component-name]`

**Semantic Tailwind classes only:**

| Use                     | Not               |
| ----------------------- | ----------------- |
| `bg-primary`            | `bg-blue-500`     |
| `bg-secondary/muted`    | `bg-gray-100`     |
| `bg-card/background`    | `bg-white`        |
| `text-foreground`       | `text-gray-900`   |
| `text-muted-foreground` | `text-gray-500`   |
| `border-border/input`   | `border-gray-200` |

**Never hardcode colors** (no hex, no Tailwind palette colors, no OKLCH). Exception: Recharts requires hex colors for charts.

**Color meanings:**

- `primary` - Main actions, links (Ocean blue)
- `muted` - Disabled states, subtle backgrounds
- `destructive` - Delete, error actions

**Dark mode:** Automatic via CSS variables. Toggle with `document.documentElement.classList.toggle('dark')`.

**Spacing:** Page `p-6`/`p-8`, sections `gap-8`, components `gap-4`, inline `gap-2`.
