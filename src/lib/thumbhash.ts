import { rgbaToThumbHash, thumbHashToDataURL, thumbHashToApproximateAspectRatio } from 'thumbhash';

/**
 * ThumbHash placeholders: a whole photograph compressed into ~25 bytes.
 *
 * Stored as base64 on the `photos` row, it travels with the row itself, so a
 * blurred impression of every photo is already in hand by the time the grid
 * paints — no extra request, no flat grey box while the real image streams in.
 *
 * See https://evanw.github.io/thumbhash/
 */

/**
 * The longest edge the encoder sees. ThumbHash only keeps a handful of DCT
 * coefficients, so anything larger is detail thrown away at cost.
 */
const MAX_DIM = 100;

/** Packs raw RGBA pixels into the base64 hash stored on the row. */
export function encodeThumbhash(
    rgba: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
): string {
    if (width > MAX_DIM || height > MAX_DIM) {
        throw new Error(`thumbhash input must be ≤ ${MAX_DIM}px per side`);
    }

    return bytesToBase64(rgbaToThumbHash(width, height, rgba));
}

/**
 * The image's approximate width/height, recovered from the hash alone.
 *
 * Lets a placeholder reserve the photo's real footprint before a byte of it has
 * downloaded — no layout shift when it lands, and no crop, unlike committing to
 * a fixed ratio. Returns `null` for a missing or malformed hash so callers can
 * fall back to their own sizing.
 */
export function thumbhashToAspectRatio(hashB64: string): number | null {
    const bytes = base64ToBytes(hashB64);
    if (!bytes) return null;

    try {
        const ratio = thumbHashToApproximateAspectRatio(bytes);
        return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
    } catch {
        return null;
    }
}

/**
 * Expands the hash into a PNG data URI ready to drop straight into `src`.
 *
 * @returns `null` for a missing or malformed hash — a photo with no usable
 *          placeholder should still render, just without one.
 */
export function thumbhashToDataURL(hashB64: string): string | null {
    const bytes = base64ToBytes(hashB64);
    if (!bytes) return null;

    try {
        return thumbHashToDataURL(bytes);
    } catch {
        return null;
    }
}

/**
 * Browser-only: draws the image small and hashes it.
 *
 * Never throws. A missing placeholder costs a little polish; a failed upload
 * costs the photograph, so anything going wrong here resolves to `null` and the
 * row is written without a hash.
 */
export async function fileToThumbhash(file: File | Blob): Promise<string | null> {
    try {
        const bitmap = await createImageBitmap(file);

        // Only ever scale down: a 40px source stays 40px rather than being
        // stretched to the cap, which would add nothing but work.
        const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) return null;

        context.drawImage(bitmap, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);
        bitmap.close();

        return encodeThumbhash(data, width, height);
    } catch (error) {
        console.warn('thumbhash generation failed:', error);
        return null;
    }
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

/** @returns `null` rather than throwing, for empty or non-base64 input. */
function base64ToBytes(hashB64: string): Uint8Array | null {
    if (!hashB64) return null;

    try {
        const binary = atob(hashB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch {
        return null;
    }
}
