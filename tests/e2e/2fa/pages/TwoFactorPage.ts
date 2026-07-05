import { expect, type Page, type Locator } from '@playwright/test';

/**
 * The second-factor ("Verify It's You") step of `/login`. Rendered in the same
 * component as the password step once an email OTP challenge is created.
 */
export class TwoFactorPage {
    readonly page: Page;
    readonly codeInput: Locator;
    readonly verifyButton: Locator;
    readonly cancelButton: Locator;
    readonly errorAlert: Locator;

    constructor(page: Page) {
        this.page = page;
        this.codeInput = page.getByLabel('Verification code');
        this.verifyButton = page.getByRole('button', { name: 'Verify & Continue' });
        this.cancelButton = page.getByRole('button', { name: 'Cancel' });
        // Scope to the error-severity alert: the 2FA step also renders an info
        // <Alert> ("We sent a code…"), so a bare getByRole('alert') matches two.
        this.errorAlert = page.locator('[role="alert"].MuiAlert-colorError');
    }

    async expectVisible(): Promise<void> {
        await expect(this.page.getByRole('heading', { name: /Verify It.s You/ })).toBeVisible();
        await expect(this.codeInput).toBeVisible();
    }

    async enterCode(code: string): Promise<void> {
        await this.codeInput.fill(code);
    }

    async submit(): Promise<void> {
        await this.verifyButton.click();
    }

    async submitCode(code: string): Promise<void> {
        await this.enterCode(code);
        await this.submit();
    }

    /** Attempt to submit — used to prove the empty field blocks submission. */
    async tryEmptySubmit(): Promise<void> {
        await this.codeInput.fill('');
        await this.verifyButton.click();
    }

    /** Assert the field is still natively required (HTML validation, no bypass). */
    async expectCodeRequired(): Promise<void> {
        await expect(this.codeInput).toHaveJSProperty('required', true);
        const valid = await this.codeInput.evaluate((el: HTMLInputElement) => el.checkValidity());
        expect(valid).toBe(false);
    }

    async expectStillOnStep(): Promise<void> {
        await this.expectVisible();
    }

    async expectError(text?: string | RegExp): Promise<void> {
        await expect(this.errorAlert).toBeVisible();
        if (text) await expect(this.errorAlert).toContainText(text);
    }

    async cancel(): Promise<void> {
        await this.cancelButton.click();
    }
}
