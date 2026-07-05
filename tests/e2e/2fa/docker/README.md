# Local Appwrite + Mailpit — automated 2FA OTP pipeline

This directory stands up the backend the automated 2FA suite runs against: a
**self-hosted Appwrite** whose system mailer is pointed at **Mailpit**, an SMTP
sink with a REST API. The app sends the email-OTP second factor through Appwrite
→ Mailpit, and Playwright reads the code back over Mailpit's REST API
(`tests/e2e/2fa/fixtures/mailpit.ts`) — no real inbox, no human, no Gmail MCP.

```
 Playwright ──drives──▶ app (vite --mode e2e) ──▶ local Appwrite ──SMTP──▶ Mailpit
      ▲                                                                      │
      └────────────── reads OTP via REST (:8025/api/v1) ─────────────────────┘
```

> **Prerequisite:** Docker Desktop (or a Docker daemon) running. Check with
> `docker info`. On this machine Docker was **not installed** when this was
> written — install it first.

## One-time setup

### 1. Start Mailpit

```bash
npm run e2e:mailpit:up          # docker compose ... docker-compose.mailpit.yml up -d
```

Mailpit UI: <http://localhost:8025> · REST: <http://localhost:8025/api/v1/info>

### 2. Install & start local Appwrite

> **Version must match your app's SDK / Appwrite Cloud.** The web SDK pins an
> `X-Appwrite-Response-Format` and calls version-specific routes (e.g. MFA is
> `POST /account/mfa/challenges` on 1.9, but `/challenge` on 1.6). A mismatch
> makes MFA login 401 locally while working against Cloud. Check both and pin
> the same major.minor:
> ```bash
> curl -s https://<region>.cloud.appwrite.io/v1/health/version   # e.g. 1.9.5
> node -e 'console.log(require("appwrite/package.json").version)'  # web SDK (25.x -> server 1.9.x)
> ```

Use Appwrite's official installer (this generates its `docker-compose.yml` + `.env`):

```bash
docker run -it --rm \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume "$(pwd)"/appwrite:/usr/src/code/appwrite:rw \
  --entrypoint="install" \
  appwrite/appwrite:1.9.5   # match Cloud (this project targets 1.9.5)
```

**Upgrading an existing local install** (e.g. from a wrong version): re-run the
same command with the new tag from *inside* the `appwrite/` dir, then `up` —
Appwrite migrates in place and keeps your project, key, and platform:

```bash
cd appwrite && docker compose down
docker run -it --rm \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume "$(pwd)":/usr/src/code/appwrite:rw \
  --entrypoint="install" \
  appwrite/appwrite:1.9.5
grep -q _APP_SMTP_HOST .env || cat ../tests/e2e/2fa/docker/appwrite.smtp.env >> .env
docker compose up -d
```

Then point Appwrite's mailer at Mailpit by appending our snippet to the `.env`
the installer created, and restart:

```bash
cat tests/e2e/2fa/docker/appwrite.smtp.env >> appwrite/.env
(cd appwrite && docker compose up -d)
```

Appwrite console: <http://localhost>

### 3. Create the project, platform, and key (local console, one-time)

Appwrite has no unauthenticated bootstrap API, so do this once in the console
(or with the Appwrite CLI — you have `appwrite` v22 installed):

1. Create a **project** → note its ID.
2. **Auth → Security:** enable the **Email (OTP)** MFA factor, and make sure
   Email/Password auth is on.
3. Add a **Web platform** with hostname `localhost` (matches any port, incl. 5180).
4. Create an **API key** with scopes `users.read`, `users.write` → copy it.

### 4. Create `tests/e2e/2fa/.env.e2e.local`

Create it (gitignored via `*.local`) with the values from step 3:

```bash
cat > tests/e2e/2fa/.env.e2e.local <<'EOF'
# App (dev server) -> LOCAL Appwrite. VITE_APPWRITE_ENDPOINT is required, or the
# browser falls back to .env (Cloud) and 404s sending a local id to Cloud.
VITE_APPWRITE_ENDPOINT=http://localhost/v1
VITE_APPWRITE_PROJECT_ID=<your local project id>

# Admin/test side (server key with users.read + users.write).
APPWRITE_ENDPOINT=http://localhost/v1
APPWRITE_PROJECT_ID=<your local project id>
APPWRITE_API_KEY=<your local server key>

# Read OTPs from Mailpit's REST API -> fully automated.
E2E_OTP_MODE=mailpit
MAILPIT_URL=http://localhost:8025
EOF
```

`config.ts` reads this file (from the suite dir) and publishes its values into
`process.env`, so both Playwright and the Vite dev server (which Vite prioritises
`process.env` `VITE_*` over `.env` for) pick up the local stack.

## Run it

```bash
npm run e2e:preflight            # checks Appwrite + Mailpit are reachable
npm run test:e2e:2fa:mailpit     # runs the 2FA suite against the local stack
```

`test:e2e:2fa:mailpit` boots the dev server in `--mode e2e` (so the app targets
local Appwrite) and executes `tests/e2e/2fa` with the Mailpit OTP reader.

## Teardown

```bash
npm run e2e:mailpit:down
(cd appwrite && docker compose down)
```

## Notes / troubleshooting

- **OTP never arrives:** confirm `appwrite-worker-mails` is running and that
  `_APP_SMTP_HOST=host.docker.internal` reached it (`docker compose exec
  appwrite-worker-mails env | grep SMTP`). On Linux add
  `extra_hosts: ["host.docker.internal:host-gateway"]`.
- **Wrong backend:** a run with no `.env.e2e.local` targets Appwrite **Cloud**
  and the OTP specs skip (no reader). The overlay in `config.ts` is what flips
  the suite local.
- **Only the 2FA suite** is wired for local. The other e2e specs (upload, etc.)
  expect the Cloud project's data/functions; run those with `npm run test:e2e`.
