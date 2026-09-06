# Hash + server registry, replacing C2PA signing

**Date:** 2026-09-04
**Status:** approved, not yet implemented

## Context

Photo provenance is currently a C2PA manifest embedded by `functions/sign-photo-rs`
(Rust) with `functions/sign-photo` (Node) as its predecessor. Both are being removed
in favour of a SHA-256 hash recorded in a server-written registry table.

The Rust function exists only because Appwrite's Node runtime is Alpine/musl and every
C2PA Node binding ships glibc-only prebuilt binaries. It is in turn pinned to
`c2pa 0.57` because Appwrite offers exactly one Rust runtime — 1.83 — and `c2pa 0.58`
raised its MSRV to 1.85. Roughly thirty transitive-dependency pins in its `Cargo.toml`
exist to keep resolver 2 from selecting edition2024 crates. That maintenance burden,
not a defect in C2PA, is what motivates the change.

## What is deliberately given up

A hash registry proves **integrity plus a server attestation**, not portable provenance.
Three properties are lost, knowingly:

1. **Off-site verification.** A C2PA manifest travels inside the file and is read by
   Content Credentials Verify, Adobe apps, and Google's "About this image". A registry
   is only checkable by someone who visits photoframes.me.
2. **The `modified` state.** C2PA can say "this was signed and has since been altered."
   A registry cannot distinguish an altered file from one never registered — both are
   simply absent. `ProvenanceState` loses `trusted`, `signed`, and `modified`.
3. **Durability beyond the service.** If the site goes away, so does all provenance.

Accepted because the goal is a verified badge on photos this site hosts, not a claim
that survives redistribution.

## Trust model

The client must not be able to write the hash. Appwrite permissions are per-row, not
per-column, so `sha256` cannot be a column on the `photos` row: owners hold `update`
there in order to edit titles, which would let them rewrite the hash.

The hash therefore lives in a **separate table that no client role may write**, and is
computed by a function that reads the bytes from the bucket itself. The browser never
supplies a hash, and cannot register a file it does not own — otherwise user A could
register user B's `fileId` under A's name, which is precisely the forged attribution
the design exists to prevent.

```
browser                                    Appwrite
  resize -> WebP
  storage.createFile(resized, perms)  --->  bucket -> fileId
  createExecution(register, {fileId}) --->  register-photo
                                              |- getFile(fileId): caller owns it?
                                              |- download bytes  (API key)
                                              |- sha256 = createHash(bytes)
                                              '- createRow(provenance, rowId=fileId)
  createRow(photos, {imageId: fileId})
```

## Data model — new table `provenance`

| column         | type          | notes                                        |
| -------------- | ------------- | -------------------------------------------- |
| `sha256`       | string(64)    | **key index required** — `Query.equal` needs one |
| `imageId`      | string(36)    | the storage file this describes              |
| `registeredAt` | datetime      | server clock, never client-supplied          |

Row id is the `imageId`, making registration idempotent and duplicate-proof.

**Permissions** — a new `registryPermissions(ownerId, isPublic)` beside `ownerPermissions`
in `src/lib/permissions.ts`:

- `read(user:owner)`
- `delete(user:owner)` — so deleting a photo can clean up its row
- `read(any)` when the photo is public
- **no `update` for any role.** An owner may retire their row but never rewrite its hash.

This is what makes direct client querying safe. An anonymous visitor enumerating the
table sees only rows belonging to already-public photos, and a row carries nothing
beyond a digest, the file it describes, and when it was written.
Private photos read as unregistered to strangers and verify normally for their owner.

## New function `functions/register-photo/`

Node, `node-appwrite` as its only dependency, matching `functions/login-resolver` in
shape and SDK call style (positional args, `Databases`). Hashing uses `node:crypto`'s
`createHash('sha256')` — stdlib, no dependency.

```
Request  (POST, JSON):
  { "action": "register",   "fileId": string }
  { "action": "visibility", "fileIds": string[] }
Response (JSON):
  200 { "sha256": string }   registered, or already registered (see below)
  200 { "ok": true, "updated": n, "skipped": n }   visibility reconciled
  404 { "error": ... }       no such file
  400 { "error": ... }       malformed request, missing or unknown action
  401 { "error": ... }       no authenticated caller
  403 { "error": ... }       caller does not own fileId
  500 { "error": ... }       download, hashing, or row write failed
```

- Caller identity comes from the `x-appwrite-user-id` header, as the Rust function did.
  The body never says who the owner is.
- Nor does the body say whether a photo is public. A row's `read("any")` is derived
  from the file's own permissions, which the ownership check has already fetched.
  A client able to ask for a public row on a private photo could publish that
  photo's existence to anyone enumerating the table.
