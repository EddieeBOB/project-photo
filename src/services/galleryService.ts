import { Functions, ID, Query, type Models } from 'appwrite';

import { account, client, tablesDB, storage } from '../lib/appwrite';
import { bucketId, databaseId, GALLERY_TABLE, PHOTOS_TABLE, photosTableId, signPhotoFunctionId } from '../lib/config';
import { ownerPermissions } from '../lib/permissions';
import { fileToThumbhash } from '../lib/thumbhash';
import type { Gallery, Photo } from '../types/gallery';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES, UPLOAD_MAX_WIDTH, fileNameForType, resizeImage } from './imageProcessing';
import { retrieveImageURL, retrieveOriginalImageURL } from './imageUrls';

/**
 * Reads and writes for exhibitions: publishing a draft, deleting, and changing
 * who can see one.
 *
 * A gallery spans three resources — a `gallery` row, a `photos` row per image,
 * and a storage file per image — and Appwrite has no transactions across them.
 * Each write path therefore cleans up after itself if a later step fails.
 */

/** How many photo rows to pull per request when walking a gallery. */
const PHOTO_PAGE_SIZE = 100;

const functions = new Functions(client);

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/* ------------------------------------------------------------------ */

/** Base64 payload of a blob, without the `data:` prefix a data URL carries. */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Downscales one image and has the `sign-photo` function store it.
 *
 * The browser does not write this file itself. A C2PA manifest hashes the bytes
 * it is embedded in, so signing has to happen before the bucket write — and it
 * has to happen server-side, because a signing key shipped to the browser is a
 * key everyone has. The function therefore does the upload, and the id it
 * returns is the one the `photos` row references.
 *
 * There is deliberately no unsigned path: if signing fails nothing was stored,
 * so the publish fails rather than quietly keeping a photo without provenance.
 *
 * @returns the storage file id
 */
async function uploadImage(file: File, isPublic: boolean, creator: string): Promise<string> {
    try {
        // The bucket enforces these server-side too; failing here just saves a
        // pointless round trip with a large body.
        if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
            throw new Error('Unsupported file type.');
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error('File exceeds the maximum allowed size.');
        }

        // The resize re-encodes to WebP, so the picked file's type no longer
        // describes the bytes being sent. The blob's own type does, and it also
        // covers the browser that fell back to PNG instead.
        const resized = await resizeImage(file, UPLOAD_MAX_WIDTH);
        const uploadType = resized.type || 'image/webp';

        const execution = await functions.createExecution({
            functionId: signPhotoFunctionId,
            body: JSON.stringify({
                image: await blobToBase64(resized),
                mimeType: uploadType,
                name: fileNameForType(file.name, uploadType),
                isPublic,
                creator,
            }),
        });

        const result = JSON.parse(execution.responseBody || '{}');
        if (execution.responseStatusCode !== 200 || !result.fileId) {
            throw new Error(result.error || 'Could not sign and store the photo.');
        }
        return result.fileId;
    } catch (error) {
        console.error('Error uploading and saving photo:', error);
        throw error;
    }
}

/**
 * Uploads a photo's file and creates the `photos` row that points at it.
 *
 * @returns the storage file id, or `null` when the photo carries no file
 */
async function createImage(
    photo: Photo,
    photoRowId: string,
    galleryId: string,
    ownerId: string,
    isPublic: boolean,
    creator: string,
): Promise<string | null> {
    if (!photo.file) return null;

    const imageId = await uploadImage(photo.file, isPublic, creator);

    try {
        // Hashed from the original rather than the upload: ThumbHash works from a
        // 100px copy either way, so there is nothing to gain by waiting on the resize.
        const thumbhash = await fileToThumbhash(photo.file);

        const data = {
            title: photo.title,
            description: photo.description,
            exposure: photo.metadata.exposure,
            iso: photo.metadata.iso,
            lens: photo.metadata.lens,
            isFrontPage: false,
            imageId,
            gallery: galleryId,
        };

        await tablesDB.createRow({
            databaseId,
            tableId: PHOTOS_TABLE,
            rowId: photoRowId,
            // `thumbhash` is optional in the schema, so omitting it on the rare
            // occasions hashing fails leaves the row perfectly valid.
            data: thumbhash ? { ...data, thumbhash } : data,
            permissions: ownerPermissions(ownerId, isPublic),
        });

        return imageId;
    } catch (error) {
        // The file is already in the bucket but nothing references it now.
        try {
            await storage.deleteFile({ bucketId, fileId: imageId });
        } catch (cleanupError) {
            console.error(`Failed to clean up storage file ${imageId} after DB error:`, cleanupError);
        }
        throw error;
    }
}

