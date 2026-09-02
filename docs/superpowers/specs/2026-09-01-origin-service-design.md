# Home Origin Service — Design

**Status:** approved for planning
**Date:** 2026-09-01
**Scope:** sub-project 1 of 2. See [Scope](#scope) for what is deliberately deferred.

## Problem

Photographs on photoframes.me lose quality twice before anyone sees them.

1. **At ingest.** `processFiles` hands the picked file to `resizeImage`, which
   downscales it to `UPLOAD_MAX_WIDTH` (1200px) at JPEG quality 0.85 via `pica`
   (`src/services/imageProcessing.ts`). The original is never stored anywhere —
   it exists only as a `File` in the browser tab and is discarded after upload.
2. **At read.** `retrieveImageURL` requests `storage.getFilePreview` with a
   width and a quality of 80 or 90 (`src/services/imageUrls.ts`), so Appwrite
   re-encodes the already-lossy 1200px file again on every request.

For a site whose stated purpose is "high-fidelity visual storytelling", the
best pixels a visitor can ever receive are a double-compressed 1200px JPEG.
There is no path to a better one, because the source is gone.

This design adds a self-hosted origin on the owner's home server that keeps
untouched originals, generates a high-quality derivative ladder from them, and
serves it — while Appwrite continues to hold a serving-size copy as both backup
and read fallback.

## Goals

- Preserve the original file, unmodified, for every photo the owner publishes.
- Serve a visually lossless ladder (AVIF / WebP / JPEG) generated once, from the
  original, with a proper resampling kernel.
- Serve the **native original file, untouched**, when a photo is opened
  fullscreen. The ladder covers every other view.
- Keep a copy of every owner photo in Appwrite — written by the studio on its
  existing code path — so the site degrades rather than breaks when the home
  server is unreachable.
- Introduce a real SQL data model the owner controls, with versioned migrations.
- Change nothing for other users, and nothing on the live read path in this
  sub-project.

## Non-goals

- Serving other users' photographs. They stay entirely on Appwrite.
- Replacing Appwrite for accounts, sessions, JWTs, or the `users`/username
  table. Authentication remains Appwrite's.
- Moving the static page backdrops (`getHeroPhoto`, `getLoginPhoto`,
  `getSignupPhoto` in `src/services/imageUrls.ts`). These stay on Appwrite so
  the login page never depends on the home server being up.
- Backing up **originals** to Appwrite. The Appwrite copy is the 1200px serving
  size only; durability of the archive is a 3-2-1 backup of the originals
  directory on the owner's own hardware, out of scope here.
- On-demand/dynamic resizing. The ladder is fixed and pre-generated.
- Retro-fitting a full-res tier to photos published before this change. Their
  originals were discarded by `pica` and cannot be recovered.

## Scope

Sub-project 1 delivers the origin service as a **standalone, additive**
component. Nothing in `src/` changes and the live site is untouched: at the end
of this sub-project a photo can be ingested with `curl`, and its ladder fetched
over the public tunnel, with the site still running entirely on Appwrite.

Sub-project 2 (separate spec) does the cutover: the migration script for
existing photos, source-routing and merging in the read path, the studio upload
path, and fallback rendering.

Splitting here means sub-project 1 carries no risk to production data, and
sub-project 2 begins against an origin service that is already proven.

## Architecture

Four containers, one Compose file, on a Linux host at home.

```
                 Cloudflare edge  (cache, TLS, DDoS)
                        |
                   [cloudflared]   outbound-only tunnel, no open ports
                        |
                     [caddy]       /i/*  -> static files, immutable cache
                        |          /v1/* -> reverse proxy
                        |
                    [origin]       Node + sharp: ingest, transcode, serve
                        |
                   [postgres]      record of originals, derivatives, EXIF
```

- **`cloudflared`** — outbound-only tunnel to `images.photoframes.me`. No router
  ports opened, home IP never exposed, TLS terminated at the edge.
- **`caddy`** — serves `/data/public` as static files and reverse-proxies the
  API. Reads never touch application code, so a crashed `origin` container does
  not stop images being served.
- **`origin`** — the only writer of its own data. Verifies JWTs, stores
  originals, transcodes, writes Postgres. It has no write access to Appwrite.
- **`postgres`** — PostgreSQL 17.

### Why pre-generated rather than on-demand

Rejected: `imgproxy` or equivalent, generating derivatives per request from the
stored original. AVIF encoding a 45-megapixel image takes seconds; paying that
once at ingest beats paying it on every Cloudflare cache miss on home hardware.
Pre-generation also keeps zero compute in the read path, which is what lets a
static file server answer reads independently of the application.

### Why transcode happens in the background

Cloudflare terminates proxied requests at 100 seconds. A 30MB upload over home
upstream plus nine derivatives (three of them AVIF) will exceed that. So the
ingest request does only the fast work — store the original, write rows, produce
the 1200px Appwrite copy — and returns. The ladder is transcoded afterwards, and
`photo.ladder_ready` plus the presence of `manifest.json` signal completion.
Consumers that find no manifest fall back to the Appwrite copy, which is the
same fallback used when the whole server is down: one mechanism, two causes.

## Repository layout

The service lives in this repository, as a sibling of the existing deployable
`functions/login-resolver/`.

```
origin/
  README.md                     operator guide: install, tunnel, backup, restore
  docker-compose.yml            postgres, origin, caddy, cloudflared
  docker-compose.test.yml       disposable postgres for the test suite
  Caddyfile
  .env.example
  Dockerfile
  package.json
  tsconfig.json
  src/
    index.ts                    http bootstrap, route table, graceful shutdown
    config.ts                   env parsing and validation, fail-fast at boot
    auth.ts                     JWT verification + owner allowlist
    db/
      client.ts                 Kysely instance
      types.ts                  table interfaces
      migrations/
        001_initial.ts
    routes/
      ingest.ts                 POST /v1/ingest
      gallery.ts                POST /v1/gallery, PATCH /v1/gallery/:id/visibility
      photo.ts                  DELETE /v1/photo/:id
      health.ts                 GET /healthz
    ladder.ts                   width selection + sharp encode settings
    transcode.ts                background ladder generation
    manifest.ts                 manifest.json construction and write
    exif.ts                     EXIF extraction and normalisation
    storage.ts                  paths, atomic writes, public/staging moves
    backup.ts                   Appwrite push + retry
    reconcile.ts                startup repair pass
  tests/
    unit/
    integration/
```

Each file has one responsibility; `routes/` holds HTTP concerns only and
delegates to the modules beside it.

## Data model

PostgreSQL 17. Migrations are Kysely migration files, applied by `origin` at
boot before the server accepts requests.

`owner_id` is an Appwrite user id (`account.get().$id`) — authentication stays
with Appwrite, so there is no local user table.

```sql
create table gallery (
  id              uuid primary key default gen_random_uuid(),
  owner_id        text not null,
  title           text not null,
  is_public       boolean not null default false,
  appwrite_row_id text unique,          -- backup pointer; also the migration map
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table photo (
  id               uuid primary key default gen_random_uuid(),
  gallery_id       uuid not null references gallery(id) on delete cascade,
  owner_id         text not null,
  title            text not null default '',
  description      text not null default '',
  position         int  not null default 0,
  is_front_page    boolean not null default false,
  thumbhash        text,

  original_path    text   not null,
  original_bytes   bigint not null,
  original_sha256  char(64) not null,
  width            int not null,
  height           int not null,

  is_public        boolean not null default false,
  ladder_ready     boolean not null default false,

  -- Client-supplied correlation pointers. Untrusted: never used to decide
  -- authorization. Also the mapping used by the sub-project 2 migration.
  appwrite_row_id  text unique,
  appwrite_file_id text unique,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- The same frame ingested twice is the same photo.
create unique index photo_owner_sha on photo (owner_id, original_sha256);
create index photo_gallery_pos      on photo (gallery_id, position);
create unique index photo_front_page on photo (owner_id) where is_front_page;
create index photo_ladder_pending   on photo (created_at) where not ladder_ready;

create table derivative (
  photo_id   uuid not null references photo(id) on delete cascade,
  width      int  not null,
  format     text not null check (format in ('avif','webp','jpeg')),
  height     int  not null,
  bytes      bigint not null,
  path       text not null,
  created_at timestamptz not null default now(),
  primary key (photo_id, width, format)
);

-- The technical metadata the Appwrite row throws away. `photos` keeps exposure,
-- iso and lens as three display strings; this keeps them typed and queryable,
-- with everything else preserved in `raw`.
create table exif (
  photo_id     uuid primary key references photo(id) on delete cascade,
  captured_at  timestamptz,
  camera_make  text,
  camera_model text,
  lens_model   text,
  focal_length numeric(6,2),
  aperture     numeric(4,2),
  shutter      numeric(10,6),
  iso          int,
  raw          jsonb not null
);

-- Audit trail for the privacy cascade: proves when a photo became private.
create table visibility_event (
  id        bigserial primary key,
  photo_id  uuid not null references photo(id) on delete cascade,
  is_public boolean not null,
  at        timestamptz not null default now()
);
```

`gen_random_uuid()` is built into PostgreSQL 13+; no extension needed.

## Filesystem layout

```
$DATA_DIR/
  originals/<photo_id>.<ext>          archive; never rewritten
  public/<photo_id>/original.<ext>    hardlink to the archive file
  public/<photo_id>/<width>.<fmt>     served by caddy
  public/<photo_id>/manifest.json     served by caddy
  staging/<photo_id>/...              private photos' files; not served
```

Privacy is enforced by **which directory a file is in**, not by application
logic, because `caddy` serves `public/` and has no route to `staging/`.

The served original is a **hardlink**, not a copy: the same inode appears in
`originals/` and in `public/<photo_id>/`, so exposing it costs no disk and
unlinking it when a photo goes private leaves the archive untouched. This
requires `originals/` and `public/` to sit on one filesystem, which is why
`DATA_DIR` is a single volume rather than three mounts.

All writes are atomic: write to `<name>.tmp`, `fsync`, then `rename`. A reader
never observes a half-written derivative or manifest.

## Ingest

### The studio writes to both backends

The browser is the fan-out point. It does **not** hand the original to the
origin and let the origin relay a copy onward:

```
                        studio (browser)
                         /                \
       1200px + row     /                  \   untouched original
                       v                    v
              [Appwrite Cloud]         [origin @ home]
        rows, files, permissions    originals, ladder, Postgres
```

**Appwrite first, origin second.** The Appwrite write is the existing path,
completely unchanged — `pica` downscales, `createImage` uploads and creates the
row with `ownerPermissions()`, and `rollbackGallery` still cleans up on failure.
Only once that has succeeded does the studio send the original to the origin.

Two things fall out of this ordering, and both are why it is worth insisting on:

- **The origin needs no Appwrite write key.** Under a relay design it would hold
  a server key that bypasses permissions entirely and would have to re-implement
  `ownerPermissions()` correctly on its own. Now the owner's photos are
  permissioned by the same browser code path as every other user's, with the
  owner's own session. One implementation, no divergence.
- **An origin failure cannot orphan anything.** Appwrite is already consistent
  when the origin is called, so a failed or skipped origin upload leaves a photo
  that publishes and renders exactly as it does today, minus the full-res tier.
  That is precisely the degradation behaviour chosen for this design, reached by
  doing nothing rather than by unwinding.

The reverse ordering was rejected: an origin-first write that then failed at
Appwrite would leave an archived original belonging to no published photo, and
the origin has no way to discover that on its own.

### Request

`POST /v1/ingest`, `multipart/form-data`, `Authorization: Bearer <appwrite-jwt>`.

| Field | Type | Notes |
| --- | --- | --- |
| `file` | binary | The untouched original. |
| `galleryId` | uuid | Must exist and be owned by the caller. |
| `appwriteRowId` | string | The `photos` row the studio just created. |
| `appwriteFileId` | string | The 1200px file the studio just uploaded. |
| `title` | string | Optional, defaults to `''`. |
| `description` | string | Optional, defaults to `''`. |
| `position` | int | Optional, defaults to `0`. |
| `thumbhash` | string | Optional. Computed browser-side as today. |

`appwriteRowId` and `appwriteFileId` are **correlation pointers only**. They are
client-supplied and therefore untrusted: nothing about authorization or
visibility is decided from them. Identity comes from the verified JWT, and
visibility is read from the origin's own `gallery` row — never from the request
— then independently re-verified against Appwrite by the reconciliation pass.

Request body cap: **100MB**, matching Cloudflare's proxied-request limit. Larger
files are rejected with `413` and a message naming the limit, rather than being
cut off at the edge with an opaque error.

Synchronous steps, in order:

1. Verify the JWT and the owner allowlist (see [Authentication](#authentication)).
2. Stream the upload to a temporary file, hashing as it goes.
3. If `(owner_id, sha256)` already exists, return `200` with the existing
   `photoId` and do nothing else. Ingest is idempotent, so a retried upload
   after a network failure cannot produce a duplicate.
4. Probe dimensions and extract EXIF.
5. Move the file into `originals/`.
6. Insert the `photo` and `exif` rows in one transaction.
7. Respond `201 { photoId, galleryId, ladderReady: false }`.

Then, after the response: the ladder transcode is scheduled.

Failure between steps 5 and 6 leaves an orphan file in `originals/`; the
reconciliation pass collects it. This is preferred to deleting on failure — an
orphaned original is recoverable, a deleted one is not.

## Derivative ladder

Target widths are **1600, 2560, 3840**.

**Never upscale.** Emit only the widths at or below the original's width; if the
original is narrower than 1600, emit a single derivative at the original's own
width. A 2400px original therefore yields 1600 and 2400, and no 3840 — which is
precisely why consumers must read `manifest.json` rather than assume a fixed set.

Encoder settings, all resampled with the Lanczos-3 kernel:

| Format | Settings |
| --- | --- |
| AVIF | `quality: 58, effort: 4, chromaSubsampling: '4:4:4'` |
| WebP | `quality: 84, effort: 5` |
| JPEG | `quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4'` |

Full chroma is deliberate: 4:2:0 smears saturated edges, which is exactly the
artefact a photography site cannot afford.

**Colour and metadata.** Derivatives are converted to sRGB with the ICC profile
retained, so colour is correct on wide-gamut displays. **All other metadata is
stripped**, GPS included. Location data stays in the `exif` table on the home
server and is never embedded in a public file — publishing a photograph should
not publish where its author was standing.

### Native original in fullscreen

Fullscreen serves the **untouched original file**, not the top ladder rung. The
ladder covers thumbnails, the carousel and every in-page view; opening a photo
fullscreen is the one moment where the point is to see exactly what the camera
recorded, so that is what gets sent.

The hardlink is created at the very end of the transcode, immediately before
`manifest.json` is written, and only for a public photo. Doing it there rather
than at ingest keeps the invariant that the manifest never advertises a file
that is not on disk, and that nothing under `public/` exists before the photo is
ready to be seen.

Two constraints follow from this, and both are load-bearing:

- **The browser has to be able to decode it.** That holds today only because
  `ALLOWED_IMAGE_TYPES` (`src/services/imageProcessing.ts`) restricts uploads to
  JPEG, PNG, WebP, AVIF and GIF — no HEIC, no RAW. That restriction stops being
  incidental and becomes a requirement of this design: widening it later means
  adding a fallback to the top rung for formats a browser cannot render.
- **It is large.** A 40MP JPEG is 25-40MB against home upstream. Cloudflare's
  edge cache absorbs the repeat cost, but the first viewer of each photo pays it
  in full. So the fullscreen view must paint the top ladder rung first — already
  in cache from the page behind it — and swap the original in when it lands.
  Sub-project 2 owns that transition; this sub-project's obligation is to serve
  both and advertise both.

### Manifest

Written to `public/<photo_id>/manifest.json` once every derivative for that
photo has been written, from the `derivative` rows:

```json
{
  "photoId": "0f1c…",
  "original": {
    "width": 6000, "height": 4000, "format": "jpeg", "bytes": 31448210,
    "url": "/i/0f1c…/original.jpg"
  },
  "derivatives": [
    { "width": 1600, "height": 1067, "format": "avif", "bytes": 182442, "url": "/i/0f1c…/1600.avif" }
  ]
}
```

Its presence is the readiness signal, and it is written last, so a manifest
never advertises a file that is not on disk.

## Serving

Public base URL: `https://images.photoframes.me`.

| Path | Handler |
| --- | --- |
| `/i/<photoId>/<width>.<ext>` | caddy, static from `public/` |
| `/i/<photoId>/original.<ext>` | caddy, static from `public/` — the native file |
| `/i/<photoId>/manifest.json` | caddy, static from `public/` |
| `/v1/*` | reverse proxy to `origin` |
| `/healthz` | reverse proxy to `origin` |

Response headers:

- Derivatives and the native original: `Cache-Control: public,
  max-age=31536000, immutable`. Safe because a photo id is unique per ingest and
  neither is ever rewritten in place.
- Manifest: `Cache-Control: public, max-age=60, stale-while-revalidate=86400`.
  It changes exactly once, when the ladder completes.
- CORS: `Access-Control-Allow-Origin` restricted to the configured origins —
  `https://photoframes.me` in production, plus the Vite dev origin locally.
- `X-Content-Type-Options: nosniff`, matching `public/_headers`.

## The Appwrite copy

Every owner photo keeps its 1200px copy and its `photos` row in Appwrite,
produced by the studio's existing upload path with no changes at all. That copy
is both the disaster-recovery backup and the fallback the site renders from when
the home server is unreachable.

Because it is the current path rather than a re-encode, fallback rendering is
byte-for-byte what production serves today — not an approximation of it.

**The origin never writes to Appwrite.** It holds no key that could create,
modify, or delete anything there. Its only Appwrite credential is a read-only
key used by the reconciliation pass, described below.

## Visibility cascade

`PATCH /v1/gallery/:id/visibility` with `{ "isPublic": boolean }`.

This is the highest-risk operation in the design, because a mistake reopens the
"private galleries are actually public" gap that `docs/appwrite-backend.md`
documents closing.

As with ingest, the **studio orchestrates both sides**:
`updateGalleryVisibility()` keeps doing exactly what it does now against
Appwrite, and gains one additional call to the origin. Neither backend reaches
into the other.

Going **public → private**, the origin's own half is:

1. Move `public/<photo_id>/` to `staging/<photo_id>/` for every photo, which
   also removes the original's hardlink. Serving stops the instant the rename
   completes.
2. Update `photo.is_public` and `gallery.is_public`.
3. Append a `visibility_event` row per photo.
4. Issue a Cloudflare cache purge for the affected paths.

Going **private → public**, the same steps in reverse — rows first, files
exposed last. The rule in both directions: **the public artefact is created last
and removed first.** The directory rename is the authority; the cache purge is
an optimisation, not the control.

The studio must treat a failed origin call as a **failed operation** and surface
it, not swallow it. Going private is the direction that matters: Appwrite may
have been locked down while the derivatives are still being served.

### Why the origin still holds a read-only key

Removing the write key costs something real, and it should be named. The origin
can no longer independently discover that a gallery went private — the browser
is the only messenger, and a browser that is closed mid-cascade never delivers
the message.

So the origin keeps a **read-only** Appwrite key, used by nothing on the request
path and only by the reconciliation pass, to compare each photo's stored
`is_public` against the truth in Appwrite. On disagreement it **fails closed**:
the photo is moved to `staging/` and the discrepancy logged loudly. A read key
cannot create, modify, or delete anything, so this restores the safety net
without restoring the blast radius.

This project's own documentation is the argument for it — privacy here is
"enforced by Appwrite permissions, not by the client hiding things", and a
cascade that depends on one browser call completing is exactly the client-side
enforcement that posture rejects.

## Deletion

`DELETE /v1/photo/:id` removes, in order: the served derivatives and the
original's hardlink, the staging directory, the archived original, then the rows
(cascading to `derivative`, `exif`, `visibility_event`).

The Appwrite file and row are **not** touched here — `deletePhoto` and
`deleteGallery` already remove them from the browser, and the origin has no key
to do so. As with ingest and the visibility cascade, the studio calls both
sides. An origin call that fails leaves orphaned files at home, which the
reconciliation pass detects against Appwrite and quarantines.

## Reconciliation

A pass runs at boot and hourly thereafter. It is the repair mechanism for every
partial failure above, which is why no failure path needs its own rollback:

- `photo` rows with `ladder_ready = false` — re-run the transcode. Covers a
  crash mid-encode.
- Files in `originals/` with no `photo` row — log and quarantine. Never deleted
  automatically; an unreferenced original is still the only copy of a photograph.
- `derivative` rows whose file is missing, and files with no row — re-derive.
- Photos whose `public/<id>/original.<ext>` hardlink is missing, or present
  contrary to `is_public` — relink or unlink to match the database. The same
  security check as the derivative directory, applied to the native file.
- Photos whose `is_public` disagrees with the directory they occupy — move them
  to match the database, and log loudly. A security check, not housekeeping.
- Photos whose `is_public` disagrees with their Appwrite row, read through the
  read-only key — **fail closed**: move to `staging/`, log loudly. This is the
  net under a visibility cascade whose browser half never completed.
- Photos whose Appwrite row no longer exists — quarantine the local artefacts.
  Catches a delete whose origin half never landed.

## Configuration

`origin/.env`, documented in `.env.example`. `config.ts` validates every value
at boot and exits non-zero on anything missing or malformed, so a
misconfiguration fails at startup rather than on the first upload.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `DATA_DIR` | Root of `originals/`, `public/`, `staging/`. |
| `OWNER_USER_ID` | The one Appwrite user id permitted to ingest. |
| `PUBLIC_BASE_URL` | `https://images.photoframes.me`, used to build manifest URLs. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist. |
| `APPWRITE_ENDPOINT` | Appwrite Cloud endpoint. |
| `APPWRITE_PROJECT_ID` | Project id. |
| `APPWRITE_DATABASE_ID` | Database holding the `photos` table, read by reconciliation. |
| `APPWRITE_API_KEY` | **Read-only** key (`documents.read`, `files.read`). Used solely by the reconciliation pass. Never client-side. |
| `APPWRITE_BUCKET_ID` | The existing bucket. |
| `MAX_UPLOAD_BYTES` | Defaults to 104857600 (100MB). |

## Authentication

There is no separate credential for the origin. The browser calls
`account.createJWT()` and sends the short-lived JWT as a bearer token; `origin`
verifies it by constructing a `node-appwrite` client with `setJWT()` and calling
`account.get()`. Appwrite is the authority on who the caller is.

The resulting user id must equal `OWNER_USER_ID` or the request is rejected
`403`. This mirrors how the rest of the codebase derives identity — `ownerId`
comes from the verified session, never from a client-supplied field, exactly as
`createGallery` and `updateGalleryVisibility` do it.

A shared secret shipped in the frontend bundle was rejected: it would be a
credential published to every visitor.

## Failure modes

| Failure | Behaviour |
| --- | --- |
| Home server down | No ingest. Reads of the ladder fail; consumers fall back to the Appwrite copy. Sub-project 2 wires that fallback into the UI; in this sub-project the effect is a 502 from the tunnel. |
| `origin` crashed, caddy up | Already-generated derivatives keep serving. Ingest returns 502. Reconciliation repairs on restart. |
| Postgres down | `origin` fails its health check and refuses ingest. Static serving is unaffected. |
| Transcode fails for one format | Other formats still land; `ladder_ready` stays false and no manifest is written, so the photo falls back rather than serving a partial ladder. Reconciliation retries. |
| Appwrite unreachable at publish | The existing rollback runs and the publish fails, exactly as today. The origin is never called, so nothing is orphaned. |
| Origin unreachable at publish | Appwrite is already consistent. The photo publishes and renders at today's quality with no full-res tier, and can be sent to the origin later. |
| Origin unreachable during a visibility change | The studio reports failure. Reconciliation fails the photo closed at its next pass, so derivatives stop being served even if nobody retries. |
| Upload exceeds 100MB | `413` with the limit named. |
| Same file uploaded twice | Deduplicated on `(owner_id, sha256)`; returns the existing photo. |
| Fullscreen original slow or failed | The viewer keeps the top ladder rung painted underneath it; the swap simply never happens, and nothing looks broken. |

## Security

- **Directory-based privacy.** Private derivatives live where the web server has
  no route. Privacy does not depend on application code being correct on the
  read path, because there is no application code on the read path.
- **No GPS in derivatives.** All metadata except the ICC profile is stripped
  from every generated file.
- **The native original is a deliberate exception, and it ships GPS.** Serving
  the file untouched means serving its EXIF: anyone who opens a photo fullscreen
  can read the coordinates it was taken at, which for photographs made at home
  is a home address. This is inherent to "native" rather than an oversight, and
  the decision here is to accept it — the request was the native file, and a
  scrubbed file is not that.

  The alternative, if that trade is not wanted, is to strip GPS from the
  original **at ingest**, before it is archived. That has to be settled before
  the first upload: the archive is never rewritten afterwards, so a later change
  of mind cannot reach photos already stored.
- **Identity from Appwrite, never from the request body.**
- **The origin cannot write to Appwrite.** Its only credential there is
  read-only, used off the request path by reconciliation. A compromised home
  server cannot alter or delete anything in Appwrite.
- **Owner photos are permissioned by the same code as everyone else's** —
  `ownerPermissions()` in the browser, under the owner's own session — rather
  than by a second implementation running under a key that bypasses permissions.
- **CORS allowlisted**, not `*`.
- **Tunnel, not port-forwarding.** No inbound ports; home IP not exposed.
- Cloudflare's free plan discourages serving large volumes of non-HTML media.
  This is a terms risk, not a technical one, and is called out in
  `origin/README.md` so it is a known cost rather than a surprise.

## Testing

**Unit** (`origin/tests/unit/`, vitest, no I/O):

- Ladder width selection: never upscales; a 2400px original yields 1600 + 2400;
  a 900px original yields a single 900px entry; a 6000px original yields all three.
- Manifest construction from `derivative` rows, including the variable-ladder case.
- Manifest advertises the native original with its true byte size and a URL that
  matches the hardlink path.
- EXIF normalisation: missing blocks, a file with no EXIF, shutter/aperture
  coercion, and the assertion that GPS fields reach `raw` but never the encoder options.
- Config validation: each missing variable fails at boot with a message naming it.

**Integration** (`origin/tests/integration/`, against the disposable Postgres in
`docker-compose.test.yml` and a temporary `DATA_DIR`; the Appwrite client is
mocked at the module boundary):

- Ingest writes the original, the rows, and — after transcode — the derivatives
  and manifest, with `ladder_ready` flipping true.
- Ingest hardlinks the original into `public/<id>/original.<ext>`, and the two
  paths report the same inode — the served copy costs no extra disk.
- Re-ingesting an identical file returns the same `photoId` and creates nothing.
- Ingest without a JWT is `401`; with a valid JWT for a non-owner user, `403`.
- **The privacy cascade.** Publish a public photo, assert the derivative path is
  present under `public/`; flip the gallery private; assert the path is gone,
  the file is under `staging/`, `storage.updateFile` was called with the private
  permission set, and a `visibility_event` row exists. Then flip it back.
- Flipping private removes the original's hardlink too, not only the
  derivatives: an anonymous fetch of `/i/<id>/original.jpg` 404s, while the
  archived file under `originals/` is still present and byte-identical.
- A crash mid-transcode (simulated by killing the task) leaves `ladder_ready`
  false and no manifest; reconciliation completes it on the next pass.
- Reconciliation reading a private Appwrite row for a photo the origin has
  marked public moves it to `staging/` and logs — the fail-closed path.
- Reconciliation finding no Appwrite row for a photo quarantines its local
  artefacts rather than deleting them.
- Deleting a photo removes derivatives, original, and rows.

**Manual verification** closing the sub-project, since the service is not yet
wired to the frontend:

1. `docker compose up -d` on the home host; confirm migrations applied and
   `/healthz` green.
2. `curl` a real 40MP original through the tunnel with a JWT minted from the
   owner account.
3. Fetch the manifest over `https://images.photoframes.me` and confirm the
   advertised files all 200 with `immutable` cache headers and the correct
   CORS origin.
4. Fetch `/i/<id>/original.jpg` and confirm it is byte-identical to the file
   that was uploaded — `sha256sum` on both ends.
5. Confirm the Appwrite bucket received the 1200px copy with owner permissions.
6. Flip the gallery private; confirm the derivative URL 404s and the Appwrite
   file 401s for an anonymous client.
7. Open a served derivative in an EXIF viewer and confirm no GPS. The native
   original keeps its EXIF intact — it is the original — which is a deliberate
   consequence of serving it, noted in Security below.

## Decisions and rejected alternatives

| Decision | Rejected alternative | Reason |
| --- | --- | --- |
| Pre-generated ladder | On-demand via imgproxy | AVIF encode cost lands on every cache miss; keeps compute on the read path. |
| Background transcode | Synchronous in the request | Cloudflare's 100s proxy limit. |
| No `job` table | A queue with `SKIP LOCKED` | `ladder_ready` plus the reconciliation pass covers the same failures for a fraction of the machinery. Revisit if ingest volume ever justifies workers. |
| Manifest file | Fixed convention, or an API endpoint | The ladder is variable because upscaling is refused, so consumers must be told what exists — and a static file keeps compute off the read path. |
| Directory-based privacy | Signed URLs | No key management, and the guarantee holds even if application code is wrong. |
| Backup is the 1200px copy | Backing up originals to Appwrite | Cloud storage cost for a copy nothing reads; archive durability belongs to local 3-2-1 backup. |
| Best-effort backup | Failing ingest when Appwrite is down | Otherwise publishing requires both backends up. |
| Appwrite JWT | Shared secret in the bundle | A secret shipped to every visitor is not a secret. |
| Studio writes to Appwrite and origin independently | Origin relays a copy to Appwrite | Removes the Appwrite write key from the home server entirely, and keeps one implementation of `ownerPermissions()`. Appwrite-first ordering means an origin failure can orphan nothing. |
| Origin keeps a read-only Appwrite key | No Appwrite credential at all | Without it the origin cannot detect a visibility cascade whose browser half never completed, leaving private photos served. A read key restores the safety net with no write blast radius. |
| Native original at fullscreen | Top ladder rung everywhere | Fullscreen is the one view whose point is the exact capture. Amends the earlier "capped ladder only" decision; edge caching absorbs the repeat bandwidth. |
| Native original keeps its EXIF | Stripping GPS from the archive at ingest | "Native" means the file as captured. Recorded as an accepted risk, reversible only before the first upload. |
| Hardlink into `public/` | Copying the original, or a caddy route into `originals/` | No duplicated disk, and privacy stays a directory question rather than a routing rule that could be got wrong. |
| Cloudflare Tunnel | Port-forward + DDNS; Tailscale Funnel | No open ports, home IP hidden, edge caching. Funnel is not intended for public media traffic. |
