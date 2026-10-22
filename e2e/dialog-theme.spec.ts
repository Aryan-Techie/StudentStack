import { test, expect, type Page } from '@playwright/test';

// Regression for #117: dialogs portal to <body>, outside the directory's
// themed root, and used to render as light panels on the dark directory.
async function directorySurface(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--d-surface)';
    document.querySelector('main')!.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
}

for (const theme of ['light', 'dark']) {
  test.describe(`Directory dialogs with the ${theme} site theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto('/directory');
    });

    test('eligibility sheet uses the directory palette', async ({ page }) => {
      const surface = await directorySurface(page);
      await page.getByText('Set my eligibility').first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS('background-color', surface);
      await expect(dialog.getByLabel('Country')).toHaveCSS('color-scheme', 'dark');
    });

    test('card description dialog uses the directory palette', async ({ page }) => {
      const surface = await directorySurface(page);
      await page.locator('article').first().getByRole('button').filter({ has: page.locator('p') }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS('background-color', surface);
    });
  });
}
