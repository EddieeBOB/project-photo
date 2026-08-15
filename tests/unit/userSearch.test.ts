import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Importing userService pulls in the Appwrite client, so the client module is
 * mocked out entirely — unit tests must never reach the network.
 */
const listRows = vi.fn();

vi.mock('../../src/lib/appwrite', () => ({
    tablesDB: { listRows: (...args: unknown[]) => listRows(...args) },
    storage: {},
    account: {},
}));

const { searchUsersByUsername } = await import('../../src/services/userService');

/** Appwrite query helpers serialize to JSON strings; decode them to assert on. */
function parseQueries(call: { queries: string[] }) {
    return call.queries.map((query) => JSON.parse(query));
}

function findQuery(call: { queries: string[] }, method: string) {
    return parseQueries(call).find((query) => query.method === method);
}

/** Builds a `users` row as the prefix query would return it. */
function userRow(id: string, username: string) {
    return { $id: id, username };
}

/** Builds a `gallery` row; `users` holds the owner id, as the API returns it. */
function galleryRow(ownerId: string, isPublic = true) {
    return { $id: `gallery-${ownerId}`, users: ownerId, isPublic };
}

/** Wires the two sequential calls: users prefix query, then gallery lookup. */
function mockSearch(users: object[], galleries: object[]) {
    listRows
        .mockResolvedValueOnce({ rows: users, total: users.length })
        .mockResolvedValueOnce({ rows: galleries, total: galleries.length });
}

beforeEach(() => {
    listRows.mockReset();
});

describe('searchUsersByUsername', () => {
    it('returns nothing without making a request when the term is empty', async () => {
        await expect(searchUsersByUsername('')).resolves.toEqual([]);
        await expect(searchUsersByUsername('   ')).resolves.toEqual([]);
        expect(listRows).not.toHaveBeenCalled();
    });

    it('prefix-matches the trimmed term against username', async () => {
        mockSearch([userRow('u1', 'Eddie')], [galleryRow('u1')]);

        await searchUsersByUsername('  ed  ');

        const startsWith = findQuery(listRows.mock.calls[0][0], 'startsWith');
        expect(startsWith).toMatchObject({ attribute: 'username', values: ['ed'] });
    });

    it('requests only the username column so no other user data can leak', async () => {
        mockSearch([userRow('u1', 'Eddie')], [galleryRow('u1')]);

        await searchUsersByUsername('ed');

        const select = findQuery(listRows.mock.calls[0][0], 'select');
        expect(select.values).toEqual(['username']);
    });

    it('keeps only users that own at least one public gallery', async () => {
        mockSearch(
            [userRow('u1', 'Eddie'), userRow('u2', 'Edgar'), userRow('u3', 'Edwin')],
            [galleryRow('u1'), galleryRow('u3')],
        );

        const results = await searchUsersByUsername('ed');

        expect(results).toEqual([
            { id: 'u1', username: 'Eddie' },
            { id: 'u3', username: 'Edwin' },
        ]);
    });

    it('asks the gallery table only for public galleries owned by the matched users', async () => {
        mockSearch([userRow('u1', 'Eddie'), userRow('u2', 'Edgar')], [galleryRow('u1')]);

        await searchUsersByUsername('ed');

        const equals = parseQueries(listRows.mock.calls[1][0]).filter((q) => q.method === 'equal');
        expect(equals).toContainEqual(
            expect.objectContaining({ attribute: 'users', values: ['u1', 'u2'] }),
        );
        expect(equals).toContainEqual(
            expect.objectContaining({ attribute: 'isPublic', values: [true] }),
        );
    });

    it('skips the gallery lookup entirely when no username matches', async () => {
        listRows.mockResolvedValueOnce({ rows: [], total: 0 });

        await expect(searchUsersByUsername('zzz')).resolves.toEqual([]);
        expect(listRows).toHaveBeenCalledTimes(1);
    });

    it('caps the list at eight suggestions', async () => {
        const users = Array.from({ length: 12 }, (_, i) => userRow(`u${i}`, `Ed${i}`));
        mockSearch(users, users.map((user) => galleryRow(user.$id)));

        const results = await searchUsersByUsername('ed');

        expect(results).toHaveLength(8);
    });

    it('resolves owner ids when the gallery relationship comes back expanded', async () => {
        mockSearch(
            [userRow('u1', 'Eddie')],
            [{ $id: 'g1', users: { $id: 'u1', username: 'Eddie' }, isPublic: true }],
        );

        await expect(searchUsersByUsername('ed')).resolves.toEqual([
            { id: 'u1', username: 'Eddie' },
        ]);
    });
});
