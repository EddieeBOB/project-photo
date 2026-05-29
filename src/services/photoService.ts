import { ID, Query, Permission, Role } from 'appwrite';
import { tablesDB, storage } from '../lib/appwrite';
import pica from 'pica';
import type { Gallery, Photo } from '../components/EditableGalleryCarousel';

const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

/**
 * Resizes an image file to the specified maximum width while maintaining its aspect ratio.
 * Used to compress large image uploads on the client side before sending to the server.
 * 
 * @param file - The original File object from the file input
 * @param width - The maximum width in pixels for the resized image
 * @returns A Promise that resolves to the resized Blob
 */
const resizer = pica({ features: ['js', 'wasm', 'ww'] });
export async function resizeImage(file: File, width: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.onload = async () => {
            try {
                // Calculate height to maintain aspect ratio
                const scale = width / img.width;
                const height = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                await resizer.resize(img, canvas, { alpha: file.type !== 'image/jpeg' } as any);
                const blob = await resizer.toBlob(canvas, file.type || 'image/jpeg', 1);

                resolve(blob);
            } catch (err) {
                reject(err);
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
    });
}

/**
 * Creates a new gallery row in the database, uploads all associated photos to the storage bucket,
 * and creates corresponding database rows for each photo. Finally, links all uploaded photos
 * to the gallery.
 * 
 * @param galleryTitle - The title of the new exhibition/gallery
 * @param userId - The ID of the currently logged-in user who owns this gallery
 * @param gallery - The Gallery object containing the array of photos to be uploaded
 */
export async function createGallery(galleryTitle: string, userId: string, gallery: Gallery) {

    // Create UUID for gallery
    const guuid = ID.unique();
    const photoIds: string[] = [];

    //Creates a gallery row in DB
    try {
        const permissions = [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ];

        await tablesDB.createRow({
            databaseId,
            tableId: 'gallery',
            rowId: guuid,
            data: {
                galleryTitle: galleryTitle,
                users: userId,
            },
            permissions
        });

        // Create rows for each photo with a dynamically generated UUID
        for (const photo of gallery.photos) {
            const photoId = ID.unique();
            photoIds.push(photoId);
            await createImage(photo, photoId, userId, guuid);
        }

        // Now that the photos actually exist in the database, we can safely link them to the gallery!
        await tablesDB.updateRow({
            databaseId,
            tableId: 'gallery',
            rowId: guuid,
            data: {
                photos: photoIds
            }
        });

    } catch (error) {
        console.error("Error creating gallery:", error);
        throw error;
    }

}

/**
 * Uploads a photo file to the storage bucket and creates a document for it in the 'photos' collection.
 * It also links the new photo document back to its parent gallery document.
 * 
 * @param item - The photo item containing the raw file, title, and description
 * @param uuid - The unique ID to be assigned to the new photo database row
 * @param userId - The ID of the currently logged-in user
 * @param galleryId - The ID of the parent gallery document
 */
export async function createImage(item: Photo, uuid: string, userId: string, galleryId: string) {
    if (!item.file) return;

    // Await the image upload first to get the string ID back!
    const imageId = await uploadImage(item.file, userId);

    const permissions = [
        Permission.read(Role.any()),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
    ];

    // Await the creation of the row
    await tablesDB.createRow({
        databaseId,
        tableId: 'photos',
        rowId: uuid,
        data: {
            title: item.title,
            description: item.description,
            exposure: item.metadata.exposure,
            iso: item.metadata.iso,
            lens: item.metadata.lens,
            isFrontPage: false,
            imageId: imageId,
            gallery: galleryId
        },
        permissions
    });
}


/**
 * Resizes (if needed) and uploads the raw image file to the Appwrite Storage bucket.
 * 
 * @param file - The File or Blob to be uploaded
 * @param title - The title of the photo
 * @param description - The description of the photo
 * @param userId - The ID of the currently logged-in user (for setting permissions)
 * @returns A Promise that resolves to the Appwrite storage file ID (buuid)
 */
export async function uploadImage(file: File | Blob, userId: string) {
    try {
        // 1. Resize Image if it is a File (and not already resized/blob)
        let fileToUpload: File;
        if (file instanceof File) {
            const resizedBlob = await resizeImage(file, 1200);
            fileToUpload = new File([resizedBlob], file.name, { type: file.type || 'image/jpeg' });
        } else {
            fileToUpload = new File([file], 'image.jpg', { type: file.type || 'image/jpeg' });
        }

        const permissions = [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ];

        // 2. Upload the actual image to your bucket
        const buuid = ID.unique();

        await storage.createFile({
            bucketId,
            fileId: buuid,
            file: fileToUpload,
            permissions
        });
        return buuid;
    } catch (error) {
        console.error("Error uploading and saving photo:", error);
        throw error;
    }
}

/**
 * Generates an image preview URL from the Appwrite storage bucket.
 * 
 * @param fileId - The storage bucket file ID
 * @param width - The maximum width of the generated preview image
 * @returns An object containing the preview URL
 */
export function retrieveImageURL(fileId: string, width: number) {
    const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
    const result = storage.getFilePreview({
        bucketId,
        fileId,
        width,
        quality: 100
    });
    return result;
}

/**
 * Queries the 'photos' database collection to find the single featured photo.
 * Returns the photo along with its nested relationship data (Gallery and User information)
 * to serve the front page.
 * 
 * @returns An object containing the combined artist name, photo title, and generated preview URL.
 */
export async function fetchFeaturedArtist() {
    try {
        const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
        const photosId = import.meta.env.VITE_APPWRITE_PHOTOS_COLLECTION_ID;

        // Fetch the featured photo with the full relationship chain populated
        const response = await tablesDB.listRows({
            databaseId,
            tableId: photosId,
            queries: [
                Query.equal('isFrontPage', true),
                Query.limit(1),
                Query.select(['*', 'gallery.*', 'gallery.users.*'])
            ]
        });

        const title = response.rows[0].title;
        const firstName = response.rows[0]?.gallery?.users?.firstName;
        const lastName = response.rows[0]?.gallery?.users?.lastName;
        const imageUrl = retrieveImageURL(response.rows[0]?.imageId, 500);

        return {
            name: `${firstName} ${lastName}`,
            title: `"${title}"`,
            imageUrl: imageUrl
        };
    } catch (error) {
        console.error("Failed to fetch featured artist:", error);
        return null;
    }
}

/**
 * Fetches the user document and their associated gallery from the database.
 * This query also populates the nested relationship fields so that the complete
 * gallery details and all associated photos are returned in a single request.
 * 
 * @param userId - The ID of the currently logged-in user
 * @returns A Promise that resolves to the user's Gallery object (which includes a 'photos' array)
 */
export async function fetchUserGallery(userId: string) {
    const response = await tablesDB.listRows({
        databaseId,
        tableId: 'users',
        queries: [
            Query.equal('$id', userId),
            Query.select(['*', 'gallery.*', 'gallery.photos.*'])
        ]
    })
    return (response.rows[0]);
}