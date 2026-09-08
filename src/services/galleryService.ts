import { ID, Query, type Models } from 'appwrite';

import { account, functions, tablesDB, storage } from '../lib/appwrite';
import { bucketId, databaseId, GALLERY_TABLE, PHOTOS_TABLE, PROVENANCE_TABLE, registerPhotoFunctionId } from '../lib/config';
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

/**
 * Most file ids `register-photo` accepts in one `visibility` call. Mirrors
 * `MAX_VISIBILITY_BATCH` there, and equals `PHOTO_PAGE_SIZE` so an ordinary
 * gallery reconciles in a single execution. That is the whole point: Appwrite
 * rate-limits execution *creation*, not the work inside an execution, so one
 * call per photo throttles partway through a large gallery and leaves its tail
 * with a publicly readable registry row.
 */
const VISIBILITY_BATCH_SIZE = 100;

/**
 * How many photos to re-permission or tear down at once. Appwrite rate-limits
 * per-request, so fanning a large gallery out all at once trades a bounded wait
 * for throttled writes partway through.
 */
const WRITE_CONCURRENCY = 10;

/** Applies `task` to every item, at most {@link WRITE_CONCURRENCY} at a time. */
async function forEachLimited<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
    for (let start = 0; start < items.length; start += WRITE_CONCURRENCY) {
        await Promise.all(items.slice(start, start + WRITE_CONCURRENCY).map(task));
    }
}

/** Parses a function's response body, treating a malformed one as empty. */
function parseExecutionBody<T>(responseBody: string): T | Record<string, never> {
    try {
        return JSON.parse(responseBody || '{}');
    } catch {
        return {};
    }
}

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/* ------------------------------------------------------------------ */

/**
 * Downscales one image, stores it, and has `register-photo` record its hash.
 *
 * The browser writes the file itself now. Nothing needs to happen to the bytes
 * before they land in the bucket — the hash is taken from what is stored, by
 * the function, reading it back out. That is what makes the registry an
 * attestation rather than a client's word: a browser that could supply its own
 * hash could register a file it does not own.
 *
 * There is deliberately no unregistered path. If registration fails the file is
 * deleted and the publish fails, rather than quietly keeping a photo whose
 * provenance nothing can confirm.
 *
 * @returns the storage file id
 */
async function uploadImage(file: File, isPublic: boolean, ownerId: string): Promise<string> {
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
    const name = fileNameForType(file.name, uploadType);

    const stored = await storage.createFile({
        bucketId,
        fileId: ID.unique(),
        file: new File([resized], name, { type: uploadType }),
        permissions: ownerPermissions(ownerId, isPublic),
    });

    try {
        const execution = await functions.createExecution({
            functionId: registerPhotoFunctionId,
            body: JSON.stringify({ action: 'register', fileId: stored.$id }),
        });

        const result = parseExecutionBody<{ sha256?: string; error?: string }>(execution.responseBody);
        if (execution.responseStatusCode !== 200 || !result.sha256) {
            throw new Error(result.error || 'Could not register the photo.');
        }
    } catch (error) {
        // Nothing references the file yet, and a photo with no provenance is
        // not what was asked for, so it does not stay.
        //
        // The row goes too, because the failure may be a timed-out execution
        // that nonetheless wrote one. A row nothing can reach still answers
        // "Registered" for bytes that were never published — and carries
        // read("any") if the gallery was public.
        await deleteStoredPhoto(stored.$id);
        throw error;
    }

    return stored.$id;
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
): Promise<string | null> {
    if (!photo.file) return null;

    const imageId = await uploadImage(photo.file, isPublic, ownerId);

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
        // The file is already in the bucket but nothing references it now — and
        // registration succeeded, so it has a registry row too. `createGallery`
        // only records the file id once this function returns, so `rollbackGallery`
        // will never see it: if the row is not removed here it is removed nowhere.
        await deleteStoredPhoto(imageId);
        throw error;
    }
}

/**
 * Best-effort removal of a photo's registry row. Never throws.
 *
 * The row id is the storage file id, so no lookup is needed. A row left behind
 * would keep answering for a photo that no longer exists.
 */
async function deleteRegistryRow(imageId: string) {
    try {
        await tablesDB.deleteRow({ databaseId, tableId: PROVENANCE_TABLE, rowId: imageId });
    } catch (error) {
        console.warn(`Failed to delete provenance row ${imageId}:`, error);
    }
}

/**
 * Best-effort removal of a stored photo — its registry row, then its file.
 * Never throws: every caller is already unwinding a failure or a deletion.
 */
async function deleteStoredPhoto(imageId: string) {
    await deleteRegistryRow(imageId);
    try {
        await storage.deleteFile({ bucketId, fileId: imageId });
    } catch (error) {
        console.warn(`Failed to delete storage file ${imageId}:`, error);
    }
}

