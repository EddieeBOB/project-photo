# register-photo

Hashes a photo that is already in the bucket and records the digest in the
`provenance` table, then keeps those rows' visibility in step with the photos'.

## Why the hash is computed here

Appwrite permissions are per-row, not per-column, so the hash cannot sit on the
`photos` row — its owner holds `update` there in order to edit titles, and that
same grant would let them rewrite the hash. A hash its subject can edit proves
nothing.

So the digest lives in a table no client may write, and is computed from bytes
this function reads back out of the bucket itself. The client sends only a
`fileId`. A client that could supply its own digest could register a file it does
not own under its own name — the one forgery this design exists to prevent.

A row records only what the function can verify for itself: the digest, the file
it describes, and when it was written. Nothing the caller says about the photo is
stored, so nothing in the registry can be a claim it did not check. Who published
a photo, and what they called it, live on the `photos` and `gallery` rows, which
are the authority for that.

Verification is not a route here. Registry rows are readable by the same audience
as the photo, so the browser hashes a dropped file and queries the table
directly — no execution per verification.

## Contract

    POST { "action": "register",   "fileId" }
      -> 200 { "sha256" }
    POST { "action": "visibility", "fileIds": [ ... ] }
      -> 200 { "ok": true, "updated": n, "skipped": n }

    400 malformed request, missing or unknown action
    401 no authenticated caller
    403 caller does not own the file
    404 no such file
    500 download, hashing, or row write failed

Anything that escapes as an unexpected error is logged and reported as a flat
`500 Operation failed.` rather than leaking its message.

### Ownership

The caller is taken from `x-appwrite-user-id`, never from the body. Every file is
then checked for a `delete("user:<caller>")` grant before anything is written
against it.

The **delete** grant specifically, not the read grant: a public photo carries
`read("any")`, so checking read permission would let any user register any public
photo on the site as their own.

### Visibility

A row's `read("any")` is **derived from the file's own permissions**, which the
ownership check has already fetched. It is never taken from the request. A client
that could ask for a public row on a private photo would publish that photo's
existence to anyone enumerating the table. An `isPublic` field in the body is
accepted and ignored — so the caller must re-permission the files *before*
calling `visibility`, not after.

The action exists because clients hold no `update` on registry rows, and so
cannot re-permission one themselves. Without it, a gallery turned private would
keep `read("any")` rows indefinitely.

It takes up to **100** file ids per call and settles each independently — a stale
id, a deleted file, or one the caller does not own is counted in `skipped` rather
than aborting the batch. 100 matches `PHOTO_PAGE_SIZE` in `galleryService`, the
page a gallery's photos are walked in, so an ordinary gallery reconciles in one
execution. It is batched because Appwrite rate-limits execution *creation*, not
the work inside an execution: one call per photo throttles partway through a large
gallery and leaves the rest of its rows publicly readable. Larger galleries are
chunked by the caller. The cap also bounds one execution at 200 SDK round trips —
a `getFile` and an `updateDocument` each — which stays inside the default timeout.

### Idempotence

Re-registering a file is not an error: the row id is the file id, so the create
collides with a 409 and the **stored** digest is returned unchanged. It is never
overwritten — overwriting on collision would be a way to replace a hash.

## Configuration

Function variables: `APPWRITE_DATABASE_ID`, `APPWRITE_BUCKET_ID`.
`APPWRITE_PROVENANCE_TABLE_ID` is optional and defaults to `provenance`.

Dynamic API key scopes: `files.read`, `documents.read`, `documents.write`.

### The `provenance` table

| column         | type       | notes                                       |
| -------------- | ---------- | ------------------------------------------- |
| `sha256`       | Varchar 64 | required                                    |
| `imageId`      | Varchar 36 | required — the storage file this describes  |
| `registeredAt` | Datetime   | required — server clock, never the client's |

The row id is the `imageId`, which is what makes registration idempotent.

`sha256` must be a **Varchar**, not a Text type: Text columns cannot take a plain
key index in MariaDB, and the index below is not optional. It must also not be
encrypted — Appwrite cannot query an encrypted column, and querying it is the
entire point.

Three settings on that table are load-bearing, and none of them are visible in
the code:

- **A key index on `sha256`.** Verification is a single `Query.equal('sha256', …)`.
  Without the index that query returns nothing and every photo on the site reads
  as unregistered — a silent failure, not an error.
- **Row security enabled.** The per-row permissions this function writes are
  ignored outright when row security is off, and every row falls back to the
  table's own permissions. The whole trust model rests on those per-row grants.
- **Table-level permissions left empty.** A `create` grant at table level would
  let any client write any digest against any file, and there would be nothing
  left of the design. Rows are created only by this function, using the API key.

Clients are never granted `update` on a row, at any level. Owners do hold
`delete`, so removing a photo can remove its provenance with it.
