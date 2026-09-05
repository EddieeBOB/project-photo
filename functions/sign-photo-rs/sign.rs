//! C2PA manifest construction and signing.
//!
//! Kept free of Appwrite and HTTP concerns so it can be exercised on its own:
//! bytes in, signed bytes out.

use std::io::Cursor;

use c2pa::{create_signer, Builder, BuilderIntent, Context, DigitalSourceType, SigningAlg};
use serde_json::{json, Map, Value};

/// What the manifest should say about a photo, beyond the pixels themselves.
///
/// Everything here is optional because it comes from a profile the
/// photographer may not have filled in. A missing field is left out of the
/// manifest rather than written blank — an empty assertion is a claim about
/// nothing, and verifiers display it as one.
#[derive(Default)]
pub struct PhotoDetails<'a> {
    /// Recorded as the manifest title, conventionally the file name.
    pub title: &'a str,
    /// Named as the author, e.g. "Eddie Lam".
    pub creator: Option<&'a str>,
    /// The photographer's site, carried so a stray copy points home.
    pub website: Option<&'a str>,
    /// When this was published, ISO-8601. Written explicitly because without a
    /// timestamp authority the signature itself carries no trusted time.
    pub uploaded_at: Option<&'a str>,
}

/// Embeds a signed C2PA manifest into an image.
///
/// The manifest carries a hash of these exact bytes, so what comes back is the
/// only version that will ever validate — re-encode it anywhere downstream and
/// every verifier reports it as modified. That is the property worth having,
/// and the reason the signed bytes must be served untransformed.
pub fn sign_image(
    bytes: &[u8],
    mime_type: &str,
    cert_pem: &[u8],
    key_pem: &[u8],
    details: &PhotoDetails,
) -> c2pa::Result<Vec<u8>> {
    // An explicit Context rather than `Builder::from_json`, which is deprecated
    // because it leans on thread-local settings — not something to rely on in a
    // process that may serve more than one request.
    let mut builder = Builder::from_context(Context::new()).with_definition(
        json!({
            "claim_generator_info": [{ "name": "photoframes.me", "version": "1.0.0" }],
            "title": details.title,
            "format": mime_type,
        })
        .to_string(),
    )?;

    // `create` with a camera source type is the honest intent, and it is also
    // what lets a verifier say "no AI provenance detected" affirmatively rather
    // than by absence: the manifest states where the pixels came from.
    builder.set_intent(BuilderIntent::Create(DigitalSourceType::DigitalCapture));

    if let Some(work) = creative_work(details) {
        // schema.org is the assertion verification UIs read for author and site.
        builder.add_assertion("stds.schema-org.CreativeWork", &work)?;
    }

    let signer = create_signer::from_keys(cert_pem, key_pem, SigningAlg::Es256, None)?;

    let mut source = Cursor::new(bytes);
    let mut dest = Cursor::new(Vec::new());
    builder.sign(&*signer, mime_type, &mut source, &mut dest)?;

    Ok(dest.into_inner())
}

/// Author, site, and publication date, omitted entirely when none are known.
fn creative_work(details: &PhotoDetails) -> Option<Value> {
    let mut work = Map::new();

    if let Some(creator) = non_empty(details.creator) {
        work.insert(
            "author".into(),
            json!([{ "@type": "Person", "name": creator }]),
        );
    }
    if let Some(website) = non_empty(details.website) {
        work.insert("url".into(), json!(website));
    }
    if let Some(uploaded) = non_empty(details.uploaded_at) {
        work.insert("datePublished".into(), json!(uploaded));
    }
    if work.is_empty() {
        return None;
    }

    work.insert("@context".into(), json!("https://schema.org"));
    work.insert("@type".into(), json!("CreativeWork"));
    Some(Value::Object(work))
}

/// Treats a blank string as absent — a trimmed empty field is not a value.
fn non_empty<'a>(value: Option<&'a str>) -> Option<&'a str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use c2pa::{Reader, ValidationState};
    use std::io::Cursor;

    const SOURCE: &[u8] = include_bytes!("tests/fixtures/sample.webp");

    /// The dev identity from `scripts/make-dev-cert.sh`. c2pa rejects a
    /// self-signed leaf outright, so the script issues one from a local root.
    fn identity() -> (Vec<u8>, Vec<u8>) {
        (
            std::fs::read(".certs/certificate.pem").expect("run scripts/make-dev-cert.sh first"),
            std::fs::read(".certs/private.key").expect("run scripts/make-dev-cert.sh first"),
        )
    }

    fn sign(details: &PhotoDetails) -> Vec<u8> {
        let (cert, key) = identity();
        sign_image(SOURCE, "image/webp", &cert, &key, details).expect("signing failed")
    }

    fn read(bytes: &[u8]) -> Reader {
        Reader::from_context(Context::new())
            .with_stream("image/webp", Cursor::new(bytes.to_vec()))
            .expect("could not read")
    }

    fn details() -> PhotoDetails<'static> {
        PhotoDetails {
            title: "seascape.webp",
            creator: Some("Eddie Lam"),
            website: Some("https://photoframes.me"),
            uploaded_at: Some("2026-09-04T10:00:00Z"),
        }
    }

    #[test]
    fn signs_a_webp_and_reads_the_manifest_back() {
        let signed = sign(&details());
        assert!(signed.len() > SOURCE.len(), "signed asset should carry a manifest");

        let reader = read(&signed);
        assert_eq!(reader.active_manifest().unwrap().title(), Some("seascape.webp"));
    }

    #[test]
    fn validates_an_untouched_signed_asset() {
        // The development root is on nobody's trust list, so `Valid` rather
        // than `Trusted` is the expected outcome here.
        assert_eq!(read(&sign(&details())).validation_state(), ValidationState::Valid);
    }

    #[test]
    fn detects_tampering_with_the_signed_bytes() {
        // The property the whole feature rests on: the manifest hashes these
        // bytes, so any edit has to surface as a validation failure.
        let mut tampered = sign(&details());
        let last = tampered.len() - 32;
        tampered[last] ^= 0xff;

        assert_eq!(read(&tampered).validation_state(), ValidationState::Invalid);
    }

    #[test]
    fn records_creator_site_and_date() {
        let json = read(&sign(&details())).json();

        assert!(json.contains("Eddie Lam"), "creator missing from manifest");
        assert!(json.contains("https://photoframes.me"), "website missing from manifest");
        assert!(json.contains("2026-09-04"), "upload date missing from manifest");
    }

    #[test]
    fn omits_details_that_were_never_supplied() {
        let bare = PhotoDetails { title: "bare.webp", ..Default::default() };
        let json = read(&sign(&bare)).json();

        assert!(!json.contains("CreativeWork"), "empty CreativeWork should be omitted");
    }

    #[test]
    fn adds_a_manifest_without_bloating_the_file() {
        // `add_thumbnails` is off in Cargo.toml; with it on, c2pa embeds a
        // full-quality copy of the asset and the file grows roughly tenfold.
        let overhead = sign(&details()).len() - SOURCE.len();
        assert!(overhead < 64 * 1024, "manifest overhead was {overhead} bytes");
    }
}
