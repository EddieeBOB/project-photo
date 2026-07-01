import { test, expect } from '@playwright/test';
import {
    APPWRITE_CONFIGURED,
    FIXTURE_EMAIL,
    FIXTURE_PASSWORD,
    cleanupGalleriesByTitle,
} from './utils/appwrite';

/**
 * The authenticated browser upload pipeline — the part Vitest can't exercise:
 * a real file goes through pica resize + EXIF parse + URL.createObjectURL in a
 * real browser, then publishes to the real Appwrite project. Everything created
 * is torn down afterwards (verified by title marker) so the DB is left clean.
 *
 * Skipped automatically if `.env` isn't configured.
 */

// Unique per run so parallel/leftover runs never collide, and cleanup is precise.
const MARKER = `E2E-Upload-${Date.now()}`;

// A minimal valid 1x1 JPEG — enough to drive the full resize/encode/upload path.
const JPEG_BASE64 =
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
    'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' +
    'AAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==';

test.describe('Studio upload pipeline', () => {
    test.skip(!APPWRITE_CONFIGURED, '.env not configured for Appwrite');

    // Remove anything a previous aborted run may have left behind.
    test.beforeAll(async () => {
        await cleanupGalleriesByTitle('E2E-Upload-');
    });

    test.afterAll(async () => {
        await cleanupGalleriesByTitle('E2E-Upload-');
    });

    test('logs in, processes an image, and publishes a private gallery', async ({ page }) => {
        // --- Sign in through the real UI ---
        await page.goto('/login');
        await page.getByLabel('Email').fill(FIXTURE_EMAIL);
        await page.getByLabel('Password').fill(FIXTURE_PASSWORD);
        // Scope to the form — a "Log In" button also lives in the navbar.
        await page.getByRole('main').getByRole('button', { name: 'Log In' }).click();

        // Successful password login lands on the studio (fixture has no MFA).
        await expect(page).toHaveURL(/\/studio$/, { timeout: 20_000 });

        // --- Feed a real file through the browser upload pipeline ---
        await page.setInputFiles('#upload-image-button', {
            name: 'e2e-sample.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from(JPEG_BASE64, 'base64'),
        });

        // pica + exifr run, then an editable card appears with the file name as
        // its default title.
        const photoTitle = page.getByLabel('Photo title');
        await expect(photoTitle).toBeVisible({ timeout: 20_000 });
        await expect(photoTitle).toHaveValue('e2e-sample');

        // Name the exhibition with our cleanup marker.
        const exhibitionTitle = page.getByLabel('Exhibition title');
        await exhibitionTitle.fill(MARKER);

        // --- Publish (defaults to Private) ---
        const publish = page.getByRole('button', { name: 'Publish', exact: true });
        await expect(publish).toBeVisible();
        await publish.click();

        // Success toast confirms the gallery + photo + storage file were written.
        await expect(page.getByText('Successfully published all photos!')).toBeVisible({ timeout: 30_000 });
    });

    test('the published gallery was actually persisted, then cleaned up', async () => {
        // The publish test ran first; confirm exactly one marked gallery exists,
        // then delete it. A non-zero count proves the write reached Appwrite.
        const deleted = await cleanupGalleriesByTitle(MARKER);
        expect(deleted).toBeGreaterThan(0);

        // A second cleanup finds nothing — proves teardown really removed it.
        const again = await cleanupGalleriesByTitle(MARKER);
        expect(again).toBe(0);
    });
});
