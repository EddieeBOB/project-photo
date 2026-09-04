import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { Reader } from '@contentauth/c2pa-node';

import { signImage } from '../src/sign.js';

const certPem = await readFile(new URL('../.certs/certificate.pem', import.meta.url));
const keyPem = await readFile(new URL('../.certs/private.key', import.meta.url));
const source = await readFile(new URL('./fixtures/sample.webp', import.meta.url));

test('signs a WebP and reads the manifest back', async () => {
    const signed = signImage(source, 'image/webp', {
        certPem,
        keyPem,
        title: 'seascape.webp',
        creator: 'Eddie Lam',
    });

    assert.ok(signed.length > source.length, 'signed asset should carry a manifest');

    const reader = await Reader.fromAsset({ buffer: signed, mimeType: 'image/webp' });
    const active = reader.getActive();

    assert.equal(active.title, 'seascape.webp');
    assert.ok(reader.isEmbedded(), 'manifest should be embedded, not remote');
});

test('names the creator in the manifest', async () => {
    const signed = signImage(source, 'image/webp', {
        certPem,
        keyPem,
        title: 'seascape.webp',
        creator: 'Eddie Lam',
    });

    const reader = await Reader.fromAsset({ buffer: signed, mimeType: 'image/webp' });
    const creativeWork = reader
        .getActive()
        .assertions.find((a) => a.label === 'stds.schema-org.CreativeWork');

    assert.equal(creativeWork?.data?.author?.[0]?.name, 'Eddie Lam');
});

test('adds a manifest without bloating the file', async () => {
    const signed = signImage(source, 'image/webp', { certPem, keyPem, title: 'x.webp' });

    // The builder embeds a full-quality copy of the asset as a manifest
    // thumbnail unless disabled, which costs roughly 10x the file size. This
    // guards that setting: a signed photo should gain tens of KB, not hundreds.
    const overhead = signed.length - source.length;
    assert.ok(overhead < 64 * 1024, `manifest overhead was ${overhead} bytes; thumbnail may be back on`);
});

test('validates an untouched signed asset', async () => {
    const signed = signImage(source, 'image/webp', { certPem, keyPem, title: 'x.webp' });

    const reader = await Reader.fromAsset({ buffer: signed, mimeType: 'image/webp' });
    const store = reader.json();

    assert.equal(store.validation_state, 'Valid');
    // The development root is on nobody's trust list, so an untrusted signing
    // credential is expected here and is not a validation failure.
    const codes = failureCodes(store);
    assert.deepEqual(codes, ['signingCredential.untrusted']);
});

test('detects tampering with the signed bytes', async () => {
    const signed = signImage(source, 'image/webp', { certPem, keyPem, title: 'x.webp' });

    // Flip a byte in the image data, well past the manifest at the head of the
    // file. This is the property the whole feature rests on: the manifest
    // hashes these bytes, so any edit has to surface as a validation failure.
    const tampered = Buffer.from(signed);
    tampered[tampered.length - 32] ^= 0xff;

    const reader = await Reader.fromAsset({ buffer: tampered, mimeType: 'image/webp' });
    const store = reader.json();

    assert.equal(store.validation_state, 'Invalid');
    assert.ok(
        failureCodes(store).includes('claimSignature.mismatch'),
        'a modified asset must report a signature mismatch',
    );
});

/** Validation failures reported against the active manifest, as bare codes. */
function failureCodes(store) {
    return (store.validation_results?.activeManifest?.failure ?? []).map((f) => f.code);
}
