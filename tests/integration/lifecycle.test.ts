import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Account, TablesDB, Storage, ID } from 'appwrite';
import { ownerPermissions } from '../../src/lib/permissions';

/**
 * End-to-end lifecycle test against the real Appwrite project configured in
 * .env (the same VITE_APPWRITE_* values the app uses). It runs entirely
 * client-side via the web SDK — no admin API key — and exercises the security
 * model the app depends on:
 *   - a user can register, sign in, and own resources
 *   - PRIVATE galleries/photos/files are unreadable by guests
 *   - PUBLIC ones become readable by guests
 *   - everything created during the run is deleted afterwards and verified gone
 *
 * To avoid leaving an undeletable auth user behind (deleting users needs an
 * admin key), it reuses one fixture account: logs in if it exists, registers
 * it otherwise. Only galleries/photos/files are created and removed each run.
 *
 * SKIPPED automatically if .env isn't configured.
 */

const env = import.meta.env as Record<string, string | undefined>;
const ENDPOINT = env.VITE_APPWRITE_ENDPOINT;
const PROJECT = env.VITE_APPWRITE_PROJECT_ID;
const DB = env.VITE_APPWRITE_DATABASE_ID;
const BUCKET = env.VITE_APPWRITE_BUCKET_ID;
const PHOTOS = env.VITE_APPWRITE_PHOTOS_COLLECTION_ID || 'photos';

const configured = Boolean(ENDPOINT && PROJECT && DB && BUCKET);

// Stable fixture credentials — reused across runs so no auth user accumulates.
const FIXTURE_EMAIL = 'eddieebob0o@gmail.com';
const FIXTURE_PASSWORD = 'Vitest!Fixture1';

// 1x1 transparent PNG.
const PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makeClient(): Client {
    return new Client()
        .setEndpoint(ENDPOINT || 'https://placeholder.appwrite.io/v1')
        .setProject(PROJECT || 'placeholder');
}

/** HTTP-level read of a file URL (web-SDK getFileView only builds a URL). */
async function fileReadable(url: string): Promise<boolean> {
    const res = await fetch(url);
    return res.ok;
}

