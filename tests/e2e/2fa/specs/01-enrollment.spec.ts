import { test, expect, requireAdmin } from '../fixtures/test';

/**
 * LIFECYCLE 1 — SETUP / ENROLLMENT
 *
 * A verified user with 2FA off logs in normally (no OTP is demanded yet), goes
 * to security settings, and turns 2FA on. We assert enrollment both in the UI
 * and against Appwrite (the source of truth).
 *
 * Note on scope: this app's email-OTP 2FA does NOT issue one-time backup/recovery
 * codes, and enrollment is a single toggle with no separate confirmation step —
 * so the spec's "backup codes shown once" case has no surface to test. It is
 * documented as a deliberate gap via test.fixme below rather than silently
 * dropped. (Recovery-code coverage was descoped per project decision.)
 */
test.describe('Enrollment', () => {
    requireAdmin();

    test('a verified user with no 2FA logs in without an OTP prompt', async ({
        userFactory,
        loginPage,
        appShell,
    }) => {
        const user = await userFactory.create({ tag: 'enroll', verified: true, mfa: false });

        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);

        // No second factor is configured, so login completes straight through.
        await appShell.expectAuthenticated();
    });

    test('enabling 2FA in security settings enrolls the email factor', async ({
        userFactory,
        admin,
        loginPage,
        accountPage,
        appShell,
    }) => {
        const user = await userFactory.create({ tag: 'enroll-on', verified: true, mfa: false });

        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await appShell.expectAuthenticated();

        await accountPage.goto();
        await accountPage.expectDisabled();
        await accountPage.enable();
        await accountPage.expectEnabled();

        // Appwrite itself must now report MFA enabled for this account.
        expect(await admin.isMfaEnabled(user.id)).toBe(true);
    });

    // Documented gap: no one-time recovery/backup codes exist in this flow.
    // See the file header. Enable this once such a feature is built.
    test.fixme(
        'shows one-time backup/recovery codes exactly once on enrollment',
        async () => {
            // The email-OTP flow does not generate recovery codes and the UI has
            // no place to display them, so there is nothing to assert yet.
        },
    );
});
