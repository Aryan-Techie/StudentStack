import { test, expect } from '@playwright/test';

// Signing in goes through a real Supabase project. Forks and fresh checkouts
// don't have one, so those tests skip instead of failing.
const hasSupabase =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const noSupabaseReason =
  'Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

test.describe('Home Page', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/StudentStack/);
  });

  test('should have proper heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should navigate to directory', async ({ page }) => {
    await page.goto('/');
    // The header nav collapses into a menu on mobile; the footer link is
    // visible at every width.
    await page
      .getByRole('navigation', { name: 'Footer' })
      .getByRole('link', { name: 'Directory' })
      .click();
    await expect(page).toHaveURL(/.*directory/);
  });
});

test.describe('Directory Page', () => {
  test('should load directory page', async ({ page }) => {
    await page.goto('/directory');
    await expect(page.locator('h1')).toContainText('Your student perks');
  });

  test('should have filter panel', async ({ page, isMobile }) => {
    await page.goto('/directory');
    if (isMobile) {
      // Mobile hides the sidebar behind a bottom sheet.
      await page.getByRole('button', { name: 'Open filter options' }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    } else {
      await expect(
        page.getByRole('complementary').getByRole('heading', { name: 'Filters' })
      ).toBeVisible();
    }
  });
});

test.describe('Deadlines Page', () => {
  test('should list deadlines with calendar and RSS feeds', async ({ page }) => {
    await page.goto('/deadlines');
    await expect(page.locator('h1')).toContainText('Deadlines');
    await expect(page.getByRole('link', { name: /Calendar \(\.ics\)/ })).toHaveAttribute(
      'href',
      /deadlines\.ics$/
    );
    await expect(page.getByRole('link', { name: /RSS Feed/ })).toHaveAttribute(
      'href',
      /deadlines\.rss$/
    );
  });
});

test.describe('Compare Page', () => {
  test('should link to comparison sets', async ({ page }) => {
    await page.goto('/compare');
    await expect(page.locator('h1')).toContainText('Compare student offers');
    await expect(page.locator('main a[href^="/compare/"]').first()).toBeVisible();
  });
});

test.describe('Public API', () => {
  test('GET /api/resources returns a paginated list', async ({ request }) => {
    const res = await request.get('/api/resources?limit=5');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toMatchObject({ page: 1, limit: 5 });
    expect(Array.isArray(body.resources)).toBe(true);
    expect(body.resources.length).toBeLessThanOrEqual(5);
  });

  test('GET /llms.txt describes the site for agents', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('text/plain');
    expect(await res.text()).toMatch(/^# StudentStack/);
  });
});

test.describe('Admin Pages', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/.*admin\/login/);
  });
});

test.describe('Admin Login', () => {
  test('should render the login form', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('h1')).toContainText('Admin login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('should show an error for invalid credentials', async ({ page }) => {
    test.skip(!hasSupabase, noSupabaseReason);
    await page.goto('/admin/login');
    await page.locator('input[name="email"]').fill('not-an-admin@example.com');
    await page.locator('input[name="password"]').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/.*admin\/login\?error=/);
    await expect(page.locator('main p')).toContainText(
      /Invalid email or password|Not an admin account/
    );
  });
});

test.describe('Admin Auth Guard', () => {
  const adminRoutes = ['/admin', '/admin/ingestion', '/admin/resources/new'];

  for (const route of adminRoutes) {
    test(`should redirect ${route} to login when not authenticated`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/.*admin\/login/);
    });
  }
});
