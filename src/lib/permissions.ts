import { Permission, Role } from 'appwrite';

/**
 * Builds the document/file permission set for a resource owned by `ownerId`.
 * The owner always has full read/write/delete; public resources additionally
 * grant read to anyone. This is the single source of truth for the per-document
 * authorization model — used when creating galleries, photos, files, and the
 * user profile row, and kept here (free of browser/SDK-client dependencies) so
 * it can be unit-tested in isolation.
 */
export function ownerPermissions(ownerId: string, isPublic: boolean): string[] {
    const perms = [
        Permission.read(Role.user(ownerId)),
        Permission.update(Role.user(ownerId)),
        Permission.delete(Role.user(ownerId)),
    ];
    if (isPublic) {
        perms.push(Permission.read(Role.any()));
    }
    return perms;
}

/**
 * Builds the permission set for a `provenance` registry row.
 *
 * Deliberately narrower than `ownerPermissions`: there is no `update` for any
 * role. Appwrite permissions are per-row rather than per-column, so an owner
 * who could update this row could rewrite the hash inside it — which is the
 * one forgery the registry exists to prevent. An owner may still delete their
 * row, so removing a photo can remove its provenance with it.
 *
 * Nothing in the browser calls this, and nothing should: registry rows are
 * written only by `functions/register-photo`, which holds the API key and runs
 * on the server SDK, so it cannot import this module. It keeps its own copy in
 * `src/registry.js`. This is the tested reference that copy is checked against
 * — the rule lives here even though the code that runs lives there.
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