- Ownership is checked via `storage.getFile(fileId)` before anything is registered.
- Registering an already-registered `fileId` is not an error. Because the row id is the
  `fileId`, the create returns a 409; the function catches it, reads the existing row,
  and returns that row's stored `sha256` with a 200. The stored hash is never
  overwritten, so a re-registration can never be used to replace one.
- Function variables: `APPWRITE_BUCKET_ID`, `APPWRITE_DATABASE_ID`, `APPWRITE_PROVENANCE_TABLE_ID`.
- Dynamic API key scopes: `files.read`, `documents.read`, `documents.write`.

### The `visibility` action

Because clients hold no `update` on registry rows, they cannot re-permission one
either — so toggling a gallery between public and private has to come back through
this function. Without it, a photo turned private would keep a `read("any")` registry
row exposing its existence indefinitely.

The call is **batched**: one execution carries up to 100 file ids, the same page a
gallery's photos are walked in. Appwrite rate-limits execution *creation* rather than
the work inside an execution, so one call per photo throttles partway through a large
gallery and leaves the tail of it publicly readable — which is the leak this action
exists to close, reintroduced by the shape of the call. Each file is checked for
ownership and settled on its own; one bad id is counted in `skipped`, never fatal to
the batch. `updateGalleryVisibility` issues it after the files themselves have been
re-permissioned (the row's visibility is read from the file), in the same best-effort
style it already uses when cascading permissions to files and photo rows.

## Client changes

- **`src/services/galleryService.ts`** — `uploadImage` calls `storage.createFile`
  directly instead of base64-encoding through a function, then calls `register-photo`.
  `blobToBase64` is deleted, and with it the 10MB body ceiling that existed only because
  signing had to precede the bucket write. If registration fails the uploaded file is
  deleted and the publish fails, preserving today's rule that no photo is stored without
  provenance.
- **`src/services/galleryService.ts`, delete paths** — `deletePhoto` and `deleteGallery`
  must also delete the `provenance` row for each removed `imageId`, in the same
  best-effort style as the existing storage-file cleanup: a failure is logged and
  skipped, never fatal. Without this, a deleted photo's hash stays verifiable forever.
- **`src/services/provenanceVerify.ts`** (replaces `c2paVerify.ts`) — hashes the dropped
  file with `crypto.subtle.digest('SHA-256', …)` in the browser, then performs one
  `tablesDB.listRows` with `Query.equal('sha256', …)`.
- **`src/types/provenance.ts`** — `ProvenanceState` becomes `registered | unregistered | error`.
- **`src/components/VerifyPhotoDialog.tsx`** — result copy rewritten for the new states.
  The existing promise that "the file never leaves the browser" must change: the file
  still does not, but a 64-character fingerprint now does, and the dialog has to say so.
- **`src/lib/config.ts`** — `signPhotoFunctionId` becomes `registerPhotoFunctionId`
  (`VITE_APPWRITE_SIGN_PHOTO_FN_ID` -> `VITE_APPWRITE_REGISTER_FN_ID`), plus a
  `PROVENANCE_TABLE` id.
- **`package.json`** — drop `@contentauth/c2pa-web`, removing ~1MB of WASM from the bundle.

## Deletions

- `functions/sign-photo/` (Node, C2PA)
- `functions/sign-photo-rs/` (Rust, C2PA) — its uncommitted `c2pa 0.57` API changes are
  discarded, by decision
- `src/services/c2paVerify.ts`

No backfill script: the bucket was emptied before this work began, so no existing photo
needs a registry row.

## Testing

- `functions/register-photo/tests/` using `node --test`, mirroring the layout and runner
  of the deleted `functions/sign-photo/tests/`. Cover: hash correctness against a known
  vector, rejection of an unauthenticated caller, rejection of a caller who does not own
  the file, and idempotent re-registration.
- `registryPermissions` unit-tested in `tests/unit` alongside the existing
  `ownerPermissions` tests, asserting in particular that no role is ever granted `update`.
- `provenanceVerify` unit-tested with a stubbed `tablesDB` for the found / not-found /
  error branches.

## Open risks

- **Enumeration of public rows** is possible by design and judged acceptable, since the
  data mirrors what public gallery pages already expose. Should the registry ever carry
  a field that is not already public, this decision must be revisited.
- **The registry is a single point of trust.** A compromised database can rewrite
  provenance silently, where a signature would have required the key. This is the
  understood cost of choosing a registry over signing.
- **A digest can be registered more than once.** Someone may download a public
  photo and publish the same bytes as their own; registration succeeds, because
  the ownership check asks only whether the caller owns *that* stored file, and
  it genuinely does. Verification answers with the earliest registration — a
  deliberate ordering, not a proof of authorship. A registry attests that these
  bytes were published here and when first; it cannot attest who made them.
  Distinguishing the two would need something the bytes alone do not carry.