/** Best-effort teardown of a half-created gallery. Never throws. */
async function rollbackGallery(galleryId: string, photoRowIds: string[], fileIds: string[]) {
    for (const rowId of photoRowIds) {
        try {
            await tablesDB.deleteRow({ databaseId, tableId: PHOTOS_TABLE, rowId });
        } catch { /* already gone, or never created */ }
    }
    for (const fileId of fileIds) {
        try {
            await storage.deleteFile({ bucketId, fileId });
        } catch { /* already gone, or never created */ }
    }
    try {
        await tablesDB.deleteRow({ databaseId, tableId: GALLERY_TABLE, rowId: galleryId });
    } catch { /* already gone, or never created */ }
}

/**
 * Publishes a draft exhibition: creates the gallery row, uploads each photo,
 * then links the photos to the gallery.
 *
 * Photos are uploaded one at a time so `onProgress` can report a meaningful
 * count, and linked only at the end so the gallery never briefly references
 * rows that do not exist. If any step fails the whole thing is rolled back and
 * the error rethrown — a partial exhibition is worse than none.
 *
 * @param galleryTitle - Title of the new exhibition
 * @param gallery - The draft, whose photos carry the files to upload
 * @param isPublic - Whether anyone may read the gallery
 * @param onProgress - Called after each photo with (uploaded, total)
 */
export async function createGallery(
    galleryTitle: string,
    gallery: Gallery,
    isPublic: boolean = false,
    onProgress?: (current: number, total: number) => void,
) {
    // Derive the owner from the authenticated session rather than trusting a
    // client-supplied id. This prevents a tampered client from attributing a
    // gallery to another user.
    // The display name rides along as the manifest's creator, so it is read
    // here rather than once per photo.
    const { $id: ownerId, name: creator } = await account.get();

    const galleryId = ID.unique();
    const photoRowIds: string[] = [];
    const uploadedFileIds: string[] = [];

    try {
        await tablesDB.createRow({
            databaseId,
            tableId: GALLERY_TABLE,
            rowId: galleryId,
            data: {
                galleryTitle,
                users: ownerId,
                isPublic,
            },
            permissions: ownerPermissions(ownerId, isPublic),
        });

        for (const [index, photo] of gallery.photos.entries()) {
            const photoRowId = ID.unique();
            photoRowIds.push(photoRowId);

            const imageId = await createImage(photo, photoRowId, galleryId, ownerId, isPublic, creator);
            if (imageId) uploadedFileIds.push(imageId);

            onProgress?.(index + 1, gallery.photos.length);
        }

        await tablesDB.updateRow({
            databaseId,
            tableId: GALLERY_TABLE,
            rowId: galleryId,
            data: { photos: photoRowIds },
        });
    } catch (error) {
        console.error('Error creating gallery, initiating rollback cleanup...', error);
        await rollbackGallery(galleryId, photoRowIds, uploadedFileIds);
        throw error;
    }
}

/* ------------------------------------------------------------------ */
/* Deleting and re-permissioning                                       */
/* ------------------------------------------------------------------ */

/** Every photo row belonging to a gallery, paged through in full. */
async function listGalleryPhotos(galleryId: string): Promise<Models.DefaultRow[]> {
    const photos: Models.DefaultRow[] = [];
    let offset = 0;

    for (;;) {
        const response = await tablesDB.listRows({
            databaseId,
            tableId: PHOTOS_TABLE,
            queries: [
                Query.equal('gallery', galleryId),
                Query.limit(PHOTO_PAGE_SIZE),
                Query.offset(offset),
            ],
        });

        photos.push(...response.rows);
        if (response.rows.length < PHOTO_PAGE_SIZE) return photos;
        offset += PHOTO_PAGE_SIZE;
    }
}

/**
 * Deletes a single photo: its storage file first, then its row.
 *
 * A file that fails to delete is logged and skipped rather than aborting — an
 * orphaned file wastes space, but a row pointing at a deleted file renders as
 * a broken image.
 */
export async function deletePhoto(photoId: string) {
    try {
        const photo = await tablesDB.getRow({
            databaseId,
            tableId: PHOTOS_TABLE,
            rowId: photoId,
        });

        if (photo?.imageId) {
            try {
                await storage.deleteFile({ bucketId, fileId: photo.imageId });
            } catch (error) {
                console.warn(`Failed to delete storage file ${photo.imageId}:`, error);
            }
        }

        await tablesDB.deleteRow({ databaseId, tableId: PHOTOS_TABLE, rowId: photoId });
    } catch (error) {
        console.error('Error deleting photo:', error);
        throw error;
    }
}

/** Deletes a gallery along with all of its photo rows and storage files. */
export async function deleteGallery(galleryId: string) {
    try {
        const photos = await listGalleryPhotos(galleryId);

        await Promise.all(photos.map(async (photo) => {
            if (photo.imageId) {
                try {
                    await storage.deleteFile({ bucketId, fileId: photo.imageId });
                } catch (error) {
                    console.warn(`[deleteGallery] Failed to delete storage file ${photo.imageId}:`, error);
                }
            }
            await tablesDB.deleteRow({ databaseId, tableId: PHOTOS_TABLE, rowId: photo.$id });
        }));

        await tablesDB.deleteRow({ databaseId, tableId: GALLERY_TABLE, rowId: galleryId });
    } catch (error) {
        console.error('[deleteGallery] Error:', error);
        throw error;
    }
}

