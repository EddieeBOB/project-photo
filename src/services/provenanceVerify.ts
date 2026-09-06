import { Query } from 'appwrite';

import { tablesDB } from '../lib/appwrite';
import { databaseId, PROVENANCE_TABLE } from '../lib/config';
import type { Provenance } from '../types/provenance';

/**
 * Checks a photo against the provenance registry.
 *
 * The photo itself never leaves the browser — only its SHA-256 does. That is a
 * genuinely weaker promise than reading an embedded manifest offline, and the
 * dialog says so out loud, because a fingerprint is still something leaving
 * the visitor's machine.
 *
 * A row is readable by the same audience as the photo it describes, so this is
 * an ordinary query rather than a server round trip. A stranger checking a
 * private photo finds nothing, which is the intended answer.
 */

/** Lowercase hex SHA-256, the same encoding the function writes. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Hashes a file the visitor picked and reports what the registry holds.
 *
 * Never throws: an unreachable registry is a result to display, not an
 * exception for the caller to handle.
 */
export async function verifyFile(file: File): Promise<Provenance> {
    try {
        const sha256 = await sha256Hex(await file.arrayBuffer());

        const response = await tablesDB.listRows({
            databaseId,
            tableId: PROVENANCE_TABLE,
            // A digest can legitimately appear on more than one row: someone
            // may download a public photo and republish the same bytes as their
            // own, which registers cleanly because the file genuinely is theirs.
            // Ordering makes the answer the *earliest* registration rather than
            // whichever row the index happened to return first. That is a policy
            // choice, not proof of authorship — see the spec's open risks.
            queries: [Query.equal('sha256', sha256), Query.orderAsc('$createdAt'), Query.limit(1)],
        });

        const row = response.rows?.[0];
        if (!row) return { state: 'unregistered' };

        return {
            state: 'registered',
            // Appwrite's own row stamp rather than a column the function wrote.
            // `$createdAt` specifically: `$updatedAt` moves when a gallery is
            // made private and the function re-permissions the row, which would
            // report a visibility change as the registration date.
            ...(row.$createdAt && { registeredAt: row.$createdAt }),
        };
    } catch (error) {
        console.warn('Could not check the provenance registry:', error);
        return { state: 'error' };
    }
}
