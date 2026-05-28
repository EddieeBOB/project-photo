import { ID, Query, Permission, Role } from 'appwrite';
import { tablesDB, storage } from '../lib/appwrite';
import pica from 'pica';
import type { Gallery, Photo } from '../components/EditableGalleryCarousel';

const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;


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

//Creates gallery row for db 
export async function createGallery(galleryTitle: string, userId: string, gallery: Gallery) {

    //Create all the UUID for all the photos
    const puuid: string[] = [];
    for (let _photo of gallery.photos) {
        puuid.push(ID.unique());
    }

    //Ccreate UUID for gallery
    const guuid = ID.unique();

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

        //Create rows for each photo with the UUID
        for (let i = 0; i < gallery.photos.length; i++) {
            await createImage(gallery.photos[i], puuid[i], userId, guuid);
        }

        // Now that the photos actually exist in the database, we can safely link them to the gallery!
        await tablesDB.updateRow({
            databaseId,
            tableId: 'gallery',
            rowId: guuid,
            data: {
                photos: puuid
            }
        });

    } catch (error) {
        console.error("Error creating gallery:", error);
        throw error;
    }

}

//Create image row for db
export async function createImage(item: Photo, uuid: string, userId: string, galleryId: string) {
    if (!item.file) return;

    // Await the image upload first to get the string ID back!
    const imageId = await uploadImage(item.file, item.title, item.description, userId);

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
            isFrontPage: false,
            imageId: imageId,
            gallery: galleryId
        },
        permissions
    });
}


export async function uploadImage(file: File | Blob, title: string, description: string, userId: string) {
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

        await storage.createFile(
            bucketId,
            buuid,
            fileToUpload,
            permissions
        );
        return buuid;
    } catch (error) {
        console.error("Error uploading and saving photo:", error);
        throw error;
    }
}

/*
* Requires: fileId, width
* Uses photoId and returns photo URL
*/
export function retrieveImageURL(fileId: string, width: number) {
    const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
    const result = storage.getFilePreview({
        bucketId,
        fileId,
        width,
        quality: 85
    });
    return result;
}

/*
* Requires: isFrontPage only exists on one photo
* Queries the 'photos' database, and its RELATIONSHIPS for:
* Title, Description, FirstName, LastName
* 
* Serves the front page.
* 
* Returns: ImageURL(Width: 500)
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

