# Appwrite backend & security model

Frame is a frontend-only app that talks directly to Appwrite, so **all
authorization is enforced by Appwrite**, not by the React code. The browser
holds nothing the user couldn't already read: hiding a control in the UI is a
presentation choice, never a security boundary.

## How the security model works

The app sets **per-row / per-file permissions at creation time**, built by
`ownerPermissions()` in [`src/lib/permissions.ts`](../src/lib/permissions.ts):

- The owner always gets `read` / `update` / `delete`.
- Public galleries additionally get `read("any")`.

For that to be the *only* thing controlling access, the tables and bucket have
**row/file security enabled** and grant no table-wide read/update/delete:

| Resource          | `rowSecurity` / `fileSecurity` | Table/bucket `$permissions` |
| ----------------- | ------------------------------ | --------------------------- |
| `gallery`         | `true`                         | `create("users")` only      |
| `photos`          | `true`                         | `create("users")` only      |
| bucket            | `true` (`fileSecurity`)        | `create("users")` only      |
| `users`           | `true`                         | `create("users")`, `read("any")` |

Because there is no table-wide `read`/`update`/`delete`, a signed-in user can
only read, modify, or delete the gallery rows, photo rows, and files they own —
unless a gallery is public, in which case anyone can *read* it. This is what
closes the IDOR and "private galleries are actually public" gaps.

> ⚠️ Never add `read("any")`, `read("users")`, `update(...)`, or `delete(...)`
> at the table or bucket level for `gallery`/`photos`/the bucket. With row
> security enabled, table-level grants are **additive** and would re-open the
> holes — a table-level `read("any")` makes every private gallery public again.

### Visibility is a cascade, not a flag

Flipping a gallery between public and private rewrites permissions on the
gallery row, **every photo row, and every storage file** it contains
(`updateGalleryVisibility()` in
[`src/services/galleryService.ts`](../src/services/galleryService.ts)). Without
the cascade a "private" gallery's images would still be fetchable by direct URL,
because the file's own permissions — not its parent's — decide who may read it.

### Why the `users` table carries no email

`users` is readable by `any` so public profile pages can resolve a username
without a session. That makes every column on it world-readable, so the table
stores a username and a gallery relationship and nothing else — no email. An
anonymous request can enumerate usernames, which is by design; there is no
username → email mapping to leak, because the mapping does not live there.

Resolving that mapping is what the `login-resolver` function exists for.

## Server-side functions

The only server-side code in the project is one Appwrite Function.

### `login-resolver`

Lets people sign in with a **username** without exposing anyone's email.
Appwrite has no "log in by username" API — `createEmailPasswordSession` needs an
email — and doing the lookup in the browser would hand every user's email to any
anonymous caller.

So the resolution happens server-side, and the email comes back **only after the
password is verified** — that is, only to the account's rightful owner, who
already knows it:

1. Look up the username in the `users` table to get a user id.
2. Read that account's email from Auth (not from the table — it isn't there).
3. Verify the password by creating a throwaway session with the admin key, then
   immediately deleting it. Appwrite has no standalone "check this password"
   endpoint, so a session that creates successfully *is* the check.
4. Return the email.

Every failure — unknown username, wrong password, missing email — returns the
same `401 { "error": "Invalid username or password." }`, so the response reveals
nothing about which step failed.

The browser then opens the real session itself through the ordinary
email/password flow, which is what keeps MFA and cookie persistence behaving
exactly as they do for an email login. Full contract in
[`functions/login-resolver/README.md`](../functions/login-resolver/README.md).

**Known limitation:** password verification runs under the admin key, which
bypasses Appwrite's per-IP login rate limits. Function executions are still rate
limited, but this path is a weaker brake on brute force than a normal login —
and since usernames are public by design, an attacker starts with a complete
target list. A per-username attempt counter or CAPTCHA in front of step 3 is the
fix if that trade stops being acceptable.
