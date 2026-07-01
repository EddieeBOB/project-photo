# Tests

Three layers: unit + integration run with [Vitest](https://vitest.dev); the
browser end-to-end layer runs with [Playwright](https://playwright.dev).

## Unit tests — `npm test`

Offline, deterministic, no network or credentials. Cover the security-critical
pure logic:

- `tests/unit/password.test.ts` — password strength rules.
- `tests/unit/permissions.test.ts` — the per-document permission builder
  (`ownerPermissions`) that drives public/private access.

```sh
npm test          # run once
npm run test:watch
```

## Integration tests — `npm run test:integration`

Live tests against the **real Appwrite project in `.env`**, run client-side via
the web SDK (no admin key). Two files:

**`tests/integration/auth-email.test.ts`** — the auth-flow *email-sending* calls
the app makes: password recovery (`createRecovery`), magic-URL login
(`createMagicURLToken`), and email verification (`createVerification`). A 2xx
means Appwrite accepted and queued the email — that's the assertion. Also checks
that recovery for an unknown email is rejected. Real emails go to the fixture
inbox on each run. (Completing a link with its one-time token needs an inbox and
is out of scope.)

**`tests/integration/lifecycle.test.ts`** — a full lifecycle: register/sign in a
user, create a
**private** gallery + photo + uploaded file, assert a guest **cannot** read
them, the owner **can**, they become readable once made **public**, then delete
everything and verify it's gone. An idempotent `afterAll` guarantees cleanup
even if a test fails partway.

It runs entirely **client-side via the web SDK — no admin API key**. Config is
read from the same `VITE_APPWRITE_*` values the app uses, which Vitest loads
from `.env`. The suite is **skipped automatically** if those aren't set.

```sh
npm run test:integration
```

### What it touches

- Reuses a single **fixture account** (`framevitestfixture@gmail.com`): it logs
  in if the account exists, registers it on the first run. This avoids leaving
  an undeletable auth user behind each run (deleting users requires an admin
  key, which this suite intentionally doesn't use).
- All galleries, photos, and files it creates are deleted at the end — the
  final test asserts they're gone.
- The project schema must match `appwrite.config.json` (tables `users`,
  `gallery`, `photos` + the storage bucket) with row/file security enabled.

> ⚠️ `.env` currently points at your live project, so these tests run against
> real data. They only ever create/delete their own clearly-named `Vitest`
> resources, but if you'd rather isolate them, point `.env` at a dedicated test
> project.

## E2E tests — `npm run test:e2e`

Real-browser coverage of everything Vitest can't touch, under `tests/e2e/`
([Playwright](https://playwright.dev)). Playwright starts a Vite dev server on a
fixed port (`playwright.config.ts`), which loads the same `.env` the app uses,
so the pages talk to the **real Appwrite project**.

```sh
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive UI mode
```

First-time setup installs the browser binary:

```sh
npx playwright install chromium
```

### What it covers

- **Public pages & rendering** (`home.spec.ts`) — hero + feature cards, hero CTAs.
- **Navigation** (`navigation.spec.ts`) — desktop nav links, the brand link, and
  the responsive **mobile drawer** (open → navigate → close).
- **Theme toggle** (`theme.spec.ts`) — flips `data-theme` and persists to
  `localStorage` across a reload.
- **Auth UI states** (`auth-ui.spec.ts`) — login/signup form rendering, the live
  password-requirements checklist and submit gating, the forgot-password
  "check your email" screen (real recovery email to the fixture inbox), and the
  reset-password invalid-link / mismatch states.
- **Upload pipeline** (`upload.spec.ts`) — logs the fixture user in through the
  real UI, pushes a real image through pica resize + EXIF parse +
  `URL.createObjectURL`, publishes a **private** gallery, and asserts it was
  persisted to Appwrite. Everything it creates is torn down by title marker
  (`tests/e2e/utils/appwrite.ts`), verified in a follow-up test — the DB is left
  clean.

Live specs (forgot-password, upload) **skip automatically** if `.env` isn't
configured, and reuse the same fixture account as the integration suite.

### Still not automated here

The email-link **completion** steps — clicking a verification / magic-URL /
password-reset link with a real one-time token — need an email inbox and aren't
E2E'd. The request side and every resulting UI state are covered above.
