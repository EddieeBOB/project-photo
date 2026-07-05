# Appwrite backend configuration

This project is a frontend-only app that talks directly to Appwrite, so **all
authorization is enforced by Appwrite**, not by the React code. The
[`appwrite.config.json`](appwrite.config.json) in this repo captures the intended
secure configuration for the database tables and storage bucket.

## How the security model works

The app sets **per-row / per-file permissions at creation time** (see
`ownerPermissions()` in [`src/services/photoService.ts`](src/services/photoService.ts)):

- The owner always gets `read` / `update` / `delete`.
- Public galleries additionally get `read("any")`.

For that to be the *only* thing controlling access, the tables and bucket must
have **row/file security enabled** and **must not** grant table-wide
read/update/delete. That is exactly what `appwrite.config.json` does:

| Resource          | `rowSecurity` / `fileSecurity` | Table/bucket `$permissions` |
| ----------------- | ------------------------------ | --------------------------- |
| `gallery`         | `true`                         | `create("users")` only      |
| `photos`          | `true`                         | `create("users")` only      |
| bucket            | `true` (`fileSecurity`)        | `create("users")` only      |
| `users`           | `true`                         | `create("users")`, `read("any")` |

Because there is no table-wide `read`/`update`/`delete`, a logged-in user can
only read/modify/delete the gallery rows, photo rows, and files they own —
unless a gallery is public, in which case anyone can *read* it. This closes the
IDOR and "private galleries are actually public" issues.

> ⚠️ Do **not** add `read("any")`, `read("users")`, `update(...)`, or
> `delete(...)` at the table or bucket level for `gallery`/`photos`/the bucket.
> With row security enabled, table-level grants are **additive** and would
> re-open the holes (e.g. a table-level `read("any")` makes every private
> gallery public again).

## Deploying this config

1. Install and log in to the CLI:
   ```sh
   npm i -g appwrite-cli
   appwrite login
   ```
2. Fill in the placeholders in `appwrite.config.json`: `<PROJECT_ID>`,
   `<REGION>`, `<DATABASE_ID>`, `<BUCKET_ID>`. (These are the same values used in
   your `.env` — see below.)
3. Push:
   ```sh
   appwrite push settings
   appwrite push tables
   appwrite push buckets
   ```

If you already have these resources in the Console, run `appwrite pull tables`
first and reconcile, so you don't clobber existing data definitions.

## Required `.env`

The app reads these (all are non-secret public identifiers; never put an API key
in a `VITE_` variable):

```
VITE_APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=<PROJECT_ID>
VITE_APPWRITE_DATABASE_ID=<DATABASE_ID>
VITE_APPWRITE_BUCKET_ID=<BUCKET_ID>
VITE_APPWRITE_PHOTOS_COLLECTION_ID=photos
```

`VITE_APPWRITE_PHOTOS_COLLECTION_ID` must match the `photos` table `$id`.
