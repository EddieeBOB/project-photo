import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Client, Account, TablesDB, Storage, Query } from 'appwrite';

/**
 * Node-side helpers for the E2E suite: read the same `.env` the app uses, sign
 * the fixture account in, and tear down any Appwrite resources a test created.
 *
 * Playwright's Node context doesn't auto-load `.env` (only the Vite dev server
 * does), so we parse it ourselves — no extra dependency.
 */

function loadEnv(): Record<string, string> {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(__dirname, '../../../.env');
    const out: Record<string, string> = {};
    let raw = '';
    try {
        raw = readFileSync(envPath, 'utf8');
    } catch {
        return out;
    }
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        // Strip surrounding quotes.
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

const env = loadEnv();

export const ENDPOINT = env.VITE_APPWRITE_ENDPOINT;
export const PROJECT = env.VITE_APPWRITE_PROJECT_ID;
export const DATABASE = env.VITE_APPWRITE_DATABASE_ID;
export const BUCKET = env.VITE_APPWRITE_BUCKET_ID;
export const PHOTOS = env.VITE_APPWRITE_PHOTOS_COLLECTION_ID || 'photos';

/** Whether `.env` is present and complete enough to run the live specs. */
export const APPWRITE_CONFIGURED = Boolean(ENDPOINT && PROJECT && DATABASE && BUCKET);

/**
 * Stable fixture account shared with the Vitest integration suite. Reused across
 * runs so no undeletable auth user accumulates (deleting users needs an admin
 * key this suite intentionally doesn't use).
 */
export const FIXTURE_EMAIL = 'eddieebob0o@gmail.com';
export const FIXTURE_PASSWORD = 'Vitest!Fixture1';

function makeClient(): Client {
    return new Client()
        .setEndpoint(ENDPOINT || 'https://placeholder.appwrite.io/v1')
        .setProject(PROJECT || 'placeholder');
}

/**
 * Create an email/password session via REST and return its secret. In Node the
 * web SDK leaves Session.secret empty (it expects a browser cookie), so we read
 * the secret out of the `a_session_<project>` Set-Cookie header ourselves.
 */
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
    const cookie = res.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .find((c) => c.startsWith('a_session_') && !c.includes('_legacy'));
    const secret = cookie ? cookie.slice(cookie.indexOf('=') + 1) : '';
    if (!secret) throw new Error('login succeeded but no session secret was returned');
    return secret;
}

/** An authenticated set of web-SDK services for the fixture user. */
export async function fixtureSession() {
    const client = makeClient();
    const secret = await emailSessionSecret(FIXTURE_EMAIL, FIXTURE_PASSWORD);
    client.setSession(secret);
    return {
        client,
        account: new Account(client),
        db: new TablesDB(client),
        storage: new Storage(client),
    };
}

/**
 * Delete every gallery owned by the fixture user whose title contains `marker`,
 * including each photo row and its uploaded storage file. Idempotent and
 * best-effort: never throws, so it's safe to call from teardown.
 */
export async function cleanupGalleriesByTitle(marker: string): Promise<number> {
    if (!APPWRITE_CONFIGURED) return 0;
    let deleted = 0;
    try {
        const { account, db, storage } = await fixtureSession();
        const me = await account.get();

        const user: any = (await db.listRows({
            databaseId: DATABASE!,
            tableId: 'users',
            queries: [
                // Pull the owner's galleries and their photos in one shot.
                Query.equal('$id', me.$id),
                Query.select(['*', 'gallery.*', 'gallery.photos.*']),
            ],
        })).rows?.[0];

        const galleries: any[] = user?.gallery || [];
        for (const gallery of galleries) {
            const title: string = gallery.galleryTitle || '';
            if (!title.includes(marker)) continue;

            for (const photo of gallery.photos || []) {
                if (photo.imageId) {
                    try { await storage.deleteFile({ bucketId: BUCKET!, fileId: photo.imageId }); } catch { /* gone */ }
                }
                try { await db.deleteRow({ databaseId: DATABASE!, tableId: PHOTOS, rowId: photo.$id }); } catch { /* gone */ }
            }
            try { await db.deleteRow({ databaseId: DATABASE!, tableId: 'gallery', rowId: gallery.$id }); } catch { /* gone */ }
            deleted++;
        }

        try { await account.deleteSession({ sessionId: 'current' }); } catch { /* ignore */ }
    } catch {
        /* best-effort teardown — swallow */
    }
    return deleted;
}
