# Home Origin Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a self-hosted origin at `origin/` that archives untouched photo originals, generates a high-quality derivative ladder from them, and serves both over a Cloudflare Tunnel — without touching the running site.

**Architecture:** Four Docker containers (`postgres`, `origin`, `caddy`, `cloudflared`). `origin` is a Node + sharp service that is the only writer; `caddy` serves generated files statically so reads need no application code. Postgres records originals, derivatives and EXIF. The studio writes to Appwrite first and to the origin second, so the origin holds no Appwrite write credential.

**Tech Stack:** Node 26, TypeScript, Hono, busboy, sharp, exifr, Kysely + PostgreSQL 17, vitest, Docker Compose, Caddy, cloudflared.

**Spec:** [`docs/superpowers/specs/2026-09-01-origin-service-design.md`](../specs/2026-09-01-origin-service-design.md)

## Global Constraints

- Everything in this plan lives under `origin/`. **No file in `src/` is modified.** The live site keeps running on Appwrite for the whole of this sub-project.
- The origin holds **no Appwrite write key**. Its only Appwrite credential is read-only (`documents.read`, `files.read`) and is used solely by the reconciliation pass.
- Ladder widths are exactly `1600, 2560, 3840`. **Never upscale.**
- Encoders: AVIF `quality 58, effort 4, chromaSubsampling '4:4:4'`; WebP `quality 84, effort 5`; JPEG `quality 88, mozjpeg true, chromaSubsampling '4:4:4'`. All resampling uses the `lanczos3` kernel.
- Derivatives are converted to sRGB, keep their ICC profile, and have **all other metadata stripped, GPS included**. The native original is served untouched and keeps its EXIF — this is a recorded, accepted decision.
- Upload cap is `104857600` bytes (100MB), matching Cloudflare's proxied-request limit.
- Privacy is enforced by **which directory a file is in**. `caddy` serves `public/` and has no route to `staging/`. Never add one.
- `originals/` and `public/` must share one filesystem — the served original is a hardlink.
- The public artefact is **created last and removed first** in every visibility transition.
- Every generated file is written atomically: write `<name>.tmp`, `fsync`, `rename`.
- `appwriteRowId` / `appwriteFileId` are client-supplied correlation pointers. **Never** use them to decide authorization or visibility.
- Commit after every task. Conventional Commits (`feat:`, `test:`, `chore:`). **Do not add a `Co-Authored-By: Claude` trailer.**

## File Structure

| File | Responsibility |
| --- | --- |
| `origin/package.json`, `tsconfig.json`, `Dockerfile` | Package manifest, compiler config, runtime image. |
| `origin/src/config.ts` | Parse and validate every environment variable; fail fast at boot. |
| `origin/src/index.ts` | HTTP bootstrap, route table, migration-on-boot, graceful shutdown. |
| `origin/src/db/client.ts` | Kysely instance and pool. |
| `origin/src/db/types.ts` | Table interfaces for Kysely. |
| `origin/src/db/migrations/001_initial.ts` | The whole schema. |
| `origin/src/db/migrate.ts` | Migration runner, called at boot and by `npm run migrate`. |
| `origin/src/storage.ts` | Path construction, atomic writes, hardlinks, public↔staging moves. |
| `origin/src/ladder.ts` | Width selection and encoder settings. Pure. |
| `origin/src/exif.ts` | EXIF extraction and normalisation. Pure given a buffer. |
| `origin/src/auth.ts` | JWT verification against Appwrite plus the owner allowlist. |
| `origin/src/routes/health.ts` | `GET /healthz`. |
| `origin/src/routes/ingest.ts` | `POST /v1/ingest`. Streaming multipart, dedupe, rows. |
| `origin/src/transcode.ts` | Background ladder generation; writes derivative rows. |
| `origin/src/manifest.ts` | Builds and writes `manifest.json`. |
| `origin/src/routes/gallery.ts` | `POST /v1/gallery`, `PATCH /v1/gallery/:id/visibility`. |
| `origin/src/routes/photo.ts` | `DELETE /v1/photo/:id`. |
| `origin/src/reconcile.ts` | Boot + hourly repair pass, including the fail-closed visibility audit. |
| `origin/docker-compose.yml`, `Caddyfile`, `.env.example`, `README.md` | Deployment and operator guide. |
| `origin/docker-compose.test.yml` | Disposable Postgres for the integration suite. |

---

### Task 1: Service skeleton, config, health check

**Files:**
- Create: `origin/package.json`, `origin/tsconfig.json`, `origin/vitest.config.ts`, `origin/.gitignore`
- Create: `origin/src/config.ts`, `origin/src/index.ts`, `origin/src/routes/health.ts`
- Test: `origin/tests/unit/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `config: Config` (a frozen object with `databaseUrl`, `dataDir`, `ownerUserId`, `publicBaseUrl`, `allowedOrigins: string[]`, `appwriteEndpoint`, `appwriteProjectId`, `appwriteApiKey`, `appwriteBucketId`, `maxUploadBytes: number`, `port: number`), and `loadConfig(env: NodeJS.ProcessEnv): Config` for tests.

- [ ] **Step 1: Create the package manifest**

`origin/package.json`:

```json
{
  "name": "@frame/origin",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -b",
    "start": "node dist/index.js",
    "migrate": "tsx src/db/migrate.ts",
    "test": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "db:test:up": "docker compose -f docker-compose.test.yml up -d --wait",
    "db:test:down": "docker compose -f docker-compose.test.yml down -v"
  },
  "dependencies": {
    "@hono/node-server": "^1.19.5",
    "busboy": "^1.6.0",
    "exifr": "7.1.3",
    "hono": "^4.9.10",
    "kysely": "^0.28.9",
    "node-appwrite": "^17.2.0",
    "pg": "^8.16.3",
    "sharp": "^0.34.5"
  },
  "devDependencies": {
    "@types/busboy": "^1.5.4",
    "@types/node": "^24.12.2",
    "@types/pg": "^8.15.6",
    "tsx": "^4.20.6",
    "typescript": "6.0.2",
    "vitest": "^3.2.4"
  }
}
```

`origin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

`origin/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Transcoding a real photograph is slow; the default 5s is not enough.
        testTimeout: 60_000,
        hookTimeout: 60_000,
        setupFiles: ['./tests/setup.ts'],
    },
});
```

`origin/tests/setup.ts`:

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * `config.ts` reads the environment once, at import time, so every value it
 * needs has to exist before any test file imports anything. Each test file gets
 * its own temporary DATA_DIR, which keeps the suites from writing over each
 * other's files — and keeps them from ever touching a real archive.
 */
process.env.DATA_DIR ??= mkdtempSync(join(tmpdir(), 'origin-test-'));
process.env.DATABASE_URL ??= 'postgres://origin:origin@localhost:55432/origin_test';
process.env.OWNER_USER_ID ??= 'owner123';
process.env.PUBLIC_BASE_URL ??= 'https://images.test';
process.env.ALLOWED_ORIGINS ??= 'https://photoframes.me';
process.env.APPWRITE_ENDPOINT ??= 'https://cloud.appwrite.io/v1';
process.env.APPWRITE_PROJECT_ID ??= 'test-project';
process.env.APPWRITE_API_KEY ??= 'test-key';
process.env.APPWRITE_DATABASE_ID ??= 'test-db';
process.env.APPWRITE_BUCKET_ID ??= 'test-bucket';
```

`origin/.gitignore`:

```
node_modules/
dist/
.env
data/
```

- [ ] **Step 2: Write the failing config test**

`origin/tests/unit/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';

const complete = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/origin',
    DATA_DIR: '/data',
    OWNER_USER_ID: 'owner123',
    PUBLIC_BASE_URL: 'https://images.photoframes.me',
    ALLOWED_ORIGINS: 'https://photoframes.me,http://localhost:5173',
    APPWRITE_ENDPOINT: 'https://cloud.appwrite.io/v1',
    APPWRITE_PROJECT_ID: 'proj',
    APPWRITE_API_KEY: 'key',
    APPWRITE_DATABASE_ID: 'db',
    APPWRITE_BUCKET_ID: 'bucket',
};

describe('loadConfig', () => {
    it('reads a complete environment', () => {
        const config = loadConfig(complete);

        expect(config.ownerUserId).toBe('owner123');
        expect(config.allowedOrigins).toEqual(['https://photoframes.me', 'http://localhost:5173']);
        expect(config.maxUploadBytes).toBe(104_857_600);
        expect(config.port).toBe(8080);
    });

    it('names the variable that is missing', () => {
        const { OWNER_USER_ID: _omitted, ...incomplete } = complete;

        expect(() => loadConfig(incomplete)).toThrow(/OWNER_USER_ID/);
    });

    it('rejects a non-numeric upload cap rather than silently using NaN', () => {
        expect(() => loadConfig({ ...complete, MAX_UPLOAD_BYTES: 'plenty' })).toThrow(/MAX_UPLOAD_BYTES/);
    });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd origin && npm install && npx vitest run tests/unit/config.test.ts`
Expected: FAIL — cannot resolve `../../src/config`.

- [ ] **Step 4: Implement the config module**

`origin/src/config.ts`:

```ts
/**
 * Every environment variable the service reads, parsed and validated once at
 * boot. A misconfiguration should stop the process immediately rather than
 * surface as a confusing failure on the first upload.
 */

export interface Config {
    databaseUrl: string;
    dataDir: string;
    ownerUserId: string;
    publicBaseUrl: string;
    allowedOrigins: string[];
    appwriteEndpoint: string;
    appwriteProjectId: string;
    /** Read-only. The origin never writes to Appwrite. */
    appwriteApiKey: string;
    appwriteDatabaseId: string;
    appwriteBucketId: string;
    maxUploadBytes: number;
    port: number;
}

const DEFAULT_MAX_UPLOAD_BYTES = 104_857_600; // 100MB — Cloudflare's proxied-body limit.
const DEFAULT_PORT = 8080;

function required(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function numeric(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;

    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer, got: ${raw}`);
    }
    return value;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
    return Object.freeze({
        databaseUrl: required(env, 'DATABASE_URL'),
        dataDir: required(env, 'DATA_DIR'),
        ownerUserId: required(env, 'OWNER_USER_ID'),
        publicBaseUrl: required(env, 'PUBLIC_BASE_URL').replace(/\/+$/, ''),
        allowedOrigins: required(env, 'ALLOWED_ORIGINS').split(',').map((o) => o.trim()).filter(Boolean),
        appwriteEndpoint: required(env, 'APPWRITE_ENDPOINT'),
        appwriteProjectId: required(env, 'APPWRITE_PROJECT_ID'),
        appwriteApiKey: required(env, 'APPWRITE_API_KEY'),
        appwriteDatabaseId: required(env, 'APPWRITE_DATABASE_ID'),
        appwriteBucketId: required(env, 'APPWRITE_BUCKET_ID'),
        maxUploadBytes: numeric(env, 'MAX_UPLOAD_BYTES', DEFAULT_MAX_UPLOAD_BYTES),
        port: numeric(env, 'PORT', DEFAULT_PORT),
    });
}

export const config: Config = loadConfig(process.env);
```

Note: `config` is evaluated on import, so tests import `loadConfig` directly and never the singleton.

- [ ] **Step 5: Run the test and watch it pass**

Run: `cd origin && npx vitest run tests/unit/config.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Add the health route and bootstrap**

`origin/src/routes/health.ts`:

```ts
import { Hono } from 'hono';

import { db } from '../db/client';

export const health = new Hono();

/**
 * Liveness plus a real database round trip: the service is useless without
 * Postgres, so reporting healthy while it is down would just delay the alarm.
 */
health.get('/healthz', async (c) => {
    try {
        await db.selectFrom('photo').select(db.fn.countAll().as('count')).executeTakeFirst();
        return c.json({ ok: true, db: 'up' });
    } catch (error) {
        console.error('[health] database check failed:', error);
        return c.json({ ok: false, db: 'down' }, 503);
    }
});
```

`origin/src/index.ts`:

```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { config } from './config';
import { migrateToLatest } from './db/migrate';
import { health } from './routes/health';

const app = new Hono();

app.use('/v1/*', cors({ origin: config.allowedOrigins }));
app.route('/', health);

// Migrations run before the first request is accepted: a half-migrated schema
// serving traffic is worse than a slower boot.
await migrateToLatest();

const server = serve({ fetch: app.fetch, port: config.port });
console.log(`[origin] listening on :${config.port}`);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
        console.log(`[origin] ${signal} received, closing`);
        server.close(() => process.exit(0));
    });
}
```

This will not compile until Task 2 provides `db/client` and `db/migrate`. That is expected; Task 2 closes it.

- [ ] **Step 7: Commit**

```bash
git add origin/
git commit -m "feat(origin): service skeleton with validated config"
```

---

### Task 2: Postgres, Kysely, and the initial migration

**Files:**
- Create: `origin/docker-compose.test.yml`, `origin/src/db/client.ts`, `origin/src/db/types.ts`, `origin/src/db/migrate.ts`, `origin/src/db/migrations/001_initial.ts`
- Test: `origin/tests/integration/schema.test.ts`, `origin/tests/integration/helpers.ts`

**Interfaces:**
- Consumes: `config` from Task 1.
- Produces: `db: Kysely<Database>`; `migrateToLatest(): Promise<void>`; the `Database` interface with tables `gallery`, `photo`, `derivative`, `exif`, `visibility_event`.

- [ ] **Step 1: Add the disposable test database**

`origin/docker-compose.test.yml`:

```yaml
# Throwaway Postgres for the integration suite.
#
#   npm run db:test:up    # then npm run test:integration
#   npm run db:test:down  # -v, so the volume goes too
services:
  postgres-test:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: origin
      POSTGRES_PASSWORD: origin
      POSTGRES_DB: origin_test
    ports:
      - "55432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U origin -d origin_test"]
      interval: 2s
      timeout: 3s
      retries: 15