/**
 * Switches a gallery between public and private.
 *
 * Visibility is enforced by Appwrite permissions, not by the client hiding
 * things: the `isPublic` flag and the read permissions are updated together,
 * and the same permissions are cascaded to every photo row and storage file in
 * the gallery. Without the cascade a "private" gallery's images would still be
 * fetchable by direct URL.
 */
export async function updateGalleryVisibility(galleryId: string, isPublic: boolean) {
    try {
        // Owner is taken from the authenticated session so permissions can't be
        // reassigned to another user via a tampered request.
        const { $id: ownerId } = await account.get();
        const permissions = ownerPermissions(ownerId, isPublic);

        await tablesDB.updateRow({
            databaseId,
            tableId: GALLERY_TABLE,
            rowId: galleryId,
            data: { isPublic },
            permissions,
        });

        const photos = await listGalleryPhotos(galleryId);

        await Promise.all(photos.map(async (photo) => {
            try {
                await tablesDB.updateRow({
                    databaseId,
                    tableId: PHOTOS_TABLE,
                    rowId: photo.$id,
                    data: {},
                    permissions,
                });
            } catch (error) {
                console.warn(`Failed to update permissions for photo ${photo.$id}:`, error);
            }

            if (photo.imageId) {
                try {
                    await storage.updateFile({ bucketId, fileId: photo.imageId, permissions });
                } catch (error) {
                    console.warn(`Failed to update permissions for file ${photo.imageId}:`, error);
                }
            }
        }));
    } catch (error) {
        console.error('Failed to update gallery visibility:', error);
        throw error;
    }
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** A gallery shaped for the carousel, with resolved image URLs. */
export interface CarouselGallery {
    id: string;
    title: string;
    userId: string;
    photos: {
        id: string;
        src: string;
        title: string;
        description: string;
        metadata: { exposure: string; iso: string; lens: string };
        thumbhash?: string;
    }[];
    isPublic: boolean;
}

/** A `gallery` row with its `photos` relationship expanded. */
type FetchedGallery = Models.DefaultRow & {
    galleryTitle?: string;
    photos?: Models.DefaultRow[];
    isPublic?: boolean;
};

/**
 * Converts a fetched gallery row into what the carousel renders, turning each
 * photo's storage id into a preview URL.
 *
 * @returns `null` for a gallery with no photos — there is nothing to show.
 */
export function mapGalleryToCarousel(fetchedGallery: FetchedGallery, userId: string): CarouselGallery | null {
    if (!fetchedGallery?.photos || fetchedGallery.photos.length === 0) return null;

    return {
        id: fetchedGallery.$id,
        title: fetchedGallery.galleryTitle || 'Untitled Exhibition',
        userId,
        isPublic: fetchedGallery.isPublic ?? false,
        photos: fetchedGallery.photos.map((photo) => ({
            id: photo.$id,
            // The stored file is already downscaled to UPLOAD_MAX_WIDTH, so a
            // preview at that width would only re-encode it: same pixels, a
            // second round of compression artefacts, and a billed transform.
            src: retrieveOriginalImageURL(photo.imageId),
            title: photo.title || '',
            description: photo.description || '',
            // Null for photos uploaded before the column existed; the carousel
            // falls back to a plain image.
            thumbhash: photo.thumbhash || undefined,
            metadata: {
                exposure: photo.exposure || 'N/A',
                iso: photo.iso || 'N/A',
                lens: photo.lens || 'N/A',
            },
        })),
    };
}

/**
 * Loads the photo flagged `isFrontPage` for the landing page, along with the
 * name of the photographer who took it.
 *
 * @returns the artist's name, the quoted photo title, a preview URL and its
 *          placeholder hash, or `null` if nothing is featured or the lookup fails
 */
export async function fetchFeaturedArtist() {
    try {
        const response = await tablesDB.listRows({
            databaseId,
            tableId: photosTableId,
            queries: [
                Query.equal('isFrontPage', true),
                Query.limit(1),
                // Only pull the username from the related user — never email/PII.
                Query.select(['*', 'gallery.*', 'gallery.users.username']),
            ],
        });

        const row = response.rows?.[0];
        if (!row) return null;

        if (!row.imageId) {
            console.warn('Featured photo has no imageId, skipping.');
            return null;
        }

        return {
            name: row.gallery?.users?.username || 'Anonymous Artist',
            title: `"${row.title ?? 'Untitled'}"`,
            imageUrl: retrieveImageURL(row.imageId, 500),
            thumbhash: row.thumbhash || undefined,
        };
    } catch (error) {
        console.error('Failed to fetch featured artist:', error);
        return null;
    }
}
