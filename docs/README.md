# Documentation

Reference docs for **Frame** ([photoframes.me](https://photoframes.me)). The
[root README](../README.md) is the starting point; the pages below go deeper on
specific areas.

## Backend & security

- [Appwrite backend configuration](./appwrite-backend.md) — the security model
  (row/file-level permissions, why there are no table-wide grants), how to deploy
  `appwrite.config.json`, and the required `VITE_APPWRITE_*` environment.
- [`login-resolver` function](../functions/login-resolver/README.md) — the
  server-side username → email resolver that lets users log in by username
  without exposing anyone's email.

## Testing

- [Test suite overview](../tests/README.md) — the three layers (unit,
  integration, E2E), what each covers, and how to run them.
- [2FA lifecycle E2E suite](../tests/e2e/2fa/README.md) — email-OTP two-factor
  login coverage (Playwright + Page Object Model).
- [Local Appwrite + Mailpit stack](../tests/e2e/2fa/docker/README.md) — the
  Dockerized backend that makes the 2FA OTP tests fully automated.

## Design system

- [Luminous Editorial](./design/luminous-editorial.md) — the core design system:
  visual philosophy, color palette, typography, and layout rules.
- [Auth patterns](./design/auth-patterns.md) — the design system applied to the
  login and sign-up flows.
