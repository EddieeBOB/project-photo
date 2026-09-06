/**
 * What the provenance registry knows about a photo.
 *
 * There is no `modified` state, and its absence is deliberate. A registry
 * records the hash of exactly one sequence of bytes; a photo that has been
 * edited, re-encoded, or re-saved simply hashes to something else and is not
 * found. That is indistinguishable from a photo nobody ever registered, so
 * both read as `unregistered` rather than pretending to tell them apart.
 */
export type ProvenanceState =
    /** The digest is in the registry: these exact bytes were published here. */
    | 'registered'
    /** No row for this digest — never registered, or altered since. */
    | 'unregistered'
    /** The registry could not be reached. */
    | 'error';

export interface Provenance {
    state: ProvenanceState;
    /**
     * When it was registered, ISO-8601 — the row's own `$createdAt`.
     *
     * The only detail a row carries, and not a stored column: Appwrite stamps
     * it, so it is not something the uploader or the function could assert. The
     * registry can say when these bytes were published here but not who by —
     * that lives on the photo and gallery rows, which are the authority for it.
     */
    registeredAt?: string;
}