```

- [ ] **Step 2: Write the failing schema test**

`origin/tests/integration/helpers.ts`:

```ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { Database } from '../../src/db/types';

export const TEST_DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgres://origin:origin@localhost:55432/origin_test';

export function testDb(): Kysely<Database> {
    return new Kysely<Database>({
        dialect: new PostgresDialect({ pool: new Pool({ connectionString: TEST_DATABASE_URL }) }),
    });
}

/** Empties every table between tests without re-running migrations. */
export async function truncateAll(db: Kysely<Database>): Promise<void> {
    await db.deleteFrom('gallery').execute(); // cascades to photo, derivative, exif, visibility_event
}

export async function insertGallery(db: Kysely<Database>, isPublic = true) {
    return db
        .insertInto('gallery')
        .values({ owner_id: 'owner123', title: 'Test Exhibition', is_public: isPublic })
        .returningAll()
        .executeTakeFirstOrThrow();
}
```

`origin/tests/integration/schema.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { migrateToLatest } from '../../src/db/migrate';
import { insertGallery, testDb, truncateAll } from './helpers';

const db = testDb();

beforeAll(async () => { await migrateToLatest(db); });
beforeEach(async () => { await truncateAll(db); });
afterAll(async () => { await db.destroy(); });

const photo = (galleryId: string, overrides: Record<string, unknown> = {}) => ({
    gallery_id: galleryId,
    owner_id: 'owner123',
    original_path: '/data/originals/a.jpg',
    original_bytes: 1_000n,
    original_sha256: 'a'.repeat(64),
    width: 6000,
    height: 4000,
    ...overrides,
});

describe('schema', () => {
    it('refuses the same frame twice for one owner', async () => {
        const gallery = await insertGallery(db);
        await db.insertInto('photo').values(photo(gallery.id)).execute();

        await expect(
            db.insertInto('photo').values(photo(gallery.id, { original_path: '/data/originals/b.jpg' })).execute(),
        ).rejects.toThrow(/photo_owner_sha/);
    });

    it('allows at most one front-page photo per owner', async () => {
        const gallery = await insertGallery(db);
        await db.insertInto('photo').values(photo(gallery.id, { is_front_page: true })).execute();

        await expect(
            db.insertInto('photo').values(
                photo(gallery.id, { is_front_page: true, original_sha256: 'b'.repeat(64) }),
            ).execute(),
        ).rejects.toThrow(/photo_front_page/);
    });

    it('cascades deletes from gallery down to derivatives', async () => {
        const gallery = await insertGallery(db);
        const row = await db.insertInto('photo').values(photo(gallery.id)).returningAll().executeTakeFirstOrThrow();
        await db.insertInto('derivative').values({
            photo_id: row.id, width: 1600, format: 'avif', height: 1067, bytes: 100n, path: 'x/1600.avif',
        }).execute();

        await db.deleteFrom('gallery').where('id', '=', gallery.id).execute();

        const left = await db.selectFrom('derivative').selectAll().execute();
        expect(left).toEqual([]);
    });

    it('rejects a format outside the ladder', async () => {
        const gallery = await insertGallery(db);
        const row = await db.insertInto('photo').values(photo(gallery.id)).returningAll().executeTakeFirstOrThrow();

        await expect(
            db.insertInto('derivative').values({
                photo_id: row.id, width: 1600, format: 'tiff', height: 1067, bytes: 1n, path: 'x',
            }).execute(),
        ).rejects.toThrow();
    });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd origin && npm run db:test:up && npx vitest run tests/integration/schema.test.ts`
Expected: FAIL — cannot resolve `../../src/db/migrate`.

- [ ] **Step 4: Write the table types**

`origin/src/db/types.ts`:

```ts
import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface GalleryTable {
    id: Generated<string>;
    owner_id: string;
    title: string;
    is_public: Generated<boolean>;
    appwrite_row_id: string | null;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
}

export interface PhotoTable {
    id: Generated<string>;
    gallery_id: string;
    owner_id: string;
    title: Generated<string>;
    description: Generated<string>;
    position: Generated<number>;
    is_front_page: Generated<boolean>;
    thumbhash: string | null;

    original_path: string;
    original_bytes: ColumnType<bigint, bigint | number, bigint | number>;
    original_sha256: string;
    width: number;
    height: number;

    is_public: Generated<boolean>;
    ladder_ready: Generated<boolean>;

    /** Client-supplied correlation pointers. Never trusted for authorization. */
    appwrite_row_id: string | null;
    appwrite_file_id: string | null;

    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
}

export interface DerivativeTable {
    photo_id: string;
    width: number;
    format: 'avif' | 'webp' | 'jpeg';
    height: number;
    bytes: ColumnType<bigint, bigint | number, bigint | number>;
    path: string;
    created_at: Generated<Timestamp>;
}

export interface ExifTable {
    photo_id: string;
    captured_at: Timestamp | null;
    camera_make: string | null;
    camera_model: string | null;
    lens_model: string | null;
    focal_length: number | null;
    aperture: number | null;
    shutter: number | null;
    iso: number | null;
    raw: ColumnType<Record<string, unknown>, string, string>;
}

export interface VisibilityEventTable {
    id: Generated<string>;
    photo_id: string;
    is_public: boolean;
    at: Generated<Timestamp>;
}

export interface Database {
    gallery: GalleryTable;
    photo: PhotoTable;
    derivative: DerivativeTable;
    exif: ExifTable;
    visibility_event: VisibilityEventTable;
}
```

- [ ] **Step 5: Write the client and the migration**

`origin/src/db/client.ts`:

```ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { config } from '../config';
import type { Database } from './types';

export const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: config.databaseUrl }) }),
});
```

`origin/src/db/migrations/001_initial.ts`:

```ts
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        create table gallery (
            id              uuid primary key default gen_random_uuid(),
            owner_id        text not null,
            title           text not null,
            is_public       boolean not null default false,
            appwrite_row_id text unique,
            created_at      timestamptz not null default now(),
            updated_at      timestamptz not null default now()
        );

        create table photo (
            id               uuid primary key default gen_random_uuid(),
            gallery_id       uuid not null references gallery(id) on delete cascade,
            owner_id         text not null,
            title            text not null default '',
            description      text not null default '',
            position         int  not null default 0,
            is_front_page    boolean not null default false,
            thumbhash        text,

            original_path    text   not null,
            original_bytes   bigint not null,
            original_sha256  char(64) not null,
            width            int not null,
            height           int not null,

            is_public        boolean not null default false,
            ladder_ready     boolean not null default false,

            appwrite_row_id  text unique,
            appwrite_file_id text unique,

            created_at       timestamptz not null default now(),
            updated_at       timestamptz not null default now()
        );

        create unique index photo_owner_sha    on photo (owner_id, original_sha256);
        create index        photo_gallery_pos  on photo (gallery_id, position);
        create unique index photo_front_page   on photo (owner_id) where is_front_page;
        create index        photo_ladder_pending on photo (created_at) where not ladder_ready;

        create table derivative (
            photo_id   uuid not null references photo(id) on delete cascade,
            width      int  not null,
            format     text not null check (format in ('avif','webp','jpeg')),
            height     int  not null,
            bytes      bigint not null,
            path       text not null,
            created_at timestamptz not null default now(),
            primary key (photo_id, width, format)
        );

        create table exif (
            photo_id     uuid primary key references photo(id) on delete cascade,
            captured_at  timestamptz,
            camera_make  text,
            camera_model text,
            lens_model   text,
            focal_length numeric(6,2),
            aperture     numeric(4,2),
            shutter      numeric(10,6),
            iso          int,
            raw          jsonb not null
        );

        create table visibility_event (
            id        bigserial primary key,
            photo_id  uuid not null references photo(id) on delete cascade,
            is_public boolean not null,
            at        timestamptz not null default now()
        );
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
        drop table if exists visibility_event, exif, derivative, photo, gallery cascade;
    `.execute(db);
}
```

`origin/src/db/migrate.ts`:

```ts
import { Migrator, type Kysely } from 'kysely';

import { db as defaultDb } from './client';
import type { Database } from './types';
import * as m001 from './migrations/001_initial';

/**
 * Migrations are bundled as an object rather than read off disk, so the
 * compiled image needs no migration directory and the test suite can run the
 * same code path against a throwaway database.
 */
const migrations = { '001_initial': m001 };

export async function migrateToLatest(target: Kysely<Database> = defaultDb): Promise<void> {
    const migrator = new Migrator({
        db: target,
        provider: { getMigrations: async () => migrations },
    });

    const { error, results } = await migrator.migrateToLatest();
    for (const result of results ?? []) {
        console.log(`[migrate] ${result.status} ${result.migrationName}`);
    }
    if (error) throw error;
}

// Allow `npm run migrate` as a standalone entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
    await migrateToLatest();
    await defaultDb.destroy();
}
```

- [ ] **Step 6: Run the schema tests and watch them pass**

Run: `cd origin && DATABASE_URL=postgres://origin:origin@localhost:55432/origin_test npx vitest run tests/integration/schema.test.ts`
Expected: PASS, 4 tests. `origin/src/index.ts` now compiles: `npx tsc -b`.

