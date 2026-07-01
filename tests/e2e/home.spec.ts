import { test, expect } from '@playwright/test';

/**
 * The public landing page: hero + feature cards render, and the hero CTAs route
 * correctly. Covers the render/navigation surface Vitest can't touch.
 */
test.describe('Home page', () => {
    test('renders the hero and feature cards', async ({ page }) => {
        await page.goto('/');

        // Hero headline (split across a <br/>, so match the distinctive half).
        await expect(page.getByRole('heading', { name: /A Home for Every Lens/i })).toBeVisible();
        await expect(page.getByText('A platform where photography can exist without the noise.')).toBeVisible();

        // Feature section.
        await expect(page.getByRole('heading', { name: 'Democratizing the Art of Seeing' })).toBeVisible();
        for (const title of ['Open Ecosystem', 'Lossy Compression', 'Share your Portfolio']) {
            await expect(page.getByRole('heading', { name: title })).toBeVisible();
        }
    });

    test('"Explore Gallery" CTA navigates to the gallery', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Explore Gallery' }).click();
        await expect(page).toHaveURL(/\/gallery$/);
    });

    test('"About" CTA navigates to the about page', async ({ page }) => {
        await page.goto('/');
        // The hero secondary CTA (scope to main to avoid the nav "About" link).
        await page.getByRole('main').getByRole('button', { name: 'About' }).click();
        await expect(page).toHaveURL(/\/about$/);
    });
});
