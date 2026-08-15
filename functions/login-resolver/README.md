# login-resolver

Server-side username → email resolver so users can log in with a **username**
without exposing anyone's email.

## Why

The `users` table is publicly readable by username (public profile pages need
it), so it no longer stores `email`. Appwrite has no "log in by username" API,
and resolving username→email in the browser would let anyone scrape every user's
email. This function does the lookup server-side and returns the email **only
after** verifying the password — i.e. only to the account owner, who already
knows it. The browser then opens the real session with the normal
email/password flow, so **MFA and session persistence are unchanged**.

## Contract

- **Request** (POST, JSON): `{ "username": string, "password": string }`
- **Response**:
  - `200 { "email": string }` — password correct
  - `400 { "error": "..." }` — malformed request
  - `401 { "error": "Invalid username or password." }` — unknown user or wrong password

## Dynamic key scopes

The function runs with `documents.read`, `users.read`, and `sessions.write`.
Appwrite injects a per-execution key as the `x-appwrite-key` header, so there is
no long-lived key to store or rotate.

## Environment

`APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` are supplied
by the Appwrite runtime. `APPWRITE_DATABASE_ID` and `APPWRITE_USERS_TABLE_ID`
are optional overrides; the code falls back to the real ids.

## How it resolves

1. Look up the username in the `users` table → user id (the row `$id` *is* the
   Auth user id).
2. Read the account's email from Auth. It is deliberately not in the table.
3. Verify the password by creating a throwaway session with the admin key, then
   deleting it immediately. There is no standalone "verify password" endpoint,
   so a session that creates successfully is the check. Deleting it keeps the
   attempt off the user's session limit; the browser opens the real one.
4. Return the email.

Every failure path returns the same `401` — unknown username and wrong password
are indistinguishable to the caller.

An exact username match is tried first, falling back to a case-insensitive scan.
That fallback pages only the first 100 rows, so it stops finding people beyond
that; worth replacing with a lowercased indexed column before the user count
gets there.

## Who calls it

One caller: [`handleLogin()`](../../src/services/loginService.ts) in
`src/services/loginService.ts`, and only when the submitted identifier contains
no `@`. Sign in with an email and the function is never invoked. The client
reads the function id from `VITE_APPWRITE_LOGIN_FN_ID`.

## Note on brute-force

Password verification uses the admin key, which bypasses per-IP rate limits.
Appwrite still rate-limits function executions; add a CAPTCHA or per-username
attempt counter in front of step 3 if you want stricter protection.
