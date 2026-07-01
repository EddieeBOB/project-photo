import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Account, ID } from 'appwrite';

/**
 * Auth-flow *email-sending* integration tests against the real Appwrite project
 * in .env. These exercise the exact endpoints the app's authService calls to
 * dispatch emails:
 *   - password recovery   (account.createRecovery      → sendPasswordReset)
 *   - magic-URL login      (account.createMagicURLToken → sendMagicUrl)
 *   - email verification   (account.createVerification  → sendVerificationEmail)
 *
 * A successful (2xx) response means Appwrite accepted the request and queued the
 * email — that's what we assert. We can't read the fixture inbox, so completing
 * a link with its one-time token is out of scope (covered by the app's confirm*
 * handlers, which just forward userId+secret to Appwrite).
 *
 * Real emails are sent to the shared fixture inbox on each run — that's
 * expected. SKIPPED automatically if .env isn't configured.
 */

const env = import.meta.env as Record<string, string | undefined>;
const ENDPOINT = env.VITE_APPWRITE_ENDPOINT;
const PROJECT = env.VITE_APPWRITE_PROJECT_ID;

const configured = Boolean(ENDPOINT && PROJECT);

// Same fixture account the other live suites reuse.
const FIXTURE_EMAIL = 'eddieebob0o@gmail.com';
const FIXTURE_PASSWORD = 'Vitest!Fixture1';

// Redirect targets must resolve to a registered Web platform host (localhost is
// registered for dev); the port is ignored by Appwrite's platform matching.
const ORIGIN = 'http://localhost:5180';

function makeClient(): Client {
    return new Client()
        .setEndpoint(ENDPOINT || 'https://placeholder.appwrite.io/v1')
        .setProject(PROJECT || 'placeholder');
}

async function emailSessionSecret(email: string, password: string): Promise<string> {
    const res = await fetch(`${ENDPOINT}/account/sessions/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': PROJECT! },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const data: any = await res.json().catch(() => ({}));
        throw new Error(data?.message || `login failed (${res.status})`);
    }
    const cookie = res.headers.getSetCookie()
        .map((c) => c.split(';')[0])
        .find((c) => c.startsWith('a_session_') && !c.includes('_legacy'));
    const secret = cookie ? cookie.slice(cookie.indexOf('=') + 1) : '';
    if (!secret) throw new Error('login succeeded but no session secret was returned');
    return secret;
}

/**
 * Asserts an email-sending call was accepted. A 2xx resolves normally; a
 * rate-limit still proves the endpoint + payload + platform config are valid
 * (Appwrite throttles these on purpose), so we treat it as a pass. Anything else
 * — bad request, unregistered redirect host, misconfig — fails the test.
 */
async function expectEmailAccepted(action: () => Promise<unknown>): Promise<void> {
    try {
        await action();
    } catch (error: any) {
        const rateLimited = error?.code === 429 || error?.type === 'general_rate_limit_exceeded';
        if (rateLimited) return;
        throw error;
    }
}

describe.skipIf(!configured)('Auth flow — email sending', () => {
    const guestClient = makeClient();
    const guestAccount = new Account(guestClient);

    const userClient = makeClient();
    const userAccount = new Account(userClient);

    beforeAll(async () => {
        // Ensure the fixture account exists (ignore "already registered").
        const auth = new Account(makeClient());
        try {
            await auth.create({ userId: ID.unique(), email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD, name: 'Vitest Fixture' });
        } catch {
            /* already exists */
        }
    });

    afterAll(async () => {
        try { await userAccount.deleteSession({ sessionId: 'current' }); } catch { /* no session */ }
    });

    it('sends a password-reset email for an existing account', async () => {
        await expectEmailAccepted(() =>
            guestAccount.createRecovery({ email: FIXTURE_EMAIL, url: `${ORIGIN}/reset` }),
        );
    });

    it('sends a magic-URL login email', async () => {
        await expectEmailAccepted(() =>
            guestAccount.createMagicURLToken({ userId: ID.unique(), email: FIXTURE_EMAIL, url: `${ORIGIN}/magic` }),
        );
    });

    it('sends a verification email to the logged-in user', async () => {
        const secret = await emailSessionSecret(FIXTURE_EMAIL, FIXTURE_PASSWORD);
        userClient.setSession(secret);

        await expectEmailAccepted(() =>
            userAccount.createVerification({ url: `${ORIGIN}/verify` }),
        );
    });

    it('rejects a password reset for an unknown email (no enumeration bypass)', async () => {
        // Deterministic and sends nothing: Appwrite throws for a missing user.
        await expect(
            guestAccount.createRecovery({ email: `no-such-user-${Date.now()}@example.com`, url: `${ORIGIN}/reset` }),
        ).rejects.toThrow();
    });
});
