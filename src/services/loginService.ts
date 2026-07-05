import { account, client } from "../lib/appwrite";
import { Functions } from "appwrite";
import { isMfaRequired, abortPartialSession } from "./authService";

const functions = new Functions(client);

export interface LoginResult {
    /** True when a second factor (email OTP) is still required to finish login. */
    mfaRequired: boolean;
}

export async function handleLogin(username: string, password: string): Promise<LoginResult> {
    let email = username;

    // If the user typed a username (not an email), resolve it to their account
    // email via the `login-resolver` function. The mapping is deliberately not
    // queryable from the browser — that would expose every user's email — so the
    // function verifies the password server-side and returns only the caller's
    // own email, which we use to open the real session below.
    if (!username.includes('@')) {
        try {
            const execution = await functions.createExecution({
                functionId: import.meta.env.VITE_APPWRITE_LOGIN_FN_ID,
                body: JSON.stringify({ username, password }),
            });
            const resolved = JSON.parse(execution.responseBody || '{}');
            if (execution.responseStatusCode !== 200 || !resolved.email) {
                throw new Error("Invalid username or password.");
            }
            email = resolved.email;
        } catch (error: any) {
            if (error.message === "Invalid username or password.") {
                throw error;
            }
            console.error("Username login resolution failed:", error);
            throw new Error("Invalid username or password.");
        }
    }

    // Clear any lingering session (e.g. a partial session left behind by an
    // abandoned MFA attempt) so creating a fresh session can't fail with
    // "session already active".
    await abortPartialSession();

    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (error: any) {
        console.error("Login failed:", error);
        const code = error?.code ?? error?.type;
        if (code === 401 || error?.type === 'user_invalid_credentials') {
            throw new Error("Invalid username or password.");
        }
        throw new Error("Login failed. Please try again later.");
    }

    // A session now exists, but it may be a partial session pending a second
    // factor. If so, the caller must complete an MFA challenge before the
    // session is usable.
    const mfaRequired = await isMfaRequired();
    return { mfaRequired };
}