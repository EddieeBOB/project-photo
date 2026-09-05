//! sign-photo — signs an image with a C2PA manifest and stores it.
//!
//! Written in Rust rather than Node because Appwrite's Node runtime is Alpine
//! (musl), and every published C2PA binding for Node ships glibc-only prebuilt
//! binaries — `c2pa-node` fails there with `__fprintf_chk: symbol not found`.
//! Here Appwrite compiles `c2pa` from source inside the image it will run in,
//! so the libc cannot mismatch.
//!
//! The signing key lives here and only here. Signing in the browser would ship
//! the key to every visitor, and provenance anyone can forge proves nothing.
//!
//! The client sends the bytes it would otherwise have uploaded, and this
//! function does the upload instead. Signing before the bucket write keeps it
//! to one file per photo: Appwrite cannot replace a file's content, so signing
//! an already-uploaded file would mean writing a second file and deleting the
//! first, every time.
//!
//! The manifest hashes the bytes it sits in, so the stored file has to be
//! served untransformed — `getFileView`, never `getFilePreview`.
//!
//! Request  (POST, JSON):
//!   { "image": base64, "mimeType": string, "name": string, "isPublic": bool,
//!     "creator"?: string, "website"?: string }
//! Response (JSON):
//!   200 { "fileId": string }   id of the stored, signed file
//!   400 { "error": ... }       malformed request
//!   401 { "error": ... }       no authenticated caller
//!   500 { "error": ... }       signing not configured, or signing/storage failed
//!
//! Function variables: C2PA_CERT_PEM, C2PA_PRIVATE_KEY_PEM (both base64),
//!   APPWRITE_BUCKET_ID. Dynamic API key scope: files.write.

mod sign;
mod storage;

use std::env;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use openruntimes::{Context, Response};
use serde_json::{json, Value};

/// What the studio's canvas re-encode can produce, and c2pa can sign.
const ALLOWED_MIME_TYPES: [&str; 3] = ["image/webp", "image/png", "image/jpeg"];

/// Ceiling on a decoded upload. The studio downscales to 1200px before sending,
/// which lands well under 1MB in practice; this only exists so an oversized
/// body is refused before it reaches the signer.
const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;

pub fn main(mut context: Context) -> Response {
    let body: Value = context.req.body();

    // Appwrite sets this header from the caller's session; the body never gets
    // a say in who owns the file, so nobody can store a photo as someone else.
    let owner_id = match context.req.headers.get("x-appwrite-user-id") {
        Some(id) if is_appwrite_id(id) => id.clone(),
        _ => return respond(&context, "Authentication required.", 401),
    };

    let name = body["name"].as_str().unwrap_or_default().trim().to_string();
    let mime_type = body["mimeType"].as_str().unwrap_or_default().trim().to_string();
    let creator = body["creator"].as_str().unwrap_or_default().trim().to_string();
    let is_public = body["isPublic"].as_bool().unwrap_or(false);

    let image_b64 = match body["image"].as_str() {
        Some(image) if !image.is_empty() => image,
        _ => return respond(&context, "image is required.", 400),
    };
    if name.is_empty() {
        return respond(&context, "name is required.", 400);
    }
    if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
        return respond(&context, "Unsupported image type.", 400);
    }

    let bytes = match BASE64.decode(image_b64) {
        Ok(bytes) if !bytes.is_empty() => bytes,
        Ok(_) => return respond(&context, "image is empty.", 400),
        Err(_) => return respond(&context, "image is not valid base64.", 400),
    };
    if bytes.len() > MAX_IMAGE_BYTES {
        return respond(&context, "Image exceeds the maximum size.", 400);
    }

    // The PEMs are base64 in function variables so their newlines survive.
    let (cert_pem, key_pem) = match (decode_pem("C2PA_CERT_PEM"), decode_pem("C2PA_PRIVATE_KEY_PEM")) {
        (Some(cert), Some(key)) => (cert, key),
        _ => {
            context.error("signing identity is not configured: set C2PA_CERT_PEM and C2PA_PRIVATE_KEY_PEM");
            return respond(&context, "Signing is unavailable.", 500);
        }
    };

    let bucket_id = match env::var("APPWRITE_BUCKET_ID") {
        Ok(id) if !id.is_empty() => id,
        _ => {
            context.error("APPWRITE_BUCKET_ID is not set");
            return respond(&context, "Signing is unavailable.", 500);
        }
    };

    let uploaded_at = chrono::Utc::now().to_rfc3339();
    let details = sign::PhotoDetails {
        title: &name,
        creator: Some(creator.as_str()),
        website: body["website"].as_str(),
        uploaded_at: Some(&uploaded_at),
    };

    let signed = match sign::sign_image(&bytes, &mime_type, &cert_pem, &key_pem, &details) {
        Ok(signed) => signed,
        Err(error) => {
            context.error(format!("signing failed for {name}: {error}"));
            return respond(&context, "Signing failed.", 500);
        }
    };

    let upload = storage::UploadRequest {
        endpoint: env::var("APPWRITE_FUNCTION_API_ENDPOINT").unwrap_or_default(),
        project_id: env::var("APPWRITE_FUNCTION_PROJECT_ID").unwrap_or_default(),
        api_key: context.req.headers.get("x-appwrite-key").cloned().unwrap_or_default(),
        bucket_id,
        file_name: name.clone(),
        mime_type,
        permissions: owner_permissions(&owner_id, is_public),
    };

    match storage::create_file(&upload, signed.clone()) {
        Ok(file_id) => {
            context.log(format!(
                "signed and stored {file_id} ({} -> {} bytes)",
                bytes.len(),
                signed.len()
            ));
            context.res.json(json!({ "fileId": file_id }), None, None)
        }
        Err(error) => {
            context.error(format!("storing {name} failed: {error}"));
            respond(&context, "Signing failed.", 500)
        }
    }
}

/// Mirrors `ownerPermissions` in src/lib/permissions.ts — the owner gets full
/// control, and a public photo is additionally readable by anyone. A file
/// written here must be indistinguishable from one the browser wrote.
fn owner_permissions(owner_id: &str, is_public: bool) -> Vec<String> {
    let mut permissions = vec![
        format!("read(\"user:{owner_id}\")"),
        format!("update(\"user:{owner_id}\")"),
        format!("delete(\"user:{owner_id}\")"),
    ];
    if is_public {
        permissions.push("read(\"any\")".to_string());
    }
    permissions
}

/// The owner id is interpolated into permission strings, so it is checked
/// against the shape Appwrite ids actually take rather than escaped.
fn is_appwrite_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 36
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
}

/// Function variables hold PEMs base64-encoded so newlines survive the round trip.
fn decode_pem(name: &str) -> Option<Vec<u8>> {
    let raw = env::var(name).ok()?;
    if raw.is_empty() {
        return None;
    }
    BASE64.decode(raw).ok()
}

/// An error response. The caller gets a flat message; the detail is logged.
fn respond(context: &Context, message: &str, status: u16) -> Response {
    context.res.json(json!({ "error": message }), Some(status), None)
}
