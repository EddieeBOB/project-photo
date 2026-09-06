import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Databases, Storage } from 'node-appwrite';

import handler from '../src/main.js';
import { sha256 } from '../src/registry.js';

/**
 * The authorization surface: every 400/401/403/404/409/500 decision the handler
 * makes, plus what it actually writes when it says yes.
 *
 * The handler builds its own `Storage` and `Databases` from the request's API
 * key, so there is nothing to inject. The stand-in backend therefore replaces
 * the two SDK prototypes for the length of a test and puts them back after —
 * the handler stays exactly the code that ships.
 */

const BYTES = Buffer.from('the stored photo bytes');
const DIGEST = sha256(BYTES);

const env = {
    APPWRITE_FUNCTION_API_ENDPOINT: 'https://appwrite.test/v1',
    APPWRITE_FUNCTION_PROJECT_ID: 'project',
    VITE_APPWRITE_DATABASE_ID: 'db',
    VITE_APPWRITE_BUCKET_ID: 'photos',
};

/** An Appwrite SDK rejection, which the handler branches on by `.code`. */
function appwriteError(code, message) {
    const failure = new Error(message);
    failure.code = code;
    return failure;
}

/**
 * A stand-in for the Appwrite runtime's response object, capturing what the
 * handler sends rather than writing it anywhere.
 */
function context(req) {
    const sent = {};
    return {
        req,
        res: {
            json(body, status = 200) {
                sent.body = body;
                sent.status = status;
                return sent;
            },
        },
        log: () => {},
        error: () => {},
        sent,
    };
}

/** A well-formed register request, so each test can vary one thing about it. */
function request({ headers, ...overrides } = {}) {
    return {
        headers: { 'x-appwrite-user-id': 'owner', 'x-appwrite-key': 'key', ...headers },
        bodyJson: {
            action: 'register',
            fileId: 'file1',
            ...overrides,
        },
    };
}

/**
 * Installs a fake bucket and table over the SDK prototypes.
 *
 * `files` maps a file id to its permission list; a file that is absent 404s,
 * exactly as the real `getFile` does. `rows` is the provenance table, keyed by
 * row id — which is the file id — and is left readable afterwards so a test can
 * assert on what was written.
 *
 * @returns the live table plus a `restore` to hand to `t.after`
 */
function backend({ files = {}, rows = {}, failLookupWith, failDownloadWith } = {}) {
    const saved = {
        getFile: Storage.prototype.getFile,
        getFileDownload: Storage.prototype.getFileDownload,
        createDocument: Databases.prototype.createDocument,
        getDocument: Databases.prototype.getDocument,
        updateDocument: Databases.prototype.updateDocument,
    };

    Storage.prototype.getFile = async (_bucketId, fileId) => {
        if (failLookupWith) throw failLookupWith;
        if (!files[fileId]) throw appwriteError(404, 'File with the requested ID could not be found.');
        return { $id: fileId, $permissions: files[fileId] };
    };
    Storage.prototype.getFileDownload = async () => {
        if (failDownloadWith) throw failDownloadWith;
        // The real SDK hands back an ArrayBuffer, not a Buffer.
        return BYTES.buffer.slice(BYTES.byteOffset, BYTES.byteOffset + BYTES.byteLength);
    };
    Databases.prototype.createDocument = async (_db, _table, rowId, data, permissions) => {
        if (rows[rowId]) throw appwriteError(409, 'Document with the requested ID already exists.');
        rows[rowId] = { $id: rowId, $createdAt: new Date().toISOString(), $permissions: permissions, ...data };
        return rows[rowId];
    };
    Databases.prototype.getDocument = async (_db, _table, rowId) => {
        if (!rows[rowId]) throw appwriteError(404, 'Document with the requested ID could not be found.');
        return rows[rowId];
    };
    Databases.prototype.updateDocument = async (_db, _table, rowId, data, permissions) => {
        if (!rows[rowId]) throw appwriteError(404, 'Document with the requested ID could not be found.');
        rows[rowId] = { ...rows[rowId], ...data, $permissions: permissions };
        return rows[rowId];
    };

    return {
        rows,
        restore() {
            Object.assign(Storage.prototype, {
                getFile: saved.getFile,
                getFileDownload: saved.getFileDownload,
            });
            Object.assign(Databases.prototype, {
                createDocument: saved.createDocument,
                getDocument: saved.getDocument,
                updateDocument: saved.updateDocument,
            });
        },
    };
}

