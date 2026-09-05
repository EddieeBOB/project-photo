//! The one Appwrite call this function makes: storing the signed file.
//!
//! Done over plain HTTP rather than through the `appwrite` crate, which pins
//! `fastrand = "=2.0.2"` in every published version and therefore cannot
//! coexist with the `tempfile 3.27` that c2pa requires.

use std::error::Error;

use reqwest::blocking::multipart::{Form, Part};
use reqwest::blocking::Client;
use serde_json::Value;

/// Everything needed to store one file, gathered before the call so the
/// request itself stays a single expression.
pub struct UploadRequest {
    pub endpoint: String,
    pub project_id: String,
    pub api_key: String,
    pub bucket_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub permissions: Vec<String>,
}

/// Uploads `bytes` to the bucket and returns the id Appwrite assigned.
///
/// The literal `unique()` asks Appwrite to mint the id, which saves carrying a
/// UUID dependency for a value the response hands back anyway.
pub fn create_file(request: &UploadRequest, bytes: Vec<u8>) -> Result<String, Box<dyn Error>> {
    let part = Part::bytes(bytes)
        .file_name(request.file_name.clone())
        .mime_str(&request.mime_type)?;

    let mut form = Form::new().text("fileId", "unique()").part("file", part);
    // Appwrite reads repeated permissions as an array of indexed form fields.
    for (index, permission) in request.permissions.iter().enumerate() {
        form = form.text(format!("permissions[{index}]"), permission.clone());
    }

    let url = format!(
        "{}/storage/buckets/{}/files",
        request.endpoint.trim_end_matches('/'),
        request.bucket_id
    );

    let response = Client::new()
        .post(url)
        .header("X-Appwrite-Project", &request.project_id)
        .header("X-Appwrite-Key", &request.api_key)
        .multipart(form)
        .send()?;

    let status = response.status();
    let body: Value = response.json()?;

    if !status.is_success() {
        // Appwrite puts a human-readable reason in `message`; keep it for the log.
        let message = body["message"].as_str().unwrap_or("unknown error");
        return Err(format!("Appwrite returned {status}: {message}").into());
    }

    body["$id"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "Appwrite response contained no $id".into())
}
