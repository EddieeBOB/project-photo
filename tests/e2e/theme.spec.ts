import { test, expect } from '@playwright/test';

/**
 * Theme toggle: flips the `data-theme` attribute on <html> and persists the
 * choice to localStorage (read back on reload).
 */
test.describe('Theme toggle', () => {
    test('switches between light and dark and persists', async ({ page }) => {
        await page.goto('/');

        const html = page.locator('html');
        const initial = await html.getAttribute('data-theme');
        expect(['light', 'dark']).toContain(initial);

        // The visible toggle is labelled with the mode it will switch *to*.
        await page.getByRole('button', { name: /Switch to (dark|light) mode/i }).first().click();

        const toggled = initial === 'light' ? 'dark' : 'light';
        await expect(html).toHaveAttribute('data-theme', toggled);
        expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(toggled);

        // Preference survives a reload.
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', toggled);
    });
});
