import { test, expect } from '@playwright/test';

/**
 * NavBar behaviour on desktop and the responsive mobile drawer — the guest
 * (logged-out) navigation surface.
 */
test.describe('Navigation (desktop)', () => {
    test('the brand link returns home', async ({ page }) => {
        await page.goto('/about');
        await page.getByRole('link', { name: /Frame — go to home/i }).click();
        await expect(page).toHaveURL(/\/$/);
    });

    test('the Gallery and About nav links route correctly', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: 'Gallery' }).first().click();
        await expect(page).toHaveURL(/\/gallery$/);

        await page.getByRole('link', { name: 'About' }).first().click();
        await expect(page).toHaveURL(/\/about$/);
    });

    test('the Log In / Sign Up buttons route to auth pages', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Log In' }).first().click();
        await expect(page).toHaveURL(/\/login$/);

        await page.goto('/');
        await page.getByRole('button', { name: 'Sign Up' }).first().click();
        await expect(page).toHaveURL(/\/signup$/);
    });
});

test.describe('Navigation (mobile drawer)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('opens the drawer and navigates', async ({ page }) => {
        await page.goto('/');

        // The desktop links are hidden at this width; open the hamburger menu.
        await page.getByRole('button', { name: 'Open navigation menu' }).click();

        const drawerGallery = page.getByRole('menuitem', { name: 'Gallery' });
        await expect(drawerGallery).toBeVisible();
        await drawerGallery.click();
        await expect(page).toHaveURL(/\/gallery$/);

        // Drawer closes after navigation.
        await expect(page.getByRole('menuitem', { name: 'Gallery' })).toHaveCount(0);
    });

    test('drawer exposes Sign Up / Log In for guests', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Open navigation menu' }).click();
        await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
    });
});
