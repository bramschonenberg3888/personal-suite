import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { appRouter } from '@/trpc/routers/_app';
import { createCallerFactory } from '@/trpc/init';
import type { Session } from 'next-auth';
import type { PrismaClient } from '@/generated/prisma/client';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';

const mockAuthFn = auth as unknown as Mock<() => Promise<Session | null>>;

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
      mockAuthFn.mockResolvedValue(null);

      const caller = createCaller({ session: null, userId: undefined, db: mockDb });
      const result = await caller.hello();

      expect(result).toEqual({ greeting: 'Hello World!' });
    });

    it('should return personalized greeting when name is provided', async () => {
      mockAuthFn.mockResolvedValue(null);

      const caller = createCaller({ session: null, userId: undefined, db: mockDb });
      const result = await caller.hello({ name: 'Alice' });

      expect(result).toEqual({ greeting: 'Hello Alice!' });
    });

    it('should return personalized greeting with empty string input', async () => {
      mockAuthFn.mockResolvedValue(null);

      const caller = createCaller({ session: null, userId: undefined, db: mockDb });
      const result = await caller.hello({ name: '' });

      expect(result).toEqual({ greeting: 'Hello !' });
    });

    it('should return personalized greeting with special characters', async () => {
      mockAuthFn.mockResolvedValue(null);

      const caller = createCaller({ session: null, userId: undefined, db: mockDb });
      const result = await caller.hello({ name: 'John Doe <script>' });

      expect(result).toEqual({ greeting: 'Hello John Doe <script>!' });
    });

    it('should return personalized greeting with unicode characters', async () => {
      mockAuthFn.mockResolvedValue(null);

      const caller = createCaller({ session: null, userId: undefined, db: mockDb });
      const result = await caller.hello({ name: '日本語' });

      expect(result).toEqual({ greeting: 'Hello 日本語!' });
    });
  });

  describe('getSession procedure', () => {
    it('should return null session when user is not authenticated', async () => {
      mockAuthFn.mockResolvedValue(null);

      const caller = createCaller({ session: null, userId: undefined, db: mockDb });
      const result = await caller.getSession();

      expect(result).toBeNull();
    });

    it('should return session data when user is authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          image: 'https://example.com/avatar.jpg',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuthFn.mockResolvedValue(mockSession);

      const caller = createCaller({ session: mockSession, userId: 'user-123', db: mockDb });
      const result = await caller.getSession();

      expect(result).toEqual(mockSession);
      expect(result?.user?.id).toBe('user-123');
      expect(result?.user?.email).toBe('test@example.com');
    });

    it('should return session with minimal user data', async () => {
      const mockSession = {
        user: {
          id: 'user-456',
          email: 'minimal@example.com',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuthFn.mockResolvedValue(mockSession);

      const caller = createCaller({ session: mockSession, userId: 'user-456', db: mockDb });
      const result = await caller.getSession();

      expect(result).toEqual(mockSession);
      expect(result?.user?.id).toBe('user-456');
      expect(result?.user?.name).toBeUndefined();
      expect(result?.user?.image).toBeUndefined();
    });

    it('should return session with expired timestamp (client should handle)', async () => {
      const mockSession = {
        user: {
          id: 'user-789',
          email: 'expired@example.com',
        },
        expires: new Date(Date.now() - 86400000).toISOString(), // Expired yesterday
      };

      mockAuthFn.mockResolvedValue(mockSession);

      const caller = createCaller({ session: mockSession, userId: 'user-789', db: mockDb });
      const result = await caller.getSession();

      // tRPC returns the session as-is; expiration handling is done elsewhere
      expect(result).toEqual(mockSession);
    });

    it('should handle session with undefined userId in context', async () => {
      const mockSession = {
        user: {
          id: 'user-abc',
          email: 'test@example.com',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuthFn.mockResolvedValue(mockSession);

      // Context may have session but userId could be undefined if not extracted
      const caller = createCaller({ session: mockSession, userId: undefined, db: mockDb });
      const result = await caller.getSession();

      expect(result).toEqual(mockSession);
    });
  });
});
