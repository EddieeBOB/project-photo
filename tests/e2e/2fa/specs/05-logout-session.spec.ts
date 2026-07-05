import { test, expect, requireAdmin } from '../fixtures/test';

/**
 * LIFECYCLE 5 — LOGOUT & SESSION
 *
 * Two groups: protected-route guarding for anonymous users (no admin needed),
 * and logout teardown for an authenticated user (seeded via admin).
 */
test.describe('Protected routes when unauthenticated', () => {
    for (const path of ['/studio', '/account']) {
        test(`direct navigation to ${path} redirects to /login`, async ({ page }) => {
            await page.goto(path);
            // ProtectedRoute renders a spinner while checkAuth runs, then redirects.
            await expect(page).toHaveURL(/\/login$/);
            await expect(page.getByRole('heading', { name: 'Welcome Back.' })).toBeVisible();
        });
    }
});

test.describe('Logout', () => {
    requireAdmin();

    test('logout clears the session and re-guards protected routes', async ({
        page,
        userFactory,
        seedAuth,
        appShell,
    }) => {
        const user = await userFactory.create({ tag: 'logout', verified: true, mfa: false });
        await seedAuth(user.id);

        await page.goto('/studio');
        await appShell.expectAuthenticated();

        await appShell.logout();
        // After logout we're off the authenticated area; the navbar drops the
        // account menu (the app itself lands the user on a public page). We don't
        // over-assert exactly which public page — the security-relevant facts are
        // below: the session is cleared and protected routes re-guard.
        await expect(page).not.toHaveURL(/\/studio$/);
        await expect(page.getByRole('button', { name: 'Open account menu' })).toHaveCount(0);

        // The session is gone: the protected route now bounces to login.
        await page.goto('/studio');
        await expect(page).toHaveURL(/\/login$/);
    });
});