- [ ] **Step 7: Commit**

```bash
git add origin/
git commit -m "feat(origin): postgres schema and migration runner"
```

---

### Task 3: Storage layer — paths, atomic writes, hardlinks, visibility moves

**Files:**
- Create: `origin/src/storage.ts`
- Test: `origin/tests/integration/storage.test.ts`

**Interfaces:**
- Consumes: `config.dataDir`.
- Produces: `originalPath(photoId, ext)`, `publicDir(photoId)`, `stagingDir(photoId)`, `writeAtomic(path, data)`, `linkOriginalPublic(photoId, originalPath)`, `unlinkOriginalPublic(photoId, originalPath)`, `moveToStaging(photoId)`, `moveToPublic(photoId)`, `removeAll(photoId, originalPath)`.

- [ ] **Step 1: Write the failing storage test**

`origin/tests/integration/storage.test.ts`:

```ts
import { mkdtemp, readFile, stat, writeFile, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let dataDir: string;

beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'origin-storage-'));
    vi.resetModules();
    vi.doMock('../../src/config', () => ({ config: { dataDir } }));
});

async function load() {
    return import('../../src/storage');
}

describe('writeAtomic', () => {
    it('leaves no temporary file behind', async () => {
        const { writeAtomic } = await load();
        const target = join(dataDir, 'thing.bin');

        await writeAtomic(target, Buffer.from('hello'));

        expect(await readFile(target, 'utf8')).toBe('hello');
        expect(await readdir(dataDir)).toEqual(['thing.bin']);
    });
});

describe('linkOriginalPublic', () => {
    it('shares an inode with the archive rather than copying', async () => {
        const { linkOriginalPublic, originalPath } = await load();
        const archive = originalPath('photo-1', '.jpg');
        await mkdir(join(dataDir, 'originals'), { recursive: true });
        await writeFile(archive, 'pixels');

        const served = await linkOriginalPublic('photo-1', archive);

        expect((await stat(served)).ino).toBe((await stat(archive)).ino);
    });
});

describe('visibility moves', () => {
    it('round-trips a photo between public and staging', async () => {
        const { moveToPublic, moveToStaging, publicDir, stagingDir, writeAtomic } = await load();
        await writeAtomic(join(publicDir('photo-1'), '1600.avif'), Buffer.from('x'));

        await moveToStaging('photo-1');
        await expect(stat(publicDir('photo-1'))).rejects.toThrow();
        expect(await readdir(stagingDir('photo-1'))).toEqual(['1600.avif']);

        await moveToPublic('photo-1');
        expect(await readdir(publicDir('photo-1'))).toEqual(['1600.avif']);
    });

    it('is a no-op when the source directory is already absent', async () => {
        const { moveToStaging } = await load();
        await expect(moveToStaging('never-existed')).resolves.toBeUndefined();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/integration/storage.test.ts`
Expected: FAIL — cannot resolve `../../src/storage`.

- [ ] **Step 3: Implement the storage module**

`origin/src/storage.ts`:

```ts
import { constants } from 'node:fs';
import { access, mkdir, open, rename, rm, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { config } from './config';

/**
 * Every path the service touches, and the only code that moves a file between
 * "served" and "not served".
 *
 * Privacy here is a filesystem question, not an application one: `caddy` is
 * pointed at `public/` and has no route into `staging/`, so a photo is private
 * precisely when its directory is not under `public/`. Nothing else needs to be
 * correct for that to hold.
 */

const originalsRoot = () => join(config.dataDir, 'originals');
const publicRoot = () => join(config.dataDir, 'public');
const stagingRoot = () => join(config.dataDir, 'staging');

export const originalPath = (photoId: string, ext: string) => join(originalsRoot(), `${photoId}${ext}`);
export const publicDir = (photoId: string) => join(publicRoot(), photoId);
export const stagingDir = (photoId: string) => join(stagingRoot(), photoId);

const exists = (path: string) => access(path, constants.F_OK).then(() => true, () => false);

/**
 * Writes through a temporary file and renames into place, so a reader never
 * observes a half-written derivative or a manifest listing a file that is still
 * being encoded.
 */
export async function writeAtomic(path: string, data: Buffer): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;

    const handle = await open(tmp, 'w');
    try {
        await handle.writeFile(data);
        await handle.sync();
    } finally {
        await handle.close();
    }

    await rename(tmp, path);
}

/**
 * Exposes the archived original by hardlinking it into the served directory —
 * the same inode, so nothing is duplicated on disk and unlinking it later
 * cannot damage the archive.
 *
 * @returns the served path
 */
export async function linkOriginalPublic(photoId: string, archivePath: string): Promise<string> {
    const ext = archivePath.slice(archivePath.lastIndexOf('.'));
    const target = join(publicDir(photoId), `original${ext}`);

    await mkdir(publicDir(photoId), { recursive: true });
    try {
        const { link } = await import('node:fs/promises');
        await link(archivePath, target);
    } catch (error) {
        // Already linked from an earlier attempt: the desired state, not a failure.
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    return target;
}

export async function unlinkOriginalPublic(photoId: string, archivePath: string): Promise<void> {
    const ext = archivePath.slice(archivePath.lastIndexOf('.'));
    await unlink(join(publicDir(photoId), `original${ext}`)).catch(() => undefined);
}

async function move(from: string, to: string): Promise<void> {
    if (!(await exists(from))) return;
    await mkdir(dirname(to), { recursive: true });
    await rm(to, { recursive: true, force: true });
    await rename(from, to);
}

/** Stops serving a photo. The rename is atomic, so there is no partial window. */
export const moveToStaging = (photoId: string) => move(publicDir(photoId), stagingDir(photoId));

/** Starts serving a photo. Always the last step of going public. */
export const moveToPublic = (photoId: string) => move(stagingDir(photoId), publicDir(photoId));

/** Removes every artefact for a photo: served, staged, and archived. */
export async function removeAll(photoId: string, archivePath: string): Promise<void> {
    await rm(publicDir(photoId), { recursive: true, force: true });
    await rm(stagingDir(photoId), { recursive: true, force: true });
    await rm(archivePath, { force: true });
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd origin && npx vitest run tests/integration/storage.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add origin/
git commit -m "feat(origin): filesystem layer with atomic writes and hardlinked originals"
```

---

### Task 4: Ladder width selection and encoder settings

**Files:**
- Create: `origin/src/ladder.ts`
- Test: `origin/tests/unit/ladder.test.ts`

**Interfaces:**
- Consumes: nothing. Pure.
- Produces: `LADDER_WIDTHS: readonly [1600, 2560, 3840]`, `ladderWidths(originalWidth: number): number[]`, `FORMATS: readonly ['avif','webp','jpeg']`, `extensionFor(format): string`, `encodeOptions(format)`.

- [ ] **Step 1: Write the failing ladder test**

`origin/tests/unit/ladder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { encodeOptions, extensionFor, ladderWidths } from '../../src/ladder';

describe('ladderWidths', () => {
    it('gives a large original the full ladder', () => {
        expect(ladderWidths(6000)).toEqual([1600, 2560, 3840]);
    });

    it('caps at 3840 rather than emitting the original width as well', () => {
        expect(ladderWidths(4000)).toEqual([1600, 2560, 3840]);
    });

    it('tops out at the original width instead of upscaling', () => {
        expect(ladderWidths(2400)).toEqual([1600, 2400]);
    });

    it('gives a small original a single rung at its own width', () => {
        expect(ladderWidths(900)).toEqual([900]);
    });

    it('does not duplicate a width that is already a rung', () => {
        expect(ladderWidths(1600)).toEqual([1600]);
    });
});

describe('encodeOptions', () => {
    it('keeps full chroma on the lossy formats that support it', () => {
        expect(encodeOptions('avif')).toMatchObject({ chromaSubsampling: '4:4:4' });
        expect(encodeOptions('jpeg')).toMatchObject({ chromaSubsampling: '4:4:4', mozjpeg: true });
    });
});

describe('extensionFor', () => {
    it('uses .jpg rather than .jpeg on disk', () => {
        expect(extensionFor('jpeg')).toBe('.jpg');
        expect(extensionFor('avif')).toBe('.avif');
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/unit/ladder.test.ts`
Expected: FAIL — cannot resolve `../../src/ladder`.

- [ ] **Step 3: Implement the ladder module**

`origin/src/ladder.ts`:

```ts
/**
 * What sizes and formats a photograph is published in.
 *
 * Quality settings are deliberately generous: this exists because the previous
 * pipeline double-compressed everything, and a ladder that saved bytes at the
 * cost of visible artefacts would defeat the point. Full chroma in particular
 * is non-negotiable — 4:2:0 smears saturated edges, which is exactly the
 * artefact a photography site cannot afford.
 */

export const LADDER_WIDTHS = [1600, 2560, 3840] as const;
export const FORMATS = ['avif', 'webp', 'jpeg'] as const;

export type Format = (typeof FORMATS)[number];

/**
 * The rungs to generate for an original of a given width.
 *
 * Never upscales: rungs wider than the original are dropped, and the top rung
 * is the original's own width when that falls below the largest ladder step. A
 * 2400px original therefore yields 1600 and 2400 — which is why consumers must
 * read the manifest rather than assume a fixed set.
 */
export function ladderWidths(originalWidth: number): number[] {
    const below = LADDER_WIDTHS.filter((width) => width < originalWidth);
    const top = Math.min(originalWidth, LADDER_WIDTHS[LADDER_WIDTHS.length - 1]);

    return [...new Set([...below, top])].sort((a, b) => a - b);
}

/** `.jpg` on disk, `jpeg` in the database and the manifest. */
export function extensionFor(format: Format): string {
    return format === 'jpeg' ? '.jpg' : `.${format}`;
}

export function encodeOptions(format: Format) {
    switch (format) {
        case 'avif':
            return { quality: 58, effort: 4, chromaSubsampling: '4:4:4' as const };
        case 'webp':
            return { quality: 84, effort: 5 };
        case 'jpeg':
            return { quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' as const };
    }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd origin && npx vitest run tests/unit/ladder.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add origin/
git commit -m "feat(origin): ladder width selection and encoder settings"
```

---

### Task 5: EXIF extraction and normalisation

**Files:**
- Create: `origin/src/exif.ts`
- Test: `origin/tests/unit/exif.test.ts`

**Interfaces:**
- Consumes: `exifr`.
- Produces: `interface NormalisedExif { capturedAt: Date | null; cameraMake: string | null; cameraModel: string | null; lensModel: string | null; focalLength: number | null; aperture: number | null; shutter: number | null; iso: number | null; raw: Record<string, unknown> }` and `extractExif(buffer: Buffer): Promise<NormalisedExif>`.

- [ ] **Step 1: Write the failing EXIF test**

