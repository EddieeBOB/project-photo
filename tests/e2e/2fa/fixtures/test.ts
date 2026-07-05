import { test as base, expect } from '@playwright/test';
import { AdminApi, type TestUser, type CreateUserOptions } from './admin';
import { seedSession } from './session';
import { LoginPage } from '../pages/LoginPage';
import { TwoFactorPage } from '../pages/TwoFactorPage';
import { AccountSecurityPage } from '../pages/AccountSecurityPage';
import { AppShell } from '../pages/AppShell';
import { ADMIN_READY, ADMIN_SKIP_REASON } from '../config';
import { otpReaderAvailable, otpReaderReachable, OTP_SKIP_REASON } from './otp';

/**
 * Custom Playwright fixtures for the 2FA suite.
 *
 *   admin        — server-SDK helper (create/verify/mfa/session/delete users)
 *   userFactory  — creates users on demand; deletes ALL of them after the test
 *   seedAuth     — logs a user in without the UI (admin session -> localStorage)
 *   loginPage / twoFactorPage / accountPage / appShell — Page Objects
 *
 * userFactory is per-test scoped so every test starts from a clean, uniquely
 * addressed user and leaves no residue in the (shared, prod) Appwrite project.
 */
interface Fixtures {
    admin: AdminApi;
    userFactory: { create(opts?: CreateUserOptions): Promise<TestUser> };
    seedAuth: (userId: string) => Promise<void>;
    loginPage: LoginPage;
    twoFactorPage: TwoFactorPage;
    accountPage: AccountSecurityPage;
    appShell: AppShell;
}

export const test = base.extend<Fixtures>({
    admin: async ({}, use) => {
        await use(new AdminApi());
    },

    userFactory: async ({ admin }, use) => {
        const created: string[] = [];
        await use({
            async create(opts?: CreateUserOptions) {
                const user = await admin.createUser(opts);
                created.push(user.id);
                return user;
            },
        });
        // Teardown: delete every user this test created. Best-effort, never throws.
        for (const id of created) await admin.deleteUser(id);
    },

    seedAuth: async ({ admin, context }, use) => {
        await use(async (userId: string) => {
            const secret = await admin.createSessionSecret(userId);
            await seedSession(context, secret);
        });
    },

    loginPage: async ({ page }, use) => use(new LoginPage(page)),
    twoFactorPage: async ({ page }, use) => use(new TwoFactorPage(page)),
    accountPage: async ({ page }, use) => use(new AccountSecurityPage(page)),
    appShell: async ({ page }, use) => use(new AppShell(page)),
});

export { expect };

/**
 * Skip an entire describe block unless the Appwrite admin path is configured.
 * Call at the top of a describe body; implemented via beforeEach so the skip
 * reliably applies to every test in the group.
 */
export function requireAdmin(): void {
    test.beforeEach(() => {
        test.skip(!ADMIN_READY, ADMIN_SKIP_REASON);
    });
}

/**
 * Additionally skip unless a live email-OTP reader is available (local + manual).
 * Use for describe groups whose tests must submit a genuinely valid code.
 */
export function requireOtpReader(): void {
    test.beforeEach(async () => {
        // Skip fast if no mode is configured; otherwise verify the reader is
        // actually reachable (e.g. Mailpit REST is up) so a mis-wired stack
        // skips with the reason instead of failing on every OTP wait.
        test.skip(!otpReaderAvailable(), OTP_SKIP_REASON);
        test.skip(!(await otpReaderReachable()), OTP_SKIP_REASON);
    });
}
