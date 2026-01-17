import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads successfully with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Next.js Boilerplate/);
  });

  test('main heading is visible with correct text', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Next.js Full-Stack Boilerplate');
  });

  test('subtitle is visible', async ({ page }) => {
    const subtitle = page.locator(
      'text=Production-ready template with Auth, tRPC, Prisma, and more'
    );
    await expect(subtitle).toBeVisible();
  });

  test('page has correct structure', async ({ page }) => {
    // Main container exists
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Container has proper styling class
    const container = main.locator('.container');
    await expect(container).toBeVisible();
  });

  test.describe('Feature Cards', () => {
    const featureCards = [
      {
        title: 'Authentication',
        description: 'NextAuth.js v5 with Credentials provider and Prisma adapter',
      },
      { title: 'UI Components', description: 'shadcn/ui with Tailwind CSS and dark mode support' },
      { title: 'Database', description: 'Prisma v7 ORM with PostgreSQL adapter' },
      { title: 'API Layer', description: 'tRPC v11 with React Query for type-safe APIs' },
      { title: 'Type Safety', description: 'TypeScript strict mode with Zod validation' },
      { title: 'Testing', description: 'Vitest for unit tests, Playwright for E2E' },
      { title: 'Code Quality', description: 'ESLint, Prettier, and Husky pre-commit hooks' },
      { title: 'Deployment', description: 'Vercel-ready with optimized configuration' },
    ];

    test('all 8 feature cards are visible', async ({ page }) => {
      const cards = page.locator('.grid > div');
      await expect(cards).toHaveCount(8);
    });

    for (const card of featureCards) {
      test(`displays ${card.title} feature card`, async ({ page }) => {
        const cardElement = page.locator(`text=${card.title}`).first();
        await expect(cardElement).toBeVisible();
      });

      test(`${card.title} card has correct description`, async ({ page }) => {
        const description = page.locator(`text=${card.description}`);
        await expect(description).toBeVisible();
      });
    }

    test('feature cards have hover effect styling', async ({ page }) => {
      const firstCard = page.locator('.grid > div').first();
      await expect(firstCard).toHaveClass(/hover:shadow-lg/);
      await expect(firstCard).toHaveClass(/transition-shadow/);
    });
  });

  test.describe('Get Started Section', () => {
    test('Get Started section is visible', async ({ page }) => {
      const section = page.locator('text=Get Started').first();
      await expect(section).toBeVisible();
    });

    test('displays environment setup instruction', async ({ page }) => {
      const envInstruction = page.locator('text=cp .env.example .env.local');
      await expect(envInstruction).toBeVisible();
    });

    test('displays database setup instruction', async ({ page }) => {
      const dbInstruction = page.locator('text=bun db:push');
      await expect(dbInstruction).toBeVisible();
    });

    test('displays dev server instruction', async ({ page }) => {
      const devInstruction = page.locator('text=bun dev');
      await expect(devInstruction).toBeVisible();
    });

    test('instruction comments are visible', async ({ page }) => {
      await expect(
        page.locator('text=Copy .env.example to .env.local and configure')
      ).toBeVisible();
      await expect(page.locator('text=Set up your database')).toBeVisible();
      await expect(page.locator('text=Start development server')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('page has proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1');
      const h2 = page.locator('h2');
      const h3 = page.locator('h3');

      await expect(h1).toHaveCount(1);
      await expect(h2).toHaveCount(1); // "Get Started"
      await expect(h3).toHaveCount(8); // 8 feature card titles
    });

    test('page has proper language attribute', async ({ page }) => {
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', 'en');
    });
  });

  test.describe('Responsive Design', () => {
    test('displays correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();

      const cards = page.locator('.grid > div');
      await expect(cards).toHaveCount(8);
    });

    test('displays correctly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });

    test('displays correctly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('page loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Page should load within 10 seconds (generous for CI environments)
      expect(loadTime).toBeLessThan(10000);
    });

    test('no console errors on page load', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Filter out expected errors (like failed network requests in test environment)
      const unexpectedErrors = consoleErrors.filter(
        (error) => !error.includes('Failed to load resource') && !error.includes('net::ERR')
      );

      expect(unexpectedErrors).toHaveLength(0);
    });
  });
});