`origin/tests/unit/exif.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('exifr', () => ({
    default: {
        parse: vi.fn(async () => mockedExif),
    },
}));

let mockedExif: Record<string, unknown> | null = null;

async function extract(exif: Record<string, unknown> | null) {
    mockedExif = exif;
    vi.resetModules();
    const { extractExif } = await import('../../src/exif');
    return extractExif(Buffer.from(''));
}

describe('extractExif', () => {
    it('normalises a full block', async () => {
        const result = await extract({
            DateTimeOriginal: new Date('2026-04-02T09:15:00Z'),
            Make: 'FUJIFILM',
            Model: 'X-T5',
            LensModel: 'XF35mmF1.4 R',
            FocalLength: 35,
            FNumber: 1.4,
            ExposureTime: 0.008,
            ISO: 800,
        });

        expect(result.cameraModel).toBe('X-T5');
        expect(result.aperture).toBe(1.4);
        expect(result.shutter).toBeCloseTo(0.008);
        expect(result.iso).toBe(800);
        expect(result.capturedAt?.toISOString()).toBe('2026-04-02T09:15:00.000Z');
    });

    it('returns nulls for a file with no EXIF at all', async () => {
        const result = await extract(null);

        expect(result.cameraModel).toBeNull();
        expect(result.iso).toBeNull();
        expect(result.raw).toEqual({});
    });

    it('reads ISOSpeedRatings when a body did not write ISO', async () => {
        const result = await extract({ ISOSpeedRatings: 1600 });

        expect(result.iso).toBe(1600);
    });

    it('keeps GPS in raw, where it stays on the home server', async () => {
        const result = await extract({ latitude: 51.5, longitude: -0.12, Model: 'X-T5' });

        expect(result.raw).toMatchObject({ latitude: 51.5, longitude: -0.12 });
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/unit/exif.test.ts`
Expected: FAIL — cannot resolve `../../src/exif`.

- [ ] **Step 3: Implement the EXIF module**

`origin/src/exif.ts`:

```ts
import exifr from 'exifr';

/**
 * The technical metadata Appwrite's three display strings throw away.
 *
 * The typed columns are the ones worth querying — "everything above ISO 3200",
 * "every frame on the 35mm" — and `raw` keeps the rest, GPS included, so
 * nothing is lost. GPS stays here on the home server: it is deliberately never
 * written into a generated derivative.
 */
export interface NormalisedExif {
    capturedAt: Date | null;
    cameraMake: string | null;
    cameraModel: string | null;
    lensModel: string | null;
    focalLength: number | null;
    aperture: number | null;
    shutter: number | null;
    iso: number | null;
    raw: Record<string, unknown>;
}

const EMPTY: NormalisedExif = {
    capturedAt: null, cameraMake: null, cameraModel: null, lensModel: null,
    focalLength: null, aperture: null, shutter: null, iso: null, raw: {},
};

const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const str = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * Metadata is a nicety, not a requirement: a screenshot, a stripped file, or a
 * malformed block all come back as nulls rather than failing the ingest.
 */
export async function extractExif(buffer: Buffer): Promise<NormalisedExif> {
    let parsed: Record<string, unknown> | null = null;

    try {
        parsed = (await exifr.parse(buffer)) ?? null;
    } catch (error) {
        console.warn('[exif] parse failed, storing no metadata:', error);
        return EMPTY;
    }

    if (!parsed) return EMPTY;

    const captured = parsed.DateTimeOriginal ?? parsed.CreateDate;

    return {
        capturedAt: captured instanceof Date && !Number.isNaN(captured.valueOf()) ? captured : null,
        cameraMake: str(parsed.Make),
        cameraModel: str(parsed.Model),
        lensModel: str(parsed.LensModel),
        focalLength: num(parsed.FocalLength),
        aperture: num(parsed.FNumber),
        shutter: num(parsed.ExposureTime),
        iso: num(parsed.ISO) ?? num(parsed.ISOSpeedRatings),
        raw: parsed,
    };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd origin && npx vitest run tests/unit/exif.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add origin/
git commit -m "feat(origin): exif extraction and normalisation"
```

---

### Task 6: Authentication — Appwrite JWT plus owner allowlist

**Files:**
- Create: `origin/src/auth.ts`
- Test: `origin/tests/unit/auth.test.ts`

**Interfaces:**
- Consumes: `config.appwriteEndpoint`, `config.appwriteProjectId`, `config.ownerUserId`; `node-appwrite`.
- Produces: `requireOwner: MiddlewareHandler` (sets `c.set('ownerId', string)`), and `AuthError` with a `status` of 401 or 403.

- [ ] **Step 1: Write the failing auth test**

`origin/tests/unit/auth.test.ts`:

```ts
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountGet = vi.fn();

vi.mock('node-appwrite', () => ({
    Client: class {
        setEndpoint() { return this; }
        setProject() { return this; }
        setJWT() { return this; }
    },
    Account: class { get = accountGet; },
}));

vi.mock('../../src/config', () => ({
    config: { appwriteEndpoint: 'https://x/v1', appwriteProjectId: 'p', ownerUserId: 'owner123' },
}));

async function appWithGuard() {
    vi.resetModules();
    const { requireOwner } = await import('../../src/auth');
    const app = new Hono();
    app.use('/guarded', requireOwner);
    app.get('/guarded', (c) => c.json({ ownerId: c.get('ownerId') }));
    return app;
}

beforeEach(() => accountGet.mockReset());

describe('requireOwner', () => {
    it('rejects a request with no bearer token', async () => {
        const res = await (await appWithGuard()).request('/guarded');

        expect(res.status).toBe(401);
        expect(accountGet).not.toHaveBeenCalled();
    });

    it('rejects a JWT Appwrite will not accept', async () => {
        accountGet.mockRejectedValue(new Error('invalid token'));

        const res = await (await appWithGuard()).request('/guarded', {
            headers: { Authorization: 'Bearer nonsense' },
        });

        expect(res.status).toBe(401);
    });

    it('rejects a valid JWT belonging to someone other than the owner', async () => {
        accountGet.mockResolvedValue({ $id: 'someone-else' });

        const res = await (await appWithGuard()).request('/guarded', {
            headers: { Authorization: 'Bearer valid' },
        });

        expect(res.status).toBe(403);
    });

    it('admits the owner and exposes the verified id', async () => {
        accountGet.mockResolvedValue({ $id: 'owner123' });

        const res = await (await appWithGuard()).request('/guarded', {
            headers: { Authorization: 'Bearer valid' },
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ownerId: 'owner123' });
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/unit/auth.test.ts`
Expected: FAIL — cannot resolve `../../src/auth`.

- [ ] **Step 3: Implement the auth middleware**

`origin/src/auth.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import { Account, Client } from 'node-appwrite';

import { config } from './config';

/**
 * Identity comes from Appwrite, never from the request body.
 *
 * The browser mints a short-lived JWT with `account.createJWT()`; this verifies
 * it by asking Appwrite who it belongs to. That mirrors how the rest of the
 * codebase derives an owner — `createGallery` and `updateGalleryVisibility`
 * both read it from the authenticated session rather than trusting a
 * client-supplied id, which is what stops a tampered client attributing work to
 * someone else.
 *
 * A shared secret was rejected: shipped in the frontend bundle it would be a
 * credential published to every visitor.
 */

declare module 'hono' {
    interface ContextVariableMap {
        ownerId: string;
    }
}

export const requireOwner: MiddlewareHandler = async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const jwt = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!jwt) return c.json({ error: 'Missing bearer token' }, 401);

    let userId: string;
    try {
        const client = new Client()
            .setEndpoint(config.appwriteEndpoint)
            .setProject(config.appwriteProjectId)
            .setJWT(jwt);

        ({ $id: userId } = await new Account(client).get());
    } catch {
        // Deliberately opaque: distinguishing "expired" from "forged" tells an
        // attacker which half of the guess was right.
        return c.json({ error: 'Invalid token' }, 401);
    }

    if (userId !== config.ownerUserId) {
        console.warn(`[auth] rejected non-owner user ${userId}`);
        return c.json({ error: 'Forbidden' }, 403);
    }

    c.set('ownerId', userId);
    await next();
};
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd origin && npx vitest run tests/unit/auth.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add origin/
git commit -m "feat(origin): appwrite jwt verification with owner allowlist"
```

---

### Task 7: Ingest route — streaming upload, dedupe, rows

**Files:**
- Create: `origin/src/routes/ingest.ts`
- Modify: `origin/src/index.ts` (mount the route)
- Test: `origin/tests/integration/ingest.test.ts`

**Interfaces:**
- Consumes: `requireOwner` (Task 6), `originalPath`/`writeAtomic` (Task 3), `extractExif` (Task 5), `db` (Task 2).
- Produces: `ingest: Hono` mounting `POST /v1/ingest`, responding `201 { photoId, galleryId, ladderReady: false }`. Calls `scheduleTranscode(photoId)` from Task 8 — stub it in this task and wire it in the next.

**Spec amendment made here:** the design listed an `isPublic` field on the ingest request. It is dropped. The origin already holds the gallery's visibility in its own `gallery` row, so taking it from the client would be trusting a value it can read authoritatively. Update the spec's field table when this task lands.

- [ ] **Step 1: Write the failing ingest test**

`origin/tests/integration/ingest.test.ts`:

```ts
import { readFile, stat } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('../../src/auth', () => ({
    requireOwner: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
        c.set('ownerId', 'owner123');
        await next();
    },
}));

const scheduleTranscode = vi.fn();
vi.mock('../../src/transcode', () => ({ scheduleTranscode }));

import { migrateToLatest } from '../../src/db/migrate';
import { insertGallery, testDb, truncateAll } from './helpers';

const db = testDb();

async function jpeg(width: number, height: number): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 3, background: '#4477aa' } }).jpeg().toBuffer();
}

function form(file: Buffer, fields: Record<string, string>): FormData {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    body.append('file', new Blob([file], { type: 'image/jpeg' }), 'DSCF1234.jpg');
    return body;
}

let app: { request: (path: string, init?: RequestInit) => Promise<Response> };

beforeAll(async () => {
    await migrateToLatest(db);
    ({ ingest: app } = await import('../../src/routes/ingest')) as never;
});
beforeEach(async () => { await truncateAll(db); scheduleTranscode.mockReset(); });
afterAll(async () => { await db.destroy(); });

describe('POST /v1/ingest', () => {
    it('archives the original and records the photo', async () => {
        const gallery = await insertGallery(db);
        const file = await jpeg(4000, 3000);

        const res = await app.request('/v1/ingest', {
            method: 'POST',
            body: form(file, { galleryId: gallery.id, title: 'Low Tide', appwriteRowId: 'row1', appwriteFileId: 'file1' }),
        });

        expect(res.status).toBe(201);
        const { photoId } = await res.json();

        const row = await db.selectFrom('photo').selectAll().where('id', '=', photoId).executeTakeFirstOrThrow();
        expect(row.width).toBe(4000);
        expect(row.title).toBe('Low Tide');
        expect(row.ladder_ready).toBe(false);
        expect(row.appwrite_row_id).toBe('row1');
        expect((await stat(row.original_path)).size).toBe(file.length);
        expect(await readFile(row.original_path)).toEqual(file);
        expect(scheduleTranscode).toHaveBeenCalledWith(photoId);
    });

    it('is idempotent: the same frame twice yields one photo', async () => {
        const gallery = await insertGallery(db);
        const file = await jpeg(2000, 1500);

        const first = await app.request('/v1/ingest', { method: 'POST', body: form(file, { galleryId: gallery.id }) });
        const second = await app.request('/v1/ingest', { method: 'POST', body: form(file, { galleryId: gallery.id }) });

        expect(second.status).toBe(200);
        expect((await second.json()).photoId).toBe((await first.json()).photoId);

        const rows = await db.selectFrom('photo').selectAll().execute();
        expect(rows).toHaveLength(1);
    });

    it('refuses a gallery belonging to someone else', async () => {
        const gallery = await db.insertInto('gallery')
            .values({ owner_id: 'someone-else', title: 'Theirs', is_public: true })
            .returningAll().executeTakeFirstOrThrow();

        const res = await app.request('/v1/ingest', {
            method: 'POST', body: form(await jpeg(800, 600), { galleryId: gallery.id }),
        });

        expect(res.status).toBe(404);
    });

    it('rejects a payload that is not a decodable image', async () => {
        const gallery = await insertGallery(db);
        const body = new FormData();
        body.append('galleryId', gallery.id);
        body.append('file', new Blob([Buffer.from('not an image')], { type: 'image/jpeg' }), 'x.jpg');

        const res = await app.request('/v1/ingest', { method: 'POST', body });

        expect(res.status).toBe(415);
        expect(await db.selectFrom('photo').selectAll().execute()).toEqual([]);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/integration/ingest.test.ts`
