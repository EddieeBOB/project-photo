import { expect, type Page, type Locator } from '@playwright/test';

/**
 * The security section of `/account`. 2FA here is a single MUI <Switch> wired to
 * account.updateMFA (src/pages/Account.tsx). The switch is disabled until the
 * email is verified, so tests use pre-verified users.
 */
export class AccountSecurityPage {
    readonly page: Page;
    readonly mfaToggle: Locator;
    readonly errorAlert: Locator;

    constructor(page: Page) {
        this.page = page;
        // MUI Switch exposes role="switch" (NOT a plain labelled checkbox), so
        // getByRole('switch') resolves it; getByLabel does not.
        this.mfaToggle = page.getByRole('switch', { name: 'Toggle two-factor authentication' });
        this.errorAlert = page.getByRole('alert');
    }

    async goto(): Promise<void> {
        await this.page.goto('/account');
        // Anchor on things that actually exist: we must be on /account (not
        // redirected to /login) and the 2FA toggle must be present. Note the
        // "Two-Factor Authentication" label is a plain <Typography> (a <p>), not
        // a heading, so we do NOT assert on a heading role here.
        await expect(this.page).toHaveURL(/\/account$/);
        await expect(this.mfaToggle).toBeVisible();
    }

    async isEnabled(): Promise<boolean> {
        return this.mfaToggle.isChecked();
    }

    /**
     * Turn 2FA on and wait for the confirmation toast. Idempotent.
     *
     * The Switch is *controlled* and async: `checked` only flips after the
     * account.updateMFA + checkAuth round-trip. So we click once (not check(),
     * which would re-click on the not-yet-updated state) and wait for the toast,
     * then assert the final checked state.
     */
    async enable(): Promise<void> {
        await expect(this.mfaToggle).toBeEnabled();
        if (!(await this.isEnabled())) {
            await this.mfaToggle.click();
            await expect(this.page.getByText('Two-factor authentication enabled.')).toBeVisible();
        }
        await expect(this.mfaToggle).toBeChecked();
    }

    /** Turn 2FA off and wait for the confirmation toast. Idempotent. */
    async disable(): Promise<void> {
        await expect(this.mfaToggle).toBeEnabled();
        if (await this.isEnabled()) {
            await this.mfaToggle.click();
            await expect(this.page.getByText('Two-factor authentication disabled.')).toBeVisible();
        }
        await expect(this.mfaToggle).not.toBeChecked();
    }

    async expectEnabled(): Promise<void> {
        await expect(this.mfaToggle).toBeChecked();
    }

    async expectDisabled(): Promise<void> {
        await expect(this.mfaToggle).not.toBeChecked();
    }
}
