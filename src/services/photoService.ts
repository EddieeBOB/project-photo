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
                users: userId
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

        const response = await tablesDB.listRows({
            databaseId,
            tableId: photosId,
            queries: [
                Query.equal('isFrontPage', true),
                Query.limit(1),
                Query.select(['*', 'users.firstName', 'users.lastName'])
            ]
        });

        const doc = response.rows[0];

        let imageUrl = null;

        // Check for image-id based on the database schema
        const fileId = doc['image-id'];

        if (fileId && bucketId) {
            // Append a cache-buster using the row's updatedAt timestamp
            // This forces the browser to fetch the new image if the database was updated
            imageUrl = storage.getFileView(bucketId, fileId).toString() + `&t=${new Date(doc.$updatedAt).getTime()}`;
        }

        // The artist relationship field is "users"
        const user = Array.isArray(doc.users) ? doc.users[0] : doc.users;
        const firstName = user.firstName;
        const lastName = user.lastName;

        // The quote can be the description or title
        const title = doc.title;

        return {
            name: `${firstName}  ${lastName}`,
            title: `"${title}"`,
            imageUrl: imageUrl
        };
    } catch (error) {
        console.error("Failed to fetch featured artist:", error);
        return null;
    }
}
