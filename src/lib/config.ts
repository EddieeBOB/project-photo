/**
 * Appwrite resource ids, read from the Vite environment in one place so the
 * services don't each reach into `import.meta.env`.
 *
 * Everything here is public by nature — it ships in the browser bundle. Secrets
 * belong in Appwrite Functions, never in a `VITE_`-prefixed variable.
 */

export const databaseId: string = import.meta.env.VITE_APPWRITE_DATABASE_ID;
export const bucketId: string = import.meta.env.VITE_APPWRITE_BUCKET_ID;

/** Table ids. */
export const GALLERY_TABLE = 'gallery';
export const PHOTOS_TABLE = 'photos';
export const USERS_TABLE = 'users';
export const PROVENANCE_TABLE = 'provenance';

/** The Appwrite Function that resolves a username to its account email. */
export const loginResolverFunctionId: string = import.meta.env.VITE_APPWRITE_LOGIN_FN_ID;

/**
 * The Appwrite Function that hashes a stored photo and records it in the
 * provenance registry. The browser uploads the file itself; this only attests
 * the hash, which it computes from the stored bytes rather than trusting the
 * client for it.
 */
export const registerPhotoFunctionId: string = import.meta.env.VITE_APPWRITE_REGISTER_FN_ID;
