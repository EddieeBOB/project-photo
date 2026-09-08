# Features

An inventory of what is implemented in project-photo, organized by full-stack layer.

**Stack:** React 19 + TypeScript SPA built with Vite 8, served as a static site by Appwrite Sites, backed by Appwrite (auth, TablesDB, storage, functions).

## Presentation layer (UI)

- Carousel viewer — arrows, progress dots, scroll handling, skeleton loading states
- Dark/light theme with toggle and persistence
- MUI design system with a custom theme
- Responsive/mobile layouts
- Toast notifications
- Error boundary for fault isolation
- Live password-requirement feedback
- Email-verification banner
- About page, privacy policy, footer/copyright
- i18n scaffolding (English only so far)

## Client application layer (routing & state)

- SPA routing across 11 routes, public and private
- Route guards on `/studio` and `/account`
- Session state and theme state via Context
- Custom hooks: carousel scroll, file drop zone, object-URL cleanup
- Multi-step login state machine (`password` → `mfa`)
- Draft composition held in client state with `blob:` previews

## Authentication & authorization

- Email/password registration and login
- Login by username *or* email
- Email verification — send and confirm
- Email-OTP two-factor auth, opt-in, gated behind a verified email
- Password reset via emailed token
- "Remember me" / auto-login policy
- Partial-session cleanup on abandoned MFA
- Per-owner resource permissions on every record

## Server-side logic (serverless)

- `login-resolver` function — validates credentials server-side and returns only the caller's own email
- Scoped execution permissions on that function (`rows.read`, `users.read`, `sessions.write`)

## Database layer

- Users / galleries / photos schema
- Ownership permissions per record
- Public/private visibility flags
- Queries by owner, by username, and username search
- Featured-artist lookup
- CRUD: create gallery, delete gallery, delete photo, update visibility

## File storage & media processing

- Upload by file picker or drag-and-drop
- MIME-type and file-size validation
- Client-side downscaling before upload
- EXIF metadata extraction and display
- Thumbhash generation and blurred placeholder rendering
- Object-storage upload
- On-the-fly transform URLs, plus original-resolution access
- Object-URL revocation

## API / integration layer

- Service-layer abstraction — no component imports the SDK directly
- Single client singleton as the one data-access seam
- Client-to-function invocation
- Atomic publish: nothing persists until the whole set succeeds

## Security

- Email non-enumeration by keeping username→email resolution server-side
- Admin SDK confined to dev tooling, never bundled
- Build-time public config kept distinct from runtime secrets
- Custom HTTP response headers
- `robots.txt`
- Enforced password policy

## Performance

- Resize before upload (bandwidth + storage)
- LQIP placeholders at correct aspect ratio — no layout shift
- Skeleton states for perceived speed
- React Compiler automatic memoization
- Code splitting and asset hashing
- Production source maps for debuggability

## Testing / QA

- Vitest unit tests
- Integration tests against real services
- Playwright end-to-end browser tests
- Automated 2FA suite with a containerized mail server capturing OTPs
- ESLint 10 + TypeScript build gate

## DevOps & delivery

- Git-based continuous deployment
- Branch promotion (`main` → `staging` triggers the build)
- Per-deployment environment variables
- Static hosting with SPA fallback routing
- Configured deployment retention
- Pinned build runtime and install/build commands
