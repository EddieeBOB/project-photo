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

Declared in `appwrite.config.json` (`functions[].scopes`): `documents.read`,
`users.read`, `sessions.write`. Appwrite injects a per-execution key as the
`x-appwrite-key` header — no manual key management.

## Config / env

`APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` are provided
by Appwrite automatically. `APPWRITE_DATABASE_ID` / `APPWRITE_USERS_TABLE_ID`
are optional overrides (the code falls back to the real IDs).

## Deploy

From the repo root, with the Appwrite CLI logged in:

```bash
appwrite push function
```

The client reads the function ID from `VITE_APPWRITE_LOGIN_FN_ID` (set to
`login-resolver` in `.env`).

## Test after deploy

```bash
# wrong password -> 401, no email
appwrite functions create-execution \
  --function-id login-resolver \
  --body '{"username":"EddieeBOB","password":"wrong"}'

# then verify a real login-by-username in the browser (MFA users still get the OTP step)
```

## Note on brute-force

Password verification uses the admin key, which bypasses per-IP rate limits.
Appwrite still rate-limits function executions; add a CAPTCHA or per-username
attempt counter in front of step 3 if you want stricter protection.
