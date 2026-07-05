#!/usr/bin/env node
/**
 * Preflight for the automated 2FA pipeline. Verifies the local stack is wired up
 * before `test:e2e:2fa:mailpit` burns a minute booting a dev server for nothing.
 *
 * Checks, from .env + .env.e2e.local (the same overlay config.ts uses):
 *   - Mailpit REST API is reachable          (MAILPIT_URL/api/v1/info)
 *   - local Appwrite endpoint is reachable   (APPWRITE_ENDPOINT or VITE_*)
 *   - an Appwrite server API key is present   (needed by the admin fixtures)
 *   - E2E_OTP_MODE=mailpit                     (else OTP specs would skip)
 *
 * No dependencies: plain Node (global fetch, fs). Exits non-zero on any failure.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // tests/e2e/2fa

function parseEnv(path) {
    const out = {};
    let raw = '';
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        return out;
    }
    for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        out[key] = val;
    }
    return out;
}

const env = {
    ...parseEnv(resolve(ROOT, '.env')),
    ...parseEnv(resolve(SUITE, '.env.e2e.local')),
    ...process.env,
};

const MAILPIT_URL = (env.MAILPIT_URL || 'http://localhost:8025').replace(/\/+$/, '');
const APPWRITE_ENDPOINT = (env.APPWRITE_ENDPOINT || env.VITE_APPWRITE_ENDPOINT || '').replace(/\/+$/, '');
const API_KEY = env.APPWRITE_API_KEY || '';
const OTP_MODE = (env.E2E_OTP_MODE || '').toLowerCase();

let ok = true;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
    ok = false;
    console.log(`  ✗ ${m}`);
};

async function reachable(url, timeoutMs = 3000) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        return res.status < 500;
    } catch {
        return false;
    }
}

console.log('\nPreflight: automated 2FA (Mailpit) pipeline\n');

// 1. OTP mode
if (OTP_MODE === 'mailpit') pass('E2E_OTP_MODE=mailpit');
else fail(`E2E_OTP_MODE is "${OTP_MODE || '(unset)'}", expected "mailpit" (set it in .env.e2e.local)`);

// 2. Mailpit
if (await reachable(`${MAILPIT_URL}/api/v1/info`)) pass(`Mailpit REST reachable at ${MAILPIT_URL}`);
else fail(`Mailpit REST NOT reachable at ${MAILPIT_URL} (run: npm run e2e:mailpit:up)`);

// 3. Appwrite endpoint
if (!APPWRITE_ENDPOINT) {
    fail('No APPWRITE_ENDPOINT / VITE_APPWRITE_ENDPOINT configured');
} else if (/cloud\.appwrite\.io/.test(APPWRITE_ENDPOINT)) {
    fail(`Endpoint is Appwrite CLOUD (${APPWRITE_ENDPOINT}); Mailpit can't intercept its email. ` +
        'Point .env.e2e.local at the LOCAL stack (http://localhost/v1).');
} else if (await reachable(APPWRITE_ENDPOINT)) {
    pass(`Local Appwrite reachable at ${APPWRITE_ENDPOINT}`);
} else {
    fail(`Appwrite NOT reachable at ${APPWRITE_ENDPOINT} (is the local stack up?)`);
}

// 4. API key
if (API_KEY) pass('APPWRITE_API_KEY present');
else fail('APPWRITE_API_KEY missing (server key with users.read/users.write)');

console.log(ok ? '\nAll checks passed. → npm run test:e2e:2fa:mailpit\n' : '\nPreflight failed. See tests/e2e/2fa/docker/README.md\n');
process.exit(ok ? 0 : 1);