/**
 * Creates an email/password session via REST and returns its secret. The web
 * SDK normally keeps the session in a cookie (browser) and leaves
 * Session.secret empty, so in Node we fetch the secret directly and feed it to
 * client.setSession().
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
    // The session secret is delivered as the value of the `a_session_<project>`
    // cookie (the JSON body's `secret` is empty in the cookie-based flow).
    const cookie = res.headers.getSetCookie()
        .map((c) => c.split(';')[0])
        .find((c) => c.startsWith('a_session_') && !c.includes('_legacy'));
    const secret = cookie ? cookie.slice(cookie.indexOf('=') + 1) : '';
    if (!secret) throw new Error('login succeeded but no session secret was returned');
    return secret;
}

describe.skipIf(!configured)('Appwrite lifecycle (auth, upload, public/private, cleanup)', () => {
    const guestClient = makeClient();
    const guestDb = new TablesDB(guestClient);
    const guestStorage = new Storage(guestClient);

    const userClient = makeClient();
    const userAccount = new Account(userClient);
    const userDb = new TablesDB(userClient);
    const userStorage = new Storage(userClient);

    let userId = '';
    let galleryId = '';
    let photoId = '';
    let fileId = '';

    beforeAll(async () => {
        // Auth: ensure the fixture account exists (ignore "already exists"),
        // then sign in and attach the session to the user client.
        const auth = new Account(makeClient());
        try {
            await auth.create({ userId: ID.unique(), email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD, name: 'Vitest Fixture' });
        } catch {
            /* already registered from a previous run */
        }
        const secret = await emailSessionSecret(FIXTURE_EMAIL, FIXTURE_PASSWORD);
        userClient.setSession(secret);

        const me = await userAccount.get();
        userId = me.$id;

        // Ensure the user profile row exists (created by signup / ensureUserProfile).
        try {
            await userDb.getRow({ databaseId: DB!, tableId: 'users', rowId: userId });
        } catch {
            await userDb.createRow({
                databaseId: DB!, tableId: 'users', rowId: userId,
                data: { email: FIXTURE_EMAIL, username: `vitest_${userId.slice(0, 10)}` },
                permissions: ownerPermissions(userId, true),
            });
        }
    });

    afterAll(async () => {
        // Idempotent teardown — runs even if a test failed partway through.
        const swallow = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* already gone */ } };
        if (fileId) await swallow(() => userStorage.deleteFile({ bucketId: BUCKET!, fileId }));
        if (photoId) await swallow(() => userDb.deleteRow({ databaseId: DB!, tableId: PHOTOS, rowId: photoId }));
        if (galleryId) await swallow(() => userDb.deleteRow({ databaseId: DB!, tableId: 'gallery', rowId: galleryId }));
        await swallow(() => userAccount.deleteSession({ sessionId: 'current' }));
    });

    it('signs the fixture user in (auth flow)', () => {
        expect(userId).toBeTruthy();
    });

    it('lets the owner create a PRIVATE gallery, photo, and uploaded file', async () => {
        fileId = ID.unique();
        const file = new File([Buffer.from(PNG_BASE64, 'base64')], 'vitest.png', { type: 'image/png' });
        await userStorage.createFile({ bucketId: BUCKET!, fileId, file, permissions: ownerPermissions(userId, false) });

        galleryId = ID.unique();
        await userDb.createRow({
            databaseId: DB!, tableId: 'gallery', rowId: galleryId,
            data: { galleryTitle: 'Vitest Private Gallery', users: userId, isPublic: false },
            permissions: ownerPermissions(userId, false),
        });

        photoId = ID.unique();
        await userDb.createRow({
            databaseId: DB!, tableId: PHOTOS, rowId: photoId,
            data: { title: 'Vitest Photo', description: '', exposure: '', iso: '', lens: '', isFrontPage: false, imageId: fileId, gallery: galleryId },
            permissions: ownerPermissions(userId, false),
        });

        expect(fileId && galleryId && photoId).toBeTruthy();
    });

    it('lets the OWNER read their own private gallery', async () => {
        const row = await userDb.getRow({ databaseId: DB!, tableId: 'gallery', rowId: galleryId });
        expect(row.$id).toBe(galleryId);
    });

    it('blocks a GUEST from reading the private gallery, photo, and file', async () => {
        await expect(guestDb.getRow({ databaseId: DB!, tableId: 'gallery', rowId: galleryId })).rejects.toThrow();
        await expect(guestDb.getRow({ databaseId: DB!, tableId: PHOTOS, rowId: photoId })).rejects.toThrow();
        const url = guestStorage.getFileView({ bucketId: BUCKET!, fileId }).toString();
        expect(await fileReadable(url)).toBe(false);
    });

    it('exposes the resources to guests once made PUBLIC', async () => {
        const pub = ownerPermissions(userId, true);
        await userDb.updateRow({ databaseId: DB!, tableId: 'gallery', rowId: galleryId, data: { isPublic: true }, permissions: pub });
        await userDb.updateRow({ databaseId: DB!, tableId: PHOTOS, rowId: photoId, data: {}, permissions: pub });
        await userStorage.updateFile({ bucketId: BUCKET!, fileId, permissions: pub });

        const gallery = await guestDb.getRow({ databaseId: DB!, tableId: 'gallery', rowId: galleryId });
        expect(gallery.isPublic).toBe(true);
        const url = guestStorage.getFileView({ bucketId: BUCKET!, fileId }).toString();
        expect(await fileReadable(url)).toBe(true);
    });

    it('deletes all created resources and verifies they are gone', async () => {
        await userStorage.deleteFile({ bucketId: BUCKET!, fileId });
        await userDb.deleteRow({ databaseId: DB!, tableId: PHOTOS, rowId: photoId });
        await userDb.deleteRow({ databaseId: DB!, tableId: 'gallery', rowId: galleryId });

        await expect(guestDb.getRow({ databaseId: DB!, tableId: 'gallery', rowId: galleryId })).rejects.toThrow();
        await expect(userDb.getRow({ databaseId: DB!, tableId: PHOTOS, rowId: photoId })).rejects.toThrow();
        const url = guestStorage.getFileView({ bucketId: BUCKET!, fileId }).toString();
        expect(await fileReadable(url)).toBe(false);

        // Mark cleaned so afterAll doesn't re-attempt.
        fileId = '';
        photoId = '';
        galleryId = '';
    });
});
