# sign-photo

Signs a photo with a **C2PA manifest** and stores it, so its origin is provable
and any later edit is detectable.

## Why

A photo published here is the user's own work, and nothing in the stored bytes
tied it back to them. C2PA fixes that with a signed manifest carrying a hash of
the image — change a pixel and every verifier reports "modified"; the signature
says who signed it.

This has to run server-side. A signing key in the browser bundle is a key
everyone has, and provenance anyone can forge proves nothing. The key lives in
this function's variables and nowhere else.

## Why it uploads, rather than signing an upload

This function replaces the client's `createFile` call instead of running after
it. Appwrite's `updateFile` changes a file's name and permissions but not its
content, so signing an already-uploaded file would mean writing a second file
and deleting the first — two uploads and a delete for every photo, plus an
orphaned file whenever the delete failed. Signing before the bucket write keeps
it to exactly one file per photo.

The cost is that the image travels in the execution body. Measured against this
project's own assets, a 1200px WebP is 13–77KB, or 18–103KB once base64-encoded
— comfortably small, because the studio has already downscaled and re-encoded
before anything is sent.

## Contract

- **Request** (POST, JSON):
  ```json
  { "image": "<base64>", "mimeType": "image/webp", "name": "seascape.webp",
    "isPublic": true, "creator": "Eddie Lam" }
  ```
- **Response**:
  - `200 { "fileId": string }` — id of the stored, signed file
  - `400 { "error": "..." }` — malformed request, unsupported type, or oversized image
  - `401 { "error": "..." }` — no authenticated caller
  - `500 { "error": "..." }` — signing not configured, or signing/storage failed

`creator` is optional; omit it and the manifest carries no attribution rather
than an empty one.

**The owner is never taken from the body.** It comes from the
`x-appwrite-user-id` header, which Appwrite sets from the caller's session, so
nobody can store a photo as somebody else. `isPublic` is the only thing the
caller influences about permissions, and it maps onto the same shape as
[`ownerPermissions`](../../src/lib/permissions.ts) — a file written here is
indistinguishable from one the browser wrote. Keep the two in step.

## Dynamic key scopes

`files.write`. Appwrite injects a per-execution key as the `x-appwrite-key`
header, so there is no long-lived key to store or rotate.

## Environment

Runtime: **node-22** or later — `@contentauth/c2pa-node` requires Node ≥ 22.

| Variable | Purpose |
| --- | --- |
| `C2PA_CERT_PEM` | Signing certificate chain, PEM, **base64-encoded** |
| `C2PA_PRIVATE_KEY_PEM` | Private key, PKCS#8 PEM, **base64-encoded** |
| `APPWRITE_BUCKET_ID` | Bucket the photos are stored in |

`APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` come from
the runtime. The PEMs are base64 so their newlines survive the round trip
through a function variable.

## Generating a signing identity

```bash
./scripts/make-dev-cert.sh
base64 -i .certs/certificate.pem | tr -d '\n'   # -> C2PA_CERT_PEM
base64 -i .certs/private.key     | tr -d '\n'   # -> C2PA_PRIVATE_KEY_PEM
```

The script writes **two** certificates: a throwaway root CA and a signing
certificate issued from it. That is not ceremony — c2pa rejects a self-signed
leaf outright, with the unhelpful message "the certificate is invalid".

`.certs/` is gitignored. Verifiers will read manifests this signs but flag the
signer as untrusted, because nobody has heard of that root. A trusted badge
needs a certificate chaining to a CA on the
[C2PA trust list](https://opensource.contentauthenticity.org/docs/verify-known-cert-list),
which is paid and identity-verified — and changes nothing in the code, only the
two variables above.

## How it works

1. Reject anything malformed: no session, no image, no name, a type the studio
   never produces, or a body over the size ceiling.
2. Build a manifest: `claim_generator_info`, the file name as the title, and —
   when the caller supplies one — a `stds.schema-org.CreativeWork` assertion
   naming the author. That is the assertion verification UIs read to show a
   creator.
3. Set the builder intent to `create` with a `digitalCapture` source type. This
   expands into the `c2pa.actions.v2` assertion the spec requires. `create` is
   the honest choice: the pipeline never sees what came off the camera, so it
   cannot attest to an edit history it did not witness.
4. Sign with ES256, writing the manifest into the image container.
5. Store the signed bytes under a fresh id with the owner's permissions, and
   return that id for the `photos` row to reference.

## Constraints worth knowing

**Serve signed files untransformed.** The manifest hashes the exact bytes it
sits in, so `getFilePreview` — which re-encodes on the fly — both strips the
manifest and breaks the hash. Full-size views already use
`retrieveOriginalImageURL` (`getFileView`) in
[`src/services/imageUrls.ts`](../../src/services/imageUrls.ts); keep it that
way. Grid thumbnails go through the preview endpoint and are deliberately
unsigned — a 500px thumbnail is not a provenance-bearing asset.

**Manifest thumbnails are disabled.** The builder embeds a full-quality copy of
the asset as a thumbnail unless told not to, taking a 59KB photo to 590KB. A
test in `tests/sign.test.js` guards the size so it cannot creep back.

**The deployment is large.** `@contentauth/c2pa-node` ships a ~37MB native
binary, downloaded by a postinstall script during the build. The build step
therefore needs network access to GitHub releases.

**A manifest can be stripped.** C2PA proves origin when present; it does not
prevent removal. The package also exports `Trustmark`, an invisible watermark
that survives stripping, if that ever becomes worth the complexity.

## Who calls it

`uploadImage()` in [`src/services/galleryService.ts`](../../src/services/galleryService.ts),
once per photo, in place of a direct `storage.createFile`. The client reads the
function id from `VITE_APPWRITE_SIGN_FN_ID`.

There is no unsigned path. This function *is* the upload, so a failure here
fails the publish rather than quietly storing a photo without provenance.

## Tests

```bash
npm test
```

Runs on Node's built-in test runner — the function is its own deployable with
its own dependencies, and the root Vitest suite cannot resolve them. Signing
tests need a local identity first (`./scripts/make-dev-cert.sh`).
