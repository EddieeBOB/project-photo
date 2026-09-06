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
