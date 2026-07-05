import { expect, type Page } from '@playwright/test';

/**
 * Cross-cutting app chrome + authenticated-area assertions: the navbar account
 * menu (logout) and the `/studio` landing that marks a successful login.
 */
export class AppShell {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /** Assert we've landed in the authenticated area (post-login redirect target). */
    async expectAuthenticated(): Promise<void> {
        await expect(this.page).toHaveURL(/\/studio$/);
        await expect(this.page.getByRole('heading', { name: 'Studio Workspace' })).toBeVisible();
    }

    /** Log out via the desktop account menu. */
    async logout(): Promise<void> {
        await this.page.getByRole('button', { name: 'Open account menu' }).click();
        await this.page.getByRole('menuitem', { name: 'Log Out' }).click();
    }
}