Expected: FAIL — cannot resolve `../../src/routes/ingest`.

- [ ] **Step 3: Add the transcode stub so the import resolves**

`origin/src/transcode.ts` (replaced wholesale in Task 8):

```ts
export function scheduleTranscode(photoId: string): void {
    console.log(`[transcode] queued ${photoId}`);
}
```

- [ ] **Step 4: Implement the ingest route**

`origin/src/routes/ingest.ts`:

```ts
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import busboy from 'busboy';
import { Hono } from 'hono';
import sharp from 'sharp';

import { requireOwner } from '../auth';
import { config } from '../config';
import { db } from '../db/client';
import { extractExif } from '../exif';
import { originalPath } from '../storage';
import { scheduleTranscode } from '../transcode';

/**
 * Receiving an original.
 *
 * The file is streamed straight to disk and hashed on the way past: a 100MB
 * upload must never be held in memory, and the hash is what makes a retried
 * upload after a dropped connection idempotent rather than duplicating a frame.
 */

interface Upload {
    fields: Record<string, string>;
    tmpPath: string;
    bytes: number;
    sha256: string;
    filename: string;
    truncated: boolean;
}

/** How much of the file EXIF can live in. The block is always near the head. */
const EXIF_HEAD_BYTES = 128 * 1024;

function receive(req: Request, tmpDir: string, limitBytes: number): Promise<Upload> {
    return new Promise((resolve, reject) => {
        const parser = busboy({
            headers: { 'content-type': req.headers.get('content-type') ?? '' },
            limits: { files: 1, fileSize: limitBytes },
        });

        const fields: Record<string, string> = {};
        const tmpPath = join(tmpDir, `${randomUUID()}.upload`);
        const hash = createHash('sha256');
        let bytes = 0;
        let truncated = false;
        let filename = 'upload.jpg';
        let written: Promise<void> = Promise.resolve();

        parser.on('field', (name, value) => { fields[name] = value; });

        parser.on('file', (_name, stream, info) => {
            filename = info.filename || filename;
            stream.on('data', (chunk: Buffer) => { hash.update(chunk); bytes += chunk.length; });
            stream.on('limit', () => { truncated = true; });
            written = pipeline(stream, createWriteStream(tmpPath));
        });

        parser.on('error', reject);
        parser.on('close', () => {
            written
                .then(() => resolve({ fields, tmpPath, bytes, sha256: hash.digest('hex'), filename, truncated }))
                .catch(reject);
        });

        Readable.fromWeb(req.body as Parameters<typeof Readable.fromWeb>[0]).pipe(parser);
    });
}

async function readHead(path: string, length: number): Promise<Buffer> {
    const handle = await open(path, 'r');
    try {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
}

export const ingest = new Hono();

ingest.post('/v1/ingest', requireOwner, async (c) => {
    const ownerId = c.get('ownerId');
    const tmpDir = join(config.dataDir, 'tmp');
    await mkdir(tmpDir, { recursive: true });

    const upload = await receive(c.req.raw, tmpDir, config.maxUploadBytes);

    try {
        if (upload.truncated) {
            return c.json({ error: `File exceeds the ${config.maxUploadBytes} byte limit` }, 413);
        }

        const galleryId = upload.fields.galleryId;
        if (!galleryId) return c.json({ error: 'galleryId is required' }, 400);

        // Ownership is checked against the origin's own record, not a claim in
        // the request. A gallery the caller does not own is indistinguishable
        // from one that does not exist.
        const gallery = await db
            .selectFrom('gallery').selectAll()
            .where('id', '=', galleryId).where('owner_id', '=', ownerId)
            .executeTakeFirst();
        if (!gallery) return c.json({ error: 'Unknown gallery' }, 404);

        const existing = await db
            .selectFrom('photo').select(['id', 'gallery_id'])
            .where('owner_id', '=', ownerId).where('original_sha256', '=', upload.sha256)
            .executeTakeFirst();
        if (existing) {
            return c.json({ photoId: existing.id, galleryId: existing.gallery_id, ladderReady: false, duplicate: true });
        }

        const probe = await sharp(upload.tmpPath).metadata().catch(() => null);
        if (!probe?.width || !probe.height) return c.json({ error: 'Not a decodable image' }, 415);

        const exif = await extractExif(await readHead(upload.tmpPath, EXIF_HEAD_BYTES));

        const photoId = randomUUID();
        const archive = originalPath(photoId, extname(upload.filename).toLowerCase() || '.jpg');
        await mkdir(dirname(archive), { recursive: true });
        await rename(upload.tmpPath, archive);

        await db.transaction().execute(async (trx) => {
            await trx.insertInto('photo').values({
                id: photoId,
                gallery_id: gallery.id,
                owner_id: ownerId,
                title: upload.fields.title ?? '',
                description: upload.fields.description ?? '',
                position: Number(upload.fields.position ?? 0) || 0,
                thumbhash: upload.fields.thumbhash || null,
                original_path: archive,
                original_bytes: upload.bytes,
                original_sha256: upload.sha256,
                width: probe.width!,
                height: probe.height!,
                // Visibility follows the gallery the origin already knows about.
                is_public: gallery.is_public,
                appwrite_row_id: upload.fields.appwriteRowId || null,
                appwrite_file_id: upload.fields.appwriteFileId || null,
            }).execute();

            await trx.insertInto('exif').values({
                photo_id: photoId,
                captured_at: exif.capturedAt,
                camera_make: exif.cameraMake,
                camera_model: exif.cameraModel,
                lens_model: exif.lensModel,
                focal_length: exif.focalLength,
                aperture: exif.aperture,
                shutter: exif.shutter,
                iso: exif.iso,
                raw: JSON.stringify(exif.raw),
            }).execute();
        });

        scheduleTranscode(photoId);
        return c.json({ photoId, galleryId: gallery.id, ladderReady: false }, 201);
    } finally {
        // A successful ingest has already renamed this away; anything left is debris.
        await rm(upload.tmpPath, { force: true });
    }
});
```

- [ ] **Step 5: Mount the route**

In `origin/src/index.ts`, add the import and the mount beside `health`:

```ts
import { ingest } from './routes/ingest';
// …
app.route('/', ingest);
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `cd origin && npx vitest run tests/integration/ingest.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add origin/
git commit -m "feat(origin): streaming ingest with content-hash idempotency"
```

---

### Task 8: Transcode the ladder, hardlink the original, write the manifest

**Files:**
- Create: `origin/src/manifest.ts`
- Modify: `origin/src/transcode.ts` (replace the stub)
- Test: `origin/tests/integration/transcode.test.ts`

**Interfaces:**
- Consumes: `ladderWidths`, `FORMATS`, `extensionFor`, `encodeOptions` (Task 4); `writeAtomic`, `publicDir`, `stagingDir`, `linkOriginalPublic` (Task 3).
- Produces: `transcodePhoto(photoId: string): Promise<void>` and `scheduleTranscode(photoId: string): void`; `writeManifest(photoId: string): Promise<void>`.

- [ ] **Step 1: Write the failing transcode test**

`origin/tests/integration/transcode.test.ts`:

```ts
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { migrateToLatest } from '../../src/db/migrate';
import { insertGallery, testDb, truncateAll } from './helpers';

const db = testDb();
beforeAll(async () => { await migrateToLatest(db); });
beforeEach(async () => { await truncateAll(db); });
afterAll(async () => { await db.destroy(); });

/** Writes a real JPEG to the archive and inserts the row ingest would have made. */
async function seed(width: number, height: number, isPublic = true) {
    const { originalPath } = await import('../../src/storage');
    const gallery = await insertGallery(db, isPublic);
    const id = crypto.randomUUID();
    const path = originalPath(id, '.jpg');
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, await sharp({ create: { width, height, channels: 3, background: '#c33' } }).jpeg().toBuffer());

    await db.insertInto('photo').values({
        id, gallery_id: gallery.id, owner_id: 'owner123',
        original_path: path, original_bytes: 1n, original_sha256: id.replace(/-/g, '').padEnd(64, '0'),
        width, height, is_public: isPublic,
    }).execute();
    return { id, path };
}

