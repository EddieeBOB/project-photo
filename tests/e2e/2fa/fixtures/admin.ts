import { ENDPOINT, PROJECT, API_KEY, TEST_PASSWORD, buildTestEmail } from '../config';

/**
 * Server-side (admin) helpers for the "set up state without the UI" path: create
 * a clean user, mark its email verified, toggle MFA, mint a session (bypassing
 * MFA) to seed an authenticated browser, and delete the user in teardown.
 *
 * We talk to Appwrite's REST API with native fetch instead of the node-appwrite
 * SDK on purpose: node-appwrite@17 bundles an HTTP agent (node-fetch-native-
 * with-agent / undici) that throws "invalid onError method" on Node 22+/26. The
 * REST surface is tiny and stable, so this is both simpler and more robust.
 * Endpoints/methods verified against the installed SDK's compiled output.
 */

export interface TestUser {
    id: string;
    email: string;
    password: string;
}

export interface CreateUserOptions {
    tag?: string;
    /** Mark the email verified (required before MFA can be enabled). Default true. */
    verified?: boolean;
    /** Enable email MFA so login demands a second factor. Default false. */
    mfa?: boolean;
    password?: string;
}

/** Appwrite-safe unique id: starts with a letter, only [a-z0-9], <= 36 chars. */
function uniqueId(): string {
    return `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 36);
}

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    if (!ENDPOINT || !PROJECT || !API_KEY) {
        // Should never hit this: suites gate on ADMIN_READY before using admin.
        throw new Error('Appwrite admin credentials missing (ENDPOINT/PROJECT/API_KEY).');
    }
    const res = await fetch(`${ENDPOINT}${path}`, {
        method,
        headers: {
            'content-type': 'application/json',
            'x-appwrite-project': PROJECT,
            'x-appwrite-key': API_KEY,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
        const message = (data as { message?: string })?.message ?? text ?? `${res.status}`;
        throw new Error(`Appwrite ${method} ${path} failed (${res.status}): ${message}`);
    }
    return data as T;
}

export class AdminApi {
    /** Create an ephemeral test user, optionally pre-verified and MFA-enabled. */
    async createUser(opts: CreateUserOptions = {}): Promise<TestUser> {
        const { tag, verified = true, mfa = false, password = TEST_PASSWORD } = opts;
        const email = buildTestEmail(tag);
        const id = uniqueId();

        await call('POST', '/users', {
            userId: id,
            email,
            password,
            name: tag ? `e2e ${tag}` : 'e2e user',
        });

        // Order matters: the email factor only becomes available once the email
        // is verified, so verify before enabling MFA.
        if (verified) await call('PATCH', `/users/${id}/verification`, { emailVerification: true });
        if (mfa) await call('PATCH', `/users/${id}/mfa`, { mfa: true });

        return { id, email, password };
    }

    async setMfa(userId: string, enabled: boolean): Promise<void> {
        await call('PATCH', `/users/${userId}/mfa`, { mfa: enabled });
    }

    /** Read the user's current MFA flag straight from Appwrite (source of truth). */
    async isMfaEnabled(userId: string): Promise<boolean> {
        const user = await call<{ mfa?: boolean }>('GET', `/users/${userId}`);
        return Boolean(user.mfa);
    }

    /**
     * Mint a session for the user and return its secret, for seeding an
     * authenticated browser in tests not exercising the login OTP.
     *
     * IMPORTANT: this only yields a *full* session for users with MFA disabled.
     * For an MFA-enabled user Appwrite returns a partial session (account.get()
     * then fails with "more factors required"), so seed on an mfa:false user and,
     * if needed, enable MFA in-session through the UI.
     */
    async createSessionSecret(userId: string): Promise<string> {
        const session = await call<{ secret?: string }>('POST', `/users/${userId}/sessions`);
        if (!session.secret) throw new Error('createSession returned no secret');
        return session.secret;
    }

    /** Best-effort delete. Never throws so it is safe in teardown. */
    async deleteUser(userId: string): Promise<void> {
        try {
            await call('DELETE', `/users/${userId}`);
        } catch {
            /* already gone / transient — teardown is best-effort */
        }
    }
}
