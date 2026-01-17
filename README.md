# Next.js Full-Stack Boilerplate

A production-ready Next.js boilerplate with authentication, database, tRPC API layer, UI components, testing, and deployment configuration.

## 🚀 Features

### Core Stack

- **Next.js 16.1.3** - React framework with App Router
- **React 19.2.3** - Latest React with Server Components
- **TypeScript 5.9.3** - Strict type safety
- **Tailwind CSS 4.1.18** - Utility-first CSS framework

### Authentication

- **NextAuth.js v5** (Auth.js) - Complete authentication solution
- **Prisma Adapter** - Database-backed sessions
- Credentials provider (ready for OAuth)
- Session management with JWT

### Database & ORM

- **Prisma 7.2.0** - Next-generation ORM
- **PostgreSQL** adapter with connection pooling
- Type-safe database client
- Migration system

### API Layer

- **tRPC 11.8.1** - End-to-end type safety
- **React Query 5.90.18** - Data fetching and caching
- Server Components integration
- API route handlers

### UI Components

- **shadcn/ui 3.7.0** - High-quality, accessible components
- **Tailwind CSS** - Modern design system
- **Lucide Icons** - Beautiful icon library
- Dark mode support

### Environment & Validation

- **@t3-oss/env-nextjs** - Type-safe environment variables
- **Zod 4.3.5** - Schema validation
- Build-time env validation

### Code Quality

- **ESLint 9.39.2** - Flat config format
- **Prettier 3.8.0** - Code formatting
- **Husky 9.1.7** - Git hooks
- Pre-commit linting

### Testing

- **Vitest 4.0.17** - Unit testing
- **Playwright 1.57.0** - E2E testing
- **React Testing Library** - Component testing
- Example test files included

### Deployment

- **Vercel-ready** - Zero-config deployment
- Environment variable management
- Optimized builds

## 📦 Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env.local

# 2. Configure DATABASE_URL and NEXTAUTH_SECRET in .env.local
#    Generate secret: openssl rand -base64 32

# 3. Generate Prisma client
bun db:generate

# 4. Push database schema (optional - skip if no database yet)
bun db:push

# 5. Start development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## 📜 Available Scripts

```bash
# Development
bun dev                 # Start development server
bun build              # Build for production
bun start              # Start production server

# Code Quality
bun lint               # Run ESLint
bun lint:fix           # Fix ESLint errors
bun type-check         # Run TypeScript checks
bun format             # Format code with Prettier

# Testing
bun test               # Run unit tests
bun test:e2e           # Run E2E tests

# Database
bun db:generate        # Generate Prisma client
bun db:push            # Push schema to database
bun db:migrate         # Run migrations
bun db:studio          # Open Prisma Studio
```

## 🗂️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── auth/          # NextAuth routes
│   │   └── trpc/          # tRPC routes
│   └── ...
├── components/ui/          # shadcn components
├── lib/
│   ├── auth.ts            # NextAuth config
│   └── db.ts              # Prisma client
├── trpc/                  # tRPC setup
│   ├── routers/           # API routers
│   ├── client.tsx         # Client provider
│   └── server.tsx         # Server caller
├── types/                 # TypeScript types
└── env.ts                 # Environment validation

prisma/
├── schema.prisma          # Database schema
└── migrations/            # Migration files
```

## 🔐 Environment Variables

Required in `.env.local`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

## 🔌 Adding tRPC Procedures

Edit `src/trpc/routers/_app.ts`:

```typescript
export const appRouter = createTRPCRouter({
  hello: baseProcedure.input(z.object({ name: z.string() })).query(({ input }) => ({
    greeting: `Hello ${input.name}!`,
  })),
});
```

Use in components:

```typescript
"use client";
import { trpc } from "@/trpc/client";

export function MyComponent() {
  const { data } = trpc.hello.useQuery({ name: "World" });
  return <div>{data?.greeting}</div>;
}
```

## 🎨 Adding UI Components

```bash
bunx shadcn@latest add button
bunx shadcn@latest add card
```

Use in your app:

```typescript
import { Button } from "@/components/ui/button";

export function MyComponent() {
  return <Button>Click me</Button>;
}
```

## 🚀 Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

The project is pre-configured with:

- Automatic builds
- Environment validation
- Prisma generation

## 📚 Documentation

- [Next.js](https://nextjs.org/docs)
- [Auth.js](https://authjs.dev)
- [Prisma](https://www.prisma.io/docs)
- [tRPC](https://trpc.io)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

## ⚠️ Important Notes

- Configure PostgreSQL before running database commands
- Generate NextAuth secret: `openssl rand -base64 32`
- Run `bun db:generate` after schema changes
- Environment validation runs at build time

## 📝 License

MIT
