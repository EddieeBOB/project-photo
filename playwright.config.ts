import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. The suite runs against a real Vite dev server (started
 * automatically below) which loads the same VITE_APPWRITE_* values from `.env`
 * that the app uses, so the pages talk to the real Appwrite project.
 *
 * A fixed port is used so the base URL is stable and the Appwrite web platform
 * (registered for `localhost`) keeps accepting the requests.
 */
const PORT = 5180;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './tests/e2e',
    // The 2FA suite is a separate, self-contained pipeline: it runs against the
    // LOCAL self-hosted Appwrite + Mailpit stack via its own config
    // (playwright.e2e.config.ts) and command (`npm run test:e2e:2fa:mailpit`),
    // which starts the dev server in `--mode e2e`. This generic `test:e2e` starts
    // the dev server in the default mode (app -> Appwrite Cloud), so running the
    // 2FA specs here would mismatch (admin creates users locally, app logs in vs
    // Cloud). Exclude them so each suite runs against the backend it expects.
    testIgnore: '**/2fa/**',
    // Parallelise ACROSS files, but keep each file's tests serial (fullyParallel:
    // false). This matters for the upload spec: its tests share one fixture
    // account and create/delete real Appwrite resources, so they must not race —
    // keeping them in a single worker's serial queue preserves that, while the
    // stateless UI specs (auth-ui, home, navigation, theme) run concurrently.
    fullyParallel: false,
    workers: process.env.CI ? 2 : 4,
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
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
