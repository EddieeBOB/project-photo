import { describe, expect, it } from 'vitest';

import { toProvenance } from '../../src/services/c2paVerify';

/** A manifest store shaped the way c2pa returns one, with the parts we read. */
function store(validationState: string, manifest: Record<string, unknown> = {}) {
    return {
        active_manifest: 'urn:c2pa:abc',
        validation_state: validationState,
        manifests: {
            'urn:c2pa:abc': {
                claim_generator_info: [{ name: 'photoframes.me', version: '1.0.0' }],
                signature_info: { issuer: 'photoframes.me', time: '2026-09-04T10:00:00Z' },
                assertions: [
                    {
                        label: 'stds.schema-org.CreativeWork',
                        data: { author: [{ '@type': 'Person', name: 'Eddie Lam' }] },
                    },
                ],
                ...manifest,
            },
        },
    };
}

describe('toProvenance', () => {
    it('reports a recognised issuer as trusted', () => {
        expect(toProvenance(store('Trusted'))).toEqual({
            state: 'trusted',
            creator: 'Eddie Lam',
            signedBy: 'photoframes.me',
            issuer: 'photoframes.me',
            signedAt: '2026-09-04T10:00:00Z',
        });
    });

    it('reports an intact signature from an unlisted issuer as signed', () => {
        // What this project's own photos look like until the certificate chains
        // to a CA on the C2PA trust list.
        expect(toProvenance(store('Valid')).state).toBe('signed');
    });

    it('reports a broken hard binding as modified', () => {
        expect(toProvenance(store('Invalid')).state).toBe('modified');
    });

    it('reports an asset with no manifest as none', () => {
        // `fromBlob` resolves to null when the file carries no C2PA data, which
        // is the ordinary case for a photo taken off any other website.
        expect(toProvenance(null)).toEqual({ state: 'none' });
    });

    it('survives a manifest with no creator assertion', () => {
        const bare = toProvenance(store('Valid', { assertions: [] }));

        expect(bare.state).toBe('signed');
        expect(bare.creator).toBeUndefined();
        expect(bare.signedBy).toBe('photoframes.me');
    });

    it('treats a store whose active manifest is missing as an error', () => {
        expect(toProvenance({ active_manifest: 'urn:c2pa:gone', manifests: {} }).state).toBe('error');
    });
});
