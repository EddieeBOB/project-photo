# Hash + Server Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace C2PA manifest signing with a SHA-256 hash recorded in a server-written registry table, so photo provenance no longer depends on a Rust function pinned to an obsolete c2pa release.

**Architecture:** The browser uploads the resized photo straight to the bucket, then calls a small Node function that reads those bytes back out of storage, hashes them itself, and writes a row into a `provenance` table no client may write. Verification is an ordinary client-side query: the browser hashes a dropped file and looks the digest up.

**Tech Stack:** Appwrite (Storage, TablesDB, Functions), `node-appwrite` 17, Node 22 function runtime, React + TypeScript + MUI, Vitest (app) and `node --test` (function).

**Spec:** `docs/superpowers/specs/2026-09-04-hash-registry-design.md`

## Global Constraints

- The client never supplies a hash. Every `sha256` value is computed by the function from bytes it read out of the bucket.
- Registry rows grant **no `update` to any role**, ever. An owner may read and delete their row; nobody may rewrite it.
- `functions/sign-photo/` and `functions/sign-photo-rs/` are already deleted on disk as unstaged deletions. Do not recreate them; stage the deletions in Task 8.
- No backfill: the bucket was emptied before this work, so no pre-existing photo needs a row.
- Function code follows `functions/login-resolver/`: ESM, `node-appwrite` as the only dependency, positional-argument SDK calls, `Databases` (not `TablesDB`).
- `ProvenanceState` has exactly three members after this work: `registered`, `unregistered`, `error`.
- Any user-facing copy claiming the file "never leaves the browser" must be corrected: the file does not, but its 64-character digest does.

---

### Task 1: `registryPermissions` helper

**Files:**
- Modify: `src/lib/permissions.ts`
- Test: `tests/unit/permissions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `registryPermissions(ownerId: string, isPublic: boolean): string[]` — canonical definition of registry-row permissions. Task 2 mirrors this logic in the function (which cannot import browser-SDK code), and Task 6 does not use it directly.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/permissions.test.ts`:

```ts
describe('registryPermissions', () => {
    it('grants the owner read and delete but never update', () => {
        const perms = registryPermissions(UID, false);
        expect(perms).toEqual([
            `read("user:${UID}")`,
            `delete("user:${UID}")`,
        ]);
    });

    it('adds public read for a public photo, still without update', () => {
        const perms = registryPermissions(UID, true);
        expect(perms).toContain('read("any")');
        expect(perms).toContain(`read("user:${UID}")`);
        expect(perms).toContain(`delete("user:${UID}")`);
        expect(perms).not.toContain('delete("any")');
    });

    // The whole trust model rests on this: a row the owner could update is a
    // row whose hash the owner could forge.
    it('never grants update to anyone, public or private', () => {
        for (const isPublic of [true, false]) {
            expect(registryPermissions(UID, isPublic).some((p) => p.startsWith('update('))).toBe(false);
        }
    });
});
```

Update the import on line 2 to `import { ownerPermissions, registryPermissions } from '../../src/lib/permissions';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- permissions`
Expected: FAIL — `registryPermissions is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/permissions.ts`:

```ts
/**
 * Builds the permission set for a `provenance` registry row.
 *
 * Deliberately narrower than `ownerPermissions`: there is no `update` for any
 * role. Appwrite permissions are per-row rather than per-column, so an owner
 * who could update this row could rewrite the hash inside it — which is the
 * one forgery the registry exists to prevent. An owner may still delete their
 * row, so removing a photo can remove its provenance with it.
 */
export function registryPermissions(ownerId: string, isPublic: boolean): string[] {
    const perms = [
        Permission.read(Role.user(ownerId)),
        Permission.delete(Role.user(ownerId)),
    ];
    if (isPublic) {
        perms.push(Permission.read(Role.any()));
    }
    return perms;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- permissions`
