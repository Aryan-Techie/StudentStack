import { test, expect } from '@playwright/test';

// Issue #127: without Supabase configured (a fresh checkout), the pages that
// need sign-in show a notice instead of returning 500. In CI the Supabase
// env is set, so these pages render the real sign-in flow instead.
test.describe('Sign-in pages without Supabase', () => {
  test.skip(
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    'Supabase is configured, so the real sign-in flow renders',
  );

  for (const path of ['/submit', '/my-list']) {
    test(`${path} explains that sign-in isn't set up`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Sign-in isn’t set up here' })).toBeVisible();
    });
  }

  test('/onboarding sends visitors to /my-list', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/my-list$/);
  });
});