/** Runs the handler against a request, returning what it responded with. */
async function invoke(req, overrides = {}) {
    const saved = { ...process.env };
    Object.assign(process.env, env, overrides);
    const ctx = context(req);
    try {
        await handler(ctx);
        return ctx.sent;
    } finally {
        process.env = saved;
    }
}

/** The permissions a file gets from `ownerPermissions('owner', isPublic)`. */
const PRIVATE_FILE = ['read("user:owner")', 'update("user:owner")', 'delete("user:owner")'];
const PUBLIC_FILE = [...PRIVATE_FILE, 'read("any")'];

/* ------------------------------------------------------------------ */
/* Refusals                                                            */
/* ------------------------------------------------------------------ */

test('rejects a caller with no session', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    const sent = await invoke({ ...request(), headers: {} });

    assert.equal(sent.status, 401);
});

test('rejects a caller who does not own the file', async (t) => {
    // The file exists and is public, so the caller can read it — but a read
    // grant is not ownership, and only the delete grant proves that.
    const fake = backend({ files: { file1: PUBLIC_FILE } });
    t.after(fake.restore);

    const sent = await invoke(request({ headers: { 'x-appwrite-user-id': 'stranger' } }));

    assert.equal(sent.status, 403);
    assert.deepEqual(fake.rows, {}, 'a stranger must not leave a row behind');
});

test('rejects a request with no action rather than assuming one', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    const sent = await invoke(request({ action: undefined }));

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /action/);
    assert.deepEqual(fake.rows, {});
});

test('rejects an unknown action', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    const sent = await invoke(request({ action: 'delete-everything' }));

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /Unknown action/);
});

test('rejects a register with no fileId', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    const sent = await invoke(request({ fileId: '   ' }));

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /fileId/);
});

test('rejects an unparseable body', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    const sent = await invoke({
        headers: { 'x-appwrite-user-id': 'owner' },
        bodyRaw: 'not json',
    });

    assert.equal(sent.status, 400);
});

test('reports a file that does not exist as 404', async (t) => {
    const fake = backend({ files: {} });
    t.after(fake.restore);

    const sent = await invoke(request());

    assert.equal(sent.status, 404);
});

test('rejects JSON bodies that are not objects', async () => {
    for (const body of [null, [], 'register', 42, false]) {
        const sent = await invoke({
            headers: request().headers,
            bodyRaw: JSON.stringify(body),
        });
        assert.equal(sent.status, 400);
        assert.equal(sent.body.error, 'Invalid request body.');
    }
});

test('rejects non-string file ids instead of coercing them into lookups', async () => {
    for (const fileId of [123, {}, ['file1'], { toString: null }]) {
        const sent = await invoke(request({ fileId }));
        assert.equal(sent.status, 400);
        assert.equal(sent.body.error, 'fileId is required.');
    }
});

test('validates the request before checking server configuration', async () => {
    const sent = await invoke(request({ action: 'unknown' }), { VITE_APPWRITE_DATABASE_ID: '' });
    assert.equal(sent.status, 400);
    assert.equal(sent.body.error, 'Unknown action.');
});

test('reports missing server configuration for a valid request', async () => {
    const sent = await invoke(request(), { VITE_APPWRITE_DATABASE_ID: '' });
    assert.equal(sent.status, 500);
    assert.equal(sent.body.error, 'Registration is unavailable.');
});

test('reports a lookup failure that is not a 404 as a server error', async (t) => {
    // A 503 from the bucket is not the caller's fault and must not read as
    // "no such file", which would be indistinguishable from a deleted photo.
    const fake = backend({ failLookupWith: appwriteError(503, 'Service unavailable') });
    t.after(fake.restore);

    const sent = await invoke(request());

    assert.equal(sent.status, 500);
});

test('reports a download failure as a server error and writes nothing', async (t) => {
    const fake = backend({
        files: { file1: PRIVATE_FILE },
        failDownloadWith: new Error('connection reset'),
    });
    t.after(fake.restore);

    const sent = await invoke(request());

    assert.equal(sent.status, 500);
    assert.deepEqual(fake.rows, {});
});

