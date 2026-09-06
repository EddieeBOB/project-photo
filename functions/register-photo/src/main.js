import { Client, Databases, Storage } from 'node-appwrite';

import { createRegistry } from './registry.js';

// Update visibility for up to 100 files per call. The gallery splits larger batches.
const MAX_VISIBILITY_BATCH = 100;

export default async ({ req, res, error }) => {
  // Use the signed-in user supplied by Appwrite.
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) return res.json({ error: 'Authentication required.' }, 401);

  // Read the JSON body and reject anything that is not an object.
  let body;
  try {
    body = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : {});
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.json({ error: 'Invalid request body.' }, 400);
    }
  } catch {
    return res.json({ error: 'Invalid request body.' }, 400);
  }

  // Accept only photo registration or a visibility update.
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!action) return res.json({ error: 'action is required.' }, 400);
  if (action !== 'register' && action !== 'visibility') {
    return res.json({ error: 'Unknown action.' }, 400);
  }

  // Registration uses one ID; visibility uses a list with blanks and duplicates removed.
  const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : '';
  const fileIds = Array.isArray(body.fileIds)
    ? [...new Set(body.fileIds.filter((id) => typeof id === 'string').map((id) => id.trim()).filter(Boolean))]
    : [];
  // Check that the selected action has the IDs it needs, within the batch limit.
  if (action === 'register' && !fileId) {
    return res.json({ error: 'fileId is required.' }, 400);
  }
  if (action === 'visibility' && !fileIds.length) {
    return res.json({ error: 'fileIds must be a non-empty array.' }, 400);
  }
  if (action === 'visibility' && fileIds.length > MAX_VISIBILITY_BATCH) {
    return res.json({ error: `At most ${MAX_VISIBILITY_BATCH} files per call.` }, 400);
  }

  // Load the database and storage bucket configured for this function. These
  // are the project-wide variables the site is built from, so the ids are set
  // once and the browser and this function cannot drift apart. The `VITE_`
  // prefix is the site's rule that a value is inlined into the browser bundle,
  // which both of these already are — so nothing secret belongs under it.
  const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
  const bucketId = process.env.VITE_APPWRITE_BUCKET_ID;
  if (!databaseId || !bucketId) {
    error('VITE_APPWRITE_DATABASE_ID and VITE_APPWRITE_BUCKET_ID must both be set');
    return res.json({ error: 'Registration is unavailable.' }, 500);
  }

  try {
    // Connect using Appwrite's server API key for this execution.
    const admin = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers['x-appwrite-key'] || '');
    // Give the photo operations their clients, resource IDs, and caller identity.
    const registry = createRegistry({
      storage: new Storage(admin),
      databases: new Databases(admin),
      databaseId,
      bucketId,
      tableId: process.env.VITE_APPWRITE_PROVENANCE_TABLE_ID || 'provenance',
      userId,
      error,
    });

    // Store a hash of the photo's bytes, or sync rows with their files' visibility.
    const result = action === 'register'
      ? { sha256: await registry.register(fileId) }
      : await registry.visibility(fileIds);
    return res.json(result);
  } catch (e) {
    // Log the full error; return a safe message to the caller.
    error(e.stack || e.message);
    return res.json({ error: e.status ? e.message : 'Operation failed.' }, e.status || 500);
  }
};
