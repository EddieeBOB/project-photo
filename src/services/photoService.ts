import { ID, Query, type Models } from 'appwrite';
import { tablesDB, storage } from '../lib/appwrite';
import pica from 'pica';
import type { Gallery, Photo, CarouselPhoto } from '../components/EditableGalleryCarousel';
import exifr from 'exifr';


const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

/**
 * Processes an array of File objects and maps them to CarouselPhoto objects.
 * Filters out non-image files and assigns default metadata, preview URLs,
 * and sets the default title using the file name without extension.
 * 
 * @param files - Array of File objects
 * @returns Array of CarouselPhoto objects
 */
export async function processFiles(files: File[]): Promise<CarouselPhoto[]> {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const photoPromises = imageFiles.map(async (file, idx) => {
        const previewUrl = URL.createObjectURL(file);
        const title = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const metadata = await getPhotoMetadata(file);
        return {
            id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            src: previewUrl,
            title: title,
            description: '',
            metadata: metadata,
            file: file
        };
    });
    return Promise.all(photoPromises);
}

/**
 * Extracts EXIF metadata (exposure, ISO, lens) from an image file using exifr.
 * 
 * @param file - The image File object
 * @returns A Promise that resolves to the metadata object containing exposure, iso, and lens
 */
export async function getPhotoMetadata(file: File) {
    const defaultMetadata = {
        exposure: '',
        iso: '',
        lens: ''
    };

    try {
        const exifData = await exifr.parse(file);
        if (!exifData) {
            return defaultMetadata;
        }

        const exposureTime = exifData.ExposureTime;
        const fNumber = exifData.FNumber;
        const isoValue = exifData.ISO ?? exifData.ISOSpeedRatings;
        const lensModel = exifData.LensModel;
        const focalLength = exifData.FocalLength;

        // Format exposure
        let shutterSpeed = '';
        if (exposureTime !== undefined && exposureTime !== null) {
            if (exposureTime < 1) {
                const denominator = Math.round(1 / exposureTime);
                shutterSpeed = `1/${denominator}`;
            } else {
                shutterSpeed = `${exposureTime}s`;
            }
        }

        let aperture = '';
        if (fNumber !== undefined && fNumber !== null) {
            aperture = `f/${fNumber}`;
        }

        let exposure = '';
        if (shutterSpeed && aperture) {
            exposure = `${shutterSpeed} · ${aperture}`;
        } else if (shutterSpeed) {
            exposure = shutterSpeed;
        } else if (aperture) {
            exposure = aperture;
        }

        // Format ISO
        const iso = isoValue !== undefined && isoValue !== null ? String(isoValue) : '';

        // Format lens
        let lens = lensModel || '';
        if (!lens && focalLength !== undefined && focalLength !== null) {
            lens = `${focalLength}mm`;
        }

        return {
            exposure,
            iso,
            lens
        };
    } catch (error) {
        console.warn("Failed to extract EXIF metadata from file:", file.name, error);
        return defaultMetadata;
    }
}


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
                if (!img.width) {
                    reject(new Error("Image loaded with 0 width"));
                    return;
                }

                // Only downscale if the image exceeds target width
                const targetWidth = img.width > width ? width : img.width;
                const scale = targetWidth / img.width;
                const height = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
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

/**
 * Creates a new gallery row in the database, uploads all associated photos to the storage bucket,
 * and creates corresponding database rows for each photo. Finally, links all uploaded photos
 * to the gallery.
 * 
 * @param galleryTitle - The title of the new exhibition/gallery
 * @param userId - The ID of the currently logged-in user who owns this gallery
 * @param gallery - The Gallery object containing the array of photos to be uploaded
 */