/* ------------------------------------------------------------------ */
/* Registering                                                         */
/* ------------------------------------------------------------------ */

test('registers an owned file with the digest of its stored bytes', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    const sent = await invoke(request());

    assert.equal(sent.status, 200);
    assert.equal(sent.body.sha256, DIGEST);
    assert.equal(fake.rows.file1.sha256, DIGEST);
    assert.equal(fake.rows.file1.imageId, 'file1');
    // The registration time is Appwrite's row stamp, not a column written here.
    assert.ok(!Number.isNaN(Date.parse(fake.rows.file1.$createdAt)));
});

test('stores nothing the caller said about the photo', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    // `registeredAt` among them: a caller must not be able to backdate a
    // registration by supplying the field the row used to carry.
    await invoke(request({ creator: 'Someone Else', title: 'Not mine', registeredAt: '1999-01-01T00:00:00.000Z' }));

    // The registry records only what the function verified for itself.
    assert.deepEqual(
        Object.keys(fake.rows.file1).filter((k) => !k.startsWith('$')).sort(),
        ['imageId', 'sha256'],
    );
});

test('a row is never granted update, whatever the photo is', async (t) => {
    const fake = backend({ files: { file1: PUBLIC_FILE } });
    t.after(fake.restore);

    await invoke(request());

    assert.ok(!fake.rows.file1.$permissions.some((p) => p.startsWith('update(')));
});

test('takes the row\'s public read from the file, not from the request', async (t) => {
    // A client asking for a public row on a private photo would publish that
    // photo's existence to anyone enumerating the table.
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);

    await invoke(request({ isPublic: true }));

    assert.ok(!fake.rows.file1.$permissions.includes('read("any")'));
    assert.ok(fake.rows.file1.$permissions.includes('read("user:owner")'));
});

test('a public photo does get a publicly readable row', async (t) => {
    const fake = backend({ files: { file1: PUBLIC_FILE } });
    t.after(fake.restore);

    await invoke(request({ isPublic: false }));

    assert.ok(fake.rows.file1.$permissions.includes('read("any")'));
});

test('re-registering returns the stored digest and never overwrites it', async (t) => {
    // The row already claims a different digest. A re-registration that could
    // replace it would be the forgery this whole design exists to prevent.
    const fake = backend({
        files: { file1: PRIVATE_FILE },
        rows: { file1: { $id: 'file1', sha256: 'a'.repeat(64), imageId: 'file1' } },
    });
    t.after(fake.restore);

    const sent = await invoke(request());

    assert.equal(sent.status, 200);
    assert.equal(sent.body.sha256, 'a'.repeat(64));
    assert.notEqual(sent.body.sha256, DIGEST);
    assert.equal(fake.rows.file1.sha256, 'a'.repeat(64));
});

test('a collision whose row cannot then be read is a server error', async (t) => {
    const fake = backend({ files: { file1: PRIVATE_FILE } });
    t.after(fake.restore);
    // Collide on create, then vanish before the read — the one case where the
    // caller genuinely cannot be told a digest.
    Databases.prototype.createDocument = async () => {
        throw appwriteError(409, 'Document with the requested ID already exists.');
    };

    const sent = await invoke(request());

    assert.equal(sent.status, 500);
});

/* ------------------------------------------------------------------ */
/* Visibility, in batches                                              */
/* ------------------------------------------------------------------ */

/** A visibility request over `fileIds`, from `owner` unless told otherwise. */
function visibility(fileIds, headers = {}) {
    return {
        headers: { 'x-appwrite-user-id': 'owner', 'x-appwrite-key': 'key', ...headers },
        bodyJson: { action: 'visibility', fileIds },
    };
}

function registeredRow(id) {
    return { $id: id, sha256: DIGEST, imageId: id, $permissions: ['read("any")'] };
}

test('one call reconciles a whole gallery', async (t) => {
    // The point of the batch: a hundred photos used to mean a hundred function
    // executions, which Appwrite throttles partway through.
    const files = {};
    const rows = {};
    for (let i = 0; i < 100; i++) {
        files[`f${i}`] = PRIVATE_FILE;
        rows[`f${i}`] = registeredRow(`f${i}`);
    }
    const fake = backend({ files, rows });
    t.after(fake.restore);

    const sent = await invoke(visibility(Object.keys(files)));

    assert.equal(sent.status, 200);
    assert.deepEqual(sent.body, { ok: true, updated: 100, skipped: 0 });
    for (const row of Object.values(fake.rows)) {
        assert.ok(!row.$permissions.includes('read("any")'));
    }
});

