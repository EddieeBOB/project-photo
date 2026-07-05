import { test, expect, requireAdmin, requireOtpReader } from '../fixtures/test';
import { requestAndWaitForOtp } from '../fixtures/otp';
import { SESSION_STORAGE_KEY, sessionCookieName } from '../config';

/**
 * LIFECYCLE 2 — LOGIN WITH 2FA (HAPPY PATH)
 *
 * Requires a live email-OTP reader (E2E_OTP_MODE=manual, local). The test asks
 * the reader for a fresh code via the file handshake in fixtures/otp.ts.
 */
test.describe('Login with 2FA — happy path', () => {
    requireAdmin();
    requireOtpReader();

    test('valid password + emailed OTP reaches the authenticated area', async ({
        page,
        userFactory,
        loginPage,
        twoFactorPage,
        appShell,
    }) => {
        // Waiting on a real email delivery + an out-of-band reader needs more than
        // the default 60s. Allow an env override for slow inboxes.
        test.setTimeout((Number(process.env.E2E_OTP_TIMEOUT_MS) || 120_000) + 60_000);
        const user = await userFactory.create({ tag: 'happy', verified: true, mfa: true });

        // Step 1: password. The app MUST advance to the second factor — if it
        // doesn't, expectMfaPrompt fails and the test does not proceed.
        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();

        // Step 2: fetch the real code from the inbox and submit it.
        const code = await requestAndWaitForOtp(user.email);
        await twoFactorPage.submitCode(code);

        // Step 3: authenticated landing.
        await appShell.expectAuthenticated();

        // Step 4: the session is actually persisted. On localhost the web SDK
        // stores it in localStorage (cookieFallback) rather than a first-party
        // cookie, so that is the artifact we assert.
        const stored = await page.evaluate(
            (key) => window.localStorage.getItem(key),
            SESSION_STORAGE_KEY,
        );
        expect(stored).toContain(sessionCookieName());
        expect(stored).toMatch(/a_session_[^"]+":"[^"]+"/); // has a non-empty secret
    });
});
