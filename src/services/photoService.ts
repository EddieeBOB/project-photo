import { ID, Query } from 'appwrite';
import { tablesDB, storage } from '../lib/appwrite';
import pica from 'pica';

import type { CarouselItem } from '../components/EditableGalleryCarousel';

/**
 * Uploads an image to the storage bucket and creates a document in the photos collection.
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
                const blob = await resizer.toBlob(canvas, file.type || 'image/jpeg', 0.85);

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

export async function uploadGallery(title: string, userId: string, items: CarouselItem[]): Promise<any[]> {
    const unpublishedItems = items.filter(item => item.file);
    if (unpublishedItems.length === 0) {
        return [];
    }

    const uploadedDocuments = [];
    for (const item of unpublishedItems) {
        const description = `${title || 'Studio Collection'} · ${item.metadata.exposure} | ISO ${item.metadata.iso} | ${item.metadata.lens}`;
        const doc = await uploadImage(item.file!, item.title, description, userId);
        uploadedDocuments.push(doc);
    }
    return uploadedDocuments;
}

export async function uploadImage(file: File | Blob, title: string, description: string, userId: string) {
    try {
        const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
        const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
        const photosCollectionId = import.meta.env.VITE_APPWRITE_PHOTOS_COLLECTION_ID;

        // 1. Resize Image if it is a File (and not already resized/blob)
        let fileToUpload: File;
        if (file instanceof File) {
            const resizedBlob = await resizeImage(file, 1200);
            fileToUpload = new File([resizedBlob], file.name, { type: file.type || 'image/jpeg' });
        } else {
            fileToUpload = new File([file], 'image.jpg', { type: file.type || 'image/jpeg' });
        }

        // 2. Upload the actual image to your bucket
        const uploadedFile = await storage.createFile(
            bucketId,
            ID.unique(),
            fileToUpload
        );

        // 3. Save the reference in your "photos" collection
        const photoDocument = await tablesDB.createRow({
            databaseId,
            tableId: photosCollectionId,
            rowId: ID.unique(),
            data: {
                title: title || "Untitled Photo",
                description: description || "",
                isFrontPage: false,
                "image-id": uploadedFile.$id,
                gallery: userId
            }
        });

        return photoDocument;
    } catch (error) {
        console.error("Error uploading and saving photo:", error);
        throw error;
    }
}

/**
 * Fetches the featured artist and returns their data object.
 */
export async function fetchFeaturedArtist() {
    try {
        const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
        const photosId = import.meta.env.VITE_APPWRITE_PHOTOS_COLLECTION_ID;
        const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;

        // Fetch the featured photo with the full relationship chain populated
        const response = await tablesDB.listRows({
            databaseId,
            tableId: photosId,
            queries: [
                Query.equal('isFrontPage', true),
                Query.limit(1),
            ]
        });

        const doc = response.rows[0];
        if (!doc) return null;

        let imageUrl = null;

        // Check for image-id based on the database schema
        const fileId = doc['image-id'];

        if (fileId && bucketId) {
            // Append a cache-buster using the row's updatedAt timestamp
            // This forces the browser to fetch the new image if the database was updated
            imageUrl = storage.getFileView(bucketId, fileId).toString() + `&t=${new Date(doc.$updatedAt).getTime()}`;
        }

        // Traverse the relationship chain: photo.gallery -> gallery.users -> user
        let firstName = 'Unknown';
        let lastName = 'Artist';

        const gallery = doc.gallery;
        const galleryDoc = Array.isArray(gallery) ? gallery[0] : gallery;

        if (galleryDoc && typeof galleryDoc === 'object') {
            // Gallery is a populated relationship object
            const usersField = galleryDoc.users;
            const user = Array.isArray(usersField) ? usersField[0] : usersField;
            if (user && typeof user === 'object') {
                firstName = user.firstName || 'Unknown';
                lastName = user.lastName || 'Artist';
            } else if (user && typeof user === 'string') {
                // users field is a raw user ID — fetch the user
                const artistsId = import.meta.env.VITE_APPWRITE_ARTISTS_COLLECTION_ID;
                if (artistsId) {
                    try {
                        const userDoc = await tablesDB.getRow({ databaseId, tableId: artistsId, rowId: user });
                        firstName = userDoc.firstName || 'Unknown';
                        lastName = userDoc.lastName || 'Artist';
                    } catch { /* user not found */ }
                }
            }
        } else if (galleryDoc && typeof galleryDoc === 'string') {
            // Gallery is a raw gallery ID — fetch the gallery doc, then resolve the user
            try {
                const galleryRow = await tablesDB.getRow({ databaseId, tableId: 'gallery', rowId: galleryDoc });
                const usersField = galleryRow.users;
                const userId = Array.isArray(usersField) ? usersField[0] : usersField;

                if (userId && typeof userId === 'object') {
                    firstName = userId.firstName || 'Unknown';
                    lastName = userId.lastName || 'Artist';
                } else if (userId && typeof userId === 'string') {
                    const artistsId = import.meta.env.VITE_APPWRITE_ARTISTS_COLLECTION_ID;
                    if (artistsId) {
                        const userDoc = await tablesDB.getRow({ databaseId, tableId: artistsId, rowId: userId });
                        firstName = userDoc.firstName || 'Unknown';
                        lastName = userDoc.lastName || 'Artist';
                    }
                }
            } catch {
                // Gallery or user not found — use defaults
            }
        }

        const title = doc.title;

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

