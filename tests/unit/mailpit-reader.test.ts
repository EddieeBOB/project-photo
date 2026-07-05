import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    mailpitUrl,
    mailpitAvailable,
    requestMailpitOtp,
    waitForMailpitOtp,
} from '../e2e/2fa/fixtures/mailpit';

/**
 * Unit coverage for the Mailpit OTP reader — the piece that makes the 2FA
 * pipeline automated. Docker/Mailpit aren't needed here: we stub global fetch to
 * simulate the REST API and assert the behaviours the specs depend on:
 *   - extract the 6-digit code (from snippet, else the full body)
 *   - ignore mail older than the requestMailpitOtp() cutoff (no stale codes)
 *   - delete the message once consumed (so a re-send stays unambiguous)
 */

type Json = Record<string, unknown>;
const ok = (body: Json = {}) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

const nowIso = () => new Date().toISOString();
const oldIso = '2020-01-01T00:00:00Z';

let deleted: string[][] = [];

/** Route fetch by URL/method; `messages` is the current search result set. */
function installFetch(messages: Json[], bodyText = '') {
    deleted = [];
    const impl = vi.fn(async (url: string, init?: RequestInit) => {
        const u = String(url);
        const method = init?.method ?? 'GET';
        if (u.includes('/api/v1/info')) return ok({ Version: 'test' }) as unknown as Response;
        if (method === 'DELETE' && u.includes('/api/v1/messages')) {
            const parsed = init?.body ? (JSON.parse(String(init.body)) as { IDs?: string[] }) : {};
            deleted.push(parsed.IDs ?? []);
            return ok() as unknown as Response;
        }
        if (u.includes('/api/v1/search')) return ok({ messages }) as unknown as Response;
        if (u.includes('/api/v1/message/')) return ok({ Text: bodyText }) as unknown as Response;
        throw new Error(`unexpected fetch: ${method} ${u}`);
    });
    vi.stubGlobal('fetch', impl);
    return impl;
}

beforeEach(() => {
    delete process.env.MAILPIT_URL;
    delete process.env.E2E_MAILPIT_URL;
});
afterEach(() => vi.unstubAllGlobals());

describe('mailpitUrl', () => {
    it('defaults to localhost:8025 and strips trailing slashes', () => {
        expect(mailpitUrl()).toBe('http://localhost:8025');
        process.env.MAILPIT_URL = 'http://mail.test:9000/';
        expect(mailpitUrl()).toBe('http://mail.test:9000');
    });
});

describe('mailpitAvailable', () => {
    it('true when /api/v1/info responds', async () => {
        installFetch([]);
        expect(await mailpitAvailable()).toBe(true);
    });
    it('false when fetch rejects', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
        expect(await mailpitAvailable()).toBe(false);
    });
});

describe('waitForMailpitOtp', () => {
    it('returns the code from the snippet and deletes that message', async () => {
        installFetch([{ ID: 'm1', Created: nowIso(), Snippet: 'Your code is 482913 — expires soon' }]);
        await requestMailpitOtp('user@local.test');
        const code = await waitForMailpitOtp('user@local.test', { timeoutMs: 2000, pollMs: 10 });
        expect(code).toBe('482913');
        expect(deleted).toContainEqual(['m1']);
    });

    it('falls back to the full body when the snippet has no code', async () => {
        installFetch(
            [{ ID: 'm2', Created: nowIso(), Snippet: 'Verify your sign-in' }],
            'Hello,\n\nEnter 771002 to finish signing in.\n',
        );
        await requestMailpitOtp('user@local.test');
        const code = await waitForMailpitOtp('user@local.test', { timeoutMs: 2000, pollMs: 10 });
        expect(code).toBe('771002');
    });

    it('ignores messages older than the request cutoff (no stale codes)', async () => {
        installFetch([
            { ID: 'stale', Created: oldIso, Snippet: 'old code 111111' },
            { ID: 'fresh', Created: nowIso(), Snippet: 'new code 222222' },
        ]);
        await requestMailpitOtp('user@local.test');
        const code = await waitForMailpitOtp('user@local.test', { timeoutMs: 2000, pollMs: 10 });
        expect(code).toBe('222222');
        expect(deleted).toContainEqual(['fresh']);
    });

    it('times out with a helpful error when only stale mail exists', async () => {
        installFetch([{ ID: 'stale', Created: oldIso, Snippet: 'old code 111111' }]);
        await requestMailpitOtp('user@local.test');
        await expect(
            waitForMailpitOtp('user@local.test', { timeoutMs: 60, pollMs: 10 }),
        ).rejects.toThrow(/Timed out.*Mailpit OTP/);
    });
});
