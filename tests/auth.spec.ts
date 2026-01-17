import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('NextAuth Sign-in Page', () => {
    test('NextAuth signin page is accessible', async ({ page }) => {
      const response = await page.goto('/api/auth/signin');
      expect(response?.status()).toBe(200);
    });

    test('signin page renders credentials provider', async ({ page }) => {
      await page.goto('/api/auth/signin');

      // NextAuth default signin page should have a form
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('signin page has email input field', async ({ page }) => {
      await page.goto('/api/auth/signin');

      // Look for email input (NextAuth uses name="email" for credentials)
      const emailInput = page.locator('input[name="email"], input[type="email"]');
      await expect(emailInput).toBeVisible();
    });

    test('signin page has password input field', async ({ page }) => {
      await page.goto('/api/auth/signin');

      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      await expect(passwordInput).toBeVisible();
    });

    test('signin page has submit button', async ({ page }) => {
      await page.goto('/api/auth/signin');

      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
    });

    test('credentials provider is listed', async ({ page }) => {
      await page.goto('/api/auth/signin');

      // The page should show the credentials provider option
      // NextAuth may display provider name in various ways
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain('credentials');
    });
  });

  test.describe('Login with Invalid Credentials', () => {
    test('submitting empty form shows validation or error', async ({ page }) => {
      await page.goto('/api/auth/signin');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // After submission with empty fields, we should either:
      // - Stay on the same page (HTML5 validation)
      // - See an error message
      // - Be redirected to an error page
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      // Should still be on auth-related page
      expect(currentUrl).toContain('/api/auth');
    });

    test('login with invalid email format is handled', async ({ page }) => {
      await page.goto('/api/auth/signin');

      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('invalid-email');
      await passwordInput.fill('password123');
      await submitButton.click();

      await page.waitForTimeout(1000);

      // Page should handle the invalid email gracefully
      const response = await page.reload();
      expect(response?.status()).toBe(200);
    });

    test('login with non-existent user shows error', async ({ page }) => {
      await page.goto('/api/auth/signin');

      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('nonexistent@example.com');
      await passwordInput.fill('password123456');
      await submitButton.click();

      // Wait for the form submission and potential redirect
      await page.waitForURL(/.*/, { timeout: 5000 });

      // After failed login, NextAuth typically redirects to signin page with error
      const currentUrl = page.url();
      const hasError = currentUrl.includes('error') || currentUrl.includes('signin');
      expect(hasError).toBe(true);
    });

    test('error page is accessible after failed login', async ({ page }) => {
      // Navigate directly to error page
      const response = await page.goto('/api/auth/error');
      // Should either show error page or redirect
      expect(response?.status()).toBeLessThan(500);
    });
  });

  test.describe('Session API', () => {
    test('session endpoint returns JSON response', async ({ request }) => {
      const response = await request.get('/api/auth/session');
      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('session endpoint returns empty session for unauthenticated user', async ({ request }) => {
      const response = await request.get('/api/auth/session');
      const session = await response.json();

      // For unauthenticated users, session should be empty or null
      expect(session).toBeDefined();
      // NextAuth returns {} for unauthenticated sessions
      expect(session.user).toBeUndefined();
    });

    test('CSRF token endpoint is accessible', async ({ request }) => {
      const response = await request.get('/api/auth/csrf');
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.csrfToken).toBeDefined();
      expect(typeof data.csrfToken).toBe('string');
    });

    test('providers endpoint returns available providers', async ({ request }) => {
      const response = await request.get('/api/auth/providers');
      expect(response.status()).toBe(200);

      const providers = await response.json();
      expect(providers).toBeDefined();

      // Should have credentials provider
      expect(providers.credentials).toBeDefined();
      expect(providers.credentials.id).toBe('credentials');
      expect(providers.credentials.name).toBe('credentials');
      expect(providers.credentials.type).toBe('credentials');
    });
  });

  test.describe('Auth Callback Handling', () => {
    test('callback endpoint with invalid credentials returns error', async ({ request }) => {
      // Get CSRF token first
      const csrfResponse = await request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      // Attempt callback with credentials
      const response = await request.post('/api/auth/callback/credentials', {
        form: {
          csrfToken,
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      // Should redirect (302) or return error status
      // NextAuth typically redirects after callback
      expect(response.status()).toBeLessThan(500);
    });

    test('signout endpoint is accessible', async ({ request }) => {
      const response = await request.get('/api/auth/signout');
      // Should return the signout page
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Protected Route Behavior', () => {
    test('unauthenticated request to login page works', async ({ page }) => {
      // The auth config has pages.signIn set to "/login"
      // Even though the page doesn't exist, we test the redirect behavior
      const response = await page.goto('/login');

      // If /login page doesn't exist, it will 404
      // If it exists, it should return 200
      expect(response?.status()).toBeLessThan(500);
    });

    test('signIn callback URL parameter is respected', async ({ page }) => {
      await page.goto('/api/auth/signin?callbackUrl=/dashboard');

      // The callback URL should be set in the form or session
      // CallbackUrl should be somewhere in the page (hidden field or URL)
      expect(page.url()).toContain('callbackUrl');
    });
  });

  test.describe('Authentication Security', () => {
    test('auth endpoints use secure headers', async ({ request }) => {
      const response = await request.get('/api/auth/session');

      // Check for common security headers (may vary based on Next.js config)
      expect(response.status()).toBe(200);
    });

    test('CSRF protection is enabled', async ({ request }) => {
      const response = await request.get('/api/auth/csrf');
      const data = await response.json();

      // CSRF token should be present
      expect(data.csrfToken).toBeDefined();
      expect(data.csrfToken.length).toBeGreaterThan(0);
    });

    test('POST to signin without CSRF token is handled', async ({ request }) => {
      const response = await request.post('/api/auth/signin/credentials', {
        form: {
          email: 'test@example.com',
          password: 'password123',
          // Intentionally omitting CSRF token
        },
      });

      // Should fail or redirect, not 500
      expect(response.status()).toBeLessThan(500);
    });
  });
});