describe('transcodePhoto', () => {
    it('writes every rung, hardlinks the original, then marks the photo ready', async () => {
        const { transcodePhoto } = await import('../../src/transcode');
        const { publicDir } = await import('../../src/storage');
        const { id, path } = await seed(4000, 3000);

        await transcodePhoto(id);

        const rows = await db.selectFrom('derivative').selectAll().where('photo_id', '=', id).execute();
        expect(rows).toHaveLength(9); // 3 widths x 3 formats
        for (const row of rows) expect((await stat(row.path)).size).toBeGreaterThan(0);

        const served = join(publicDir(id), 'original.jpg');
        expect((await stat(served)).ino).toBe((await stat(path)).ino);

        const photo = await db.selectFrom('photo').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
        expect(photo.ladder_ready).toBe(true);
    });

    it('does not upscale a small original', async () => {
        const { transcodePhoto } = await import('../../src/transcode');
        const { id } = await seed(1200, 800);

        await transcodePhoto(id);

        const widths = await db.selectFrom('derivative').select('width').distinct()
            .where('photo_id', '=', id).execute();
        expect(widths.map((w) => w.width)).toEqual([1200]);
    });

    it('strips GPS from derivatives while the archive keeps it', async () => {
        const { transcodePhoto } = await import('../../src/transcode');
        const { publicDir } = await import('../../src/storage');
        const { id } = await seed(2000, 1500);

        await transcodePhoto(id);

        const derivative = await sharp(join(publicDir(id), '1600.jpg')).metadata();
        expect(derivative.exif).toBeUndefined();
    });

    it('writes the manifest last and lists only files that exist', async () => {
        const { transcodePhoto } = await import('../../src/transcode');
        const { publicDir } = await import('../../src/storage');
        const { id } = await seed(4000, 3000);

        await transcodePhoto(id);

        const manifest = JSON.parse(await readFile(join(publicDir(id), 'manifest.json'), 'utf8'));
        expect(manifest.original.url).toMatch(/\/i\/.+\/original\.jpg$/);
        expect(manifest.derivatives).toHaveLength(9);
        for (const entry of manifest.derivatives) {
            const name = entry.url.split('/').pop();
            expect((await stat(join(publicDir(id), name))).size).toBe(entry.bytes);
        }
    });

    it('keeps a private photo entirely out of the served directory', async () => {
        const { transcodePhoto } = await import('../../src/transcode');
        const { publicDir, stagingDir } = await import('../../src/storage');
        const { id } = await seed(2000, 1500, false);

        await transcodePhoto(id);

        await expect(stat(publicDir(id))).rejects.toThrow();
        expect((await stat(join(stagingDir(id), 'manifest.json'))).size).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/integration/transcode.test.ts`
Expected: FAIL — `transcodePhoto` is not exported.

- [ ] **Step 3: Implement the manifest writer**

`origin/src/manifest.ts`:

```ts
import { basename, join } from 'node:path';

import { config } from './config';
import { db } from './db/client';
import { publicDir, stagingDir, writeAtomic } from './storage';

/**
 * The list of what actually exists for a photo.
 *
 * Consumers cannot assume a fixed ladder — upscaling is refused, so a 2400px
 * original has different rungs than a 6000px one. They cannot probe for files
 * either, because a miss is indistinguishable from a photo that is still
 * transcoding. So the ladder is published as a static file, written last, and
 * its absence is the "not ready" signal.
 */

export interface Manifest {
    photoId: string;
    original: { width: number; height: number; format: string; bytes: number; url: string };
    derivatives: { width: number; height: number; format: string; bytes: number; url: string }[];
}

const urlFor = (photoId: string, file: string) => `${config.publicBaseUrl}/i/${photoId}/${file}`;

export async function writeManifest(photoId: string): Promise<void> {
    const photo = await db.selectFrom('photo').selectAll().where('id', '=', photoId).executeTakeFirstOrThrow();
    const rows = await db.selectFrom('derivative').selectAll()
        .where('photo_id', '=', photoId)
        .orderBy('width').orderBy('format').execute();

    const originalFile = `original${photo.original_path.slice(photo.original_path.lastIndexOf('.'))}`;

    const manifest: Manifest = {
        photoId,
        original: {
            width: photo.width,
            height: photo.height,
            format: originalFile.slice(originalFile.lastIndexOf('.') + 1),
            bytes: Number(photo.original_bytes),
            url: urlFor(photoId, originalFile),
        },
        derivatives: rows.map((row) => ({
            width: row.width,
            height: row.height,
            format: row.format,
            bytes: Number(row.bytes),
            url: urlFor(photoId, basename(row.path)),
        })),
    };

    const dir = photo.is_public ? publicDir(photoId) : stagingDir(photoId);
    await writeAtomic(join(dir, 'manifest.json'), Buffer.from(JSON.stringify(manifest, null, 2)));
}
```

- [ ] **Step 4: Implement the transcoder**

`origin/src/transcode.ts` (replacing the stub):

```ts
import { join } from 'node:path';

import sharp from 'sharp';

import { db } from './db/client';
import { FORMATS, encodeOptions, extensionFor, ladderWidths, type Format } from './ladder';
import { writeManifest } from './manifest';
import { linkOriginalPublic, publicDir, stagingDir, writeAtomic } from './storage';

/**
 * Generating the ladder.
 *
 * This runs after the ingest response has been sent: encoding nine derivatives
 * from a 45-megapixel original takes tens of seconds, and Cloudflare kills a
 * proxied request at 100. Until it finishes there is no manifest, so consumers
 * fall back to the Appwrite copy — the same behaviour as the server being down,
 * reached by the same mechanism.
 */

async function encode(sourcePath: string, width: number, format: Format) {
    return sharp(sourcePath)
        // Bakes in EXIF orientation. Necessary because everything else is
        // stripped below, so an orientation tag would not survive to be honoured.
        .rotate()
        .resize({ width, kernel: 'lanczos3', withoutEnlargement: true })
        .toColorspace('srgb')
        // Colour must stay correct on wide-gamut displays, but nothing else
        // travels: sharp drops all other metadata unless asked, which is how
        // GPS stays on this server rather than in a public file.
        .keepIccProfile()[format](encodeOptions(format) as never)
        .toBuffer({ resolveWithObject: true });
}

export async function transcodePhoto(photoId: string): Promise<void> {
    const photo = await db.selectFrom('photo').selectAll().where('id', '=', photoId).executeTakeFirstOrThrow();
    const directory = photo.is_public ? publicDir(photoId) : stagingDir(photoId);

    for (const width of ladderWidths(photo.width)) {
        for (const format of FORMATS) {
            const { data, info } = await encode(photo.original_path, width, format);
            const path = join(directory, `${width}${extensionFor(format)}`);
            await writeAtomic(path, data);

            await db.insertInto('derivative')
                .values({ photo_id: photoId, width, format, height: info.height, bytes: data.length, path })
                .onConflict((oc) => oc.columns(['photo_id', 'width', 'format']).doUpdateSet({
                    height: info.height, bytes: data.length, path,
                }))
                .execute();
        }
    }

    if (photo.is_public) await linkOriginalPublic(photoId, photo.original_path);

    // Last, so the manifest can never advertise a file that is not on disk.
    await writeManifest(photoId);
    await db.updateTable('photo').set({ ladder_ready: true, updated_at: new Date() })
        .where('id', '=', photoId).execute();
}

/**
 * Fire-and-forget. A failure here is not a failed publish: the photo is already
 * live from its Appwrite copy, and reconciliation retries anything left with
 * `ladder_ready = false`.
 */
export function scheduleTranscode(photoId: string): void {
    void transcodePhoto(photoId).catch((error) => {
        console.error(`[transcode] ${photoId} failed, leaving for reconciliation:`, error);
    });
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `cd origin && npx vitest run tests/integration/transcode.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add origin/
git commit -m "feat(origin): background ladder transcode and manifest"
```

---

### Task 9: Gallery creation and the visibility cascade

**Files:**
- Create: `origin/src/routes/gallery.ts`
- Modify: `origin/src/index.ts` (mount)
- Test: `origin/tests/integration/visibility.test.ts`

**Interfaces:**
- Consumes: `requireOwner`, `db`, `moveToPublic`/`moveToStaging`/`linkOriginalPublic`/`unlinkOriginalPublic`.
- Produces: `gallery: Hono` mounting `POST /v1/gallery` (body `{ title, isPublic, appwriteRowId? }` → `201 { galleryId }`) and `PATCH /v1/gallery/:id/visibility` (body `{ isPublic }` → `200 { updated: number }`).

- [ ] **Step 1: Write the failing cascade test**

`origin/tests/integration/visibility.test.ts`:

```ts
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth', () => ({
    requireOwner: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
        c.set('ownerId', 'owner123'); await next();
    },
}));

import { migrateToLatest } from '../../src/db/migrate';
import { testDb, truncateAll } from './helpers';

const db = testDb();
beforeAll(async () => { await migrateToLatest(db); });
beforeEach(async () => { await truncateAll(db); });
afterAll(async () => { await db.destroy(); });

describe('PATCH /v1/gallery/:id/visibility', () => {
    it('stops serving every artefact when a gallery goes private, and resumes on the way back', async () => {
        const { gallery } = await import('../../src/routes/gallery');
        const { publicDir, stagingDir } = await import('../../src/storage');
        const { seedPublished } = await import('./seed');

        const { galleryId, photoId } = await seedPublished(db);
        expect((await stat(join(publicDir(photoId), 'manifest.json'))).size).toBeGreaterThan(0);

        const off = await gallery.request(`/v1/gallery/${galleryId}/visibility`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isPublic: false }),
        });

        expect(off.status).toBe(200);
        await expect(stat(publicDir(photoId))).rejects.toThrow();
        await expect(stat(join(publicDir(photoId), 'original.jpg'))).rejects.toThrow();
        expect((await stat(join(stagingDir(photoId), 'manifest.json'))).size).toBeGreaterThan(0);

        const row = await db.selectFrom('photo').selectAll().where('id', '=', photoId).executeTakeFirstOrThrow();
        expect(row.is_public).toBe(false);

        const events = await db.selectFrom('visibility_event').selectAll().where('photo_id', '=', photoId).execute();
        expect(events.map((e) => e.is_public)).toEqual([false]);

        const on = await gallery.request(`/v1/gallery/${galleryId}/visibility`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isPublic: true }),
        });

        expect(on.status).toBe(200);
        expect((await stat(join(publicDir(photoId), 'manifest.json'))).size).toBeGreaterThan(0);
        expect((await stat(join(publicDir(photoId), 'original.jpg'))).size).toBeGreaterThan(0);
    });

    it('refuses a gallery the caller does not own', async () => {
        const { gallery } = await import('../../src/routes/gallery');
        const theirs = await db.insertInto('gallery')
            .values({ owner_id: 'someone-else', title: 'Theirs', is_public: true })
            .returningAll().executeTakeFirstOrThrow();

        const res = await gallery.request(`/v1/gallery/${theirs.id}/visibility`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isPublic: false }),
        });

        expect(res.status).toBe(404);
    });
});
```

`origin/tests/integration/seed.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Kysely } from 'kysely';
import sharp from 'sharp';

import type { Database } from '../../src/db/types';

/** A gallery with one fully published photo: archive, ladder, hardlink, manifest. */
export async function seedPublished(db: Kysely<Database>, isPublic = true) {
    const { originalPath } = await import('../../src/storage');
    const { transcodePhoto } = await import('../../src/transcode');

    const gallery = await db.insertInto('gallery')
        .values({ owner_id: 'owner123', title: 'Seeded', is_public: isPublic })
        .returningAll().executeTakeFirstOrThrow();

    const photoId = crypto.randomUUID();
    const path = originalPath(photoId, '.jpg');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#282' } }).jpeg().toBuffer());

    await db.insertInto('photo').values({
        id: photoId, gallery_id: gallery.id, owner_id: 'owner123',
        original_path: path, original_bytes: 1n,
        original_sha256: photoId.replace(/-/g, '').padEnd(64, '0'),
        width: 2000, height: 1500, is_public: isPublic,
    }).execute();

    await transcodePhoto(photoId);
    return { galleryId: gallery.id, photoId };
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/integration/visibility.test.ts`
Expected: FAIL — cannot resolve `../../src/routes/gallery`.

- [ ] **Step 3: Implement the gallery routes**

`origin/src/routes/gallery.ts`:

```ts
import { Hono } from 'hono';

import { requireOwner } from '../auth';
import { db } from '../db/client';
import { writeManifest } from '../manifest';
import { linkOriginalPublic, moveToPublic, moveToStaging, unlinkOriginalPublic } from '../storage';

/**
 * Galleries, and the operation that decides who can see one.
 *
 * The cascade is the highest-risk code here: getting the order wrong reopens
 * the "private galleries are actually public" gap the project documents
 * closing. The invariant in both directions is that **the public artefact is
 * created last and removed first** — going private stops serving before the
 * database is touched, going public updates the database before anything is
 * exposed. Either way, no window exists in which a private photo is fetchable.
 */

export const gallery = new Hono();

gallery.post('/v1/gallery', requireOwner, async (c) => {
    const ownerId = c.get('ownerId');
    const { title, isPublic, appwriteRowId } = await c.req.json<{
        title?: string; isPublic?: boolean; appwriteRowId?: string;
    }>();

    if (!title?.trim()) return c.json({ error: 'title is required' }, 400);

    const row = await db.insertInto('gallery').values({
        owner_id: ownerId,
        title: title.trim(),
        is_public: isPublic ?? false,
        appwrite_row_id: appwriteRowId ?? null,
    }).returning('id').executeTakeFirstOrThrow();

    return c.json({ galleryId: row.id }, 201);
});

gallery.patch('/v1/gallery/:id/visibility', requireOwner, async (c) => {
    const ownerId = c.get('ownerId');
    const galleryId = c.req.param('id');
    const { isPublic } = await c.req.json<{ isPublic?: boolean }>();

    if (typeof isPublic !== 'boolean') return c.json({ error: 'isPublic must be a boolean' }, 400);

    const owned = await db.selectFrom('gallery').select('id')
        .where('id', '=', galleryId).where('owner_id', '=', ownerId).executeTakeFirst();
    if (!owned) return c.json({ error: 'Unknown gallery' }, 404);

    const photos = await db.selectFrom('photo').selectAll().where('gallery_id', '=', galleryId).execute();

    for (const photo of photos) {
        if (isPublic) {
            // Rows first, exposure last.
            await db.updateTable('photo').set({ is_public: true, updated_at: new Date() })
                .where('id', '=', photo.id).execute();
            await moveToPublic(photo.id);
            await linkOriginalPublic(photo.id, photo.original_path);
        } else {
            // Exposure first, rows after. The rename is atomic, so serving stops
            // the instant it returns — before anything else has been touched.
            await moveToStaging(photo.id);
            await unlinkOriginalPublic(photo.id, photo.original_path);
            await db.updateTable('photo').set({ is_public: false, updated_at: new Date() })
                .where('id', '=', photo.id).execute();
        }

        await db.insertInto('visibility_event').values({ photo_id: photo.id, is_public: isPublic }).execute();

        // The manifest names URLs under whichever directory now holds the files.
        if (photo.ladder_ready) await writeManifest(photo.id);
    }

    await db.updateTable('gallery').set({ is_public: isPublic, updated_at: new Date() })
        .where('id', '=', galleryId).execute();

    return c.json({ updated: photos.length });
});
```

- [ ] **Step 4: Mount and run the tests**

Add to `origin/src/index.ts`:

```ts
import { gallery } from './routes/gallery';
// …
app.route('/', gallery);
```

Run: `cd origin && npx vitest run tests/integration/visibility.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add origin/
git commit -m "feat(origin): gallery creation and three-step visibility cascade"
```

---

### Task 10: Deleting a photo

**Files:**
- Create: `origin/src/routes/photo.ts`
- Modify: `origin/src/index.ts` (mount)
- Test: `origin/tests/integration/delete.test.ts`

**Interfaces:**
- Consumes: `requireOwner`, `db`, `removeAll` (Task 3).
- Produces: `photo: Hono` mounting `DELETE /v1/photo/:id` → `204`.

- [ ] **Step 1: Write the failing delete test**

`origin/tests/integration/delete.test.ts`:

```ts
import { stat } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth', () => ({
    requireOwner: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
        c.set('ownerId', 'owner123'); await next();
    },
}));

import { migrateToLatest } from '../../src/db/migrate';
import { testDb, truncateAll } from './helpers';

const db = testDb();
beforeAll(async () => { await migrateToLatest(db); });
beforeEach(async () => { await truncateAll(db); });
afterAll(async () => { await db.destroy(); });

describe('DELETE /v1/photo/:id', () => {
    it('removes every artefact and cascades the rows', async () => {
        const { photo } = await import('../../src/routes/photo');
        const { publicDir } = await import('../../src/storage');
        const { seedPublished } = await import('./seed');
        const { photoId } = await seedPublished(db);

        const archive = (await db.selectFrom('photo').select('original_path')
            .where('id', '=', photoId).executeTakeFirstOrThrow()).original_path;

        const res = await photo.request(`/v1/photo/${photoId}`, { method: 'DELETE' });

        expect(res.status).toBe(204);
        await expect(stat(publicDir(photoId))).rejects.toThrow();
        await expect(stat(archive)).rejects.toThrow();
        expect(await db.selectFrom('derivative').selectAll().where('photo_id', '=', photoId).execute()).toEqual([]);
        expect(await db.selectFrom('photo').selectAll().where('id', '=', photoId).execute()).toEqual([]);
    });

    it('refuses a photo the caller does not own', async () => {
        const { photo } = await import('../../src/routes/photo');
        const theirs = await db.insertInto('gallery')
            .values({ owner_id: 'someone-else', title: 'Theirs', is_public: true })
            .returningAll().executeTakeFirstOrThrow();
        const row = await db.insertInto('photo').values({
            gallery_id: theirs.id, owner_id: 'someone-else',
            original_path: '/nowhere.jpg', original_bytes: 1n, original_sha256: 'f'.repeat(64),
            width: 10, height: 10,
        }).returning('id').executeTakeFirstOrThrow();

        const res = await photo.request(`/v1/photo/${row.id}`, { method: 'DELETE' });

        expect(res.status).toBe(404);
        expect(await db.selectFrom('photo').selectAll().where('id', '=', row.id).execute()).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/integration/delete.test.ts`
Expected: FAIL — cannot resolve `../../src/routes/photo`.

- [ ] **Step 3: Implement the delete route**

`origin/src/routes/photo.ts`:

```ts
import { Hono } from 'hono';

import { requireOwner } from '../auth';
import { db } from '../db/client';
import { removeAll } from '../storage';

/**
 * Removing a photograph from the origin.
 *
 * Appwrite's row and file are not touched here: `deletePhoto` and
 * `deleteGallery` already remove them from the browser, and this service holds
 * no key that could. As with ingest and the visibility cascade, the studio
 * calls both sides.
 */

export const photo = new Hono();

photo.delete('/v1/photo/:id', requireOwner, async (c) => {
    const ownerId = c.get('ownerId');
    const photoId = c.req.param('id');

    const row = await db.selectFrom('photo').select(['id', 'original_path'])
        .where('id', '=', photoId).where('owner_id', '=', ownerId).executeTakeFirst();
    if (!row) return c.json({ error: 'Unknown photo' }, 404);

    // Files before rows: a row with no files renders as a broken image, while
    // files with no row are merely waste that reconciliation will find.
    await removeAll(row.id, row.original_path);
    await db.deleteFrom('photo').where('id', '=', row.id).execute();

    return c.body(null, 204);
});
```

- [ ] **Step 4: Mount, run, and watch the tests pass**

Add `app.route('/', photo)` to `origin/src/index.ts`.

Run: `cd origin && npx vitest run tests/integration/delete.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add origin/
git commit -m "feat(origin): photo deletion"
```

---

### Task 11: Reconciliation — the repair and fail-closed pass

**Files:**
- Create: `origin/src/reconcile.ts`
- Modify: `origin/src/index.ts` (run at boot, then hourly)
- Test: `origin/tests/integration/reconcile.test.ts`

**Interfaces:**
- Consumes: `transcodePhoto`, `moveToStaging`, `db`, `config.appwriteApiKey`, `node-appwrite` `TablesDB`.
- Produces: `reconcile(): Promise<ReconcileReport>` where `ReconcileReport = { transcoded: number; failedClosed: number; quarantined: number }`.

- [ ] **Step 1: Write the failing reconciliation test**

`origin/tests/integration/reconcile.test.ts`:

```ts
import { stat } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getRow = vi.fn();
vi.mock('node-appwrite', () => ({
    Client: class { setEndpoint() { return this; } setProject() { return this; } setKey() { return this; } },
    TablesDB: class { getRow = getRow; },
}));

import { migrateToLatest } from '../../src/db/migrate';
import { testDb, truncateAll } from './helpers';

const db = testDb();
beforeAll(async () => { await migrateToLatest(db); });
beforeEach(async () => { await truncateAll(db); getRow.mockReset(); });
afterAll(async () => { await db.destroy(); });

describe('reconcile', () => {
    it('finishes a ladder abandoned mid-transcode', async () => {
        const { reconcile } = await import('../../src/reconcile');
        const { seedPublished } = await import('./seed');
        const { photoId } = await seedPublished(db);

        await db.updateTable('photo').set({ ladder_ready: false }).where('id', '=', photoId).execute();
        await db.deleteFrom('derivative').where('photo_id', '=', photoId).execute();
        getRow.mockResolvedValue({ $id: 'row', isPublic: true });

        const report = await reconcile();

        expect(report.transcoded).toBe(1);
        const photo = await db.selectFrom('photo').selectAll().where('id', '=', photoId).executeTakeFirstOrThrow();
        expect(photo.ladder_ready).toBe(true);
    });

    it('fails closed when Appwrite says private and the origin is still serving', async () => {
        const { reconcile } = await import('../../src/reconcile');
        const { publicDir, stagingDir } = await import('../../src/storage');
        const { seedPublished } = await import('./seed');
        const { photoId } = await seedPublished(db);

        await db.updateTable('photo').set({ appwrite_row_id: 'row1' }).where('id', '=', photoId).execute();
        getRow.mockResolvedValue({ $id: 'row1', isPublic: false });

        const report = await reconcile();

        expect(report.failedClosed).toBe(1);
        await expect(stat(publicDir(photoId))).rejects.toThrow();
        expect((await stat(stagingDir(photoId))).isDirectory()).toBe(true);
        const photo = await db.selectFrom('photo').selectAll().where('id', '=', photoId).executeTakeFirstOrThrow();
        expect(photo.is_public).toBe(false);
    });

    it('leaves a photo alone when Appwrite agrees it is public', async () => {
        const { reconcile } = await import('../../src/reconcile');
        const { publicDir } = await import('../../src/storage');
        const { seedPublished } = await import('./seed');
        const { photoId } = await seedPublished(db);

        await db.updateTable('photo').set({ appwrite_row_id: 'row1' }).where('id', '=', photoId).execute();
        getRow.mockResolvedValue({ $id: 'row1', isPublic: true });

        const report = await reconcile();

        expect(report.failedClosed).toBe(0);
        expect((await stat(publicDir(photoId))).isDirectory()).toBe(true);
    });

    it('quarantines a photo whose Appwrite row has gone', async () => {
        const { reconcile } = await import('../../src/reconcile');
        const { publicDir } = await import('../../src/storage');
        const { seedPublished } = await import('./seed');
        const { photoId } = await seedPublished(db);

        await db.updateTable('photo').set({ appwrite_row_id: 'row1' }).where('id', '=', photoId).execute();
        getRow.mockRejectedValue(Object.assign(new Error('not found'), { code: 404 }));

        const report = await reconcile();

        expect(report.quarantined).toBe(1);
        await expect(stat(publicDir(photoId))).rejects.toThrow();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd origin && npx vitest run tests/integration/reconcile.test.ts`
Expected: FAIL — cannot resolve `../../src/reconcile`.

- [ ] **Step 3: Implement reconciliation**

`origin/src/reconcile.ts`:

```ts
import { Client, TablesDB } from 'node-appwrite';

import { config } from './config';
import { db } from './db/client';
import { moveToStaging } from './storage';
import { transcodePhoto } from './transcode';

/**
 * The repair pass. Every partial failure elsewhere is left for this rather than
 * unwound in place, which is why no write path needs its own rollback.
 *
 * It is also the safety net under the visibility cascade. Because the origin
 * holds no Appwrite write key, the browser is the only thing that can tell it a
 * gallery went private — and a browser closed mid-cascade never does. So this
 * reads the truth back from Appwrite with a read-only key and **fails closed**:
 * any disagreement moves the photo out of the served directory. A read key
 * cannot create, modify, or delete anything, so the net costs no blast radius.
 */

export interface ReconcileReport {
    transcoded: number;
    failedClosed: number;
    quarantined: number;
}

const PHOTOS_TABLE = 'photos';

function appwrite(): TablesDB {
    const client = new Client()
        .setEndpoint(config.appwriteEndpoint)
        .setProject(config.appwriteProjectId)
        .setKey(config.appwriteApiKey);
    return new TablesDB(client);
}

export async function reconcile(): Promise<ReconcileReport> {
    const report: ReconcileReport = { transcoded: 0, failedClosed: 0, quarantined: 0 };

    for (const photo of await db.selectFrom('photo').selectAll().where('ladder_ready', '=', false).execute()) {
        try {
            await transcodePhoto(photo.id);
            report.transcoded += 1;
        } catch (error) {
            console.error(`[reconcile] transcode of ${photo.id} failed again:`, error);
        }
    }

    const tables = appwrite();
    const linked = await db.selectFrom('photo').selectAll().where('appwrite_row_id', 'is not', null).execute();

    for (const photo of linked) {
        let remote: { isPublic?: boolean } | null = null;

        try {
            remote = await tables.getRow({
                databaseId: config.appwriteDatabaseId,
                tableId: PHOTOS_TABLE,
                rowId: photo.appwrite_row_id!,
            }) as { isPublic?: boolean };
        } catch (error) {
            // A row that is gone means the studio's delete only half landed.
            // Quarantine rather than delete: the archived original may be the
            // only copy of the photograph that still exists.
            console.warn(`[reconcile] no Appwrite row for ${photo.id}, quarantining:`, error);
            await moveToStaging(photo.id);
            report.quarantined += 1;
            continue;
        }

        if (photo.is_public && remote?.isPublic === false) {
            console.error(`[reconcile] SERVING A PRIVATE PHOTO: ${photo.id}. Failing closed.`);
            await moveToStaging(photo.id);
            await db.updateTable('photo').set({ is_public: false, updated_at: new Date() })
                .where('id', '=', photo.id).execute();
            await db.insertInto('visibility_event').values({ photo_id: photo.id, is_public: false }).execute();
            report.failedClosed += 1;
        }
    }

    console.log('[reconcile]', report);
    return report;
}
```

- [ ] **Step 4: Add the orphan and missing-file checks**

The spec's reconciliation list has two cases the pass above does not cover:
derivative rows whose file has vanished, and archived originals no reachable
row points at. Add to `origin/src/storage.ts`:

```ts
import { readdir } from 'node:fs/promises';

export const fileExists = (path: string) => exists(path);

/** Every file currently in the archive, as absolute paths. */
export async function listOriginals(): Promise<string[]> {
    const names = await readdir(originalsRoot()).catch(() => [] as string[]);
    return names.map((name) => join(originalsRoot(), name));
}

/**
 * Moves an unreferenced original out of the archive rather than deleting it.
 * An original nothing points at is still the only copy of a photograph.
 */
export async function quarantineOriginal(path: string): Promise<void> {
    const target = join(config.dataDir, 'quarantine', basename(path));
    await mkdir(dirname(target), { recursive: true });
    await rename(path, target);
}
```

…importing `basename` from `node:path`. Then extend `reconcile()`, before the
Appwrite audit:

```ts
// A derivative whose file has gone means an interrupted write or a manual
// deletion. Re-deriving is cheap and idempotent.
for (const photo of await db.selectFrom('photo').selectAll().where('ladder_ready', '=', true).execute()) {
    const rows = await db.selectFrom('derivative').select('path').where('photo_id', '=', photo.id).execute();
    const present = await Promise.all(rows.map((row) => fileExists(row.path)));

    if (rows.length === 0 || present.includes(false)) {
        console.warn(`[reconcile] ${photo.id} is missing derivative files, re-deriving`);
        await transcodePhoto(photo.id).catch((e) => console.error(`[reconcile] re-derive failed:`, e));
        report.transcoded += 1;
    }
}

const referenced = new Set(
    (await db.selectFrom('photo').select('original_path').execute()).map((row) => row.original_path),
);
for (const path of await listOriginals()) {
    if (referenced.has(path)) continue;
    console.warn(`[reconcile] archived original with no row, quarantining: ${path}`);
    await quarantineOriginal(path);
    report.quarantined += 1;
}
```

Add the matching tests to `origin/tests/integration/reconcile.test.ts`:

```ts
it('re-derives a photo whose derivative files were deleted', async () => {
    const { reconcile } = await import('../../src/reconcile');
    const { publicDir } = await import('../../src/storage');
    const { seedPublished } = await import('./seed');
    const { rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { photoId } = await seedPublished(db);

    await rm(join(publicDir(photoId), '1600.avif'));
    getRow.mockResolvedValue({ isPublic: true });

    const report = await reconcile();

    expect(report.transcoded).toBe(1);
    expect((await stat(join(publicDir(photoId), '1600.avif'))).size).toBeGreaterThan(0);
});

it('quarantines an archived original that no row points at', async () => {
    const { reconcile } = await import('../../src/reconcile');
    const { originalPath, quarantineOriginal: _q } = await import('../../src/storage');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname } = await import('node:path');

    const stray = originalPath('no-such-photo', '.jpg');
    await mkdir(dirname(stray), { recursive: true });
    await writeFile(stray, 'orphan');

    const report = await reconcile();

    expect(report.quarantined).toBe(1);
    await expect(stat(stray)).rejects.toThrow();
});
```

Run: `cd origin && npx vitest run tests/integration/reconcile.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Schedule it**

In `origin/src/index.ts`, after `migrateToLatest()`:

```ts
import { reconcile } from './reconcile';

const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;

// Boot-time pass first: a crash mid-transcode should be repaired before the
// service starts accepting new work.
await reconcile().catch((error) => console.error('[reconcile] boot pass failed:', error));
setInterval(() => { void reconcile().catch((e) => console.error('[reconcile] pass failed:', e)); },
    RECONCILE_INTERVAL_MS).unref();
```

- [ ] **Step 6: Run the whole suite**

Run: `cd origin && npx vitest run && npx tsc -b`
Expected: every unit and integration test passes; no type errors.

- [ ] **Step 7: Commit**

```bash
git add origin/
git commit -m "feat(origin): reconciliation pass with fail-closed visibility audit"
```

---

### Task 12: Deployment — Compose, Caddy, tunnel, operator guide

**Files:**
- Create: `origin/Dockerfile`, `origin/docker-compose.yml`, `origin/Caddyfile`, `origin/.env.example`, `origin/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a running stack at `https://images.photoframes.me`.

- [ ] **Step 1: Write the Dockerfile**

`origin/Dockerfile`:

```dockerfile
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# sharp ships prebuilt libvips binaries; --omit=dev keeps the image small.
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Write the Caddyfile**

`origin/Caddyfile`:

```
# Reads are served straight off disk. Nothing in this file can reach
# /data/staging — that omission is what makes a photo private.
:80 {
	handle_path /i/* {
		root * /data/public
		header Cache-Control "public, max-age=31536000, immutable"
		header X-Content-Type-Options "nosniff"
		header Access-Control-Allow-Origin "{env.ALLOWED_ORIGIN}"
		# The manifest is the one file that changes, exactly once, when the
		# ladder completes.
		@manifest path *.json
		header @manifest Cache-Control "public, max-age=60, stale-while-revalidate=86400"
		file_server
	}

	handle /v1/* {
		reverse_proxy origin:8080
	}

	handle /healthz {
		reverse_proxy origin:8080
	}

	respond 404
}
```

- [ ] **Step 3: Write the Compose file and env template**

`origin/docker-compose.yml`:

```yaml
# The home origin. Four containers, no inbound ports on the router:
# cloudflared dials out, and everything else is on the internal network.
#
#   cp .env.example .env && $EDITOR .env
#   docker compose up -d
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: origin
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: origin
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U origin -d origin"]
      interval: 5s
      timeout: 3s
      retries: 20

  origin:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgres://origin:${POSTGRES_PASSWORD}@postgres:5432/origin
      DATA_DIR: /data
    volumes:
      # One mount, not three: originals/ and public/ must share a filesystem
      # because the served original is a hardlink into the archive.
      - ./data/files:/data
    depends_on:
      postgres:
        condition: service_healthy

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    environment:
      ALLOWED_ORIGIN: ${PRIMARY_ALLOWED_ORIGIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/files/public:/data/public:ro
    depends_on:
      - origin

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - caddy
```

`origin/.env.example`:

```bash
# Postgres
POSTGRES_PASSWORD=change-me

# Public identity
PUBLIC_BASE_URL=https://images.photoframes.me
ALLOWED_ORIGINS=https://photoframes.me,http://localhost:5173
PRIMARY_ALLOWED_ORIGIN=https://photoframes.me

# The one Appwrite account permitted to ingest
OWNER_USER_ID=

# Appwrite. The key must be READ-ONLY: documents.read and files.read.
# This service never writes to Appwrite — the browser does.
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=
APPWRITE_DATABASE_ID=
APPWRITE_BUCKET_ID=

# Cloudflare Tunnel token from the Zero Trust dashboard
CLOUDFLARE_TUNNEL_TOKEN=

# Optional
MAX_UPLOAD_BYTES=104857600
```

- [ ] **Step 4: Write the operator guide**

`origin/README.md` must cover: first-time setup; creating the Cloudflare Tunnel and pointing `images.photoframes.me` at `caddy:80`; minting the read-only Appwrite key with exactly `documents.read` and `files.read`; backing up `data/files/originals` (3-2-1 — Appwrite holds only the 1200px copies, so this directory is the only place the originals exist) and `pg_dump` for the database; how to restore; and these two recorded risks:

- Cloudflare's free plan discourages serving large volumes of non-HTML media. Serving a photo archive may require a paid plan.
- The native original is served with its EXIF intact, GPS included. Stripping it is only possible before the first upload, because the archive is never rewritten.

- [ ] **Step 5: Bring the stack up and verify by hand**

The service is not wired to the frontend yet, so this checklist is what closes the sub-project. Run every step on the home host.

```bash
cd origin && cp .env.example .env   # fill it in
docker compose up -d
curl -s http://localhost/healthz    # {"ok":true,"db":"up"}
```

Then, with `JWT` from `account.createJWT()` on the owner account and `BASE=https://images.photoframes.me`:

```bash
# 1. Create a gallery
GID=$(curl -s -X POST $BASE/v1/gallery -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{"title":"Tunnel test","isPublic":true}' | jq -r .galleryId)

# 2. Ingest a real 40MP original
PID=$(curl -s -X POST $BASE/v1/ingest -H "Authorization: Bearer $JWT" \
  -F galleryId=$GID -F title=Test -F file=@/path/to/DSCF1234.jpg | jq -r .photoId)

# 3. Wait for the ladder, then confirm every advertised file exists
curl -s $BASE/i/$PID/manifest.json | jq -r '.derivatives[].url' | xargs -n1 curl -sI | grep -E 'HTTP/|cache-control'

# 4. The native original must be byte-identical to what went in
curl -s $BASE/i/$PID/original.jpg | sha256sum
sha256sum /path/to/DSCF1234.jpg

# 5. Going private must stop serving immediately
curl -s -X PATCH $BASE/v1/gallery/$GID/visibility -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{"isPublic":false}'
curl -sI $BASE/i/$PID/original.jpg   # expect 404
```

Also confirm by eye: a served derivative opened in an EXIF viewer has no GPS, and CORS responses name `https://photoframes.me` rather than `*`.

- [ ] **Step 6: Commit**

```bash
git add origin/
git commit -m "feat(origin): docker compose stack, caddy config, and operator guide"
```

---

## Done when

- `cd origin && npx vitest run` is green and `npx tsc -b` is clean.
- The Task 12 checklist has been run end-to-end against the live tunnel.
- Nothing under `src/` has changed and photoframes.me still serves entirely from Appwrite.

Sub-project 2 — the migration script, source-routing in the read path, the studio upload path, and fallback rendering — gets its own spec and plan.
