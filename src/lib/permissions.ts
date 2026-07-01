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
