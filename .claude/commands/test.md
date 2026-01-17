---
name: test
description: Run tests and spawn parallel agents to fix any failures
---

# Run Tests

This command runs all tests for the project and spawns parallel agents to fix any failures.

## Step 1: Run Unit Tests

```bash
bun run test:run
```

Capture all output. If there are failures, note:

- Which test files failed
- Which specific tests failed
- The error messages

## Step 2: Run E2E Tests (if unit tests pass)

```bash
bun run test:e2e
```

Capture all output. Note any failures with their error messages.

## Step 3: Analyze Failures

If there are failures, group them by type:

- **Unit test failures**: Tests in `__tests__/` directory
- **E2E test failures**: Tests in `tests/` directory

## Step 4: Spawn Parallel Agents to Fix Failures

For each category of failures, spawn an agent in parallel using the Task tool:

**IMPORTANT**: Use a SINGLE response with MULTIPLE Task tool calls to run agents in parallel.

**Agent for Unit Test Failures**:

- Receive the list of failing tests and error messages
- Read the test files and source code
- Fix the issues (either in tests or source code)
- Re-run the specific tests to verify

**Agent for E2E Test Failures**:

- Receive the list of failing tests and error messages
- Read the test files and relevant page/component code
- Fix the issues
- Re-run the specific tests to verify

## Step 5: Verify All Tests Pass

After agents complete, run the full test suite again:

```bash
bun run test:run && bun run test:e2e
```

All tests must pass before completing.

## Available Test Commands

```bash
# Unit tests
bun run test           # Watch mode
bun run test:run       # Single run
bun run test:ui        # Vitest UI
bun run test:coverage  # With coverage report

# E2E tests
bun run test:e2e       # Headless
bun run test:e2e:ui    # Playwright UI

# Run specific tests
bun run test:run __tests__/lib/utils.test.ts
bun run test:e2e tests/homepage.spec.ts
```

## Test Structure

```
__tests__/                    # Unit & integration tests (Vitest)
├── setup.ts                  # Test setup with mocks
├── lib/
│   ├── auth.test.ts          # NextAuth configuration tests
│   └── utils.test.ts         # Utility function tests
├── trpc/
│   ├── client.test.ts        # tRPC client tests
│   ├── init.test.ts          # tRPC context tests
│   ├── query-client.test.ts  # React Query config tests
│   └── routers/
│       └── app.test.ts       # tRPC procedure tests
├── env.test.ts               # Environment validation tests
└── example.test.ts           # Example tests

tests/                        # E2E tests (Playwright)
├── homepage.spec.ts          # Homepage UI tests
├── auth.spec.ts              # Authentication flow tests
└── api.spec.ts               # tRPC API endpoint tests
```
