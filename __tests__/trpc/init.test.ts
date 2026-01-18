import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock React cache to return the function as-is (no caching in tests)
vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));

// Use vi.hoisted to create mock functions before vi.mock is hoisted
const { mockUserFindUnique, mockUserCreate } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
}));

// Mock the db module with proper hoisting
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
  },
}));

// Import after mocking
import { createTRPCContext, DEFAULT_USER_ID } from '@/trpc/init';

describe('tRPC Init - createTRPCContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('DEFAULT_USER_ID', () => {
    it('should export the correct DEFAULT_USER_ID', () => {
      expect(DEFAULT_USER_ID).toBe('default-user');
    });
  });

  describe('createTRPCContext', () => {
    it('should return default userId when default user exists', async () => {
      mockUserFindUnique.mockResolvedValue({ id: DEFAULT_USER_ID, name: 'User' });

      const context = await createTRPCContext();

      expect(context.userId).toBe(DEFAULT_USER_ID);
      expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { id: DEFAULT_USER_ID } });
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('should create default user if it does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ id: DEFAULT_USER_ID, name: 'User' });

      const context = await createTRPCContext();

      expect(context.userId).toBe(DEFAULT_USER_ID);
      expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { id: DEFAULT_USER_ID } });
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: {
          id: DEFAULT_USER_ID,
          name: 'User',
          email: 'user@personal-suite.local',
        },
      });
    });

    it('should handle db error when finding user', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(createTRPCContext()).rejects.toThrow('Database connection failed');
    });

    it('should handle db error when creating user', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockRejectedValue(new Error('Failed to create user'));

      await expect(createTRPCContext()).rejects.toThrow('Failed to create user');
    });
  });
});
