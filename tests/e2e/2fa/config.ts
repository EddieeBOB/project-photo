import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Central configuration for the 2FA E2E suite.
 *
 * Values are read from (in order of precedence):
 *   1. process.env         — how CI / npm scripts inject secrets
 *   2. `.env.e2e.local`    — local-stack overrides (local Appwrite project id +
 *                            server key + MAILPIT_URL). Gitignored (`*.local`).
 *   3. the repo-root `.env` — how the app + dev server are already configured
 *                             (defaults to the real Appwrite Cloud project)
 *
 * So a plain run targets Appwrite Cloud; dropping a `.env.e2e.local` flips the
 * whole suite onto the local Appwrite+Mailpit stack with no code change.
 *
 * Playwright's Node context does not auto-load these (only the Vite dev server
 * does), so we parse them ourselves, matching the pattern already used by
 * tests/e2e/utils/appwrite.ts. No extra dependency.
 */
function parseDotEnv(path: string): Record<string, string> {
    const out: Record<string, string> = {};
    let raw = '';
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        return out;
    }
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        // Keys in this .env sometimes have a trailing space (e.g. "FOO ="), so trim.
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

function loadDotEnv(): Record<string, string> {
    const here = dirname(fileURLToPath(import.meta.url));
    const root = resolve(here, '../../..');
    // Later spreads win: the suite-local .env.e2e.local overrides the app's .env.
    const merged = {
        ...parseDotEnv(resolve(root, '.env')),
        ...parseDotEnv(resolve(here, '.env.e2e.local')),
    };
    // Publish anything not already in the environment so:
    //   - sibling modules that read process.env directly (fixtures/mailpit.ts ->
    //     MAILPIT_URL) stay in sync, and
    //   - the Vite dev server that Playwright spawns inherits the VITE_* vars
    //     (Vite prioritises process.env VITE_* over .env). This is why the app
    //     points at local Appwrite even though .env.e2e.local lives under tests/
    //     where Vite would not otherwise load it — see playwright.e2e.config.ts.
    for (const [k, v] of Object.entries(merged)) {
        if (process.env[k] === undefined) process.env[k] = v;
    }
    return merged;
}

const file = loadDotEnv();
const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
        if (process.env[k]) return process.env[k];
        if (file[k]) return file[k];
    }
    return undefined;
};

export const ENDPOINT = pick('APPWRITE_ENDPOINT', 'VITE_APPWRITE_ENDPOINT');
export const PROJECT = pick('APPWRITE_PROJECT_ID', 'VITE_APPWRITE_PROJECT_ID');

/**
 * Appwrite *server* API key. Never committed. Provide it via a gitignored `.env`
 * (`APPWRITE_API_KEY=...`) locally, or a GitHub Actions secret in CI.
 * It needs the `users.read` and `users.write` scopes so the suite can create,
 * verify, enable-MFA-for, seed-sessions-for, and delete test users.
 */
export const API_KEY = pick('APPWRITE_API_KEY');

/**
 * The web SDK persists a session in localStorage under this exact shape:
 *   localStorage['cookieFallback'] = {"a_session_<projectId>":"<secret>"}
 * (see node_modules/appwrite sdk.js). We reuse the same key to seed an
 * authenticated browser without driving the UI. See fixtures/session.ts.
 */
export const SESSION_STORAGE_KEY = 'cookieFallback';
export const sessionCookieName = () => `a_session_${PROJECT}`;

/**
 * Base inbox that receives every test user's email OTP. We use Gmail
 * plus-addressing so a single real inbox catches all of them:
 *   eddieebob0o+2fa-<run>@gmail.com  ->  eddieebob0o@gmail.com
 * Override with E2E_2FA_INBOX to point at a different mailbox.
 */
export const INBOX_BASE = pick('E2E_2FA_INBOX') ?? 'eddieebob0o@gmail.com';

/** Strong password reused for all ephemeral test users. */
export const TEST_PASSWORD = pick('E2E_2FA_PASSWORD') ?? 'E2e!Fixture-2fa-9Q';

/** Whether the admin (server-SDK) path is usable. Suites skip themselves if not. */
export const ADMIN_READY = Boolean(ENDPOINT && PROJECT && API_KEY);

export const ADMIN_SKIP_REASON =
    'Appwrite admin not configured. Set APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID ' +
    '(or the VITE_* equivalents) and APPWRITE_API_KEY (server key with users scope).';

/** Build a unique plus-addressed test email off INBOX_BASE. */
export function buildTestEmail(tag = ''): string {
    const [local, domain] = INBOX_BASE.split('@');
    const rand = Math.random().toString(36).slice(2, 8);
    const suffix = `2fa-${Date.now().toString(36)}-${rand}${tag ? `-${tag}` : ''}`;
    return `${local}+${suffix}@${domain}`;
}
