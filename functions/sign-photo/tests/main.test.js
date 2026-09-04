import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import handler from '../src/main.js';

const image = (await readFile(new URL('./fixtures/sample.webp', import.meta.url))).toString('base64');

/**
 * A stand-in for the Appwrite runtime's response object, capturing what the
 * handler sends rather than writing it anywhere.
 */
function context(req) {
    const sent = {};
    return {
        req,
        res: {
            json(body, status = 200) {
                sent.body = body;
                sent.status = status;
                return sent;
            },
        },
        log: () => {},
        error: () => {},
        sent,
    };
}

/** A well-formed request, so each test can vary one thing about it. */
function request({ headers, ...overrides } = {}) {
    return {
        headers: { 'x-appwrite-user-id': 'user123', ...headers },
        bodyJson: {
            image,
            mimeType: 'image/webp',
            name: 'seascape.webp',
            isPublic: true,
            ...overrides,
        },
    };
}

/** Runs the handler against a request, returning what it responded with. */
async function invoke(req, env = {}) {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    const ctx = context(req);
    try {
        await handler(ctx);
        return ctx.sent;
    } finally {
        process.env = saved;
    }
}

const configured = {
    C2PA_CERT_PEM: Buffer.from('cert').toString('base64'),
    C2PA_PRIVATE_KEY_PEM: Buffer.from('key').toString('base64'),
    APPWRITE_BUCKET_ID: 'photos',
};

test('rejects a caller with no session', async () => {
    const sent = await invoke({ ...request(), headers: {} }, configured);

    assert.equal(sent.status, 401);
});

test('rejects an unparseable body', async () => {
    const sent = await invoke(
        { headers: { 'x-appwrite-user-id': 'user123' }, bodyRaw: 'not json' },
        configured,
    );

    assert.equal(sent.status, 400);
});

test('rejects a request with no image', async () => {
    const sent = await invoke(request({ image: undefined }), configured);

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /image/);
});

test('rejects a request with no name', async () => {
    const sent = await invoke(request({ name: '   ' }), configured);

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /name/);
});

test('rejects an image type the pipeline never produces', async () => {
    const sent = await invoke(request({ mimeType: 'image/gif' }), configured);

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /type/i);
});

test('rejects an image larger than the ceiling', async () => {
    const sent = await invoke(
        request({ image: Buffer.alloc(11 * 1024 * 1024).toString('base64') }),
        configured,
    );

    assert.equal(sent.status, 400);
    assert.match(sent.body.error, /size/i);
});

test('reports a missing signing identity as a server error, not a bad request', async () => {
    const sent = await invoke(request(), {
        ...configured,
        C2PA_CERT_PEM: '',
        C2PA_PRIVATE_KEY_PEM: '',
    });

    assert.equal(sent.status, 500);
    // The caller learns nothing about why; the detail goes to the log.
    assert.doesNotMatch(sent.body.error, /cert|key|PEM/i);
});

test('reports a missing bucket as a server error', async () => {
    const sent = await invoke(request(), { ...configured, APPWRITE_BUCKET_ID: '' });

    assert.equal(sent.status, 500);
});
