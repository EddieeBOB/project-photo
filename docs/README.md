# Documentation

Reference docs for **Frame** ([photoframes.me](https://photoframes.me)). The
[root README](../README.md) is the starting point; the pages below go deeper on
specific areas.

## Backend & security

- [Appwrite backend & security model](./appwrite-backend.md) — how row/file-level
  permissions carry all authorization, why there are no table-wide grants, why
  visibility changes cascade to files, and what the server-side function does.
- [`login-resolver` function](../functions/login-resolver/README.md) — the
  server-side username → email resolver that lets users log in by username
  without exposing anyone's email: contract, resolution steps, and its callers.


## Testing

- [Test suite overview](../tests/README.md) — the three layers (unit,
  integration, E2E), what each covers, and how to run them.
- [2FA lifecycle E2E suite](../tests/e2e/2fa/README.md) — email-OTP two-factor
  login coverage (Playwright + Page Object Model), and the local Appwrite +
  Mailpit stack that makes the OTP specs run unattended.

## Design system

- [Luminous Editorial](./design/luminous-editorial.md) — the core design system:
  visual philosophy, color palette, typography, and layout rules.
- [Auth patterns](./design/auth-patterns.md) — the design system applied to the
  login and sign-up flows.
