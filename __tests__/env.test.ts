import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Since the env.ts file executes validation at import time and uses process.env,
 * we test the Zod schemas directly to validate the schema logic without
 * triggering side effects from the actual env module.
 */
describe('Environment Variable Validation Schemas', () => {
  describe('DATABASE_URL schema', () => {
    const schema = z.string().url();

    it('should accept valid PostgreSQL URL', () => {
      const url = 'postgresql://user:password@localhost:5432/database';
      expect(schema.parse(url)).toBe(url);
    });

    it('should accept valid MySQL URL', () => {
      const url = 'mysql://user:password@localhost:3306/database';
      expect(schema.parse(url)).toBe(url);
    });

    it('should accept valid SQLite URL', () => {
      const url = 'file:./dev.db';
      expect(schema.parse(url)).toBe(url);
    });

    it('should accept URL with query parameters', () => {
      const url = 'postgresql://user:password@localhost:5432/db?schema=public&sslmode=require';
      expect(schema.parse(url)).toBe(url);
    });

    it('should reject invalid URL format', () => {
      expect(() => schema.parse('not-a-url')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => schema.parse('')).toThrow();
    });

    it('should reject non-string values', () => {
      expect(() => schema.parse(123)).toThrow();
      expect(() => schema.parse(null)).toThrow();
      expect(() => schema.parse(undefined)).toThrow();
    });
  });

  describe('NODE_ENV schema', () => {
    const schema = z.enum(['development', 'test', 'production']).default('development');

    it("should accept 'development'", () => {
      expect(schema.parse('development')).toBe('development');
    });

    it("should accept 'test'", () => {
      expect(schema.parse('test')).toBe('test');
    });

    it("should accept 'production'", () => {
      expect(schema.parse('production')).toBe('production');
    });

    it("should default to 'development' when undefined", () => {
      expect(schema.parse(undefined)).toBe('development');
    });

    it('should reject invalid environment values', () => {
      expect(() => schema.parse('staging')).toThrow();
      expect(() => schema.parse('dev')).toThrow();
      expect(() => schema.parse('prod')).toThrow();
      expect(() => schema.parse('')).toThrow();
    });

    it('should be case-sensitive', () => {
      expect(() => schema.parse('Development')).toThrow();
      expect(() => schema.parse('PRODUCTION')).toThrow();
      expect(() => schema.parse('TEST')).toThrow();
    });
  });

  describe('NEXTAUTH_SECRET schema', () => {
    const schema = z.string().min(1);

    it('should accept any non-empty string', () => {
      expect(schema.parse('a')).toBe('a');
      expect(schema.parse('my-secret-key')).toBe('my-secret-key');
    });

    it('should accept long secrets', () => {
      const longSecret = 'a'.repeat(256);
      expect(schema.parse(longSecret)).toBe(longSecret);
    });

    it('should accept secrets with special characters', () => {
      const secret = 'my!@#$%^&*()_+-=[]{}|;\':",./<>?secret';
      expect(schema.parse(secret)).toBe(secret);
    });

    it('should reject empty string', () => {
      expect(() => schema.parse('')).toThrow();
    });

    it('should reject undefined', () => {
      expect(() => schema.parse(undefined)).toThrow();
    });

    it('should reject null', () => {
      expect(() => schema.parse(null)).toThrow();
    });
  });

  describe('NEXTAUTH_URL schema', () => {
    const schema = z.string().url().optional();

    it('should accept valid HTTP URL', () => {
      const url = 'http://localhost:3000';
      expect(schema.parse(url)).toBe(url);
    });

    it('should accept valid HTTPS URL', () => {
      const url = 'https://example.com';
      expect(schema.parse(url)).toBe(url);
    });

    it('should accept URL with path', () => {
      const url = 'https://example.com/auth';
      expect(schema.parse(url)).toBe(url);
    });

    it('should accept URL with port', () => {
      const url = 'https://example.com:8080';
      expect(schema.parse(url)).toBe(url);
    });

    it('should accept undefined (optional)', () => {
      expect(schema.parse(undefined)).toBeUndefined();
    });

    it('should reject invalid URL', () => {
      expect(() => schema.parse('not-a-url')).toThrow();
    });

    it('should reject empty string as invalid URL', () => {
      expect(() => schema.parse('')).toThrow();
    });
  });

  describe('emptyStringAsUndefined behavior', () => {
    /**
     * This tests the concept of treating empty strings as undefined,
     * which is what the env.ts configuration does.
     */
    const createSchemaWithEmptyAsUndefined = () => {
      return z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional());
    };

    it('should treat empty string as undefined', () => {
      const schema = createSchemaWithEmptyAsUndefined();
      expect(schema.parse('')).toBeUndefined();
    });

    it('should still accept valid URLs', () => {
      const schema = createSchemaWithEmptyAsUndefined();
      expect(schema.parse('https://example.com')).toBe('https://example.com');
    });

    it('should still accept undefined', () => {
      const schema = createSchemaWithEmptyAsUndefined();
      expect(schema.parse(undefined)).toBeUndefined();
    });
  });

  describe('complete server schema validation', () => {
    const serverSchema = z.object({
      DATABASE_URL: z.string().url(),
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      NEXTAUTH_SECRET: z.string().min(1),
      NEXTAUTH_URL: z.string().url().optional(),
    });

    it('should accept complete valid configuration', () => {
      const config = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NODE_ENV: 'production' as const,
        NEXTAUTH_SECRET: 'super-secret-key',
        NEXTAUTH_URL: 'https://myapp.com',
      };

      const result = serverSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should accept minimal valid configuration', () => {
      const config = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NEXTAUTH_SECRET: 'secret',
      };

      const result = serverSchema.parse(config);
      expect(result.DATABASE_URL).toBe(config.DATABASE_URL);
      expect(result.NEXTAUTH_SECRET).toBe(config.NEXTAUTH_SECRET);
      expect(result.NODE_ENV).toBe('development'); // default
      expect(result.NEXTAUTH_URL).toBeUndefined();
    });

    it('should reject missing DATABASE_URL', () => {
      const config = {
        NODE_ENV: 'production',
        NEXTAUTH_SECRET: 'secret',
      };

      expect(() => serverSchema.parse(config)).toThrow();
    });

    it('should reject missing NEXTAUTH_SECRET', () => {
      const config = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NODE_ENV: 'production',
      };

      expect(() => serverSchema.parse(config)).toThrow();
    });

    it('should reject invalid DATABASE_URL', () => {
      const config = {
        DATABASE_URL: 'not-a-valid-url',
        NEXTAUTH_SECRET: 'secret',
      };

      expect(() => serverSchema.parse(config)).toThrow();
    });

    it('should reject invalid NODE_ENV', () => {
      const config = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NODE_ENV: 'invalid',
        NEXTAUTH_SECRET: 'secret',
      };

      expect(() => serverSchema.parse(config)).toThrow();
    });

    it('should reject empty NEXTAUTH_SECRET', () => {
      const config = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NEXTAUTH_SECRET: '',
      };

      expect(() => serverSchema.parse(config)).toThrow();
    });

    it('should reject invalid NEXTAUTH_URL when provided', () => {
      const config = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NEXTAUTH_SECRET: 'secret',
        NEXTAUTH_URL: 'not-a-url',
      };

      expect(() => serverSchema.parse(config)).toThrow();
    });
  });

  describe('client schema validation', () => {
    // The client schema is currently empty, but we test the structure
    const clientSchema = z.object({
      // NEXT_PUBLIC_CLIENTVAR: z.string(),
    });

    it('should accept empty object for empty client schema', () => {
      expect(clientSchema.parse({})).toEqual({});
    });
  });

  describe('SKIP_ENV_VALIDATION behavior', () => {
    it('should correctly evaluate truthy values', () => {
      // Testing the !!process.env.SKIP_ENV_VALIDATION logic
      const undefinedVal: string | undefined = undefined;
      const emptyStr = '';
      const trueStr = 'true';
      const oneStr = '1';
      const falseStr = 'false'; // Note: "false" string is truthy!
      const zeroStr = '0'; // Note: "0" string is truthy!

      expect(!!undefinedVal).toBe(false);
      expect(!!emptyStr).toBe(false);
      expect(!!trueStr).toBe(true);
      expect(!!oneStr).toBe(true);
      expect(!!falseStr).toBe(true);
      expect(!!zeroStr).toBe(true);
    });
  });

  describe('validation error messages', () => {
    it('should provide meaningful error for invalid DATABASE_URL', () => {
      const schema = z.string().url();
      try {
        schema.parse('invalid');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        if (error instanceof z.ZodError) {
          // Zod's URL error message is "Invalid URL"
          expect(error.issues[0].message).toContain('Invalid URL');
        }
      }
    });

    it('should provide meaningful error for invalid NODE_ENV', () => {
      const schema = z.enum(['development', 'test', 'production']);
      try {
        schema.parse('invalid');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        if (error instanceof z.ZodError) {
          // Zod's enum error message format: "Invalid option: expected one of..."
          expect(error.issues[0].message).toContain('Invalid option');
        }
      }
    });

    it('should provide meaningful error for too short NEXTAUTH_SECRET', () => {
      const schema = z.string().min(1);
      try {
        schema.parse('');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        if (error instanceof z.ZodError) {
          expect(error.issues[0].code).toBe('too_small');
        }
      }
    });
  });
});