/**
 * Brings a gallery's registry rows back in step with its photos' visibility.
 *
 * Registry rows carry no client `update` permission — that is what keeps an
 * owner from rewriting the hash inside one — so the browser cannot re-permission
 * a row itself. Only the function, holding the API key, can.
 *
 * Sent in batches rather than one call per photo: Appwrite rate-limits
 * execution creation tightly, so a hundred calls throttle partway through and
 * the tail of a large gallery keeps its `read("any")` row — exactly the leak
 * this exists to close. One execution per hundred photos does not.
 *
 * The function reads each file's *own* permissions to decide the row's, rather
 * than believing a caller who says a photo is public, so this must run after
 * the files themselves have been re-permissioned. A file whose own update
 * failed keeps its row consistent with what the file actually exposes.
 *
 * Best-effort and never throws: the gallery's visibility is already written by
 * the time this runs, and failing the toggle over a registry row would be worse
 * than logging it.
 */
async function reconcileRegistryVisibility(imageIds: string[]) {
    if (imageIds.length === 0) return;
    if (!registerPhotoFunctionId) {
        console.warn('VITE_APPWRITE_REGISTER_FN_ID is not set; provenance row visibility was not updated.');
        return;
    }

    for (let start = 0; start < imageIds.length; start += VISIBILITY_BATCH_SIZE) {
        const batch = imageIds.slice(start, start + VISIBILITY_BATCH_SIZE);
        try {
            const execution = await functions.createExecution({
                functionId: registerPhotoFunctionId,
                body: JSON.stringify({ action: 'visibility', fileIds: batch }),
            });

            const result = parseExecutionBody<{ ok?: boolean; skipped?: number; error?: string }>(execution.responseBody);

            // createExecution resolves even when the function itself returns a
            // non-2xx status, so success has to be read from the response, not
            // just the absence of a thrown error — the same reason uploadImage
            // checks responseStatusCode rather than trusting the await.
            if (execution.responseStatusCode !== 200 || !result.ok) {
                console.warn(
                    `Failed to update provenance visibility for ${batch.length} photo(s): ` +
                    `status ${execution.responseStatusCode}${result.error ? `, ${result.error}` : ''}`,
                );
            } else if (result.skipped) {
                console.warn(
                    `Provenance visibility skipped ${result.skipped} of ${batch.length} photo(s).`,
                );
            }
        } catch (error) {
            console.warn(`Failed to update provenance visibility for ${batch.length} photo(s):`, error);
        }
    }
}

/** Best-effort teardown of a half-created gallery. Never throws. */
async function rollbackGallery(galleryId: string, photoRowIds: string[], fileIds: string[]) {
    for (const rowId of photoRowIds) {
        try {
            await tablesDB.deleteRow({ databaseId, tableId: PHOTOS_TABLE, rowId });
        } catch { /* already gone, or never created */ }
    }
    await forEachLimited(fileIds, deleteStoredPhoto);
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
    const { $id: ownerId } = await account.get();

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

            // A photo with no file creates no row, so its id must not be linked
            // into the gallery below — the relationship would dangle.
            const imageId = await createImage(photo, photoRowId, galleryId, ownerId, isPublic);
            if (imageId) {
                photoRowIds.push(photoRowId);
                uploadedFileIds.push(imageId);
            }

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

/** A photo row as needed by the delete and re-permission paths. */
type PhotoFileRow = Models.Row & { imageId?: string };

/**
 * Every photo row belonging to a gallery, paged through in full. Only the row
 * id and its file id are selected — the callers rewrite or delete rows, and
 * pulling titles and descriptions for that is wasted payload.
 */
async function listGalleryPhotos(galleryId: string): Promise<PhotoFileRow[]> {
    const photos: PhotoFileRow[] = [];
    let offset = 0;

    for (;;) {
        const response = await tablesDB.listRows<PhotoFileRow>({
            databaseId,
            tableId: PHOTOS_TABLE,
            queries: [
                Query.equal('gallery', galleryId),
                Query.select(['$id', 'imageId']),
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
            await deleteStoredPhoto(photo.imageId);
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

        await forEachLimited(photos, async (photo) => {
            if (photo.imageId) await deleteStoredPhoto(photo.imageId);
            await tablesDB.deleteRow({ databaseId, tableId: PHOTOS_TABLE, rowId: photo.$id });
        });

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

        await forEachLimited(photos, async (photo) => {
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
        });

        // After the files, never before: the function derives each row's public
        // read from the file's own permissions rather than from this request.
        await reconcileRegistryVisibility(
            photos.map((photo) => photo.imageId).filter((id): id is string => Boolean(id)),
        );
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
            tableId: PHOTOS_TABLE,
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
