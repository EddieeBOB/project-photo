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
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.substring(1, value.length - 1);
            }
            env[match[1]] = value;
        }
    }
}

const endpoint = env.VITE_APPWRITE_ENDPOINT;
const projectId = env.VITE_APPWRITE_PROJECT_ID;
const devKey = env.VITE_APPWRITE_DEV_KEY;
const databaseId = env.VITE_APPWRITE_DATABASE_ID;

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

async function testRelationship() {
    try {
        // --- Fetch all users ---
        console.log('=== Users (artists) ===');
        const usersResponse = await tablesDB.listRows({ databaseId, tableId: 'users' });
        for (const user of usersResponse.rows) {
            console.log(`  ID: ${user.$id}  |  ${user.firstName} ${user.lastName}  |  ${user.email}`);
        }

        // --- Fetch all gallery documents ---
        console.log('\n=== Gallery documents ===');
        let galleryRows = [];
        try {
            const galleryResponse = await tablesDB.listRows({ databaseId, tableId: 'gallery' });
            galleryRows = galleryResponse.rows;
            for (const g of galleryRows) {
                const usersField = g.users;
                let linkedUser = '(none)';
                if (Array.isArray(usersField) && usersField.length > 0) {
                    const u = typeof usersField[0] === 'object' ? usersField[0] : usersField[0];
                    linkedUser = typeof u === 'object'
                        ? `${u.firstName} ${u.lastName} (${u.$id})`
                        : u;
                } else if (usersField && typeof usersField === 'object') {
                    linkedUser = `${usersField.firstName} ${usersField.lastName} (${usersField.$id})`;
                } else if (usersField) {
                    linkedUser = String(usersField);
                }
                console.log(`  Gallery ID: ${g.$id}  ->  User: ${linkedUser}`);
            }
            if (galleryRows.length === 0) console.log('  (no gallery documents found)');
        } catch (err) {
            console.log(`  Could not access gallery collection: ${err.message}`);
        }

        // --- Fetch all photos ---
        console.log('\n=== Photos ===');
        const photosResponse = await tablesDB.listRows({ databaseId, tableId: 'photos' });
        for (const photo of photosResponse.rows) {
            console.log(`  Photo ID: ${photo.$id}`);
            console.log(`    Title:       ${photo.title}`);
            console.log(`    Description: ${photo.description}`);
            console.log(`    Image ID:    ${photo['image-id']}`);
            console.log(`    Front Page:  ${photo.isFrontPage}`);

            const gallery = photo.gallery;
            if (gallery == null) {
                console.log(`    Gallery:     (not linked)`);
            } else if (typeof gallery === 'string') {
                console.log(`    Gallery ->   ID: ${gallery}`);
            } else if (typeof gallery === 'object') {
                const g = Array.isArray(gallery) ? gallery[0] : gallery;
                if (g) {
                    console.log(`    Gallery ->   ID: ${g.$id || JSON.stringify(g)}`);
                }
            }
            console.log();
        }

        // --- Relationship chain ---
        console.log('=== Relationship Chain: Photo -> Gallery -> User ===');
        console.log('Photo Title'.padEnd(28) + 'Gallery ID'.padEnd(28) + 'Artist');
        console.log('-'.repeat(84));
        for (const photo of photosResponse.rows) {
            const raw = photo.gallery;
            let galleryId = '(not linked)';
            let artistName = '—';

            if (typeof raw === 'string') {
                galleryId = raw;
                // Look up gallery in our fetched rows
                const g = galleryRows.find(r => r.$id === raw);
                if (g) {
                    const usersField = g.users;
                    const u = Array.isArray(usersField) ? usersField[0] : usersField;
                    if (u && typeof u === 'object') {
                        artistName = `${u.firstName} ${u.lastName}`;
                    } else if (u) {
                        artistName = `User ID: ${u}`;
                    }
                }
            } else if (raw && typeof raw === 'object') {
                const g = Array.isArray(raw) ? raw[0] : raw;
                galleryId = g?.$id || '(populated)';
                const usersField = g?.users;
                const u = Array.isArray(usersField) ? usersField[0] : usersField;
                if (u && typeof u === 'object') {
                    artistName = `${u.firstName} ${u.lastName}`;
                }
            }

            console.log(
                `${(photo.title || 'Untitled').padEnd(28)}${galleryId.padEnd(28)}${artistName}`
            );
        }

    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

testRelationship();
