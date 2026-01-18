import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appRouter } from '@/trpc/routers/_app';
import { createCallerFactory, DEFAULT_USER_ID } from '@/trpc/init';
import type { PrismaClient } from '@/generated/prisma/client';

// Mock db for testing
const mockDb = {} as PrismaClient;

describe('tRPC App Router', () => {
  const createCaller = createCallerFactory(appRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('hello procedure', () => {
    it('should return default greeting when no input is provided', async () => {
      const caller = createCaller({ userId: DEFAULT_USER_ID, db: mockDb });
      const result = await caller.hello();

      expect(result).toEqual({ greeting: 'Hello World!' });
    });

    it('should return personalized greeting when name is provided', async () => {
      const caller = createCaller({ userId: DEFAULT_USER_ID, db: mockDb });
      const result = await caller.hello({ name: 'Alice' });

      expect(result).toEqual({ greeting: 'Hello Alice!' });
    });

    it('should return personalized greeting with empty string input', async () => {
      const caller = createCaller({ userId: DEFAULT_USER_ID, db: mockDb });
      const result = await caller.hello({ name: '' });

      expect(result).toEqual({ greeting: 'Hello !' });
    });

    it('should return personalized greeting with special characters', async () => {
      const caller = createCaller({ userId: DEFAULT_USER_ID, db: mockDb });
      const result = await caller.hello({ name: 'John Doe <script>' });

      expect(result).toEqual({ greeting: 'Hello John Doe <script>!' });
    });

    it('should return personalized greeting with unicode characters', async () => {
      const caller = createCaller({ userId: DEFAULT_USER_ID, db: mockDb });
      const result = await caller.hello({ name: '日本語' });

      expect(result).toEqual({ greeting: 'Hello 日本語!' });
    });
  });
});
