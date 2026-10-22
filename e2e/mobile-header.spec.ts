import { test, expect } from '@playwright/test';

// Regression for #116: at phone widths the header used to be wider than the
// screen, clipping the menu button and letting pages scroll sideways.
for (const width of [320, 390]) {
  test.describe(`Header at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of ['/', '/directory', '/deadlines']) {
      test(`${path} has no horizontal scroll`, async ({ page }) => {
        await page.goto(path);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(width);
      });
    }

    test('menu button is fully visible and toggles the menu', async ({ page }) => {
      await page.goto('/');
      const open = page.getByRole('button', { name: 'Open navigation menu' });
      const box = await open.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);

      await open.click();
      const menuLink = page.locator('header').getByRole('link', { name: 'Add a perk' });
      await expect(menuLink).toBeVisible();

      await page.getByRole('button', { name: 'Close navigation menu' }).click();
      await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible();
      await expect(page.locator('header').getByRole('link', { name: 'Deadlines' })).toBeHidden();
    });
  });
}
