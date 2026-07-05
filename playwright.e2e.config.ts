import { defineConfig, devices } from '@playwright/test';
// Side-effect import: this loads tests/e2e/2fa/.env.e2e.local and publishes its
// VITE_* / APPWRITE_* / MAILPIT_* values into process.env. The dev server that
// `webServer` spawns below inherits process.env, and Vite prioritises process.env
// VITE_* over .env — so the app points at LOCAL Appwrite even though the env file
// now lives under tests/ (where Vite would not auto-load it).
import './tests/e2e/2fa/config';

/**
 * E2E config for the LOCAL self-hosted stack (Appwrite + Mailpit).
 *
 * Difference from playwright.config.ts: the Vite dev server is started in
 * `--mode e2e`, so it loads `.env` + `.env.e2e.local` and the app talks to
 * the LOCAL Appwrite (http://localhost/v1) instead of Appwrite Cloud. Combined
 * with E2E_OTP_MODE=mailpit, the emailed OTP is delivered into Mailpit and read
 * back over its REST API — the whole 2FA login flow runs unattended.
 *
 * Scope is the 2FA suite only; the other e2e specs (upload, etc.) expect the
 * Cloud project's data/functions and are left on the default config.
 *
 * Run with:  npm run test:e2e:2fa:mailpit
 */
const PORT = 5180;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './tests/e2e/2fa',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'line' : 'list',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        // `--mode e2e` -> app points at local Appwrite (see .env.e2e.local).
        command: `npm run dev -- --mode e2e --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
