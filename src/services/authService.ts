import { account, tablesDB, ID } from '../lib/appwrite';
import { AuthenticationFactor } from 'appwrite';
import { ownerPermissions } from '../lib/permissions';

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

/**
 * Centralized auth helpers for email verification, magic-URL login,
 * password recovery, and email-based MFA (2FA).
 *
 * Redirect URLs are built from the current origin. Every hostname used here
 * (e.g. http://localhost:5173 in dev and your production domain) must be added
 * as a Web platform in the Appwrite Console, otherwise Appwrite rejects the
 * redirect to prevent open-redirect attacks.
 */

const origin = () => window.location.origin;

/* ------------------------------------------------------------------ */
/* Email verification                                                  */
/* ------------------------------------------------------------------ */

/** Sends a verification email to the currently logged-in user. */
export async function sendVerificationEmail(): Promise<void> {
    await account.createVerification({ url: `${origin()}/verify` });
}

/** Completes verification using the userId + secret from the email link. */
export async function confirmVerification(userId: string, secret: string): Promise<void> {
    await account.updateVerification({ userId, secret });
}

/* ------------------------------------------------------------------ */
/* Magic URL (passwordless) login                                      */
/* ------------------------------------------------------------------ */

/** Emails a magic login link. Creates the account if the email is new. */
export async function sendMagicUrl(email: string): Promise<void> {
    await account.createMagicURLToken({
        userId: ID.unique(),
        email,
        url: `${origin()}/magic`,
    });
}

/** Completes magic-URL login using userId + secret from the link. */
export async function completeMagicUrl(userId: string, secret: string): Promise<void> {
    // Clear any pre-existing session so creating the new one can't fail with
    // "session already active" (e.g. when the link is opened while logged in).
    await abortPartialSession();
    await account.createSession({ userId, secret });
    // Magic-URL login can create a brand-new account; make sure it has the
    // `users` profile row the rest of the app relies on.
    await ensureUserProfile();
}

/**
 * Ensures the authenticated user has a `users` table row. Signup creates this
 * row, but magic-URL login can mint a brand-new account without one, leaving
 * the app with a null profile and a dangling gallery->users relationship.
 */
export async function ensureUserProfile(): Promise<void> {
    const me = await account.get();
    try {
        await tablesDB.getRow({ databaseId, tableId: 'users', rowId: me.$id });
        return; // Profile already exists.
    } catch {
        // No row yet — fall through and create it.
    }
    try {
        await tablesDB.createRow({
            databaseId,
            tableId: 'users',
            rowId: me.$id,
            // `name` is empty for magic-URL accounts; the email is guaranteed
            // unique, which keeps the unique username index happy.
            data: { email: me.email, username: me.name?.trim() || me.email },
            permissions: ownerPermissions(me.$id, true),
        });
    } catch (error) {
        console.error('Failed to create user profile row:', error);
    }
}

/** Best-effort deletion of the current (possibly partial) session. */
export async function abortPartialSession(): Promise<void> {
    try {
        await account.deleteSession({ sessionId: 'current' });
    } catch {
        /* no active session — nothing to clear */
    }
}

/* ------------------------------------------------------------------ */
/* Password recovery                                                   */
/* ------------------------------------------------------------------ */

/** Emails a password-reset link. */
export async function sendPasswordReset(email: string): Promise<void> {
    await account.createRecovery({ email, url: `${origin()}/reset` });
}

/** Completes a password reset using userId + secret from the email link. */
export async function confirmPasswordReset(userId: string, secret: string, password: string): Promise<void> {
    await account.updateRecovery({ userId, secret, password });
}

/* ------------------------------------------------------------------ */
/* MFA (email-based 2FA)                                               */
/* ------------------------------------------------------------------ */

/** Enables or disables MFA on the current account. */
export async function setMfaEnabled(enabled: boolean): Promise<void> {
    await account.updateMFA({ mfa: enabled });
}

/** Returns which MFA factors are available for the current account. */
export async function listFactors() {
    return account.listMFAFactors();
}

/**
 * Starts an email MFA challenge (sends the one-time code) and returns the
 * challenge id needed to complete it.
 */
export async function startEmailMfaChallenge(): Promise<string> {
    const challenge = await account.createMFAChallenge({ factor: AuthenticationFactor.Email });
    return challenge.$id;
}

/** Completes an MFA challenge with the one-time code. */
export async function completeMfaChallenge(challengeId: string, otp: string): Promise<void> {
    await account.updateMFAChallenge({ challengeId, otp });
}

/**
 * Detects whether the current (partial) session still needs a second factor.
 * Appwrite signals this by throwing `user_more_factors_required` from
 * `account.get()` until the MFA challenge is completed.
 */
export async function isMfaRequired(): Promise<boolean> {
    try {
        await account.get();
        return false;
    } catch (error: any) {
        if (error?.type === 'user_more_factors_required') {
            return true;
        }
        throw error;
    }
}