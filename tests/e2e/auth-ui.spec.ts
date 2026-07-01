import { test, expect } from '@playwright/test';
import { FIXTURE_EMAIL } from './utils/appwrite';

/**
 * Auth page UI states that don't need an email inbox: form rendering, the live
 * password-requirements checklist, submit gating, and the "email sent" /
 * "invalid link" screens for the recovery flow. The email-link *completion*
 * steps (verify / magic / reset with a real token) can't be E2E'd without an
 * inbox and are intentionally out of scope.
 */

test.describe('Login page', () => {
    test('renders the sign-in form and its links', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: 'Welcome Back.' })).toBeVisible();
        await expect(page.getByLabel('Email')).toBeVisible();
        await expect(page.getByLabel('Password')).toBeVisible();
        // Scope to the form — a "Log In" button also lives in the navbar.
        await expect(page.getByRole('main').getByRole('button', { name: 'Log In' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Email me a magic link' })).toBeVisible();
    });

    test('the "Sign Up" link goes to the signup page', async ({ page }) => {
        await page.goto('/login');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await expect(page).toHaveURL(/\/signup$/);
    });

    test('requesting a magic link without an email shows an error', async ({ page }) => {
        await page.goto('/login');
        await page.getByRole('button', { name: 'Email me a magic link' }).click();
        await expect(page.getByText('Enter your email first, then request a magic link.')).toBeVisible();
    });
});

test.describe('Sign-up page', () => {
    test('password checklist reacts to input and gates submission', async ({ page }) => {
        await page.goto('/signup');
        await expect(page.getByRole('heading', { name: 'Join Frame.' })).toBeVisible();

        // Scope to the form — a "Sign Up" button also lives in the navbar.
        const submit = page.getByRole('main').getByRole('button', { name: 'Sign Up' });
        // Disabled until the password satisfies every rule.
        await expect(submit).toBeDisabled();

        const password = page.getByLabel('Password');

        // A weak password keeps the button disabled; the checklist is visible.
        await password.fill('weak');
        await expect(page.getByText('At least 8 characters')).toBeVisible();
        await expect(submit).toBeDisabled();

        // A password meeting all rules enables the button.
        await page.getByLabel('Username').fill('e2e_tester');
        await page.getByLabel('Email').fill('eddieebob.0.o@gmail.com');
        await password.fill('Str0ng!Pass');
        await expect(submit).toBeEnabled();
    });

    test('the "Log In" link goes to the login page', async ({ page }) => {
        await page.goto('/signup');
        await page.getByRole('link', { name: 'Log In' }).click();
        await expect(page).toHaveURL(/\/login$/);
    });
});

test.describe('Forgot password', () => {
    test('shows the check-your-email screen after submitting', async ({ page }) => {
        await page.goto('/forgot-password');
        await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();

        // Appwrite's createRecovery throws for unknown emails, so use the real
        // fixture account to exercise the success screen (sends a real email to
        // the fixture inbox, which is expected).
        await page.getByLabel('Email').fill(FIXTURE_EMAIL);
        await page.getByRole('button', { name: 'Send Reset Link' }).click();

        await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Back to Login' })).toBeVisible();
    });
});

test.describe('Reset password', () => {
    test('shows the invalid-link state when token params are missing', async ({ page }) => {
        await page.goto('/reset');
        await expect(page.getByRole('heading', { name: 'Invalid Link' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Request a New Link' })).toBeVisible();
    });

    test('renders the new-password form and flags mismatched passwords', async ({ page }) => {
        // A well-formed (but fake) link so the form renders; we never submit it.
        await page.goto('/reset?userId=abc123&secret=fake-secret');
        await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible();

        await page.getByLabel('New password').fill('Str0ng!Pass');
        await page.getByLabel('Confirm password').fill('Different1!');
        await expect(page.getByText('Passwords do not match')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Update Password' })).toBeDisabled();

        // Matching + valid enables submission.
        await page.getByLabel('Confirm password').fill('Str0ng!Pass');
        await expect(page.getByRole('button', { name: 'Update Password' })).toBeEnabled();
    });
});
