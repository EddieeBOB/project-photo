import { describe, it, expect } from 'vitest';
import { encodeThumbhash, thumbhashToDataURL, thumbhashToAspectRatio } from '../../src/lib/thumbhash';

/** A flat block of colour, as RGBA — enough to hash without decoding a real file. */
function solidRgba(width: number, height: number, [r, g, b, a]: number[]): Uint8Array {
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        pixels.set([r, g, b, a], i * 4);
    }
    return pixels;
}

describe('encodeThumbhash', () => {
    it('encodes a small RGBA buffer to non-empty base64', () => {
        const hash = encodeThumbhash(solidRgba(8, 6, [200, 40, 40, 255]), 8, 6);

        expect(hash.length).toBeGreaterThan(0);
        expect(() => atob(hash)).not.toThrow();
    });

    it('rejects dimensions over 100px', () => {
        expect(() => encodeThumbhash(new Uint8Array(101 * 4 * 4), 101, 4)).toThrow();
    });
});

describe('thumbhashToDataURL', () => {
    it('round-trips an encoded hash to a PNG data URI', () => {
        const hash = encodeThumbhash(solidRgba(8, 6, [200, 40, 40, 255]), 8, 6);

        expect(thumbhashToDataURL(hash)).toMatch(/^data:image\/png;base64,/);
    });

    it('returns null for garbage input', () => {
        expect(thumbhashToDataURL('not-base64!!!')).toBeNull();
        expect(thumbhashToDataURL('')).toBeNull();
    });
});

describe('thumbhashToAspectRatio', () => {
    it('recovers the source ratio well enough to reserve layout space', () => {
        const landscape = thumbhashToAspectRatio(encodeThumbhash(solidRgba(90, 45, [30, 90, 160, 255]), 90, 45));

        expect(landscape).toBeGreaterThan(1);
        expect(landscape).toBeCloseTo(2, 0);
    });

    it('returns null for garbage input', () => {
        expect(thumbhashToAspectRatio('not-base64!!!')).toBeNull();
        expect(thumbhashToAspectRatio('')).toBeNull();
    });
});
