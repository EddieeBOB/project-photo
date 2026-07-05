# 2FA lifecycle E2E suite

End-to-end coverage for the login + email-OTP two-factor lifecycle of
photoframes.me (Appwrite auth). Playwright + Page Object Model, with test users
created/torn down through the Appwrite **server** SDK for speed and isolation.

> **This app uses email-OTP 2FA, not TOTP.** The second factor is a 6-digit code
> emailed at login (`account.createMFAChallenge({ factor: Email })`). There is no
> authenticator secret/QR code, so **`otplib` is not used**. The code is obtained
> at runtime by whichever reader `E2E_OTP_MODE` selects — see
> [Handling OTP codes](#handling-otp-codes).

> **Automated pipeline (recommended):** run against a local Appwrite whose mailer
> is pointed at **Mailpit**, and read the OTP back over Mailpit's REST API — no
> real inbox, no human. Setup is in [`docker/README.md`](./docker/README.md); the
> reader is [`fixtures/mailpit.ts`](./fixtures/mailpit.ts). This turns the two
> previously-manual specs into an unattended, CI-shaped run.

## Layout

```
tests/e2e/2fa/
  config.ts              # env resolution (+ .env.e2e.local overlay), test-email builder
  fixtures/
    admin.ts             # node-appwrite: create/verify/mfa/session/delete users
    session.ts           # seed an authenticated browser without the UI
    mailpit.ts           # automated OTP reader over Mailpit's REST API
    otp.ts               # OTP dispatcher (mailpit | manual file-handshake) + skip gate
    test.ts              # merged Playwright fixtures + requireAdmin/requireOtpReader
  pages/                 # Page Objects: LoginPage, TwoFactorPage, AccountSecurityPage, AppShell
  specs/
    01-enrollment.spec.ts
    02-login-2fa-happy.spec.ts
    03-login-2fa-failures.spec.ts
    04-edge-cases.spec.ts
    05-logout-session.spec.ts
  docker/                # Mailpit compose + Appwrite SMTP wiring + setup guide
  scripts/preflight.mjs  # checks the local stack is reachable before a run
  .env.e2e.local         # local-stack config (gitignored; you create it)
```

The suite targets Appwrite **Cloud** by default; adding a gitignored
`tests/e2e/2fa/.env.e2e.local` flips `config.ts` (and, via the process.env it
publishes, the Vite dev server) onto the local Appwrite+Mailpit stack — no code
change. See [`docker/README.md`](./docker/README.md) for the exact keys.

## What each spec covers

| Spec | Cases | Needs OTP reader? |
|------|-------|-------------------|
| 01 enrollment | plain login (no 2FA), enable 2FA in settings, verify against Appwrite. Recovery/backup codes documented as an out-of-scope gap (`test.fixme`). | No |
| 02 happy path | password → OTP prompt (asserted) → valid code → `/studio` → session persisted | **Yes** |
| 03 failures | wrong password (no 2FA prompt), wrong code, empty code (native-required, no bypass), repeated-wrong throttling/429, previously-used code rejected | Only the reuse case |
| 04 edge cases | disable 2FA (+ flags the missing re-auth gate), partial-session-lost mid-flow forces restart, opt-in real-TTL expiry | No |
| 05 logout & session | unauthenticated `/studio` & `/account` redirect to `/login`; logout clears session and re-guards routes | No |

The OTP-dependent cases run unattended under `E2E_OTP_MODE=mailpit` (local
Appwrite + Mailpit); everything else needs only `APPWRITE_API_KEY`.

## Setup

**Automated (local Appwrite + Mailpit)** — the recommended path. Follow
[`docker/README.md`](./docker/README.md); it walks you through creating
`tests/e2e/2fa/.env.e2e.local` (gitignored) with the local project id, a server
API key (`users.read` + `users.write`), and `E2E_OTP_MODE=mailpit`. `config.ts`
reads that file and publishes its `VITE_*` / `APPWRITE_*` / `MAILPIT_*` values
into `process.env`, so both the Playwright process and the Vite dev server pick
up the local stack.

**Manual (against Appwrite Cloud)** — put the same `APPWRITE_API_KEY`
(server key with `users.read` + `users.write`) in the repo-root `.env`; endpoint
and project fall back to the app's existing `VITE_APPWRITE_*` values. The project
must have SMTP configured so OTP emails reach a real inbox, and codes are supplied
by hand (`E2E_OTP_MODE=manual`, see [Handling OTP codes](#handling-otp-codes)).
Test users are plus-addressed off `E2E_2FA_INBOX`.

## Running

```bash
# CI-safe subset vs Appwrite Cloud (admin-driven; OTP specs auto-skip).
npm run test:e2e:2fa

# FULLY AUTOMATED including the emailed-OTP specs, vs local Appwrite + Mailpit.
# One-time setup: tests/e2e/2fa/docker/README.md
npm run e2e:mailpit:up             # start Mailpit (docker)
npm run e2e:preflight              # verify stack is reachable
npm run test:e2e:2fa:mailpit       # dev server in --mode e2e + Mailpit reader

# Human/Gmail-MCP fallback vs Cloud (no Mailpit): supply codes by hand.
npm run test:e2e:2fa:manual        # sets E2E_OTP_MODE=manual
```

Without `APPWRITE_API_KEY` the admin-driven groups **skip** (they don't fail), so
the suite is safe to have in the default `npm run test:e2e`.

## Handling OTP codes

This is the crux of automating email-based 2FA: a headless Playwright process
can't read a mailbox. [`fixtures/otp.ts`](./fixtures/otp.ts) exposes a single
entry point — `requestAndWaitForOtp(email)` — that dispatches on `E2E_OTP_MODE`,
so the specs never change when the backend does.

### `E2E_OTP_MODE=mailpit` — automated (recommended)

The local Appwrite stack sends the OTP email into **Mailpit** (an SMTP sink), and
[`fixtures/mailpit.ts`](./fixtures/mailpit.ts) reads it back over Mailpit's REST
API — zero humans:

1. `requestMailpitOtp(email)` records a timestamp cutoff and clears the mailbox
   (so a stale code from an earlier test can't match).
2. `waitForMailpitOtp(email)` polls `GET /api/v1/search?query=to:"<email>"`
   (newest first), pulls the 6-digit code from the message, and **deletes** it so
   a re-send stays unambiguous.

Reachability is checked in the `requireOtpReader` gate, so if Mailpit is down the
OTP specs *skip with a clear reason* rather than failing. Full setup (local
Appwrite install, SMTP wiring, project/key) is in
[`docker/README.md`](./docker/README.md). The reader's logic is unit-tested
without Docker in [`tests/unit/mailpit-reader.test.ts`](../../unit/mailpit-reader.test.ts).

### `E2E_OTP_MODE=manual` — file handshake (Cloud, human/Gmail-MCP)

When running against Appwrite Cloud (email can't be intercepted), a small file
handshake bridges the test and whatever *can* read the inbox:

1. `requestOtp(email)` → writes `.otp/requests/<slug>.json` and clears any stale
   code, announcing *"now awaiting a code for `<email>`"*.
2. The reader (Gmail MCP or a human) drops the newest 6-digit code into
   `.otp/codes/<slug>.txt` (via `writeOtp()`).
3. `waitForOtp(email)` polls that file until the code appears (120 s default).

```bash
npm run test:e2e:2fa:manual        # or: E2E_OTP_MODE=manual npx playwright test <spec>
```
When a test blocks in `waitForOtp`, read `.otp/requests/` for the target address,
fetch the code from Gmail, and write it to `.otp/codes/<slug>.txt`. `.otp/` is
gitignored; this mode is never available in CI.

### unset — no reader

OTP-dependent specs skip themselves (`requireOtpReader`), so the rest of the
suite stays green with no email backend at all.

## Seeding auth without the UI

For tests that aren't exercising the login OTP itself (disable-2FA, logout), the
`seedAuth(userId)` fixture mints a session via the admin API
(`users.createSession`, which bypasses MFA) and writes it into the browser the
same way the web SDK does on localhost: `localStorage['cookieFallback'] =
{"a_session_<project>":"<secret>"}`, plus the app's `auth.rememberExpiry` flag so
`AuthContext` doesn't tear the seeded session down. See
[`fixtures/session.ts`](./fixtures/session.ts).

## Selectors

The Page Objects use existing accessible roles/labels, so **no frontend changes
are required to run today**:

| Element | Current selector |
|---------|------------------|
| Email / Password fields | `getByLabel('Email')`, `getByLabel('Password')` |
| Login submit | `getByRole('main').getByRole('button', { name: 'Log In' })` |
| OTP field | `getByLabel('Verification code')` |
| Verify button | `getByRole('button', { name: 'Verify & Continue' })` |
| 2FA settings toggle | `getByLabel('Toggle two-factor authentication')` |
| Account menu / Log Out | `getByRole('button', { name: 'Open account menu' })` → `menuitem 'Log Out'` |
| Error / info toast | `getByRole('alert')` (MUI `<Alert>`) |

### Optional `data-testid`s to harden the suite

These would decouple the tests from copy/i18n changes. If you add them, tell me
and I'll switch the Page Objects over:

- `data-testid="login-email"`, `login-password`, `login-submit`
- `data-testid="mfa-code"`, `mfa-submit`, `mfa-cancel`
- `data-testid="login-error"` on the error `<Alert>` (and a distinct
  `mfa-error` if you want to disambiguate step)
- `data-testid="settings-2fa-toggle"` on the Account switch
- `data-testid="account-menu"` and `data-testid="logout"` in the navbar
- `data-testid="studio-root"` on the `/studio` container (stable authed marker)

## Known gaps / QA notes flagged by the suite

- **No recovery/backup codes** exist in this flow (email OTP only). The "shown
  once" case is a documented `test.fixme` in spec 01.
- **Disabling 2FA requires no re-auth or current code** — just a toggle. Spec 04
  asserts the real behaviour and comments the missing protection the spec expects.
- **Real challenge-TTL expiry** is simulated by dropping the partial session
  (fast). An opt-in slow variant (`E2E_2FA_REAL_EXPIRY=<seconds>`) exercises the
  true TTL.
