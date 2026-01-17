import { describe, it, expect } from 'vitest';
import { makeQueryClient } from '@/trpc/query-client';
import { QueryClient } from '@tanstack/react-query';

describe('makeQueryClient', () => {
  describe('QueryClient instance', () => {
    it('should return a QueryClient instance', () => {
      const queryClient = makeQueryClient();
      expect(queryClient).toBeInstanceOf(QueryClient);
    });

    it('should return a new instance each time', () => {
      const client1 = makeQueryClient();
      const client2 = makeQueryClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('staleTime configuration', () => {
    it('should set staleTime to 30 seconds (30000ms)', () => {
      const queryClient = makeQueryClient();
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.staleTime).toBe(30 * 1000);
    });

    it('should have staleTime of exactly 30000 milliseconds', () => {
      const queryClient = makeQueryClient();
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.staleTime).toBe(30000);
    });
  });

  describe('dehydrate configuration', () => {
    it('should have dehydrate options configured', () => {
      const queryClient = makeQueryClient();
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.dehydrate).toBeDefined();
    });

    it('should have shouldDehydrateQuery function defined', () => {
      const queryClient = makeQueryClient();
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.dehydrate?.shouldDehydrateQuery).toBeDefined();
      expect(typeof defaultOptions.dehydrate?.shouldDehydrateQuery).toBe('function');
    });

    describe('shouldDehydrateQuery behavior', () => {
      it('should dehydrate query when default check passes', () => {
        const queryClient = makeQueryClient();
        const shouldDehydrate = queryClient.getDefaultOptions().dehydrate?.shouldDehydrateQuery;

        // Create a mock query that would pass defaultShouldDehydrateQuery
        const successQuery = {
          state: {
            status: 'success' as const,
            data: { test: 'data' },
            fetchStatus: 'idle' as const,
          },
          queryKey: ['test'],
          queryHash: 'test',
          gcTime: 5 * 60 * 1000, // 5 minutes (default)
        };

        // The function should return true for successful queries
        if (shouldDehydrate) {
          const result = shouldDehydrate(successQuery as any);
          expect(result).toBe(true);
        }
      });

      it('should dehydrate query when status is pending', () => {
        const queryClient = makeQueryClient();
        const shouldDehydrate = queryClient.getDefaultOptions().dehydrate?.shouldDehydrateQuery;

        // Create a mock query with pending status
        const pendingQuery = {
          state: {
            status: 'pending' as const,
            data: undefined,
            fetchStatus: 'fetching' as const,
          },
          queryKey: ['test'],
          queryHash: 'test',
          gcTime: 5 * 60 * 1000,
        };

        if (shouldDehydrate) {
          const result = shouldDehydrate(pendingQuery as any);
          expect(result).toBe(true);
        }
      });

      it('should dehydrate query when either condition is met (success OR pending)', () => {
        const queryClient = makeQueryClient();
        const shouldDehydrate = queryClient.getDefaultOptions().dehydrate?.shouldDehydrateQuery;

        const testCases = [
          {
            name: 'success status',
            query: {
              state: { status: 'success' as const, data: {}, fetchStatus: 'idle' as const },
              queryKey: ['test'],
              queryHash: 'test',
              gcTime: 5 * 60 * 1000,
            },
            expected: true,
          },
          {
            name: 'pending status',
            query: {
              state: {
                status: 'pending' as const,
                data: undefined,
                fetchStatus: 'fetching' as const,
              },
              queryKey: ['test'],
              queryHash: 'test',
              gcTime: 5 * 60 * 1000,
            },
            expected: true,
          },
        ];

        for (const testCase of testCases) {
          if (shouldDehydrate) {
            const result = shouldDehydrate(testCase.query as any);
            expect(result).toBe(testCase.expected);
          }
        }
      });

      it('should not dehydrate error queries that fail default check', () => {
        const queryClient = makeQueryClient();
        const shouldDehydrate = queryClient.getDefaultOptions().dehydrate?.shouldDehydrateQuery;

        // Error queries with gcTime of 0 should not be dehydrated
        const errorQuery = {
          state: {
            status: 'error' as const,
            error: new Error('Test error'),
            fetchStatus: 'idle' as const,
          },
          queryKey: ['test'],
          queryHash: 'test',
          gcTime: 0, // Immediately garbage collected
        };

        if (shouldDehydrate) {
          const result = shouldDehydrate(errorQuery as any);
          // Error with gcTime 0 fails default check AND is not pending
          expect(result).toBe(false);
        }
      });
    });
  });

  describe('default query options', () => {
    it('should allow overriding staleTime per query', () => {
      const queryClient = makeQueryClient();

      // The QueryClient should still allow setting different staleTime per query
      // This tests that the default doesn't prevent overrides
      const customStaleTime = 60 * 1000; // 1 minute

      // Set a query with custom staleTime
      queryClient.setQueryDefaults(['custom'], { staleTime: customStaleTime });

      // Verify the custom staleTime is set
      const queryDefaults = queryClient.getQueryDefaults(['custom']);
      expect(queryDefaults?.staleTime).toBe(customStaleTime);
    });

    it('should use default staleTime for queries without override', () => {
      const queryClient = makeQueryClient();
      const defaultOptions = queryClient.getDefaultOptions();

      // Queries without specific defaults should use the global default
      expect(defaultOptions.queries?.staleTime).toBe(30000);
    });
  });

  describe('integration with React Query features', () => {
    it('should be able to set and get query data', () => {
      const queryClient = makeQueryClient();
      const testData = { message: 'Hello' };

      queryClient.setQueryData(['test', 'query'], testData);
      const result = queryClient.getQueryData(['test', 'query']);

      expect(result).toEqual(testData);
    });

    it('should be able to invalidate queries', async () => {
      const queryClient = makeQueryClient();

      queryClient.setQueryData(['test'], { data: 'value' });

      // Invalidate should work without throwing
      await expect(queryClient.invalidateQueries({ queryKey: ['test'] })).resolves.not.toThrow();
    });

    it('should be able to remove queries', () => {
      const queryClient = makeQueryClient();

      queryClient.setQueryData(['to-remove'], { data: 'value' });
      expect(queryClient.getQueryData(['to-remove'])).toBeDefined();

      queryClient.removeQueries({ queryKey: ['to-remove'] });
      expect(queryClient.getQueryData(['to-remove'])).toBeUndefined();
    });

    it('should be able to clear all queries', () => {
      const queryClient = makeQueryClient();

      queryClient.setQueryData(['query1'], { data: 1 });
      queryClient.setQueryData(['query2'], { data: 2 });

      queryClient.clear();

      expect(queryClient.getQueryData(['query1'])).toBeUndefined();
      expect(queryClient.getQueryData(['query2'])).toBeUndefined();
    });
  });

  describe('mutation defaults', () => {
    it('should not have custom mutation defaults', () => {
      const queryClient = makeQueryClient();
      const defaultOptions = queryClient.getDefaultOptions();

      // The makeQueryClient only sets query options, not mutation options
      // So mutations should have undefined or default values
      expect(defaultOptions.mutations).toBeUndefined();
    });
  });

  describe('cache behavior', () => {
    it('should return stale data after staleTime expires conceptually', () => {
      const queryClient = makeQueryClient();
      const defaultOptions = queryClient.getDefaultOptions();

      // Data becomes stale after 30 seconds
      // This is a conceptual test - actual staleness depends on when data was fetched
      expect(defaultOptions.queries?.staleTime).toBe(30000);

      // In a real scenario, data fetched 31 seconds ago would be stale
      // but data fetched 29 seconds ago would still be fresh
    });
  });

  describe('memory management', () => {
    it('should allow cleanup via clear method', () => {
      const queryClient = makeQueryClient();

      // Add some queries
      for (let i = 0; i < 100; i++) {
        queryClient.setQueryData([`query-${i}`], { index: i });
      }

      // Clear should work
      queryClient.clear();

      // Verify all queries are cleared
      for (let i = 0; i < 100; i++) {
        expect(queryClient.getQueryData([`query-${i}`])).toBeUndefined();
      }
    });
  });
});
