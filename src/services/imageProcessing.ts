import type { CarouselPhoto } from '../types/gallery';

/**
 * Client-side handling of image files between the file picker and the upload:
 * validation, EXIF extraction, and downscaling.
 *
 * `pica` (a WASM image resizer) and `exifr` are heavy and only needed once a
 * user actually picks a file, so both are imported dynamically — that keeps
 * them out of the bundle for visitors who never open the studio.
 */

/**
 * Upload constraints. Appwrite enforces the same limits on the bucket; these
 * are a first line of defence and, more usefully, immediate feedback.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/** The longest edge we store. Larger uploads are downscaled to this width. */
export const UPLOAD_MAX_WIDTH = 1200;

/**
 * Every upload is re-encoded to WebP, whatever was picked. One output format
 * means one set of behaviours to reason about: it is lossy, it keeps an alpha
 * channel, and it is smaller than JPEG or PNG at the same quality. It also
 * sidesteps the fact that no browser canvas can write GIF or AVIF at all.
 *
 * A resize reduces an animated GIF to its first frame regardless; what matters
 * is that the stored file is labelled as what it really is.
 */
const ENCODE_TYPE = 'image/webp';

/**
 * File extension for each type an encode can produce. WebP is the intended
 * output; PNG is what a browser too old to write WebP falls back to.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
    'image/webp': 'webp',
    'image/png': 'png',
    'image/jpeg': 'jpg',
};

/**
 * Prepares picked files for the studio editor: drops anything that isn't a
 * supported image, builds a local preview URL, and pre-fills each photo's
 * title from the filename and its settings from EXIF.
 *
 * Callers own the returned `src` values — they are `blob:` URLs and must be
 * revoked once the photo leaves the editor.
 */
export async function processFiles(files: File[]): Promise<CarouselPhoto[]> {
    const imageFiles = files.filter((file) =>
        ALLOWED_IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_FILE_SIZE_BYTES
    );

    return Promise.all(imageFiles.map(async (file) => ({
        id: crypto.randomUUID(),
        src: URL.createObjectURL(file),
        title: stripFileExtension(file.name),
        description: '',
        metadata: await getPhotoMetadata(file),
        file,
    })));
}

/** "seascape.jpg" -> "seascape". Names without an extension pass through. */
function stripFileExtension(fileName: string): string {
    return fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
}

/**
 * Renames a file so its extension matches the bytes it now holds, leaving the
 * name itself alone: "seascape.gif" re-encoded as WebP becomes "seascape.webp".
 * Unknown types pass through untouched.
 */
export function fileNameForType(fileName: string, type: string): string {
    const extension = EXTENSION_BY_TYPE[type];
    return extension ? `${stripFileExtension(fileName)}.${extension}` : fileName;
}

/** Shutter speed as photographers write it: "1/125" fast, "2s" long. */
function formatShutterSpeed(exposureTime: number): string {
    return exposureTime < 1 ? `1/${Math.round(1 / exposureTime)}` : `${exposureTime}s`;
}

/** Combines shutter speed and aperture, using whichever parts EXIF supplied. */
function formatExposure(exposureTime?: number | null, fNumber?: number | null): string {
    const shutter = exposureTime != null ? formatShutterSpeed(exposureTime) : '';
    const aperture = fNumber != null ? `f/${fNumber}` : '';

    if (shutter && aperture) return `${shutter} · ${aperture}`;
    return shutter || aperture;
}

/**
 * Reads exposure, ISO, and lens out of a photo's EXIF block.
 *
 * Metadata is a nicety, not a requirement: anything missing (or a file with no
 * EXIF at all, such as a screenshot) comes back as an empty string, which the
 * editor shows as a blank field for the photographer to fill in.
 */
export async function getPhotoMetadata(file: File) {
    const noMetadata = { exposure: '', iso: '', lens: '' };

    try {
        const { default: exifr } = await import('exifr');
        const exif = await exifr.parse(file);
        if (!exif) return noMetadata;

        const isoValue = exif.ISO ?? exif.ISOSpeedRatings;
        // Fall back to the focal length when the body didn't record a lens name.
        const lens = exif.LensModel || (exif.FocalLength != null ? `${exif.FocalLength}mm` : '');

        return {
            exposure: formatExposure(exif.ExposureTime, exif.FNumber),
            iso: isoValue != null ? String(isoValue) : '',
            lens,
        };
    } catch (error) {
        console.warn('Failed to extract EXIF metadata from file:', file.name, error);
        return noMetadata;
    }
}

/**
 * `pica` spins up web workers and a WASM module, so one instance is created
 * lazily and shared by every resize for the life of the page.
 */
let resizerPromise: Promise<import('pica').Pica> | null = null;
function getResizer() {
    resizerPromise ??= import('pica').then(({ default: pica }) => pica({ features: ['js', 'wasm', 'ww'] }));
    return resizerPromise;
}

/**
 * Downscales an image to at most `width`, preserving its aspect ratio, and
 * re-encodes it as WebP. Images already narrower than `width` are re-encoded
 * but not upscaled.
 *
 * Decoding goes through `createImageBitmap`, which happens off the main thread
 * and so does not stall the page on a large photo. `from-image` is asked for
 * explicitly so an EXIF-rotated phone photo lands the right way up, matching
 * what an `<img>` would have shown.
 *
 * @returns the resized image as a Blob — WebP, or PNG on a browser that cannot
 *          encode WebP. Read its `type` rather than assuming either.
 */
export async function resizeImage(file: File, width: number): Promise<Blob> {
    const [resizer, bitmap] = await Promise.all([
        getResizer(),
        createImageBitmap(file, { imageOrientation: 'from-image' }),
    ]);

    try {
        if (!bitmap.width) throw new Error('Image decoded with 0 width');

        const targetWidth = Math.min(bitmap.width, width);
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = Math.round(bitmap.height * (targetWidth / bitmap.width));

        await resizer.resize(bitmap, canvas);
        return await resizer.toBlob(canvas, ENCODE_TYPE, 0.85);
    } finally {
        bitmap.close();
    }
}
