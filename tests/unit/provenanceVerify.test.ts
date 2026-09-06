import { beforeEach, describe, expect, it, vi } from 'vitest';

const listRows = vi.fn();

vi.mock('../../src/lib/appwrite', () => ({
    tablesDB: { listRows: (...args: unknown[]) => listRows(...args) },
}));
vi.mock('../../src/lib/config', () => ({
    databaseId: 'test-db',
    PROVENANCE_TABLE: 'provenance',
}));

const { sha256Hex, verifyFile } = await import('../../src/services/provenanceVerify');

describe('sha256Hex', () => {
    it('matches the published digest for "abc"', async () => {
        const bytes = new TextEncoder().encode('abc');
        expect(await sha256Hex(bytes.buffer as ArrayBuffer)).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
    });
});

describe('verifyFile', () => {
    // A per-mock `.mockReset()` here trips a vitest/tinyspy interaction on this
    // toolchain's Node version: an already-caught rejection from a later test
    // gets misreported as unhandled, with no assertion failure to show for it.
    // `vi.clearAllMocks()` clears the same call/result state through a
    // different path that doesn't hit it. See task-4-report.md for the isolated
    // repro (plain `vi.fn()` + `beforeEach` reset + `mockRejectedValue`, no
    // application code involved).
    beforeEach(() => vi.clearAllMocks());

    it('reports a digest the registry knows as registered', async () => {
        listRows.mockResolvedValue({
            rows: [{ creator: 'Eddie Lam', title: 'Dusk', registeredAt: '2026-09-04T10:00:00.000Z' }],
        });

        expect(await verifyFile(new File(['abc'], 'a.webp', { type: 'image/webp' }))).toEqual({
            state: 'registered',
            registeredAt: '2026-09-04T10:00:00.000Z',
        });
    });

    it('queries on the digest of the file, not its name', async () => {
        listRows.mockResolvedValue({ rows: [] });
        await verifyFile(new File(['abc'], 'a.webp', { type: 'image/webp' }));

        const [{ queries }] = listRows.mock.calls[0] as [{ queries: string[] }];
        expect(queries[0]).toContain('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    // An altered file and a file that was never registered are genuinely
    // indistinguishable to a hash registry. Reporting either as "modified"
    // would claim more than the data supports.
    it('reports an unknown digest as unregistered', async () => {
        listRows.mockResolvedValue({ rows: [] });
        expect(await verifyFile(new File(['abc'], 'a.webp'))).toEqual({ state: 'unregistered' });
    });

    it('reports a failed lookup as an error rather than as unregistered', async () => {
        listRows.mockRejectedValue(new Error('offline'));
        expect(await verifyFile(new File(['abc'], 'a.webp'))).toEqual({ state: 'error' });
    });

    it('omits fields the row does not carry', async () => {
        listRows.mockResolvedValue({ rows: [{ registeredAt: '2026-09-04T10:00:00.000Z' }] });
        expect(await verifyFile(new File(['abc'], 'a.webp'))).toEqual({
            state: 'registered',
            registeredAt: '2026-09-04T10:00:00.000Z',
        });
    });

    // Every detail field is optional, so `registered` on its own is a real
    // result and the dialog has to lay it out sensibly.
    it('still reports registered when the row carries no details at all', async () => {
        listRows.mockResolvedValue({ rows: [{}] });
        expect(await verifyFile(new File(['abc'], 'a.webp'))).toEqual({ state: 'registered' });
    });

    // Two rows can share a digest when someone republishes bytes they obtained
    // elsewhere. Ordering makes the answer the earliest registration rather
    // than whichever row the index happened to hand back first.
    it('asks for the earliest registration when a digest appears more than once', async () => {
        listRows.mockResolvedValue({ rows: [] });
        await verifyFile(new File(['abc'], 'a.webp'));

        const [{ queries }] = listRows.mock.calls[0] as [{ queries: string[] }];
        expect(queries.some((query) => query.includes('orderAsc') && query.includes('$createdAt'))).toBe(true);
    });
});
