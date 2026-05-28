import { Client, TablesDB, Query, ID, Storage } from 'appwrite';

// 1. Initialize Appwrite Client
const client = new Client()
    .setEndpoint('https://tor.cloud.appwrite.io/v1')
    .setProject('6a09504300328dac3255')
    .setDevKey('d8ffa9b305c671032c8e306f3c7033967b8466870fd0c58c347f057532d50607c49cebdbc124871c63d143acfcd70d8b60b18208207dd2b1774baeb3be9ef784c732149618bc76e5060eedaa45a5b5ca75959b5aa5b987e6fb58c92e1474c83dd5ae4b79b00153bc05ee204f5c170e6472fa72beac0a66bd367e8bb27fde72fd');

const tablesDB = new TablesDB(client);

const storage = new Storage(client);

async function testRows() {
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

testRows();
