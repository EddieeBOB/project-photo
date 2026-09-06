import { describe, it, expect } from 'vitest';
import { ownerPermissions, registryPermissions } from '../../src/lib/permissions';

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
