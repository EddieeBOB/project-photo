import { test, expect, requireAdmin } from '../fixtures/test';
import { SESSION_STORAGE_KEY } from '../config';

/**
 * LIFECYCLE 4 — RECOVERY / EDGE CASES
 *
 * Recovery/backup-code cases are out of scope (this flow has no recovery codes;
 * see 01-enrollment). What remains: disabling 2FA, and session behaviour when the
 * user stalls between the password and OTP steps.
 */
test.describe('Edge cases', () => {
    requireAdmin();

    test('an authenticated user can disable 2FA from settings', async ({
        page,
        userFactory,
        admin,
        seedAuth,
        accountPage,
    }) => {
        // NOTE: an admin-minted session for an *MFA-enabled* user is only a
        // partial session (Appwrite still demands the second factor), so we can't
        // seed straight into an mfa:true account without the OTP. Instead we seed
        // a full session on an mfa:OFF user and enable 2FA in-session (the app's
        // real enrollment path keeps the session valid), then disable it — which
        // is exactly the "authenticated user turns 2FA off" scenario.
        const user = await userFactory.create({ tag: 'disable', verified: true, mfa: false });
        await seedAuth(user.id);

        await accountPage.goto();
        await accountPage.enable();
        await accountPage.expectEnabled();
        expect(await admin.isMfaEnabled(user.id)).toBe(true);

        await accountPage.disable();
        await accountPage.expectDisabled();

        // Appwrite confirms it's off.
        expect(await admin.isMfaEnabled(user.id)).toBe(false);

        // QA note (documented behaviour gap): the current implementation disables
        // 2FA via a single toggle with NO re-authentication or current-code
        // challenge. The spec expects a re-auth gate here; the app does not have
        // one. We assert the real behaviour and flag the gap so it's not lost:
        // no code/password prompt appears during disable.
        await expect(page.getByLabel('Verification code')).toHaveCount(0);
    });

    test('losing the partial session between password and OTP forces a restart', async ({
        page,
        userFactory,
        loginPage,
        twoFactorPage,
    }) => {
        const user = await userFactory.create({ tag: 'expiry', verified: true, mfa: true });

        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();

        // Simulate the partial session/challenge expiring while the user is idle
        // on the OTP step by dropping the persisted session. (A true time-based
        // expiry would require waiting out Appwrite's challenge TTL; see the
        // opt-in slow variant below.)
        await page.evaluate((key) => window.localStorage.removeItem(key), SESSION_STORAGE_KEY);

        // Submitting now has no session to attach the challenge to -> rejected.
        await twoFactorPage.submitCode('123456');
        await twoFactorPage.expectError();

        // Reloading login drops the user back to the password step: a clean restart,
        // not a wedged/blank page.
        await loginPage.goto();
        await loginPage.expectPasswordStep();
    });

    // Opt-in: exercise the REAL challenge TTL instead of simulating it. Enable
    // with E2E_2FA_REAL_EXPIRY=<seconds> (e.g. the project's challenge lifetime).
    test('real challenge TTL expiry rejects a late code', async ({
        userFactory,
        loginPage,
        twoFactorPage,
    }) => {
        test.skip(!process.env.E2E_2FA_REAL_EXPIRY, 'Set E2E_2FA_REAL_EXPIRY=<seconds> to run the slow real-TTL check.');
        const waitSec = Number(process.env.E2E_2FA_REAL_EXPIRY);
        test.setTimeout((waitSec + 60) * 1000);

        const user = await userFactory.create({ tag: 'ttl', verified: true, mfa: true });
        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();

        await new Promise((r) => setTimeout(r, waitSec * 1000));

        await twoFactorPage.submitCode('654321');
        await twoFactorPage.expectError();
        await twoFactorPage.expectStillOnStep();
    });
});
