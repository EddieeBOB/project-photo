/**
 * Mailpit-backed email-OTP reader for the 2FA suite.
 *
 * Mailpit (https://mailpit.axllent.org) is a tiny SMTP sink + REST API. When the
 * local Appwrite stack is configured to send through it (`_APP_SMTP_HOST=mailpit`,
 * see tests/e2e/2fa/docker/), every MFA email the app triggers lands in Mailpit
 * instead of a real inbox — and Playwright can read it back over HTTP with zero
 * human in the loop. That is what turns the previously manual OTP step (Gmail MCP
 * / file handshake in ./otp.ts) into a fully automated pipeline.
 *
 * This module speaks the small, stable slice of the Mailpit v1 REST API we need:
 *   GET  /api/v1/info            — health check
 *   GET  /api/v1/search?query=  — find messages for a recipient (newest first)
 *   GET  /api/v1/message/{ID}    — full message (plaintext body -> OTP)
 *   DELETE /api/v1/messages      — clear read messages (avoid stale codes)
 *
 * It intentionally mirrors the shape of ./otp.ts (requestOtp / waitForOtp) so the
 * two readers are interchangeable behind the E2E_OTP_MODE switch.
 */

/**
 * Base URL of Mailpit's HTTP/REST UI (Compose maps it to localhost:8025).
 * Read lazily so it reflects env populated by config.ts (../config) regardless
 * of module import order. Override with MAILPIT_URL.
 */
export function mailpitUrl(): string {
    return (
        process.env.MAILPIT_URL || process.env.E2E_MAILPIT_URL || 'http://localhost:8025'
    ).replace(/\/+$/, '');
}

/** A single 6-digit code, as Appwrite's email-OTP factor sends it. */
const OTP_RE = /\b(\d{6})\b/;

/** Per-email "don't accept anything older than this" cutoff (see requestMailpitOtp). */
const cutoffs = new Map<string, number>();

interface MailpitSummary {
    ID: string;
    Read: boolean;
    Created: string; // RFC3339
    Subject: string;
    Snippet: string;
    To: Array<{ Name: string; Address: string }>;
}

interface MailpitMessage {
    ID: string;
    Created?: string;
    Date?: string;
    Subject: string;
    Text?: string;
    HTML?: string;
    Snippet?: string;
    To: Array<{ Name: string; Address: string }>;
}

async function mailpitFetch(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${mailpitUrl()}${path}`, init);
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${body}`);
    }
    return res;
}

/** Fast reachability probe used by the gate + preflight. Never throws. */
export async function mailpitAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${mailpitUrl()}/api/v1/info`, {
            signal: AbortSignal.timeout(2_000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/** Delete every message currently in the mailbox. */
export async function mailpitClear(): Promise<void> {
    await mailpitFetch('/api/v1/messages', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
    });
}

/** Delete specific messages by id (best-effort; used after a code is consumed). */
async function mailpitDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
        await mailpitFetch('/api/v1/messages', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ IDs: ids }),
        });
    } catch {
        /* best-effort cleanup */
    }
}

/** Newest-first summaries addressed to `email`. */
async function searchTo(email: string): Promise<MailpitSummary[]> {
    const query = encodeURIComponent(`to:"${email}"`);
    const res = await mailpitFetch(`/api/v1/search?query=${query}&limit=30`);
    const data = (await res.json()) as { messages?: MailpitSummary[] };
    return data.messages ?? [];
}

async function messageBody(id: string): Promise<string> {
    const res = await mailpitFetch(`/api/v1/message/${id}`);
    const msg = (await res.json()) as MailpitMessage;
    // Prefer plaintext; fall back to a crudely de-tagged HTML body, then snippet.
    return msg.Text || (msg.HTML ? msg.HTML.replace(/<[^>]+>/g, ' ') : '') || msg.Snippet || '';
}

/**
 * Announce that we want the OTP for `email`.
 *
 * IMPORTANT: unlike the file-handshake reader, the MFA email here is triggered by
 * the login step that runs BEFORE this call, so the code may already be sitting
 * in the mailbox. We therefore must NOT clear it (that would delete the very code
 * we need — the original bug). Instead we record a generous timestamp cutoff and
 * rely on waitForMailpitOtp's newest-first scan + delete-after-read to stay
 * correct across same-user re-sends (e.g. the "reuse" spec): the consumed code is
 * deleted, and the next challenge's newer code is the one returned.
 *
 * The 5-minute window comfortably covers the delay between the email being sent
 * and this call (the test first waits for the MFA prompt to render) while still
 * excluding codes left over from a much earlier run.
 */
export async function requestMailpitOtp(email: string): Promise<void> {
    cutoffs.set(email.toLowerCase(), Date.now() - 5 * 60_000);
}

/**
 * Poll Mailpit until a message newer than the cutoff carries a 6-digit code for
 * `email`, then return that code (and delete the message so re-sends stay clean).
 */
export async function waitForMailpitOtp(
    email: string,
    {
        timeoutMs = Number(process.env.E2E_OTP_TIMEOUT_MS) || 60_000,
        pollMs = 1_000,
    }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<string> {
    const cutoff = cutoffs.get(email.toLowerCase()) ?? 0;
    const deadline = Date.now() + timeoutMs;
    let lastErr = '';

    while (Date.now() < deadline) {
        try {
            const summaries = await searchTo(email);
            // Newest first; only consider mail delivered after we started waiting.
            for (const s of summaries) {
                if (new Date(s.Created).getTime() < cutoff) continue;
                const inSnippet = s.Snippet.match(OTP_RE);
                const code = inSnippet ? inSnippet[1] : (await messageBody(s.ID)).match(OTP_RE)?.[1];
                if (code) {
                    await mailpitDelete([s.ID]);
                    return code;
                }
            }
        } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(
        `Timed out after ${timeoutMs}ms waiting for a Mailpit OTP for ${email} at ${mailpitUrl()}. ` +
        (lastErr ? `Last error: ${lastErr}. ` : '') +
        `Is the local Appwrite SMTP pointed at Mailpit and the mails worker running?`,
    );
}

/** Convenience: announce + wait in one call (matches otp.ts#requestAndWaitForOtp). */
export async function requestAndWaitForMailpitOtp(
    email: string,
    opts?: { timeoutMs?: number },
): Promise<string> {
    await requestMailpitOtp(email);
    return waitForMailpitOtp(email, opts);
}