test('turning a gallery public restores read("any") on its rows', async (t) => {
    const fake = backend({
        files: { f1: PUBLIC_FILE, f2: PUBLIC_FILE },
        rows: { f1: { $id: 'f1', $permissions: [] }, f2: { $id: 'f2', $permissions: [] } },
    });
    t.after(fake.restore);

    const sent = await invoke(visibility(['f1', 'f2']));

    assert.deepEqual(sent.body, { ok: true, updated: 2, skipped: 0 });
    assert.ok(fake.rows.f1.$permissions.includes('read("any")'));
    assert.ok(!fake.rows.f1.$permissions.some((p) => p.startsWith('update(')));
});

test('a file the caller does not own is skipped, not fatal to the rest', async (t) => {
    const fake = backend({
        files: {
            mine: PRIVATE_FILE,
            theirs: ['read("user:stranger")', 'delete("user:stranger")', 'read("any")'],
            alsoMine: PRIVATE_FILE,
        },
        rows: {
            mine: registeredRow('mine'),
            theirs: registeredRow('theirs'),
            alsoMine: registeredRow('alsoMine'),
        },
    });
    t.after(fake.restore);

    const sent = await invoke(visibility(['mine', 'theirs', 'alsoMine']));

    assert.equal(sent.status, 200);
    assert.deepEqual(sent.body, { ok: true, updated: 2, skipped: 1 });
    // Somebody else's row is left exactly as it was.
    assert.deepEqual(fake.rows.theirs.$permissions, ['read("any")']);
    assert.ok(!fake.rows.mine.$permissions.includes('read("any")'));
});

test('an unknown or already-deleted file is skipped, not fatal', async (t) => {
    const fake = backend({
        files: { mine: PRIVATE_FILE },
        rows: { mine: registeredRow('mine') },
    });
    t.after(fake.restore);

    const sent = await invoke(visibility(['mine', 'gone']));

    assert.deepEqual(sent.body, { ok: true, updated: 1, skipped: 1 });
});

test('a file with no registry row is skipped, not fatal', async (t) => {
    const fake = backend({ files: { mine: PRIVATE_FILE, unregistered: PRIVATE_FILE }, rows: { mine: registeredRow('mine') } });
    t.after(fake.restore);

    const sent = await invoke(visibility(['mine', 'unregistered']));

    assert.deepEqual(sent.body, { ok: true, updated: 1, skipped: 1 });
});

test('rejects a visibility call with no fileIds', async (t) => {
    const fake = backend({ files: { f1: PRIVATE_FILE } });
    t.after(fake.restore);

    for (const fileIds of [undefined, [], 'f1', ['  ']]) {
        const sent = await invoke(visibility(fileIds));
        assert.equal(sent.status, 400, `fileIds: ${JSON.stringify(fileIds)}`);
        assert.match(sent.body.error, /fileIds/);
    }
});

test('rejects a batch larger than the cap rather than timing out on it', async (t) => {
    const fake = backend({ files: {} });
    t.after(fake.restore);

    const sent = await invoke(visibility(Array.from({ length: 101 }, (_, i) => `f${i}`)));

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /100/);
});

test('a repeated file id counts once', async (t) => {
    const fake = backend({ files: { f1: PRIVATE_FILE }, rows: { f1: registeredRow('f1') } });
    t.after(fake.restore);

    const sent = await invoke(visibility(['f1', 'f1', 'f1']));

    assert.deepEqual(sent.body, { ok: true, updated: 1, skipped: 0 });
});

test('an unauthenticated visibility call is refused before any lookup', async (t) => {
    const fake = backend({ files: { f1: PRIVATE_FILE }, rows: { f1: registeredRow('f1') } });
    t.after(fake.restore);

    const sent = await invoke(visibility(['f1'], { 'x-appwrite-user-id': '' }));

    assert.equal(sent.status, 401);
    assert.deepEqual(fake.rows.f1.$permissions, ['read("any")']);
});
