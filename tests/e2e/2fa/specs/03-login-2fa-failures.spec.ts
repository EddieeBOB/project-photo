import { test, expect, requireAdmin } from '../fixtures/test';
import { requestAndWaitForOtp, otpReaderAvailable, OTP_SKIP_REASON } from '../fixtures/otp';

/**
 * LIFECYCLE 3 — LOGIN WITH 2FA (FAILURE PATHS)
 *
 * Most of these need no email reader: they submit wrong/garbage codes and assert
 * the app keeps the user gated. Only the "old code is rejected" case needs a real
 * code and is gated behind requireOtpReader.
 */
test.describe('Login with 2FA — failure paths', () => {
    requireAdmin();

    test('wrong password: error shown, no 2FA prompt', async ({
        userFactory,
        loginPage,
    }) => {
        const user = await userFactory.create({ tag: 'wrongpw', verified: true, mfa: true });

        await loginPage.goto();
        await loginPage.submitCredentials(user.email, 'Definitely-Wrong-1');

        await loginPage.expectError(/invalid/i);
        // Critically: the password never validated, so the 2FA step must NOT show.
        await loginPage.expectPasswordStep();
    });

    test('correct password, wrong code: clear error, stays on 2FA step', async ({
        userFactory,
        loginPage,
        twoFactorPage,
    }) => {
        const user = await userFactory.create({ tag: 'wrongotp', verified: true, mfa: true });

        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();

        await twoFactorPage.submitCode('000000');

        await twoFactorPage.expectError();
        await twoFactorPage.expectStillOnStep();
    });

    test('correct password, empty code: native validation blocks submit, no bypass', async ({
        page,
        userFactory,
        loginPage,
        twoFactorPage,
    }) => {
        const user = await userFactory.create({ tag: 'emptyotp', verified: true, mfa: true });

        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();

        await twoFactorPage.tryEmptySubmit();

        // The field is `required`; submission is blocked and we never navigate.
        await twoFactorPage.expectCodeRequired();
        await twoFactorPage.expectStillOnStep();
        await expect(page).not.toHaveURL(/\/studio$/);
    });

    test('repeated wrong codes are always rejected, never bypassed', async ({
        page,
        userFactory,
        loginPage,
        twoFactorPage,
    }, testInfo) => {
        const user = await userFactory.create({ tag: 'ratelimit', verified: true, mfa: true });

        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();

        // Observe whether the project throttles (429) on the MFA challenge route.
        // This is project-config dependent, so it's recorded as information — not
        // asserted — to keep the test reliable and avoid hammering a shared IP.
        let sawRateLimit = false;
        page.on('response', (res) => {
            if (res.status() === 429 && /mfa\/challenge/i.test(res.url())) sawRateLimit = true;
        });

        // The security invariant we CAN guarantee: every wrong code is rejected
        // and the user is never let through, no matter how many attempts.
        for (let attempt = 0; attempt < 8; attempt++) {
            await twoFactorPage.submitCode(String(100000 + attempt));
            await twoFactorPage.expectError();
            await twoFactorPage.expectStillOnStep();
            if (sawRateLimit) break;
        }

        await expect(page).not.toHaveURL(/\/studio$/);
        testInfo.annotations.push({
            type: 'rate-limit-429-observed',
            description: String(sawRateLimit),
        });
    });

    test('a previously-used OTP is rejected on a later login', async ({
        userFactory,
        loginPage,
        twoFactorPage,
        appShell,
    }) => {
        test.skip(!otpReaderAvailable(), OTP_SKIP_REASON);
        test.setTimeout(180_000); // two real OTP fetches
        const user = await userFactory.create({ tag: 'reuse', verified: true, mfa: true });

        // First login: capture and consume a real code.
        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();
        const usedCode = await requestAndWaitForOtp(user.email);
        await twoFactorPage.submitCode(usedCode);
        await appShell.expectAuthenticated();

        // Log out, start a fresh login (which issues a brand-new challenge).
        await appShell.logout();
        await loginPage.goto();
        await loginPage.submitCredentials(user.email, user.password);
        await loginPage.expectMfaPrompt();

        // The old code belongs to a consumed challenge — it must be rejected.
        await twoFactorPage.submitCode(usedCode);
        await twoFactorPage.expectError();
        await twoFactorPage.expectStillOnStep();

        // And a fresh code still works, proving the account isn't wedged.
        const freshCode = await requestAndWaitForOtp(user.email);
        await twoFactorPage.submitCode(freshCode);
        await appShell.expectAuthenticated();
    });
});
