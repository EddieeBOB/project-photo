import { Client, TablesDB, Query, ID, Storage } from 'appwrite';

// 1. Initialize Appwrite Client
const client = new Client()
    .setEndpoint('https://tor.cloud.appwrite.io/v1')
    .setProject('6a09504300328dac3255')
    .setDevKey(process.env.APPWRITE_DEV_KEY);

const tablesDB = new TablesDB(client);

const storage = new Storage(client);

async function testPhotosRows() {
    try {
        const databaseId = '6a0955e90024b114ad38';
        const photosId = 'photos';

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
        const imageUrl = retrieveImageURL(response.rows[0]?.imageId);

        console.log("Title:", title);
        console.log("First Name:", firstName);
        console.log("Last Name:", lastName);
        console.log("Image URL:", imageUrl);
    } catch (error) {
        console.log(error);
    }
}

function retrieveImageURL(fileId) {
    if (!fileId) return null;
    const bucketId = '6a0952c2001568b2f373';
    const result = storage.getFilePreview({
        bucketId,
        fileId,
        width: 1200,
        quality: 85
    });

    return result;
}

async function testUsersRows(userId) {
    try {
        const databaseId = '6a0955e90024b114ad38';
        // Fetch the featured photo with the full relationship chain populated
        const response = await tablesDB.listRows({
            databaseId,
            tableId: 'users',
            queries: [
                Query.equal('$id', userId),
                Query.select(['gallery.photos.*'])
            ]
        });
        console.log(response.rows[0].gallery);
        for (const photo of response.rows[0].gallery[0].photos) {
            console.log(retrieveImageURL(response.rows[0].gallery[0].photos[0].imageId));
        }

    } catch (error) {
        console.log(error);
    }
}

//testPhotosRows();
testUsersRows('6a0f80a80015d5d872cd');