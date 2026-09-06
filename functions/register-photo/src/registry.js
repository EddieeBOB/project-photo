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
