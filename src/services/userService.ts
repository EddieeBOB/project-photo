import { Query, type Models } from 'appwrite';

import { tablesDB } from '../lib/appwrite';
import { databaseId, GALLERY_TABLE, USERS_TABLE } from '../lib/config';

/**
 * Reads against the `users` table.
 *
 * Every query here selects an explicit column list. A bare `*` on `users` would
 * ship each matched user's email to the browser, so the field lists below are
 * the boundary between public profile data and PII — treat widening them as a
 * privacy change.
 */

/** A `users` row with its related `gallery` rows populated. */
export type UserRow = Models.Row & {
    username: string;
    gallery?: (Models.DefaultRow & { galleryTitle?: string; photos?: Models.DefaultRow[]; isPublic?: boolean })[];
};

/** A photographer surfaced by the navbar search. */
export interface UserSearchResult {
    id: string;
    username: string;
}

/** Public-safe columns for a profile page, plus the galleries hanging off it. */
const PUBLIC_PROFILE_FIELDS = ['username', 'gallery.*', 'gallery.photos.*'];

/** How many suggestions the search dropdown shows. */
const MAX_SEARCH_RESULTS = 8;
/** How many prefix matches to consider before filtering to public profiles. */
const SEARCH_CANDIDATE_LIMIT = 25;

/**
 * Loads the signed-in user's own row together with every gallery and photo
 * they own, in a single request.
 *
 * @param userId - The id of the currently logged-in user
 */
export async function fetchUserGallery(userId: string) {
    const response = await tablesDB.listRows<UserRow>({
        databaseId,
        tableId: USERS_TABLE,
        queries: [
            Query.equal('$id', userId),
            Query.select(['*', 'gallery.*', 'gallery.photos.*']),
        ],
    });
    return response.rows[0];
}

/**
 * Looks up a photographer's public profile by username.
 *
 * Usernames are stored as typed, so an exact match is tried first and a
 * case-/whitespace-insensitive scan of the first 100 rows serves as a fallback
 * for links that were shared with different casing.
 *
 * @returns the matching row, or `null` if no such username exists
 */
export async function fetchUserGalleryByUsername(username: string) {
    try {
        const exactMatch = await tablesDB.listRows<UserRow>({
            databaseId,
            tableId: USERS_TABLE,
            queries: [
                Query.equal('username', username),
                Query.select(PUBLIC_PROFILE_FIELDS),
            ],
        });

        if (exactMatch.rows?.length > 0) {
            return exactMatch.rows[0];
        }

        const candidates = await tablesDB.listRows<UserRow>({
            databaseId,
            tableId: USERS_TABLE,
            queries: [
                Query.limit(100),
                Query.select(PUBLIC_PROFILE_FIELDS),
            ],
        });

        const target = username.trim().toLowerCase();
        const match = candidates.rows.find((row) => (row.username || '').trim().toLowerCase() === target);

        return match || null;
    } catch (error) {
        console.error('Failed to fetch user by username:', error);
        throw error;
    }
}

/** A `gallery` row as returned when filtering by owner. */
type GalleryOwnerRow = Models.Row & {
    isPublic?: boolean;
    users?: string | Models.DefaultRow | null;
};

/**
 * Returns the subset of `userIds` that own at least one public gallery.
 *
 * The `gallery` relationship does not expand reliably when reading from the
 * `users` side, so the gallery table is asked directly. `Query.equal` accepts an
 * array, so this stays a single request no matter how many candidates there are.
 */
async function fetchPublicGalleryOwnerIds(userIds: string[]): Promise<Set<string>> {
    const response = await tablesDB.listRows<GalleryOwnerRow>({
        databaseId,
        tableId: GALLERY_TABLE,
        queries: [
            Query.equal('users', userIds),
            Query.equal('isPublic', true),
            // Generous relative to SEARCH_CANDIDATE_LIMIT: only exceeded if the
            // candidates collectively own more than this many public galleries,
            // in which case later owners would be missed.
            Query.limit(200),
        ],
    });

    const ownerIds = (response.rows || [])
        // The owner arrives as a bare id, or as an expanded row depending on
        // how the SDK resolves the relationship.
        .map((row) => (typeof row.users === 'string' ? row.users : row.users?.$id))
        .filter((id): id is string => Boolean(id));

    return new Set(ownerIds);
}

/**
 * Finds photographers whose username starts with `prefix`, keeping only those
 * with something public to show.
 *
 * Matching is prefix-only and case-insensitive: "ed" finds "EddieeBOB", "bob"
 * does not. Backed by the `user_index` key index on `users.username`.
 *
 * @param prefix - The partial username typed by the searcher
 * @returns Up to {@link MAX_SEARCH_RESULTS} matches, empty if the term is blank
 */
export async function searchUsersByUsername(prefix: string): Promise<UserSearchResult[]> {
    const term = prefix.trim();
    if (!term) return [];

    try {
        // Only `username` is selected, so no other user column can reach the browser.
        const response = await tablesDB.listRows<UserRow>({
            databaseId,
            tableId: USERS_TABLE,
            queries: [
                Query.startsWith('username', term),
                Query.select(['username']),
                Query.orderAsc('username'),
                Query.limit(SEARCH_CANDIDATE_LIMIT),
            ],
        });

        const candidates = response.rows || [];
        if (candidates.length === 0) return [];

        const publicOwnerIds = await fetchPublicGalleryOwnerIds(candidates.map((row) => row.$id));

        return candidates
            .filter((row) => publicOwnerIds.has(row.$id))
            .slice(0, MAX_SEARCH_RESULTS)
            .map((row) => ({ id: row.$id, username: row.username }));
    } catch (error) {
        console.error('Failed to search users by username:', error);
        throw error;
    }
}
