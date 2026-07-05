import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
    mailpitAvailable,
    requestMailpitOtp,
    waitForMailpitOtp,
    mailpitUrl,
} from './mailpit';

/**
 * Email-OTP reader for the 2FA suite.
 *
 * The tricky bit: the app's second factor is a code EMAILED to the user, so the
 * test must obtain a fresh code at runtime. Which reader we use is chosen by
 * E2E_OTP_MODE:
 *
 *   'mailpit' (automated, CI-safe) — the local Appwrite stack sends through a
 *     Mailpit SMTP sink, and we read the code back over Mailpit's REST API. Zero
 *     human in the loop. See ./mailpit.ts + tests/e2e/2fa/docker/.
 *
 *   'manual' (local, human/MCP) — a file handshake: the test announces it is
 *     waiting (requestOtp), an out-of-band reader (the Gmail MCP driven by
 *     Claude, or a person) drops the 6 digits into .otp/codes/<slug>.txt
 *     (writeOtp), and waitForOtp polls that file. Used when running against the
 *     real Appwrite Cloud project, where email can't be intercepted.
 *
 *   unset — no reader; OTP-dependent specs skip themselves (see requireOtpReader
 *     in ./test.ts). Keeps `playwright test` green with no email backend at all.
 *
 * The public helpers (requestAndWaitForOtp / otpReaderAvailable) dispatch on the
 * mode, so the specs never change when the reader does.
 */

type OtpMode = 'mailpit' | 'manual' | 'none';

/** Resolve the configured reader strategy. */
export function otpMode(): OtpMode {
    const raw = (process.env.E2E_OTP_MODE || '').toLowerCase();
    if (raw === 'mailpit') return 'mailpit';
    // 'manual' file handshake is a local-only convenience, never in CI.
    if (raw === 'manual' && !process.env.CI) return 'manual';
    return 'none';
}

const OTP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.otp');
const REQ_DIR = resolve(OTP_DIR, 'requests');
const CODE_DIR = resolve(OTP_DIR, 'codes');

const slug = (email: string) => email.replace(/[^a-z0-9]/gi, '_').toLowerCase();

function ensureDirs() {
    mkdirSync(REQ_DIR, { recursive: true });
    mkdirSync(CODE_DIR, { recursive: true });
}

/**
 * True when a reader strategy is configured for this run. Sync (used by the
 * describe-level gate). For 'mailpit' this only checks that the mode is set —
 * actual reachability is verified by otpReaderReachable() so a mis-wired stack
 * skips with a clear reason instead of failing every OTP spec.
 */
export function otpReaderAvailable(): boolean {
    return otpMode() !== 'none';
}

/** Async liveness check. For 'mailpit', pings the REST API; 'manual' is always live. */
export async function otpReaderReachable(): Promise<boolean> {
    const mode = otpMode();
    if (mode === 'mailpit') return mailpitAvailable();
    return mode === 'manual';
}

export const OTP_SKIP_REASON =
    'No live email-OTP reader for this run. Either set E2E_OTP_MODE=mailpit and ' +
    `start the local Appwrite+Mailpit stack (Mailpit REST at ${mailpitUrl()}), or ` +
    'set E2E_OTP_MODE=manual locally so the Gmail MCP (or a human) supplies codes. ' +
    'Unset, these specs skip themselves.';

/** Announce that we are now awaiting a code for `email` and clear any stale one. */
export function requestOtp(email: string): void {
    ensureDirs();
    const codeFile = resolve(CODE_DIR, `${slug(email)}.txt`);
    if (existsSync(codeFile)) rmSync(codeFile);
    writeFileSync(
        resolve(REQ_DIR, `${slug(email)}.json`),
        JSON.stringify({ email, requestedAt: new Date().toISOString() }, null, 2),
    );
}

/** Out-of-band helper: drop a fetched code where waitForOtp will find it. */
export function writeOtp(email: string, code: string): void {
    ensureDirs();
    writeFileSync(resolve(CODE_DIR, `${slug(email)}.txt`), code.trim());
}

/** Poll for the code file until it holds 6 digits, or time out. */
export async function waitForOtp(
    email: string,
    {
        timeoutMs = Number(process.env.E2E_OTP_TIMEOUT_MS) || 120_000,
        pollMs = 2_000,
    }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<string> {
    ensureDirs();
    const codeFile = resolve(CODE_DIR, `${slug(email)}.txt`);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (existsSync(codeFile)) {
            const raw = readFileSync(codeFile, 'utf8').trim();
            const match = raw.match(/\d{6}/);
            if (match) return match[0];
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(
        `Timed out after ${timeoutMs}ms waiting for an OTP for ${email}. ` +
        `Expected 6 digits at ${codeFile}.`,
    );
}

/**
 * Announce + wait in one call, dispatching on the configured reader.
 * This is the only OTP entry point the specs use, so switching backends
 * (mailpit <-> manual) never touches a spec file.
 */
export async function requestAndWaitForOtp(email: string, opts?: { timeoutMs?: number }): Promise<string> {
    if (otpMode() === 'mailpit') {
        await requestMailpitOtp(email);
        return waitForMailpitOtp(email, opts);
    }
    // 'manual' (and any other value) falls back to the file handshake.
    requestOtp(email);
    return waitForOtp(email, opts);
}
