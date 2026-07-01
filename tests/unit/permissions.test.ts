import { describe, it, expect } from 'vitest';
import { ownerPermissions } from '../../src/lib/permissions';

const UID = 'user-123';

describe('ownerPermissions', () => {
    it('grants the owner read/update/delete for a private resource and nothing public', () => {
        const perms = ownerPermissions(UID, false);
        expect(perms).toEqual([
            `read("user:${UID}")`,
            `update("user:${UID}")`,
            `delete("user:${UID}")`,
        ]);
        // crucially, no public read on private resources
        expect(perms).not.toContain('read("any")');
    });

    it('adds public read for a public resource while keeping owner-only write', () => {
        const perms = ownerPermissions(UID, true);
        expect(perms).toContain('read("any")');
        expect(perms).toContain(`read("user:${UID}")`);
        expect(perms).toContain(`update("user:${UID}")`);
        expect(perms).toContain(`delete("user:${UID}")`);
        // public users must NOT get write access
        expect(perms).not.toContain('update("any")');
        expect(perms).not.toContain('delete("any")');
    });

    it('scopes write permissions to the specific owner, not all users', () => {
        const perms = ownerPermissions(UID, true);
        expect(perms).not.toContain('update("users")');
        expect(perms).not.toContain('delete("users")');
    });
});
