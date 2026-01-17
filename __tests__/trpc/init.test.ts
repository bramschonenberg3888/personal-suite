import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Session } from 'next-auth';

// Mock React cache to return the function as-is (no caching in tests)
vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));

// Mock the auth module before importing createTRPCContext
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock the db module
const mockDb = { _isMockDb: true };
vi.mock('@/lib/db', () => ({
  db: { _isMockDb: true },
}));

// Import after mocking
import { auth } from '@/lib/auth';
import { createTRPCContext } from '@/trpc/init';

const mockAuthFn = auth as unknown as Mock<() => Promise<Session | null>>;

describe('tRPC Init - createTRPCContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createTRPCContext', () => {
    it('should return null session and undefined userId when not authenticated', async () => {
      mockAuthFn.mockResolvedValue(null);

      const context = await createTRPCContext();

      expect(context.session).toBeNull();
      expect(context.userId).toBeUndefined();
      expect(context.db).toEqual(mockDb);
      expect(mockAuthFn).toHaveBeenCalledTimes(1);
    });

    it('should return session and userId when user is authenticated', async () => {
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

      const context = await createTRPCContext();

      expect(context.session).toEqual(mockSession);
      expect(context.userId).toBe('user-123');
      expect(context.db).toEqual(mockDb);
      expect(mockAuthFn).toHaveBeenCalledTimes(1);
    });

    it('should extract userId correctly from nested session.user.id', async () => {
      const mockSession = {
        user: {
          id: 'unique-user-id-456',
          email: 'user@example.com',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuthFn.mockResolvedValue(mockSession);

      const context = await createTRPCContext();

      expect(context.userId).toBe('unique-user-id-456');
      expect(context.session?.user?.id).toBe('unique-user-id-456');
    });

    it('should handle session with missing user object', async () => {
      const mockSession = {
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as unknown as Session;

      mockAuthFn.mockResolvedValue(mockSession);

      const context = await createTRPCContext();

      expect(context.session).toEqual(mockSession);
      expect(context.userId).toBeUndefined();
    });

    it('should handle session with user object but missing id', async () => {
      const mockSession = {
        user: {
          email: 'noId@example.com',
          name: 'No ID User',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as unknown as Session;

      mockAuthFn.mockResolvedValue(mockSession);

      const context = await createTRPCContext();

      expect(context.session).toEqual(mockSession);
      expect(context.userId).toBeUndefined();
    });

    it('should handle auth() throwing an error', async () => {
      mockAuthFn.mockRejectedValue(new Error('Auth service unavailable'));

      await expect(createTRPCContext()).rejects.toThrow('Auth service unavailable');
      expect(mockAuthFn).toHaveBeenCalledTimes(1);
    });

    it('should return full session object with all user properties', async () => {
      const mockSession = {
        user: {
          id: 'complete-user-789',
          name: 'Complete User',
          email: 'complete@example.com',
          image: 'https://example.com/complete-avatar.png',
        },
        expires: '2024-12-31T23:59:59.999Z',
      };

      mockAuthFn.mockResolvedValue(mockSession);

      const context = await createTRPCContext();

      expect(context.session).toEqual(mockSession);
      expect(context.session?.user).toEqual({
        id: 'complete-user-789',
        name: 'Complete User',
        email: 'complete@example.com',
        image: 'https://example.com/complete-avatar.png',
      });
      expect(context.userId).toBe('complete-user-789');
    });

    it('should handle session with empty string userId', async () => {
      const mockSession = {
        user: {
          id: '',
          email: 'empty-id@example.com',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuthFn.mockResolvedValue(mockSession);

      const context = await createTRPCContext();

      // Empty string is falsy, but it's still returned as the userId
      expect(context.userId).toBe('');
      expect(context.session?.user?.id).toBe('');
    });

    it('should call auth() only once per context creation', async () => {
      const mockSession = {
        user: { id: 'test-user', email: 'test@example.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuthFn.mockResolvedValue(mockSession);

      await createTRPCContext();

      expect(mockAuthFn).toHaveBeenCalledTimes(1);
      expect(mockAuthFn).toHaveBeenCalledWith();
    });
  });
});