Expected: PASS, all three new cases plus the three existing `ownerPermissions` cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts tests/unit/permissions.test.ts
git commit -m "feat(permissions): add registryPermissions with no update for any role"
```

---

### Task 2: `register-photo` function

**Files:**
- Create: `functions/register-photo/package.json`
- Create: `functions/register-photo/src/registry.js`
- Create: `functions/register-photo/src/main.js`
- Create: `functions/register-photo/README.md`
- Test: `functions/register-photo/tests/registry.test.js`

**Interfaces:**
- Consumes: the permission shape defined in Task 1 (mirrored, not imported — this is a separate package on the server SDK).
- Produces: an HTTP contract Task 6 and Task 7 call —
  `POST { action: 'register', fileId, isPublic, creator?, title? }` → `200 { sha256 }`;
  `POST { action: 'visibility', fileId, isPublic }` → `200 { ok: true }`.
  Also `sha256(bytes: Buffer): string` and `registryPermissions(ownerId: string, isPublic: boolean): string[]` from `src/registry.js`.

- [ ] **Step 1: Create the package manifest**

Create `functions/register-photo/package.json`:

```json
{
  "name": "register-photo",
  "version": "1.0.0",
  "description": "Hashes a stored photo server-side and records it in the provenance registry.",
  "type": "module",
  "main": "src/main.js",
  "scripts": {
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "node-appwrite": "^17.2.0"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `functions/register-photo/tests/registry.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registryPermissions, sha256 } from '../src/registry.js';

test('sha256 matches the published digest for "abc"', () => {
    assert.equal(
        sha256(Buffer.from('abc')),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
});

test('sha256 matches the published digest for empty input', () => {
    assert.equal(
        sha256(Buffer.alloc(0)),
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
});

test('a single flipped byte changes the digest', () => {
    assert.notEqual(sha256(Buffer.from('abc')), sha256(Buffer.from('abd')));
});

test('registry permissions never grant update', () => {
    for (const isPublic of [true, false]) {
        const perms = registryPermissions('user-123', isPublic);
        assert.ok(!perms.some((p) => p.startsWith('update(')));
    }
});

test('public rows are readable by anyone and private rows are not', () => {
    assert.ok(registryPermissions('u1', true).includes('read("any")'));
    assert.ok(!registryPermissions('u1', false).includes('read("any")'));
});

test('the owner can always read and delete their own row', () => {
    const perms = registryPermissions('u1', false);
    assert.ok(perms.includes('read("user:u1")'));
    assert.ok(perms.includes('delete("user:u1")'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd functions/register-photo && npm install && npm test`
Expected: FAIL — cannot resolve `../src/registry.js`.

- [ ] **Step 4: Write the pure module**

Create `functions/register-photo/src/registry.js`:

```js
import { createHash } from 'node:crypto';

/**
 * Hashing and permission rules, kept free of Appwrite and HTTP concerns so they
 * can be exercised on their own: bytes in, digest out.
 */

/** SHA-256 of exactly these bytes, lowercase hex. The registry's only claim. */
export function sha256(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Permissions for a registry row. Mirrors `registryPermissions` in
 * src/lib/permissions.ts, which cannot be imported here — that module is built
 * against the browser SDK and this function runs on the server one.
 *
 * There is deliberately no `update` for any role. Appwrite permissions are
 * per-row rather than per-column, so an owner who could update this row could
 * rewrite the hash inside it.
 */
export function registryPermissions(ownerId, isPublic) {
    const perms = [`read("user:${ownerId}")`, `delete("user:${ownerId}")`];
    if (isPublic) perms.push('read("any")');
    return perms;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd functions/register-photo && npm test`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the handler**

Create `functions/register-photo/src/main.js`:

```js
import { Client, Databases, Storage } from 'node-appwrite';

import { registryPermissions, sha256 } from './registry.js';

/**
 * register-photo — records the SHA-256 of a stored photo in the provenance
 * registry, and keeps that row's visibility in step with the photo's.
 *
 * Why the hash is computed here rather than in the browser:
 *   Appwrite permissions are per-row, not per-column, so the hash cannot live
 *   on the `photos` row — owners hold `update` there in order to edit titles,
 *   which would let them rewrite it. It therefore lives in a table no client
 *   may write, and is computed from bytes this function reads out of the
 *   bucket itself. A client that could supply its own hash could register
 *   someone else's file under its own name, which is the one forgery this
 *   design exists to prevent.
 *
 * Verification is deliberately NOT a route here. A registry row is readable by
 * exactly the audience that can already see the photo, so the browser looks a
 * digest up with an ordinary query and no server round trip.
 *
 * Request  (POST, JSON):
 *   { "action": "register",   "fileId": string, "isPublic": bool,
 *     "creator"?: string, "title"?: string }
 *   { "action": "visibility", "fileId": string, "isPublic": bool }
 * Response (JSON):
 *   200 { "sha256": string }   registered, or already registered
 *   200 { "ok": true }         visibility updated
 *   400 { "error": ... }       malformed request or unknown action
 *   401 { "error": ... }       no authenticated caller
 *   403 { "error": ... }       caller does not own the file
 *   404 { "error": ... }       no such file
 *   500 { "error": ... }       download, hashing, or row write failed
 *
 * Function variables: APPWRITE_DATABASE_ID, APPWRITE_BUCKET_ID,
 *   APPWRITE_PROVENANCE_TABLE_ID
 * Dynamic API key scopes: files.read, documents.read, documents.write
 */
export default async ({ req, res, error }) => {
  // Appwrite sets this from the caller's session; the body never gets a say in
  // who owns a photo, so nobody can register one as somebody else.
  const userId = req.headers['x-appwrite-user-id'] || '';
  if (!userId) return res.json({ error: 'Authentication required.' }, 401);

  let body;
  try {
    body = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : {});
  } catch {
    return res.json({ error: 'Invalid request body.' }, 400);
  }

  const action = String(body.action ?? 'register');
  const fileId = String(body.fileId ?? '').trim();
  const isPublic = body.isPublic === true;
  if (!fileId) return res.json({ error: 'fileId is required.' }, 400);
  if (action !== 'register' && action !== 'visibility') {
    return res.json({ error: 'Unknown action.' }, 400);
  }

  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  const tableId = process.env.APPWRITE_PROVENANCE_TABLE_ID || 'provenance';
  if (!databaseId || !bucketId) {
    error('APPWRITE_DATABASE_ID and APPWRITE_BUCKET_ID must both be set');
    return res.json({ error: 'Registration is unavailable.' }, 500);
  }

  const admin = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] || '');
  const storage = new Storage(admin);
  const databases = new Databases(admin);

  // Ownership is proved by the delete grant, not the read grant: a public
  // photo is readable by everyone, but only its owner may delete it.
  try {
    const file = await storage.getFile(bucketId, fileId);
    if (!(file.$permissions || []).includes(`delete("user:${userId}")`)) {
      return res.json({ error: 'You do not own this file.' }, 403);
    }
  } catch (e) {
    error(`file lookup failed for ${fileId}: ${e.message}`);
    return res.json({ error: 'Unknown file.' }, 404);
  }

  const permissions = registryPermissions(userId, isPublic);

  if (action === 'visibility') {
    try {
      await databases.updateDocument(databaseId, tableId, fileId, {}, permissions);
      return res.json({ ok: true });
    } catch (e) {
      error(`visibility update failed for ${fileId}: ${e.message}`);
      return res.json({ error: 'Could not update visibility.' }, 500);
    }
  }

  let digest;
  try {
    digest = sha256(Buffer.from(await storage.getFileDownload(bucketId, fileId)));
  } catch (e) {
    error(`hashing failed for ${fileId}: ${e.message}`);
    return res.json({ error: 'Could not hash the photo.' }, 500);
  }

  try {
    await databases.createDocument(
      databaseId,
      tableId,
      fileId,
      {
        sha256: digest,
        imageId: fileId,
        creator: String(body.creator ?? '').trim() || null,
        title: String(body.title ?? '').trim() || null,
        registeredAt: new Date().toISOString(),
      },
      permissions,
    );
    return res.json({ sha256: digest });
  } catch (e) {
    // The row id is the file id, so re-registering collides. The stored hash
    // is authoritative and is never overwritten — returning it keeps the call
    // idempotent without handing anyone a way to replace a hash.
    if (e.code === 409) {
      try {
        const existing = await databases.getDocument(databaseId, tableId, fileId);
        return res.json({ sha256: existing.sha256 });
      } catch (readError) {
        error(`existing row unreadable for ${fileId}: ${readError.message}`);
        return res.json({ error: 'Could not register the photo.' }, 500);
      }
    }
    error(`registry write failed for ${fileId}: ${e.message}`);
    return res.json({ error: 'Could not register the photo.' }, 500);
  }
};
```

- [ ] **Step 7: Write the README**

Create `functions/register-photo/README.md`:

```markdown
# register-photo

Hashes a photo that is already in the bucket and records the digest in the
`provenance` table, then keeps that row's visibility in step with the photo's.

The hash is computed here rather than in the browser because Appwrite
permissions are per-row, not per-column: the hash cannot sit on the `photos`
row, whose owner holds `update` in order to edit titles. A client that could
supply its own hash could also register a file it does not own under its own
name.

Verification is not a route here. Registry rows are readable by the same
audience as the photo, so the browser hashes a dropped file and queries the
table directly.

## Contract

    POST { "action": "register",   "fileId", "isPublic", "creator"?, "title"? }
      -> 200 { "sha256" }
    POST { "action": "visibility", "fileId", "isPublic" }
      -> 200 { "ok": true }

    400 malformed request or unknown action
    401 no authenticated caller
    403 caller does not own the file
    404 no such file
    500 download, hashing, or row write failed

Re-registering a file is not an error: the row id is the file id, so the
create collides and the stored digest is returned unchanged.

## Configuration

Function variables: `APPWRITE_DATABASE_ID`, `APPWRITE_BUCKET_ID`,
`APPWRITE_PROVENANCE_TABLE_ID`.

Dynamic API key scopes: `files.read`, `documents.read`, `documents.write`.
```

- [ ] **Step 8: Re-run the tests**

Run: `cd functions/register-photo && npm test`
Expected: PASS, 6 tests. (`main.js` has no unit tests — it is all Appwrite I/O, and is exercised end-to-end in Task 3.)

- [ ] **Step 9: Commit**

```bash
git add functions/register-photo
git commit -m "feat(register-photo): add server-side hashing and provenance registry writes"
```

---

### Task 3: Provision the Appwrite resources

**Files:**
- Modify: `.env` / `.env.example` (whichever the repo carries — add the new ids)

**Interfaces:**
- Consumes: the function from Task 2.
- Produces: a deployed `register-photo` function id, a `provenance` table with a `sha256` key index, and the env vars `VITE_APPWRITE_REGISTER_FN_ID` and (if not already implied) the provenance table id that Tasks 4 and 6 read through `src/lib/config.ts`.

This task is configuration rather than code, so it has no failing-test cycle. Its deliverable is a smoke-tested round trip.

- [ ] **Step 1: Create the `provenance` table**

In the Appwrite console, in the database referenced by `VITE_APPWRITE_DATABASE_ID`, create a table with id `provenance` and these columns:

| key | type | size | required |
|---|---|---|---|
| `sha256` | String | 64 | yes |
| `imageId` | String | 36 | yes |
| `creator` | String | 255 | no |
| `title` | String | 255 | no |
| `registeredAt` | Datetime | — | yes |

- [ ] **Step 2: Add the index**

Create a **key** index named `sha256_idx` on the `sha256` column, ascending.
`Query.equal('sha256', …)` fails without it — this is the single most common cause of a verify page that returns nothing for every file.

- [ ] **Step 3: Set table permissions**

Leave **table-level permissions empty** and enable **row security**. Every row's access comes from the permission array the function writes; no role may create, update, or delete at the table level.

- [ ] **Step 4: Deploy the function**

Create an Appwrite Function named `register-photo`, Node 22 runtime, entrypoint `src/main.js`, build command `npm install`, deployed from `functions/register-photo/`.

Set its function variables:
- `APPWRITE_DATABASE_ID` — same value as `VITE_APPWRITE_DATABASE_ID`
- `APPWRITE_BUCKET_ID` — same value as `VITE_APPWRITE_BUCKET_ID`
- `APPWRITE_PROVENANCE_TABLE_ID` — `provenance`

Enable a dynamic API key with scopes `files.read`, `documents.read`, `documents.write`.

- [ ] **Step 5: Record the function id**

Add to the local env file and to the Appwrite Site's environment variables:

```
VITE_APPWRITE_REGISTER_FN_ID=<the new function id>
```

Remove `VITE_APPWRITE_SIGN_PHOTO_FN_ID` — nothing reads it after Task 6.

- [ ] **Step 6: Smoke-test the round trip**

Upload any small image to the bucket by hand, note its file id, then execute the function from the console with:

```json
{ "action": "register", "fileId": "<file id>", "isPublic": true, "creator": "Smoke Test" }
```

Expected: `200` with a 64-character `sha256`, and a new row in `provenance` whose id equals the file id. Confirm the row's permissions contain `read("any")` and contain **no** `update(` entry. Execute the identical payload a second time and confirm it returns the same digest rather than erroring.

Delete the test file and its row afterwards.

- [ ] **Step 7: Commit**

```bash
git add -A -- '*.env.example'
git commit -m "chore(config): add register-photo function id to the environment example"
```

If the repo has no tracked env example, skip the commit and note the ids in your own `.env`.

---

### Task 4: Provenance types and the verify service

**Files:**
- Modify: `src/types/provenance.ts`
- Modify: `src/lib/config.ts`
- Create: `src/services/provenanceVerify.ts`
- Test: `tests/unit/provenanceVerify.test.ts`

**Interfaces:**
- Consumes: the `provenance` table and `sha256_idx` from Task 3.
- Produces: `ProvenanceState = 'registered' | 'unregistered' | 'error'`;
  `interface Provenance { state; creator?; title?; registeredAt? }`;
  `sha256Hex(bytes: ArrayBuffer): Promise<string>`;
  `verifyFile(file: File): Promise<Provenance>`;
  and the config export `PROVENANCE_TABLE`. Task 5 renders all of these.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/provenanceVerify.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listRows = vi.fn();

vi.mock('../../src/lib/appwrite', () => ({
    tablesDB: { listRows: (...args: unknown[]) => listRows(...args) },
}));
vi.mock('../../src/lib/config', () => ({
    databaseId: 'test-db',
    PROVENANCE_TABLE: 'provenance',
}));

const { sha256Hex, verifyFile } = await import('../../src/services/provenanceVerify');

describe('sha256Hex', () => {
    it('matches the published digest for "abc"', async () => {
        const bytes = new TextEncoder().encode('abc');
        expect(await sha256Hex(bytes.buffer as ArrayBuffer)).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
    });
});

describe('verifyFile', () => {
    beforeEach(() => listRows.mockReset());

    it('reports a digest the registry knows as registered', async () => {
        listRows.mockResolvedValue({
            rows: [{ creator: 'Eddie Lam', title: 'Dusk', registeredAt: '2026-09-04T10:00:00.000Z' }],
        });

        expect(await verifyFile(new File(['abc'], 'a.webp', { type: 'image/webp' }))).toEqual({
            state: 'registered',
            creator: 'Eddie Lam',
            title: 'Dusk',
            registeredAt: '2026-09-04T10:00:00.000Z',
        });
    });

    it('queries on the digest of the file, not its name', async () => {
        listRows.mockResolvedValue({ rows: [] });
        await verifyFile(new File(['abc'], 'a.webp', { type: 'image/webp' }));

        const [{ queries }] = listRows.mock.calls[0] as [{ queries: string[] }];
        expect(queries[0]).toContain('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    // An altered file and a file that was never registered are genuinely
    // indistinguishable to a hash registry. Reporting either as "modified"
    // would claim more than the data supports.
    it('reports an unknown digest as unregistered', async () => {
        listRows.mockResolvedValue({ rows: [] });
        expect(await verifyFile(new File(['abc'], 'a.webp'))).toEqual({ state: 'unregistered' });
    });

    it('reports a failed lookup as an error rather than as unregistered', async () => {
        listRows.mockRejectedValue(new Error('offline'));
        expect(await verifyFile(new File(['abc'], 'a.webp'))).toEqual({ state: 'error' });
    });

    it('omits fields the row does not carry', async () => {
        listRows.mockResolvedValue({ rows: [{ registeredAt: '2026-09-04T10:00:00.000Z' }] });
        expect(await verifyFile(new File(['abc'], 'a.webp'))).toEqual({
            state: 'registered',
            registeredAt: '2026-09-04T10:00:00.000Z',
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- provenanceVerify`
Expected: FAIL — cannot resolve `src/services/provenanceVerify`.

- [ ] **Step 3: Rewrite the provenance type**

Replace the entire contents of `src/types/provenance.ts`:

```ts
/**
 * What the provenance registry knows about a photo.
 *
 * There is no `modified` state, and its absence is deliberate. A registry
 * records the hash of exactly one sequence of bytes; a photo that has been
 * edited, re-encoded, or re-saved simply hashes to something else and is not
 * found. That is indistinguishable from a photo nobody ever registered, so
 * both read as `unregistered` rather than pretending to tell them apart.
 */
export type ProvenanceState =
    /** The digest is in the registry: these exact bytes were published here. */
    | 'registered'
    /** No row for this digest — never registered, or altered since. */
    | 'unregistered'
    /** The registry could not be reached. */
    | 'error';

export interface Provenance {
    state: ProvenanceState;
    /** Who the photographer was, as recorded when the photo was registered. */
    creator?: string;
    /** The photo's title at registration. */
    title?: string;
    /** When it was registered, ISO-8601, from the server clock. */
    registeredAt?: string;
}
```

- [ ] **Step 4: Add the table id to config**

In `src/lib/config.ts`, add `PROVENANCE_TABLE` to the table-id block on line 14-16:

```ts
export const GALLERY_TABLE = 'gallery';
export const PHOTOS_TABLE = 'photos';
export const USERS_TABLE = 'users';
export const PROVENANCE_TABLE = 'provenance';
```

- [ ] **Step 5: Write the verify service**

Create `src/services/provenanceVerify.ts`:

```ts
import { Query } from 'appwrite';

import { tablesDB } from '../lib/appwrite';
import { databaseId, PROVENANCE_TABLE } from '../lib/config';
import type { Provenance } from '../types/provenance';

/**
 * Checks a photo against the provenance registry.
 *
 * The photo itself never leaves the browser — only its SHA-256 does. That is a
 * genuinely weaker promise than reading an embedded manifest offline, and the
 * dialog says so out loud, because a fingerprint is still something leaving
 * the visitor's machine.
 *
 * A row is readable by the same audience as the photo it describes, so this is
 * an ordinary query rather than a server round trip. A stranger checking a
 * private photo finds nothing, which is the intended answer.
 */

/** Lowercase hex SHA-256, the same encoding the function writes. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Hashes a file the visitor picked and reports what the registry holds.
 *
 * Never throws: an unreachable registry is a result to display, not an
 * exception for the caller to handle.
 */
export async function verifyFile(file: File): Promise<Provenance> {
    try {
        const sha256 = await sha256Hex(await file.arrayBuffer());

        const response = await tablesDB.listRows({
            databaseId,
            tableId: PROVENANCE_TABLE,
            queries: [Query.equal('sha256', sha256), Query.limit(1)],
        });

        const row = response.rows?.[0];
        if (!row) return { state: 'unregistered' };

        return {
            state: 'registered',
            ...(row.creator && { creator: row.creator }),
            ...(row.title && { title: row.title }),
            ...(row.registeredAt && { registeredAt: row.registeredAt }),
        };
    } catch (error) {
        console.warn('Could not check the provenance registry:', error);
        return { state: 'error' };
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- provenanceVerify`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/types/provenance.ts src/lib/config.ts src/services/provenanceVerify.ts tests/unit/provenanceVerify.test.ts
git commit -m "feat(provenance): verify photos against the registry by hash"
```

---

### Task 5: Rewrite the verify dialog

**Files:**
- Modify: `src/components/VerifyPhotoDialog.tsx`

**Interfaces:**
- Consumes: `Provenance`, `ProvenanceState`, and `verifyFile` from Task 4.
- Produces: nothing other tasks depend on.

There is no unit test here — the file is presentational and the project has no component-test setup. It is verified by `tsc` and by eye.

- [ ] **Step 1: Replace the results table**

Replace the `RESULTS` constant (lines 17-39) with:

```tsx
/** Headline and explanation for each outcome, in the visitor's terms. */
const RESULTS: Record<ProvenanceState, { headline: string; detail: string }> = {
    registered: {
        headline: 'Registered',
        detail: 'These exact bytes were published on photoframes.me, and have not changed since. The details below are what was recorded at the time.',
    },
    unregistered: {
        headline: 'Not in the registry',
        detail: 'No record matches this file. Either it was never published here, or it has been edited, re-encoded, or re-saved since — a registry records one exact sequence of bytes, so it cannot tell those apart.',
    },
    error: {
        headline: 'Could not check this file',
        detail: 'The registry could not be reached. This says nothing about the photo — try again in a moment.',
    },
};
```

- [ ] **Step 2: Point the dynamic import at the new service**

In `verify()` (around line 62), change the import and the comment:

```tsx
            // Imported here so the dialog's code only loads for the visitors
            // who actually open it.
            const { verifyFile } = await import('../services/provenanceVerify');
            setResult(await verifyFile(file));
```

- [ ] **Step 3: Correct the privacy claim**

The dialog currently promises that nothing is uploaded, which stops being true the moment a digest is sent. Replace the body copy (around line 113):

```tsx
                    Check whether a photo was published here, and whether it has changed
                    since. The photo stays on your device — only its fingerprint is sent.
```

And the header comment on the component (lines 41-47):

```tsx
/**
 * Lets anyone check a photo against the provenance registry.
 *
 * The photo stays on the visitor's machine; what leaves is a SHA-256 of its
 * bytes, which the registry is queried for. The dialog says this plainly
 * rather than claiming nothing is sent, because asking someone to hand over a
 * photo to prove a point about trust deserves an honest answer up front.
 */
```

- [ ] **Step 4: Fix the warning state and the detail fields**

In `Result` (around line 212), `modified` no longer exists. Nothing here is an accusation, so no outcome is coloured as a warning:

```tsx
function Result({ provenance, onReset }: { provenance: Provenance; onReset: () => void }) {
    const { headline, detail } = RESULTS[provenance.state];
```

Delete the `isWarning` constant and the `modified` check it held. Its one use is the
headline colour, which becomes plain `color: colors.text`. Separately, the detail
paragraph's `mb` expression still names a field that no longer exists — change
`provenance.creator || provenance.signedBy ? 3 : 0` to `provenance.creator || provenance.title ? 3 : 0`.

Replace the four `Field` rows with:

```tsx
            {provenance.creator && <Field label="Creator" value={provenance.creator} />}
            {provenance.title && <Field label="Title" value={provenance.title} />}
            {provenance.registeredAt && (
                <Field label="Registered" value={new Date(provenance.registeredAt).toLocaleString()} />
            )}
```

- [ ] **Step 5: Update the progress label**

The spinner says "Reading credentials…" (around line 148). Change it to `Checking the registry…`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: no errors. If `tsc` still reports `modified`, `signedBy`, `issuer`, or `signedAt`, a reference was missed above.

- [ ] **Step 7: Commit**

```bash
git add src/components/VerifyPhotoDialog.tsx
git commit -m "feat(verify): check photos against the registry instead of reading manifests"
```

---

### Task 6: Direct upload and registration

**Files:**
- Modify: `src/services/galleryService.ts:29-107`
- Modify: `src/lib/config.ts:21-26`

**Interfaces:**
- Consumes: the `register` action from Task 2, `ownerPermissions` from `src/lib/permissions.ts`.
- Produces: `registerPhotoFunctionId` in config; `uploadImage(file, isPublic, creator, title, ownerId)` returning the storage file id. Task 7 relies on the registry row id equalling that file id.

No unit test: this function is entirely Appwrite I/O and the repo tests such paths through `tests/integration`. It is verified by the manual publish in Step 6.

- [ ] **Step 1: Rename the function id in config**

In `src/lib/config.ts`, replace the `signPhotoFunctionId` export (lines 21-26) with:

```ts
/**
 * The Appwrite Function that hashes a stored photo and records it in the
 * provenance registry. The browser uploads the file itself; this only attests
 * the hash, which it computes from the stored bytes rather than trusting the
 * client for it.
 */
export const registerPhotoFunctionId: string = import.meta.env.VITE_APPWRITE_REGISTER_FN_ID;
```

- [ ] **Step 2: Update the imports in galleryService**

Line 4 becomes:

```ts
import { bucketId, databaseId, GALLERY_TABLE, PHOTOS_TABLE, photosTableId, PROVENANCE_TABLE, registerPhotoFunctionId } from '../lib/config';
```

- [ ] **Step 3: Replace `blobToBase64` and `uploadImage`**

Delete `blobToBase64` (lines 29-37) entirely — nothing else uses it. Replace `uploadImage` (lines 39-90) with:

```ts
/**
 * Downscales one image, stores it, and has `register-photo` record its hash.
 *
 * The browser writes the file itself now. Nothing needs to happen to the bytes
 * before they land in the bucket — the hash is taken from what is stored, by
 * the function, reading it back out. That is what makes the registry an
 * attestation rather than a client's word: a browser that could supply its own
 * hash could register a file it does not own.
 *
 * There is deliberately no unregistered path. If registration fails the file is
 * deleted and the publish fails, rather than quietly keeping a photo whose
 * provenance nothing can confirm.
 *
 * @returns the storage file id
 */
async function uploadImage(
    file: File,
    isPublic: boolean,
    creator: string,
    title: string,
    ownerId: string,
): Promise<string> {
    // The bucket enforces these server-side too; failing here just saves a
    // pointless round trip with a large body.
    if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error('Unsupported file type.');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error('File exceeds the maximum allowed size.');
    }

    // The resize re-encodes to WebP, so the picked file's type no longer
    // describes the bytes being sent. The blob's own type does, and it also
    // covers the browser that fell back to PNG instead.
    const resized = await resizeImage(file, UPLOAD_MAX_WIDTH);
    const uploadType = resized.type || 'image/webp';
    const name = fileNameForType(file.name, uploadType);

    const stored = await storage.createFile({
        bucketId,
        fileId: ID.unique(),
        file: new File([resized], name, { type: uploadType }),
        permissions: ownerPermissions(ownerId, isPublic),
    });

    try {
        const execution = await functions.createExecution({
            functionId: registerPhotoFunctionId,
            body: JSON.stringify({
                action: 'register',
                fileId: stored.$id,
                isPublic,
                creator,
                title,
            }),
        });

        const result = JSON.parse(execution.responseBody || '{}');
        if (execution.responseStatusCode !== 200 || !result.sha256) {
            throw new Error(result.error || 'Could not register the photo.');
        }
    } catch (error) {
        // Nothing references the file yet, and a photo with no provenance is
        // not what was asked for, so it does not stay.
        try {
            await storage.deleteFile({ bucketId, fileId: stored.$id });
        } catch (cleanupError) {
            console.error(`Failed to clean up ${stored.$id} after a failed registration:`, cleanupError);
        }
        throw error;
    }

    return stored.$id;
}
```

- [ ] **Step 4: Pass the new arguments through `createImage`**

In `createImage`, change the call on line 107 to hand over the title and owner:

```ts
    const imageId = await uploadImage(photo.file, isPublic, creator, photo.title, ownerId);
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors. A complaint that `blobToBase64` is unused means Step 3 deleted the caller but not the function.

- [ ] **Step 6: Verify a real publish**

Run `npm run dev`, publish an exhibition with one photo, then confirm in the Appwrite console that the bucket holds the file, `provenance` holds a row whose id equals the file id, and its permissions contain no `update(` entry. Open the verify dialog, drop the *original* file — it should read **Not in the registry**, because what was stored is the resized WebP, not the original. Download the stored file from the console and drop that — it should read **Registered**.

- [ ] **Step 7: Commit**

```bash
git add src/lib/config.ts src/services/galleryService.ts
git commit -m "feat(gallery): upload photos directly and register their hashes"
```

---

### Task 7: Registry cleanup on delete and visibility change

**Files:**
- Modify: `src/services/galleryService.ts` — `rollbackGallery`, `deletePhoto`, `deleteGallery`, `updateGalleryVisibility`

**Interfaces:**
- Consumes: `PROVENANCE_TABLE` from Task 4, the `visibility` action from Task 2, the file-id-as-row-id guarantee from Task 6.
- Produces: `deleteRegistryRow(imageId: string): Promise<void>` — best-effort, never throws.

- [ ] **Step 1: Add the helper**

Add above `rollbackGallery` (around line 147):

```ts
/**
 * Best-effort removal of a photo's registry row. Never throws.
 *
 * The row id is the storage file id, so no lookup is needed. A row left behind
 * would keep answering for a photo that no longer exists.
 */
async function deleteRegistryRow(imageId: string) {
    try {
        await tablesDB.deleteRow({ databaseId, tableId: PROVENANCE_TABLE, rowId: imageId });
    } catch (error) {
        console.warn(`Failed to delete provenance row ${imageId}:`, error);
    }
}
```

- [ ] **Step 2: Clean up in `rollbackGallery`**

In the `fileIds` loop (lines 154-158), delete the row before the file:

```ts
    for (const fileId of fileIds) {
        await deleteRegistryRow(fileId);
        try {
            await storage.deleteFile({ bucketId, fileId });
        } catch { /* already gone, or never created */ }
    }
```

- [ ] **Step 3: Clean up in `deletePhoto`**

Inside the `if (photo?.imageId)` block (lines 272-278), add the row deletion alongside the file deletion:

```ts
        if (photo?.imageId) {
            await deleteRegistryRow(photo.imageId);
            try {
                await storage.deleteFile({ bucketId, fileId: photo.imageId });
            } catch (error) {
                console.warn(`Failed to delete storage file ${photo.imageId}:`, error);
            }
        }
```

- [ ] **Step 4: Clean up in `deleteGallery`**

Inside the `if (photo.imageId)` block (lines 293-299):

```ts
            if (photo.imageId) {
                await deleteRegistryRow(photo.imageId);
                try {
                    await storage.deleteFile({ bucketId, fileId: photo.imageId });
                } catch (error) {
                    console.warn(`[deleteGallery] Failed to delete storage file ${photo.imageId}:`, error);
                }
            }
```

- [ ] **Step 5: Cascade visibility to registry rows**

Clients hold no `update` on a registry row, so they cannot re-permission one either. Without this step a gallery turned private keeps `read("any")` rows exposing its titles and creators.

In `updateGalleryVisibility`, inside the `photos.map` callback, after the `storage.updateFile` block (around line 355):

```ts
            if (photo.imageId) {
                try {
                    await functions.createExecution({
                        functionId: registerPhotoFunctionId,
                        body: JSON.stringify({
                            action: 'visibility',
                            fileId: photo.imageId,
                            isPublic,
                        }),
                    });
                } catch (error) {
                    console.warn(`Failed to update provenance visibility for ${photo.imageId}:`, error);
                }
            }
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 7: Verify by hand**

With `npm run dev`: publish a public gallery, confirm its `provenance` rows carry `read("any")`. Switch the gallery to private and confirm the rows lose `read("any")` while keeping the owner's read and delete. Delete the gallery and confirm its rows are gone.

- [ ] **Step 8: Commit**

```bash
git add src/services/galleryService.ts
git commit -m "feat(gallery): keep registry rows in step with photo deletion and visibility"
```

---

### Task 8: Remove the C2PA remnants

**Files:**
- Delete: `src/services/c2paVerify.ts`
- Delete: `tests/unit/c2paVerify.test.ts`
- Modify: `package.json`
- Stage: the already-deleted `functions/sign-photo/` and `functions/sign-photo-rs/`

**Interfaces:**
- Consumes: Task 5 having moved the dialog off `c2paVerify`.
- Produces: nothing.

- [ ] **Step 1: Confirm nothing still imports the old service**

Run: `grep -rn "c2paVerify\|c2pa-web\|signPhotoFunctionId\|SIGN_PHOTO_FN" src/ tests/ --include='*.ts' --include='*.tsx'`
Expected: matches only in `src/services/c2paVerify.ts` and `tests/unit/c2paVerify.test.ts`, both of which are about to go. Any other hit is a task above left unfinished.

- [ ] **Step 2: Delete the files**

```bash
git rm src/services/c2paVerify.ts tests/unit/c2paVerify.test.ts
```

- [ ] **Step 3: Drop the dependency**

```bash
npm uninstall @contentauth/c2pa-web
```

This removes roughly a megabyte of WebAssembly from the bundle. Confirm `@contentauth/c2pa-web` is gone from `package.json` and `package-lock.json`.

- [ ] **Step 4: Stage the function deletions**

Both signing functions were already deleted on disk. Stage those deletions:

```bash
git add -A functions/
```

- [ ] **Step 5: Run everything**

Run: `npm run test:unit && npx tsc -b && npm run lint && npm run build`
Expected: all unit tests pass, no type errors, no lint errors, and a clean production build. A build failure mentioning `c2pa.wasm` means a dynamic import survived somewhere.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove C2PA signing, verification, and the c2pa-web dependency"
```

---

## Done when

- Publishing a gallery stores a file and creates a `provenance` row whose id is the file id, with no `update` permission on it.
- Dropping the stored file into the verify dialog reads **Registered** with creator, title, and date; dropping anything else reads **Not in the registry**.
- Toggling a gallery private removes `read("any")` from its registry rows; deleting a photo or gallery removes them entirely.
- `functions/` contains only `login-resolver` and `register-photo`.
- `npm run test:unit`, `npx tsc -b`, `npm run lint`, and `npm run build` all pass.
