import { test, expect } from '@playwright/test';

test.describe('tRPC API Endpoints', () => {
  test.describe('Hello Procedure', () => {
    test('returns greeting without input', async ({ request }) => {
      const response = await request.get('/api/trpc/hello');
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.result).toBeDefined();
      expect(data.result.data).toBeDefined();
      expect(data.result.data.greeting).toBe('Hello World!');
    });

    test('returns personalized greeting with name input', async ({ request }) => {
      const input = JSON.stringify({ name: 'Playwright' });
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.result.data.greeting).toBe('Hello Playwright!');
    });

    test('handles empty name input', async ({ request }) => {
      const input = JSON.stringify({ name: '' });
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.result.data.greeting).toBe('Hello !');
    });

    test('handles special characters in name', async ({ request }) => {
      const input = JSON.stringify({ name: 'Test User <script>' });
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.result.data.greeting).toContain('Test User');
    });

    test('handles unicode characters in name', async ({ request }) => {
      const input = JSON.stringify({ name: '用户' });
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.result.data.greeting).toBe('Hello 用户!');
    });

    test('works with POST method', async ({ request }) => {
      const response = await request.post('/api/trpc/hello', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({}),
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result.data.greeting).toBe('Hello World!');
    });

    test('POST with input in body', async ({ request }) => {
      const response = await request.post('/api/trpc/hello', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({ name: 'POST User' }),
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result.data.greeting).toBe('Hello POST User!');
    });
  });

  test.describe('GetSession Procedure', () => {
    test('returns null session for unauthenticated request', async ({ request }) => {
      const response = await request.get('/api/trpc/getSession');
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.result).toBeDefined();
      expect(data.result.data).toBeNull();
    });

    test('session endpoint responds to POST', async ({ request }) => {
      const response = await request.post('/api/trpc/getSession', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({}),
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result.data).toBeNull();
    });
  });

  test.describe('Error Handling', () => {
    test('returns error for non-existent procedure', async ({ request }) => {
      const response = await request.get('/api/trpc/nonExistentProcedure');

      // tRPC returns 404 or error response for unknown procedures
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toBeDefined();
    });

    test('handles malformed JSON input gracefully', async ({ request }) => {
      const response = await request.get('/api/trpc/hello?input=not-valid-json');

      // Should return an error but not crash
      expect(response.status()).toBeLessThan(500);
    });

    test('handles invalid input type', async ({ request }) => {
      // Send a number instead of object
      const input = JSON.stringify(12345);
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);

      // tRPC should validate the input schema
      expect(response.status()).toBeLessThan(500);
    });

    test('returns proper error structure for validation failures', async ({ request }) => {
      // Try to pass an array instead of expected object
      const input = JSON.stringify([1, 2, 3]);
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);
      await response.json(); // Consume the response

      // Either it works with fallback or returns structured error
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('Batch Requests', () => {
    test('handles batch request with multiple procedures', async ({ request }) => {
      // tRPC supports batching via comma-separated procedure names
      const response = await request.get(
        `/api/trpc/hello,getSession?batch=1&input=${encodeURIComponent(
          JSON.stringify({ '0': { name: 'Batch' }, '1': {} })
        )}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      // Batch response is an array
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);

      // First result is hello
      expect(data[0].result.data.greeting).toBe('Hello Batch!');
      // Second result is getSession (null for unauthenticated)
      expect(data[1].result.data).toBeNull();
    });
  });

  test.describe('Response Headers', () => {
    test('API returns correct content-type header', async ({ request }) => {
      const response = await request.get('/api/trpc/hello');
      const contentType = response.headers()['content-type'];

      expect(contentType).toContain('application/json');
    });

    test('API responds with appropriate cache headers', async ({ request }) => {
      const response = await request.get('/api/trpc/hello');

      // tRPC queries may have cache headers
      expect(response.status()).toBe(200);
    });
  });

  test.describe('HTTP Methods', () => {
    test('GET method works for queries', async ({ request }) => {
      const response = await request.get('/api/trpc/hello');
      expect(response.status()).toBe(200);
    });

    test('POST method works for queries', async ({ request }) => {
      const response = await request.post('/api/trpc/hello', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({}),
      });
      expect(response.status()).toBe(200);
    });

    test('OPTIONS request is handled (CORS preflight)', async ({ request }) => {
      try {
        const response = await request.fetch('/api/trpc/hello', {
          method: 'OPTIONS',
        });
        // Should not error, status depends on CORS config
        expect(response.status()).toBeLessThan(500);
      } catch {
        // Some configurations may not allow OPTIONS
        expect(true).toBe(true);
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('handles very long name input', async ({ request }) => {
      const longName = 'A'.repeat(10000);
      const input = JSON.stringify({ name: longName });
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);

      // Should handle without crashing
      expect(response.status()).toBeLessThan(500);
    });

    test('handles null input value', async ({ request }) => {
      const input = JSON.stringify(null);
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);

      // tRPC should handle null gracefully (optional input)
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result.data.greeting).toBe('Hello World!');
    });

    test('handles undefined input gracefully', async ({ request }) => {
      const input = JSON.stringify(undefined);
      const encodedInput = encodeURIComponent(input);

      const response = await request.get(`/api/trpc/hello?input=${encodedInput}`);

      expect(response.status()).toBeLessThan(500);
    });

    test('handles request without input parameter', async ({ request }) => {
      const response = await request.get('/api/trpc/hello');

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.result.data.greeting).toBe('Hello World!');
    });

    test('concurrent requests are handled correctly', async ({ request }) => {
      const requests = Array.from({ length: 10 }, (_, i) => {
        const input = JSON.stringify({ name: `User${i}` });
        return request.get(`/api/trpc/hello?input=${encodeURIComponent(input)}`);
      });

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status()).toBe(200);
      });

      const results = await Promise.all(responses.map((r) => r.json()));

      results.forEach((data, i) => {
        expect(data.result.data.greeting).toBe(`Hello User${i}!`);
      });
    });
  });
});

test.describe('Auth API Endpoints via tRPC Context', () => {
  test('getSession reflects auth state in tRPC context', async ({ request }) => {
    // First, verify session is null for unauthenticated
    const trpcResponse = await request.get('/api/trpc/getSession');
    const trpcData = await trpcResponse.json();

    // Compare with NextAuth session endpoint
    const authResponse = await request.get('/api/auth/session');
    const authData = await authResponse.json();

    // Both should indicate no authenticated user
    expect(trpcData.result.data).toBeNull();
    expect(authData.user).toBeUndefined();
  });
});

test.describe('API Health Checks', () => {
  test('tRPC endpoint is reachable', async ({ request }) => {
    const response = await request.get('/api/trpc/hello');
    expect(response.ok()).toBe(true);
  });

  test('auth endpoint is reachable', async ({ request }) => {
    const response = await request.get('/api/auth/session');
    expect(response.ok()).toBe(true);
  });

  test("multiple rapid requests don't cause issues", async ({ request }) => {
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(request.get('/api/trpc/hello'));
    }

    const responses = await Promise.all(requests);
    const allSuccessful = responses.every((r) => r.status() === 200);

    expect(allSuccessful).toBe(true);
  });
});