export async function createGallery(
    galleryTitle: string,
    userId: string,
    gallery: Gallery,
    isPublic: boolean = false,
    onProgress?: (current: number, total: number) => void
) {

    // Create UUID for gallery
    const guuid = ID.unique();
    const photoIds: string[] = [];
    const uploadedFileIds: string[] = [];

    //Creates a gallery row in DB
    try {
        await tablesDB.createRow({
            databaseId,
            tableId: 'gallery',
            rowId: guuid,
            data: {
                galleryTitle: galleryTitle,
                users: userId,
                isPublic: isPublic
            }
        });

        // Create rows for each photo with a dynamically generated UUID
        let current = 0;
        const total = gallery.photos.length;
        for (const photo of gallery.photos) {
            const photoId = ID.unique();
            photoIds.push(photoId);
            const imageId = await createImage(photo, photoId, guuid);
            if (imageId) {
                uploadedFileIds.push(imageId);
            }
            current++;
            if (onProgress) {
                onProgress(current, total);
            }
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
        console.error("Error creating gallery, initiating rollback cleanup...", error);

        // Rollback: Delete any created photo documents
        for (const pid of photoIds) {
            try {
                await tablesDB.deleteRow({ databaseId, tableId: 'photos', rowId: pid });
            } catch { }
        }
        // Rollback: Delete any uploaded files from storage
        for (const fid of uploadedFileIds) {
            try {
                await storage.deleteFile({ bucketId, fileId: fid });
            } catch { }
        }
        // Rollback: Delete the gallery row
        try {
            await tablesDB.deleteRow({ databaseId, tableId: 'gallery', rowId: guuid });
        } catch { }

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
export async function createImage(item: Photo, uuid: string, galleryId: string) {
    if (!item.file) return null;

    // Await the image upload first to get the string ID back!
    const imageId = await uploadImage(item.file);

    try {
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
            }
        });

        return imageId;
    } catch (error) {
        // Clean up the uploaded storage file if the DB document write fails
        try {
            await storage.deleteFile({
                bucketId,
                fileId: imageId
            });
        } catch (cleanupError) {
            console.error(`Failed to clean up storage file ${imageId} after DB error:`, cleanupError);
        }
        throw error;
    }
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
export async function uploadImage(file: File | Blob) {
    try {
        // 1. Resize Image if it is a File (and not already resized/blob)
        let fileToUpload: File;
        if (file instanceof File) {
            const resizedBlob = await resizeImage(file, 1200);
            fileToUpload = new File([resizedBlob], file.name, { type: file.type || 'image/jpeg' });
        } else {
            fileToUpload = new File([file], 'image.jpg', { type: file.type || 'image/jpeg' });
        }

        // 2. Upload the actual image to your bucket
        const buuid = ID.unique();

        await storage.createFile({
            bucketId,
            fileId: buuid,
            file: fileToUpload
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
export function retrieveImageURL(fileId: string, width: number): string {
    const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
    const result = storage.getFilePreview({
        bucketId,
        fileId,
        width,
        quality: width <= 500 ? 80 : 90
    });
    return result.toString();
}

export function mapGalleryToCarousel(
    fetchedGallery: Models.Document & { galleryTitle?: string; photos?: any[]; isPublic?: boolean },
    userId: string
): any {
    if (!fetchedGallery || !fetchedGallery.photos || fetchedGallery.photos.length === 0) return null;

    const mappedPhotos = fetchedGallery.photos.map((photo: any) => ({
        id: photo.$id,
        src: retrieveImageURL(photo.imageId, 1200),
        title: photo.title || '',
        description: photo.description,
        metadata: {
            exposure: photo.exposure || 'N/A',
            iso: photo.iso || 'N/A',
            lens: photo.lens || 'N/A'
        }
    }));

    return {
        id: fetchedGallery.$id,
        title: fetchedGallery.galleryTitle || "Untitled Exhibition",
        userId,
        photos: mappedPhotos,
        isPublic: fetchedGallery.isPublic ?? false
    };
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

        if (!response.rows || response.rows.length === 0) {
            return null;
        }

        const row = response.rows[0];
        const title = row?.title ?? 'Untitled';
        const artistUsername = row?.gallery?.users?.username;
        const imageId = row?.imageId;

        if (!imageId) {
            console.warn("Featured photo has no imageId, skipping.");
            return null;
        }

        const name = artistUsername || 'Anonymous Artist';
        const imageUrl = retrieveImageURL(imageId, 500);

        return {
            name,
            title: `"${title}"`,
            imageUrl
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

/**
 * Deletes a single photo document and its corresponding file in storage.
 * 
 * @param photoId - The database row ID of the photo
 */
export async function deletePhoto(photoId: string) {
    try {
        // 1. Fetch photo row to get imageId (storage file ID)
        const photo = await tablesDB.getRow({
            databaseId,
            tableId: 'photos',
            rowId: photoId
        });

        // 2. Clean up file in storage if it exists
        if (photo?.imageId) {
            try {
                await storage.deleteFile({
                    bucketId,
                    fileId: photo.imageId
                });
            } catch (err) {
                console.warn(`Failed to delete storage file ${photo.imageId}:`, err);
            }
        }

        // 3. Delete photo row from database
        await tablesDB.deleteRow({
            databaseId,
            tableId: 'photos',
            rowId: photoId
        });
    } catch (error) {
        console.error("Error deleting photo:", error);
        throw error;
    }
}

/**
 * Deletes a gallery row, including all associated photos and files from storage.
 * 
 * @param galleryId - The ID of the gallery to delete
 */
export async function deleteGallery(galleryId: string) {
    try {
        // 1. Fetch all photos associated with this gallery
        const allPhotos: any[] = [];
        let offset = 0;

        while (true) {
            const response = await tablesDB.listRows({
                databaseId,
                tableId: 'photos',
                queries: [
                    Query.equal('gallery', galleryId),
                    Query.limit(100),
                    Query.offset(offset)
                ]
            });

            allPhotos.push(...response.rows);

            if (response.rows.length < 100) break;
            offset += 100;
        }

        // 2. Delete all files from storage and photo rows in parallel
        const deletePromises = allPhotos.map(async (photo: any) => {
            if (photo.imageId) {
                try {
                    await storage.deleteFile({
                        bucketId,
                        fileId: photo.imageId
                    });
                } catch (err) {
                    console.warn(`[deleteGallery] Failed to delete storage file ${photo.imageId}:`, err);
                }
            }
            await tablesDB.deleteRow({
                databaseId,
                tableId: 'photos',
                rowId: photo.$id
            });
        });
        await Promise.all(deletePromises);

        // 3. Delete gallery row from database
        await tablesDB.deleteRow({
            databaseId,
            tableId: 'gallery',
            rowId: galleryId
        });
    } catch (error) {
        console.error("[deleteGallery] Error:", error);
        throw error;
    }
}

/**
 * Updates the public visibility status of a gallery.
 * 
 * @param galleryId - The ID of the gallery to update
 * @param isPublic - The public visibility status to set
 */
export async function updateGalleryVisibility(galleryId: string, isPublic: boolean) {
    try {
        await tablesDB.updateRow({
            databaseId,
            tableId: 'gallery',
            rowId: galleryId,
            data: {
                isPublic: isPublic
            }
        });
    } catch (error) {
        console.error("Failed to update gallery visibility:", error);
        throw error;
    }
}

/**
 * Fetches user profile document and their galleries by username.
 * 
 * @param username - The username to query
 * @returns A Promise that resolves to the user's document
 */
export async function fetchUserGalleryByUsername(username: string) {
    try {
        // 1. Try exact match first
        let response = await tablesDB.listRows({
            databaseId,
            tableId: 'users',
            queries: [
                Query.equal('username', username),
                Query.select(['*', 'gallery.*', 'gallery.photos.*'])
            ]
        });

        if (response.rows && response.rows.length > 0) {
            return response.rows[0];
        }

        // 2. Fallback: Search case-insensitively and whitespace-insensitively
        response = await tablesDB.listRows({
            databaseId,
            tableId: 'users',
            queries: [
                Query.limit(100),
                Query.select(['*', 'gallery.*', 'gallery.photos.*'])
            ]
        });

        const targetUsername = username.trim().toLowerCase();
        const matchedRow = response.rows.find((row: any) => {
            const dbUsername = (row.username || '').trim().toLowerCase();
            return dbUsername === targetUsername;
        });

        return matchedRow || null;
    } catch (error) {
        console.error("Failed to fetch user by username:", error);
        throw error;
    }
}

/**
 * Retrieves specific static asset URLs from Appwrite storage.
 * Combines the mapping for Hero, Login, and Signup photos into a single method.
 */
export function getAppwriteStaticPhoto(type: 'hero' | 'login' | 'signup'): string {
    const ids = {
        hero: '6a1b6ef1002df5981a20',
        login: '6a1b6ef1002de3b47d12',
        signup: '6a1b6ef1002df68d663d'
    };
    return retrieveImageURL(ids[type], 1200);
}

/**
 * Retrieves the URL for the Hero photo from Appwrite.
 */
export function getHeroPhoto(): string {
    return getAppwriteStaticPhoto('hero');
}

/**
 * Retrieves the URL for the Login page photo from Appwrite.
 */
export function getLoginPhoto(): string {
    return getAppwriteStaticPhoto('login');
}

/**
 * Retrieves the URL for the Signup page photo from Appwrite.
 */
export function getSignupPhoto(): string {
    return getAppwriteStaticPhoto('signup');
}