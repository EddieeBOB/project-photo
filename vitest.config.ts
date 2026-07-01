import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        // Integration tests create/destroy real Appwrite resources and must not
        // run in parallel against the same project.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
        // The integration suite reads the real VITE_APPWRITE_* values Vitest
        // loads from .env (same as the app). Unit tests don't import the
        // Appwrite client, so they run fine with or without .env present.
    },
});
