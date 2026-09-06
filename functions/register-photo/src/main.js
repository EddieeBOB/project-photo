import { Client, Databases, Storage } from 'node-appwrite';

import { registryPermissions, sha256 } from './registry.js';

/**
 * register-photo — hashes a photo already in the bucket and records the digest
 * in the provenance registry, so the registry attests bytes the server saw
 * rather than a number the client sent.
 *
 * Two actions: `register` writes a row, `visibility` re-permissions existing
 * rows when a gallery changes between public and private. README.md has the
 * full contract and the table settings this depends on.
 */

/**
 * How many photos one `visibility` call may reconcile.
 *
 * Appwrite rate-limits how many executions you create, not the work inside one,
 * so a call per photo throttles partway through a large gallery and leaves the
 * rest of its rows publicly readable. Batching makes an ordinary gallery one
 * execution: 100 is `PHOTO_PAGE_SIZE` in galleryService, the page its photos
 * are already walked in. Anything larger the client sends in chunks.
 */
const MAX_VISIBILITY_BATCH = 100;

/**
 * An error whose message is safe to show the caller, tagged with its status.
 *
 * Untagged errors are bugs rather than refusals, so the handler reports those
 * as a flat 500 instead of leaking what threw.
 */
const fail = (status, message) => Object.assign(new Error(message), { status });

/** Whether the stored file is world-readable. Its registry row follows suit. */
const fileIsPublic = (file) => (file.$permissions || []).includes('read("any")');

/** Fetches a file, refusing unless the caller owns it. */
async function ownedFile({ storage, bucketId, userId }, fileId) {
  const file = await storage.getFile(bucketId, fileId).catch((e) => {
    if (e.code === 404) throw fail(404, 'Unknown file.');
    throw fail(500, 'Could not look up the file.');
  });

  // The delete grant, not the read grant: a public photo is readable by
  // everyone, so a read check would admit any caller.
  if (!(file.$permissions || []).includes(`delete("user:${userId}")`)) {
    throw fail(403, 'You do not own this file.');
  }
  return file;
}

/**
 * Hashes the bytes already in the bucket and records them.
 *
 * @returns the digest — the previously stored one if this file is already registered
 */
async function registerPhoto(context, fileId) {
  const { storage, databases, bucketId, databaseId, tableId, userId } = context;

  if (!fileId) throw fail(400, 'fileId is required.');

  const file = await ownedFile(context, fileId);
  const bytes = await storage.getFileDownload(bucketId, fileId);
  const digest = sha256(Buffer.from(bytes));

  try {
    await databases.createDocument(
      databaseId,
      tableId,
      fileId,
      { imageId: fileId, sha256: digest, registeredAt: new Date().toISOString() },
      registryPermissions(userId, fileIsPublic(file)),
    );
    return digest;
  } catch (e) {
    if (e.code !== 409) throw e;

    // Re-registering collides on the row id. Return the stored digest rather
    // than overwriting it — overwriting would be a way to replace a hash.
    const existing = await databases.getDocument(databaseId, tableId, fileId);
    return existing.sha256;
  }
}

/**
 * Brings a batch of registry rows back in step with their files' visibility.
 *
 * Clients hold no `update` on those rows — that is what stops an owner
 * rewriting their own hash — so they cannot re-permission one themselves.
 *
 * @returns `{ ok, updated, skipped }`; a bad id is counted, never thrown
 */
async function reconcileVisibility(context, fileIds) {
  const { databases, databaseId, tableId, userId, error } = context;

  const ids = Array.isArray(fileIds)
    ? [...new Set(fileIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    : [];
  if (ids.length === 0) throw fail(400, 'fileIds must be a non-empty array.');
  if (ids.length > MAX_VISIBILITY_BATCH) {
    throw fail(400, `At most ${MAX_VISIBILITY_BATCH} files per call.`);
  }

  // Each file is settled on its own: one stale id must not cost the rest of the
  // gallery its reconciliation, so nothing here rejects.
  const settled = await Promise.all(ids.map(async (fileId) => {
    try {
      const file = await ownedFile(context, fileId);
      await databases.updateDocument(
        databaseId,
        tableId,
        fileId,
        {},
        registryPermissions(userId, fileIsPublic(file)),
      );
      return true;
    } catch (e) {
      error(`visibility skipped ${fileId}: ${e.message}`);
      return false;
    }
  }));

  const updated = settled.filter(Boolean).length;
  return { ok: true, updated, skipped: settled.length - updated };
}

/**
 * Resolves the ids and SDK clients both actions need.
 *
 * Read per request rather than at import, so changing a function variable takes
 * effect on the next call instead of the next cold start.
 */
function contextFor(req, userId, error) {
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  if (!databaseId || !bucketId) {
    error('APPWRITE_DATABASE_ID and APPWRITE_BUCKET_ID must both be set');
    throw fail(500, 'Registration is unavailable.');
  }

  const admin = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] || '');

  return {
    databaseId,
    bucketId,
    tableId: process.env.APPWRITE_PROVENANCE_TABLE_ID || 'provenance',
    storage: new Storage(admin),
    databases: new Databases(admin),
    userId,
    error,
  };
}

export default async ({ req, res, error }) => {
  // Appwrite sets this from the caller's session; the body never gets a say in
  // who owns a photo.
  const userId = req.headers['x-appwrite-user-id'] || '';
  if (!userId) return res.json({ error: 'Authentication required.' }, 401);

  let body;
  try {
    body = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : {});
  } catch {
    return res.json({ error: 'Invalid request body.' }, 400);
  }

  try {
    const action = String(body.action ?? '').trim();
    if (!action) throw fail(400, 'action is required.');

    const context = contextFor(req, userId, error);

    if (action === 'register') {
      const fileId = String(body.fileId ?? '').trim();
      return res.json({ sha256: await registerPhoto(context, fileId) });
    }
    if (action === 'visibility') {
      return res.json(await reconcileVisibility(context, body.fileIds));
    }
    throw fail(400, 'Unknown action.');
  } catch (e) {
    error(e.stack || e.message);
    // Only a tagged error is safe to show; anything else is a bug, not a refusal.
    return res.json({ error: e.status ? e.message : 'Operation failed.' }, e.status || 500);
  }
};
