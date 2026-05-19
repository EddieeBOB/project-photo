import { ID, Query } from 'appwrite';
import { tablesDB, storage } from '../lib/appwrite';

/**
 * Uploads an image to the storage bucket and creates a document in the photos collection.
 */
// export async function uploadImage(file, userId) {
//     try {
//         const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
//         const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
//         const photosCollectionId = import.meta.env.VITE_APPWRITE_PHOTOS_COLLECTION_ID;

//         if (!bucketId || !databaseId || !photosCollectionId) {
//             throw new Error("Missing environment variables");
//         }

//         // 1. Upload the actual image to your bucket
//         const uploadedFile = await storage.createFile(
//             bucketId,
//             ID.unique(),
//             file
//         );

//         // 2. Save the reference in your "photos" collection
//         const photoDocument = await tabledb.createRow(
//             databaseId,
//             photosCollectionId,
//             ID.unique(),
//             {
//                 userId: userId,
//                 fileId: uploadedFile.$id,
//                 createdAt: new Date().toISOString()
//             }
//         );

//         return photoDocument;
//     } catch (error) {
//         console.error("Error uploading and saving photo:", error);
//         throw error;
//     }
// }

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
