import { expect, type Page, type Locator } from '@playwright/test';

/**
 * The `/login` page. It has two modes driven by React state:
 *   - 'password' : email + password + "Log In"
 *   - 'mfa'      : the second-factor step (see TwoFactorPage)
 *
 * Selectors intentionally lean on accessible roles/labels that already exist in
 * src/pages/Login.tsx, so the suite works today with zero frontend changes. See
 * the README for the (optional) data-testids that would harden these further.
 */
export class LoginPage {
    readonly page: Page;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly errorAlert: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.getByLabel('Email');
        this.passwordInput = page.getByLabel('Password');
        // Scope to <main>: a "Log In" button also lives in the navbar.
        this.submitButton = page.getByRole('main').getByRole('button', { name: 'Log In' });
        // MUI <Alert> renders role="alert"; the MFA step also shows an info <Alert>
        // ("We sent a code…"), so scope to the error-severity one (MuiAlert-colorError)
        // to avoid a strict-mode match against two alerts.
        this.errorAlert = page.locator('[role="alert"].MuiAlert-colorError');
    }

    async goto(): Promise<void> {
        await this.page.goto('/login');
        await expect(this.page.getByRole('heading', { name: 'Welcome Back.' })).toBeVisible();
    }

    /** Fill credentials and submit the password step. */
    async submitCredentials(email: string, password: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    /** Assert we are still (or back) on the password step — no 2FA prompt shown. */
    async expectPasswordStep(): Promise<void> {
        await expect(this.page.getByRole('heading', { name: 'Welcome Back.' })).toBeVisible();
        await expect(this.page.getByLabel('Verification code')).toHaveCount(0);
    }

    /** Assert the app has advanced to the second-factor step. */
    async expectMfaPrompt(): Promise<void> {
        // Heading uses a curly apostrophe ("Verify It's You"); match loosely.
        await expect(this.page.getByRole('heading', { name: /Verify It.s You/ })).toBeVisible();
        await expect(this.page.getByLabel('Verification code')).toBeVisible();
    }

    async expectError(text?: string | RegExp): Promise<void> {
        await expect(this.errorAlert).toBeVisible();
        if (text) await expect(this.errorAlert).toContainText(text);
    }
}
