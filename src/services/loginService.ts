import { account, functions } from "../lib/appwrite";
import { loginResolverFunctionId } from "../lib/config";
import { isMfaRequired, abortPartialSession } from "./authService";

const BAD_CREDENTIALS = "Invalid username or password.";

export interface LoginResult {
    /** True when a second factor (email OTP) is still required to finish login. */
    mfaRequired: boolean;
}

/**
 * Resolves a username to the account email behind it.
 *
 * The mapping is deliberately not queryable from the browser — that would
 * expose every user's email — so the `login-resolver` function verifies the
 * password server-side and returns only the caller's own email.
 *
 * Every failure looks the same from here, whether the username was wrong, the
 * password was wrong, or the function was unreachable: telling them apart would
 * tell an attacker which usernames exist.
 */
async function resolveUsernameToEmail(username: string, password: string): Promise<string> {
    let email: string | undefined;

    try {
        const execution = await functions.createExecution({
            functionId: loginResolverFunctionId,
            body: JSON.stringify({ username, password }),
        });

        if (execution.responseStatusCode === 200) {
            email = JSON.parse(execution.responseBody || '{}').email;
        }
    } catch (error) {
        console.error("Username login resolution failed:", error);
        throw new Error(BAD_CREDENTIALS, { cause: error });
    }

    if (!email) throw new Error(BAD_CREDENTIALS);
    return email;
}

export async function handleLogin(username: string, password: string): Promise<LoginResult> {
    const email = username.includes('@') ? username : await resolveUsernameToEmail(username, password);

    // Clear any lingering session (e.g. a partial session left behind by an
    // abandoned MFA attempt) so creating a fresh session can't fail with
    // "session already active".
    await abortPartialSession();

    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (error) {
        console.error("Login failed:", error);
        const err = error as { code?: number; type?: string };
        if (err.code === 401 || err.type === 'user_invalid_credentials') {
            throw new Error(BAD_CREDENTIALS, { cause: error });
        }
        throw new Error("Login failed. Please try again later.", { cause: error });
    }

    // A session now exists, but it may be a partial session pending a second
    // factor. If so, the caller must complete an MFA challenge before the
    // session is usable.
    return { mfaRequired: await isMfaRequired() };
}
