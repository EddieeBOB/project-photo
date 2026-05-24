import { Client, TablesDB } from 'appwrite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Load environment variables from .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const env = {};
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = match[2] || '';
            // Remove surrounding quotes if any
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.substring(1, value.length - 1);
            }
            env[match[1]] = value;
        }
    }
}

const endpoint = env.VITE_APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT;
const projectId = env.VITE_APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
const devKey = env.VITE_APPWRITE_DEV_KEY || process.env.VITE_APPWRITE_DEV_KEY;
const databaseId = env.VITE_APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID;
const artistsCollectionId = env.VITE_APPWRITE_ARTISTS_COLLECTION_ID || process.env.VITE_APPWRITE_ARTISTS_COLLECTION_ID || 'users';
const photosCollectionId = env.VITE_APPWRITE_PHOTOS_COLLECTION_ID || process.env.VITE_APPWRITE_PHOTOS_COLLECTION_ID || 'photos';

console.log('Appwrite Configuration:');
console.log(`- Endpoint: ${endpoint}`);
console.log(`- Project ID: ${projectId}`);
console.log(`- Database ID: ${databaseId}`);
console.log(`- Artists Collection ID: ${artistsCollectionId}`);
console.log(`- Photos Collection ID: ${photosCollectionId}`);
console.log('');

if (!endpoint || !projectId || !devKey || !databaseId) {
    console.error('Error: Missing required configuration in .env file.');
    process.exit(1);
}

// 2. Initialize Appwrite Client
const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setDevKey(devKey);

const tablesDB = new TablesDB(client);

async function listDatabase() {
    try {
        console.log('Fetching data from Appwrite database...');
        
        // Fetch Artists (users)
        console.log(`\n--- Collection: ${artistsCollectionId} (Artists) ---`);
        try {
            const artistsResponse = await tablesDB.listRows({
                databaseId,
                tableId: artistsCollectionId,
            });
            console.log(`Found ${artistsResponse.rows.length} rows.`);
            if (artistsResponse.rows.length > 0) {
                console.table(artistsResponse.rows.map(row => ({
                    ID: row.$id,
                    Email: row.email || row.Email,
                    Name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.name || 'N/A',
                    CreatedAt: row.$createdAt
                })));
            } else {
                console.log('No artists found.');
            }
        } catch (err) {
            console.error(`Failed to list artists from collection "${artistsCollectionId}":`, err.message);
        }

        // Fetch Photos
        console.log(`\n--- Collection: ${photosCollectionId} (Photos) ---`);
        try {
            const photosResponse = await tablesDB.listRows({
                databaseId,
                tableId: photosCollectionId,
            });
            console.log(`Found ${photosResponse.rows.length} rows.`);
            if (photosResponse.rows.length > 0) {
                console.table(photosResponse.rows.map(row => ({
                    ID: row.$id,
                    Title: row.title,
                    Description: row.description,
                    IsFrontPage: row.isFrontPage,
                    ImageId: row['image-id'],
                    Gallery: typeof row.gallery === 'object' ? JSON.stringify(row.gallery) : row.gallery,
                    CreatedAt: row.$createdAt
                })));
            } else {
                console.log('No photos found.');
            }
        } catch (err) {
            console.error(`Failed to list photos from collection "${photosCollectionId}":`, err.message);
        }

    } catch (error) {
        console.error('Error listing database:', error);
    }
}

listDatabase();
