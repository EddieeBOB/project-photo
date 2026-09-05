import type { Provenance, ProvenanceState } from '../types/provenance';

/**
 * Reads the Content Credentials embedded in an image.
 *
 * Reading a manifest needs only the public certificate inside the file, so
 * unlike signing — which holds a private key and therefore lives in the
 * `sign-photo` Appwrite Function — this belongs in the browser. Nothing is
 * uploaded: the WASM reader parses the bytes in place, which is what lets the
 * verifier promise that a dropped photo never leaves the machine.
 *
 * The reader is around a megabyte of WebAssembly, so callers should import this
 * module dynamically, the way `pica` and `exifr` are kept out of the bundle in
 * `imageProcessing.ts`.
 */

/** The manifest store, as c2pa returns it — snake_case, straight from Rust. */
interface ManifestStore {
    active_manifest?: string | null;
    validation_state?: string | null;
    manifests?: Record<string, ManifestJson>;
}

interface ManifestJson {
    claim_generator_info?: { name?: string }[];
    signature_info?: { issuer?: string; time?: string };
    assertions?: { label?: string; data?: unknown }[];
}

/** Shape of the schema.org assertion, which is where a creator name lives. */
interface CreativeWorkData {
    author?: { name?: string }[];
}

const STATE_BY_VALIDATION: Record<string, ProvenanceState> = {
    Trusted: 'trusted',
    Valid: 'signed',
    Invalid: 'modified',
};

/**
 * Maps a manifest store onto what the UI needs to say about a photo.
 *
 * @param store the store c2pa produced, or `null` for an asset carrying no
 *              Content Credentials at all
 */
export function toProvenance(store: ManifestStore | null): Provenance {
    if (!store) return { state: 'none' };

    const active = store.active_manifest ? store.manifests?.[store.active_manifest] : undefined;
    // A store that names an active manifest it does not contain is malformed
    // rather than unsigned, so it is reported as a failure to read.
    if (!active) return { state: 'error' };

    const creativeWork = active.assertions?.find(
        (assertion) => assertion.label === 'stds.schema-org.CreativeWork',
    );
    const creator = (creativeWork?.data as CreativeWorkData | undefined)?.author?.[0]?.name;

    return {
        // Anything c2pa doesn't call Valid or Trusted means the bytes no longer
        // match the hash the manifest was signed over.
        state: STATE_BY_VALIDATION[store.validation_state ?? ''] ?? 'modified',
        ...(creator && { creator }),
        ...(active.claim_generator_info?.[0]?.name && {
            signedBy: active.claim_generator_info[0].name,
        }),
        ...(active.signature_info?.issuer && { issuer: active.signature_info.issuer }),
        ...(active.signature_info?.time && { signedAt: active.signature_info.time }),
    };
}

/**
 * The WASM module is fetched once and shared. `?url` hands Vite the asset path
 * rather than inlining a megabyte of base64 into the chunk.
 */
let c2paPromise: Promise<{ reader: { fromBlob: (format: string, blob: Blob) => Promise<unknown> } }> | null = null;

function getC2pa() {
    c2paPromise ??= (async () => {
        const [{ createC2pa }, { default: wasmSrc }] = await Promise.all([
            import('@contentauth/c2pa-web'),
            import('@contentauth/c2pa-web/resources/c2pa.wasm?url'),
        ]);
        return createC2pa({ wasmSrc });
    })();
    return c2paPromise;
}

/**
 * Reads a file the visitor picked and reports what its manifest claims.
 *
 * Never throws: an unreadable file is a result to display, not an exception for
 * the caller to handle.
 */
export async function verifyFile(file: File): Promise<Provenance> {
    try {
        const c2pa = await getC2pa();
        // `fromBlob` resolves to null when the asset carries no C2PA data,
        // which is the ordinary case rather than a failure.
        const reader = (await c2pa.reader.fromBlob(file.type, file)) as {
            manifestStore: () => Promise<ManifestStore>;
            free?: () => void;
        } | null;

        if (!reader) return { state: 'none' };

        try {
            return toProvenance(await reader.manifestStore());
        } finally {
            reader.free?.();
        }
    } catch (error) {
        console.warn('Could not read Content Credentials:', error);
        return { state: 'error' };
    }
}
