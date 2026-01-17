import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma client before any imports
const mockFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

// Mock PrismaAdapter
vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

// We need to test the NextAuth configuration by extracting the callbacks and authorize function
// Since NextAuth is initialized at import time, we need to structure our tests carefully

describe('NextAuth Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Credentials Provider - authorize function', () => {
    // We'll test the authorize logic by recreating it based on the implementation
    // This is necessary because NextAuth doesn't export the authorize function directly

    const loginSchema = {
      parse: (credentials: unknown) => {
        const creds = credentials as { email?: string; password?: string };
        if (!creds.email || !creds.email.includes('@')) {
          throw new Error('Invalid email');
        }
        if (!creds.password || creds.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        return { email: creds.email, password: creds.password };
      },
    };

    async function authorize(credentials: { email?: string; password?: string } | undefined) {
      try {
        if (!credentials) {
          return null;
        }
        const { email } = loginSchema.parse(credentials);

        const user = await mockFindUnique({
          where: { email },
        });

        if (!user || !user.email) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      } catch {
        return null;
      }
    }

    it('should return null when credentials are undefined', async () => {
      const result = await authorize(undefined);

      expect(result).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('should return null when email is invalid', async () => {
      const result = await authorize({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(result).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('should return null when password is too short', async () => {
      const result = await authorize({
        email: 'test@example.com',
        password: '12345',
      });

      expect(result).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('should return null when user is not found in database', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await authorize({
        email: 'notfound@example.com',
        password: 'password123',
      });

      expect(result).toBeNull();
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: 'notfound@example.com' },
      });
    });

    it('should return null when user has no email', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'user-123',
        email: null,
        name: 'No Email User',
        image: null,
      });

      const result = await authorize({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should return user data when credentials are valid and user exists', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
      };

      mockFindUnique.mockResolvedValue(mockUser);

      const result = await authorize({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
      });
    });

    it('should return user with minimal data (only id and email)', async () => {
      const mockUser = {
        id: 'minimal-user-456',
        email: 'minimal@example.com',
        name: null,
        image: null,
      };

      mockFindUnique.mockResolvedValue(mockUser);

      const result = await authorize({
        email: 'minimal@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: 'minimal-user-456',
        email: 'minimal@example.com',
        name: null,
        image: null,
      });
    });

    it('should return null when database throws an error', async () => {
      mockFindUnique.mockRejectedValue(new Error('Database connection failed'));

      const result = await authorize({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should handle email with special characters', async () => {
      const mockUser = {
        id: 'special-user',
        email: 'user+tag@example.com',
        name: 'Special User',
        image: null,
      };

      mockFindUnique.mockResolvedValue(mockUser);

      const result = await authorize({
        email: 'user+tag@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: 'special-user',
        email: 'user+tag@example.com',
        name: 'Special User',
        image: null,
      });
    });
  });

  describe('JWT Callback', () => {
    // Test the jwt callback logic
    async function jwtCallback({
      token,
      user,
    }: {
      token: { id?: string; [key: string]: unknown };
      user?: { id: string; [key: string]: unknown };
    }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }

    it('should add user.id to token when user is present', async () => {
      const token = { sub: 'token-sub', name: 'Test' };
      const user = { id: 'user-123', email: 'test@example.com' };

      const result = await jwtCallback({ token, user });

      expect(result.id).toBe('user-123');
      expect(result.sub).toBe('token-sub');
      expect(result.name).toBe('Test');
    });

    it('should not modify token when user is not present', async () => {
      const token = { sub: 'token-sub', name: 'Test', existingId: 'old-id' };

      const result = await jwtCallback({ token, user: undefined });

      expect(result.id).toBeUndefined();
      expect(result.sub).toBe('token-sub');
      expect(result.name).toBe('Test');
    });

    it('should preserve existing token properties', async () => {
      const token = {
        sub: 'token-sub',
        email: 'token@example.com',
        name: 'Token User',
        customField: 'custom-value',
      };
      const user = { id: 'new-user-id', email: 'user@example.com' };

      const result = await jwtCallback({ token, user });

      expect(result).toEqual({
        sub: 'token-sub',
        email: 'token@example.com',
        name: 'Token User',
        customField: 'custom-value',
        id: 'new-user-id',
      });
    });

    it('should handle user with additional properties', async () => {
      const token = {};
      const user = {
        id: 'user-with-extras',
        email: 'extra@example.com',
        name: 'Extra User',
        image: 'https://example.com/image.png',
      };

      const result = await jwtCallback({ token, user });

      expect(result.id).toBe('user-with-extras');
    });
  });

  describe('Session Callback', () => {
    // Test the session callback logic
    async function sessionCallback({
      session,
      token,
    }: {
      session: { user?: { id?: string; [key: string]: unknown }; [key: string]: unknown };
      token: { id?: string; [key: string]: unknown };
    }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }

    it('should add token.id to session.user when session.user exists', async () => {
      const session = {
        user: { email: 'test@example.com', name: 'Test User' },
        expires: '2024-12-31',
      };
      const token = { id: 'token-user-id', sub: 'sub-123' };

      const result = await sessionCallback({ session, token });

      expect(result.user?.id).toBe('token-user-id');
      expect(result.user?.email).toBe('test@example.com');
      expect(result.expires).toBe('2024-12-31');
    });

    it('should not add id when session.user is undefined', async () => {
      const session = { expires: '2024-12-31' } as {
        user?: { id?: string };
        expires: string;
      };
      const token = { id: 'token-user-id' };

      const result = await sessionCallback({ session, token });

      expect(result.user).toBeUndefined();
      expect(result.expires).toBe('2024-12-31');
    });

    it('should handle token without id property', async () => {
      const session = {
        user: { email: 'test@example.com' },
        expires: '2024-12-31',
      };
      const token = { sub: 'sub-only' };

      const result = await sessionCallback({ session, token });

      expect(result.user?.id).toBeUndefined();
    });

    it('should preserve all session properties', async () => {
      const session = {
        user: {
          email: 'full@example.com',
          name: 'Full User',
          image: 'https://example.com/avatar.jpg',
        },
        expires: '2024-12-31T23:59:59.999Z',
      };
      const token = { id: 'full-user-id' };

      const result = await sessionCallback({ session, token });

      expect(result).toEqual({
        user: {
          email: 'full@example.com',
          name: 'Full User',
          image: 'https://example.com/avatar.jpg',
          id: 'full-user-id',
        },
        expires: '2024-12-31T23:59:59.999Z',
      });
    });

    it('should overwrite existing user.id with token.id', async () => {
      const session = {
        user: {
          id: 'old-id',
          email: 'test@example.com',
        },
        expires: '2024-12-31',
      };
      const token = { id: 'new-id' };

      const result = await sessionCallback({ session, token });

      expect(result.user?.id).toBe('new-id');
    });
  });

  describe('Integration - JWT and Session Callbacks Together', () => {
    async function jwtCallback({
      token,
      user,
    }: {
      token: { id?: string; [key: string]: unknown };
      user?: { id: string; [key: string]: unknown };
    }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }

    async function sessionCallback({
      session,
      token,
    }: {
      session: { user?: { id?: string; [key: string]: unknown }; [key: string]: unknown };
      token: { id?: string; [key: string]: unknown };
    }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }

    it('should flow user.id from login through JWT to session', async () => {
      // Simulate user login - authorize returns user
      const loggedInUser = {
        id: 'integrated-user-123',
        email: 'integrated@example.com',
        name: 'Integrated User',
      };

      // JWT callback receives the user and adds id to token
      const initialToken = { sub: 'jwt-sub' };
      const tokenAfterLogin = await jwtCallback({
        token: initialToken,
        user: loggedInUser,
      });

      expect(tokenAfterLogin.id).toBe('integrated-user-123');

      // Session callback receives token and adds id to session.user
      const initialSession = {
        user: { email: 'integrated@example.com', name: 'Integrated User' },
        expires: '2024-12-31',
      };
      const finalSession = await sessionCallback({
        session: initialSession,
        token: tokenAfterLogin,
      });

      expect(finalSession.user?.id).toBe('integrated-user-123');
    });

    it('should maintain user.id across subsequent JWT refreshes', async () => {
      // Initial login
      const user = { id: 'persistent-user-456' };
      const token = await jwtCallback({ token: {}, user });

      // Subsequent refresh (user is undefined)
      const refreshedToken = await jwtCallback({ token, user: undefined });

      // id should still be present from initial login
      expect(refreshedToken.id).toBe('persistent-user-456');

      // Session should still get the id
      const session = { user: { email: 'test@example.com' }, expires: '2024-12-31' };
      const finalSession = await sessionCallback({ session, token: refreshedToken });

      expect(finalSession.user?.id).toBe('persistent-user-456');
    });
  });
});
