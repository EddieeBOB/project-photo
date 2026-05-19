import { Client, TablesDB, Storage } from 'appwrite';

const client = new Client();

// Use the endpoint and project ID from your .env file
client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export { client };
