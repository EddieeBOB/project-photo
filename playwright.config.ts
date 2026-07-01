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
    // The upload spec creates/deletes real Appwrite resources, so specs must not
    // race each other against the same fixture account.
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
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
