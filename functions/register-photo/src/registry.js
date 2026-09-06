import { createHash } from 'node:crypto';

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// No update grant: owners must not be able to rewrite their stored hash.
export function registryPermissions(ownerId, isPublic) {
  const perms = [`read("user:${ownerId}")`, `delete("user:${ownerId}")`];
  if (isPublic) perms.push('read("any")');
  return perms;
}

// Only these errors carry messages that are safe to return to the caller.
const fail = (status, message) => Object.assign(new Error(message), { status });

export function createRegistry({ storage, databases, bucketId, databaseId, tableId, userId, error }) {
  async function permissionsFor(fileId) {
    const file = await storage.getFile(bucketId, fileId).catch((e) => {
      if (e.code === 404) throw fail(404, 'Unknown file.');
      throw fail(500, 'Could not look up the file.');
    });
    const permissions = file.$permissions || [];

    // Public read access does not prove ownership; the delete grant does.
    if (!permissions.includes(`delete("user:${userId}")`)) {
      throw fail(403, 'You do not own this file.');
    }
    return registryPermissions(userId, permissions.includes('read("any")'));
  }

  async function register(fileId) {
    const permissions = await permissionsFor(fileId);
    const bytes = await storage.getFileDownload(bucketId, fileId);
    const digest = sha256(Buffer.from(bytes));

    try {
      // No timestamp of our own: Appwrite stamps the row's `$createdAt`, which
      // neither the caller nor this function can set, and which a re-registration
      // leaves where it was.
      await databases.createDocument(
        databaseId,
        tableId,
        fileId,
        { imageId: fileId, sha256: digest },
        permissions,
      );
      return digest;
    } catch (e) {
      if (e.code !== 409) throw e;
      // Re-registration returns the original digest without overwriting it.
      const existing = await databases.getDocument(databaseId, tableId, fileId);
      return existing.sha256;
    }
  }

  async function visibility(fileIds) {
    const results = await Promise.all(fileIds.map(async (fileId) => {
      try {
        const permissions = await permissionsFor(fileId);
        await databases.updateDocument(databaseId, tableId, fileId, {}, permissions);
        return true;
      } catch (e) {
        // A stale or unauthorized file must not abort the rest of the batch.
        error(`visibility skipped ${fileId}: ${e.message}`);
        return false;
      }
    }));
    const updated = results.filter(Boolean).length;
    return { ok: true, updated, skipped: results.length - updated };
  }

  return { register, visibility };
}
