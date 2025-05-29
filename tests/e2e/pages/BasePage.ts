import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
    await this.waitForAppLoad();
  }

  async waitForAppLoad() {
    await expect(this.page.locator('.app-title')).toContainText('Whisper Wrapper');
  }

  // Common selectors
  get appTitle(): Locator {
    return this.page.locator('.app-title');
  }

  get footer(): Locator {
    return this.page.locator('.app-footer');
  }

  get statusText(): Locator {
    return this.page.locator('#status-text');
  }

  get appInfo(): Locator {
    return this.page.locator('.app-info span');
  }

  // Tab navigation
  async switchTab(tabName: 'upload' | 'record' | 'transcription') {
    await this.page.locator(`[data-tab="${tabName}"]`).click();
    await expect(this.page.locator(`[data-tab="${tabName}"]`)).toHaveClass(/active/);
  }

  async verifyTabIsActive(tabName: 'upload' | 'record' | 'transcription') {
    await expect(this.page.locator(`[data-tab="${tabName}"]`)).toHaveClass(/active/);
  }

  async verifyTabIsNotActive(tabName: 'upload' | 'record' | 'transcription') {
    await expect(this.page.locator(`[data-tab="${tabName}"]`)).not.toHaveClass(/active/);
  }

  async verifyFooterVisible() {
    await expect(this.footer).toBeVisible();
    await expect(this.statusText).toContainText('Ready');
    await expect(this.appInfo).toContainText('Powered by OpenAI Whisper');
  }
}