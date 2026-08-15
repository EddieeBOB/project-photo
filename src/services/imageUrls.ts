import { storage } from '../lib/appwrite';
import { bucketId } from '../lib/config';

/**
 * Builds a preview URL for a file in the storage bucket.
 *
 * Appwrite resizes and re-encodes on its side, so ask for the width actually
 * needed rather than the original. Thumbnails get slightly heavier compression
 * than full-size views, where artefacts would be visible.
 *
 * @param fileId - Storage file id
 * @param width - Maximum width of the generated preview, in pixels
 */
export function retrieveImageURL(fileId: string, width: number): string {
    return storage.getFilePreview({
        bucketId,
        fileId,
        width,
        quality: width <= 500 ? 80 : 90,
    }).toString();
}

/**
 * Decorative photography shipped with the product rather than uploaded by a
 * user. The ids are fixed files in the bucket.
 */
const STATIC_PHOTO_IDS = {
    hero: '6a1b6ef1002df5981a20',
    login: '6a1b6ef1002de3b47d12',
    signup: '6a1b6ef1002df68d663d',
} as const;

function staticPhoto(kind: keyof typeof STATIC_PHOTO_IDS): string {
    return retrieveImageURL(STATIC_PHOTO_IDS[kind], 1200);
}

/** Backdrop for the landing page. */
export const getHeroPhoto = () => staticPhoto('hero');

/** Backdrop for the login page. */
export const getLoginPhoto = () => staticPhoto('login');

/** Backdrop for the signup page. */
export const getSignupPhoto = () => staticPhoto('signup');
