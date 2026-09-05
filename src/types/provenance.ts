/**
 * What a photo's Content Credentials say about it.
 *
 * `trusted` and `signed` are both intact signatures over unmodified bytes; they
 * differ only in whether the signing certificate chains to a recognised
 * authority. A self-signed or privately-issued certificate — which is what this
 * project uses until it buys a trust-listed one — reads as `signed`.
 */
export type ProvenanceState =
    /** Signed, unmodified, and issued by a recognised certificate authority. */
    | 'trusted'
    /** Signed and unmodified, but the issuer is not on any trust list. */
    | 'signed'
    /** A manifest is present but no longer matches the bytes it covers. */
    | 'modified'
    /** No Content Credentials at all — the ordinary case for most photos. */
    | 'none'
    /** The file could not be read. */
    | 'error';

export interface Provenance {
    state: ProvenanceState;
    /** Who the manifest names as the author, when it carries a CreativeWork assertion. */
    creator?: string;
    /** The application that generated the claim, e.g. "photoframes.me". */
    signedBy?: string;
    /** The certificate's subject — who the signature actually belongs to. */
    issuer?: string;
    /** When it was signed, ISO-8601, if the manifest recorded a time. */
    signedAt?: string;
}
