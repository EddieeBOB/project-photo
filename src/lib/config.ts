/**
 * Appwrite resource ids, read from the Vite environment in one place so the
 * services don't each reach into `import.meta.env`.
 *
 * Everything here is public by nature — it ships in the browser bundle. Secrets
 * belong in Appwrite Functions, never in a `VITE_`-prefixed variable.
 */

export const databaseId: string = import.meta.env.VITE_APPWRITE_DATABASE_ID;
export const bucketId: string = import.meta.env.VITE_APPWRITE_BUCKET_ID;

/** Table ids. The photos table is configurable; the rest are stable names. */
export const photosTableId: string = import.meta.env.VITE_APPWRITE_PHOTOS_COLLECTION_ID;
export const GALLERY_TABLE = 'gallery';
export const PHOTOS_TABLE = 'photos';
export const USERS_TABLE = 'users';

/** The Appwrite Function that resolves a username to its account email. */
export const loginResolverFunctionId: string = import.meta.env.VITE_APPWRITE_LOGIN_FN_ID;

/**
 * The Appwrite Function that signs a photo with a C2PA provenance manifest and
 * stores it. It performs the upload itself — the signing key must never reach
 * the browser, and signing has to happen before the bytes land in the bucket.
 */
export const signPhotoFunctionId: string = import.meta.env.VITE_APPWRITE_SIGN_PHOTO_FN_ID;
