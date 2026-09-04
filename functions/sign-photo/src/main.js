import { Client, Storage, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

import { signImage } from './sign.js';

/**
 * sign-photo — signs an image with a C2PA manifest and stores it.
 *
 * The signing key lives here and only here. Signing in the browser would ship
 * the key to every visitor, and provenance anyone can forge proves nothing.
 *
 * The client sends the bytes it would otherwise have uploaded, and this
 * function does the upload instead. Signing before the bucket write is what
 * keeps it to one file per photo: Appwrite's `updateFile` cannot change a
 * file's content, so signing an already-uploaded file would mean writing a
 * second file and deleting the first, on every photo.
 *
 * The manifest hashes the bytes it is embedded in, so the stored file has to be
 * served untransformed — `getFileView`, never `getFilePreview`. Appwrite's
 * preview endpoint re-encodes on the fly, which both strips the manifest and
 * breaks the hash it was signed over.
 *
 * Request  (POST, JSON):
 *   { "image": base64, "mimeType": string, "name": string,
 *     "isPublic": boolean, "creator"?: string }
 * Response (JSON):
 *   200 { "fileId": string }   id of the stored, signed file
 *   400 { "error": "..." }     malformed request
 *   401 { "error": "..." }     no authenticated caller
 *   500 { "error": "..." }     signing not configured, or signing/storage failed
 *
 * Function variables: C2PA_CERT_PEM, C2PA_PRIVATE_KEY_PEM (both base64),
 *   APPWRITE_BUCKET_ID. Dynamic API key scope: files.write.
 */

/** What the studio's canvas re-encode can produce, and c2pa can sign. */
const ALLOWED_MIME_TYPES = ['image/webp', 'image/png', 'image/jpeg'];

/**
 * Ceiling on a decoded upload. The studio downscales to 1200px before sending,
 * which lands well under 1MB in practice; this only exists so an oversized body
 * is refused before it reaches the signer.
 */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export default async ({ req, res, log, error }) => {
    let body;
    try {
        body = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : {});
    } catch {
        return res.json({ error: 'Invalid request body.' }, 400);
    }

    // Appwrite sets this header from the caller's session; the body never gets
    // a say in who owns the file, so nobody can upload a photo as someone else.
    const ownerId = req.headers?.['x-appwrite-user-id'];
    if (!ownerId) return res.json({ error: 'Authentication required.' }, 401);

    const name = String(body.name ?? '').trim();
    const mimeType = String(body.mimeType ?? '').trim();
    const creator = String(body.creator ?? '').trim();
    const isPublic = body.isPublic === true;

    //No image
    if (!body.image || typeof body.image !== 'string') {
        return res.json({ error: 'image is required.' }, 400);
    }
   
    //No name
    if (!name) return res.json({ error: 'name is required.' }, 400);
   
    //No mimeType
    if (!mimeType) return res.json({ error: 'mimeType is required.' }, 400);

    //Not an allowed mimeType
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.json({ error: 'Unsupported image type.' }, 400);
    }

    //Decode base64
    const bytes = Buffer.from(body.image, 'base64');
    if (bytes.length === 0) return res.json({ error: 'image is not valid base64.' }, 400);
    
    //Too large image
    if (bytes.length > MAX_IMAGE_BYTES) {
        return res.json({ error: 'Image exceeds the maximum size.' }, 400);
    }

    const certPem = decodePem(process.env.C2PA_CERT_PEM);
    const keyPem = decodePem(process.env.C2PA_PRIVATE_KEY_PEM);
    if (!certPem || !keyPem) {
        error('signing identity is not configured: set C2PA_CERT_PEM and C2PA_PRIVATE_KEY_PEM');
        return res.json({ error: 'Signing is unavailable.' }, 500);
    }

    const bucketId = process.env.APPWRITE_BUCKET_ID;
    if (!bucketId) {
        error('APPWRITE_BUCKET_ID is not set');
        return res.json({ error: 'Signing is unavailable.' }, 500);
    }

    try {
        const signed = signImage(bytes, mimeType, {
            certPem,
            keyPem,
            title: name,
            creator: creator || undefined,
        });

        const admin = new Client()
            .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(req.headers?.['x-appwrite-key'] || '');

        const fileId = ID.unique();
        await new Storage(admin).createFile(
            bucketId,
            fileId,
            InputFile.fromBuffer(signed, name),
            ownerPermissions(ownerId, isPublic),
        );

        log(`signed and stored ${fileId} (${bytes.length} -> ${signed.length} bytes)`);
        return res.json({ fileId });
    } catch (e) {
        error(`signing failed for ${name}: ${e.message}`);
        return res.json({ error: 'Signing failed.' }, 500);
    }
};

/**
 * Mirrors `ownerPermissions` in src/lib/permissions.ts — the owner gets full
 * control, and a public photo is additionally readable by anyone. Kept in step
 * with that file: a file written here must be indistinguishable from one the
 * browser wrote.
 */
function ownerPermissions(ownerId, isPublic) {
    const permissions = [
        Permission.read(Role.user(ownerId)),
        Permission.update(Role.user(ownerId)),
        Permission.delete(Role.user(ownerId)),
    ];
    if (isPublic) permissions.push(Permission.read(Role.any()));
    return permissions;
}

/** Function variables hold PEMs base64-encoded so newlines survive the round trip. */
function decodePem(value) {
    return value ? Buffer.from(value, 'base64') : null;
}
