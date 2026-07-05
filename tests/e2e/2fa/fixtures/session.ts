import type { BrowserContext } from '@playwright/test';
import { PROJECT, SESSION_STORAGE_KEY } from '../config';

/**
 * Seed an authenticated browser WITHOUT driving the login UI.
 *
 * The Appwrite web SDK (v25) can't set a first-party session cookie when the API
 * lives on a different origin than the app (the localhost dev case), so it falls
 * back to localStorage: it reads/writes the session from
 *   localStorage['cookieFallback'] = {"a_session_<projectId>":"<secret>"}
 * and replays it as the `X-Fallback-Cookies` header (see sdk.js). We write that
 * exact shape so account.get() succeeds on first load.
 *
 * We ALSO satisfy the app's "remember me" auto-resume gate (authService.ts):
 * AuthContext deletes any session that isn't within the remember window, so we
 * set auth.rememberExpiry ~30 days out. Without this the seeded session would be
 * torn down on the first checkAuth().
 *
 * addInitScript runs before app JS on every navigation, so call this once per
 * context before page.goto().
 */
export async function seedSession(context: BrowserContext, secret: string): Promise<void> {
    const fallback = JSON.stringify({ [`a_session_${PROJECT}`]: secret });
    const rememberExpiry = String(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await context.addInitScript(
        ([storageKey, fallbackValue, expiry]) => {
            try {
                window.localStorage.setItem(storageKey, fallbackValue);
                window.localStorage.setItem('auth.rememberExpiry', expiry);
            } catch {
                /* storage may be unavailable on about:blank — ignored */
            }
        },
        [SESSION_STORAGE_KEY, fallback, rememberExpiry] as const,
    );
}

/** Read the session secret currently persisted in the page's localStorage, if any. */
export async function readSessionSecret(context: BrowserContext): Promise<string | null> {
    const pages = context.pages();
    if (pages.length === 0) return null;
    return pages[0].evaluate(
        ([storageKey, project]) => {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return null;
            try {
                const parsed = JSON.parse(raw) as Record<string, string>;
                return parsed[`a_session_${project}`] ?? null;
            } catch {
                return null;
            }
        },
        [SESSION_STORAGE_KEY, PROJECT] as const,
    );
}
