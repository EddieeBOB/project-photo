import { account } from '../lib/appwrite';
import { AuthenticationFactor } from 'appwrite';

/**
 * Centralized auth helpers for email verification,
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
/* Session helpers                                                     */
/* ------------------------------------------------------------------ */

/** Best-effort deletion of the current (possibly partial) session. */
export async function abortPartialSession(): Promise<void> {
    try {
        await account.deleteSession({ sessionId: 'current' });
    } catch {
        /* no active session — nothing to clear */
    }
}

/* ------------------------------------------------------------------ */
/* "Remember me" auto-login gating                                     */
/* ------------------------------------------------------------------ */

/*
 * Appwrite persists the session in localStorage, so on its own it would auto-
 * resume indefinitely. These helpers gate that auto-resume:
 *   - "Remember me" checked  -> resume for up to 30 days.
 *   - unchecked              -> resume only within the same browser session
 *                               (ends when the browser is fully closed).
 */

const REMEMBER_EXPIRY_KEY = 'auth.rememberExpiry';
const SESSION_ACTIVE_KEY = 'auth.sessionActive';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Records the user's "remember me" choice at login time. */
export function setRememberPreference(remember: boolean): void {
    if (remember) {
        localStorage.setItem(REMEMBER_EXPIRY_KEY, String(Date.now() + THIRTY_DAYS_MS));
    } else {
        localStorage.removeItem(REMEMBER_EXPIRY_KEY);
    }
    // Marks the current browser session as active. sessionStorage is cleared
    // when the browser/tab is closed, which is how we detect a fresh start.
    sessionStorage.setItem(SESSION_ACTIVE_KEY, '1');
}

/** Clears remember-me state (call on logout). */
export function clearRememberPreference(): void {
    localStorage.removeItem(REMEMBER_EXPIRY_KEY);
    sessionStorage.removeItem(SESSION_ACTIVE_KEY);
}

/**
 * Whether a persisted Appwrite session is still allowed to auto-resume.
 * True within the 30-day window when "remember me" was checked, or within the
 * same browser session otherwise.
 */
export function isAutoLoginAllowed(): boolean {
    const expiryRaw = localStorage.getItem(REMEMBER_EXPIRY_KEY);
    if (expiryRaw) {
        return Date.now() < Number(expiryRaw);
    }
    return sessionStorage.getItem(SESSION_ACTIVE_KEY) === '1';
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