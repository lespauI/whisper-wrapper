import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface ModelOption {
  value: string;
  textPattern: RegExp;
  displayName: string;
}

export class SettingsPage extends BasePage {
  readonly settingsBtn: Locator;
  readonly settingsModal: Locator;
  readonly modalHeader: Locator;
  readonly modelSelect: Locator;
  readonly modelDescription: Locator;
  readonly languageSelect: Locator;
  readonly threadsSelect: Locator;
  readonly translateCheckbox: Locator;
  readonly saveSettingsBtn: Locator;
  readonly cancelSettingsBtn: Locator;
  readonly modelInfoBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.settingsBtn = page.locator('#settings-btn');
    this.settingsModal = page.locator('#settings-modal');
    this.modalHeader = page.locator('#settings-modal .modal-header h3');
    this.modelSelect = page.locator('#model-select');
    this.modelDescription = page.locator('#model-description');
    this.languageSelect = page.locator('#language-select');
    this.threadsSelect = page.locator('#threads-select');
    this.translateCheckbox = page.locator('#translate-checkbox');
    this.saveSettingsBtn = page.locator('#save-settings-btn');
    this.cancelSettingsBtn = page.locator('#cancel-settings-btn');
    this.modelInfoBtn = page.locator('#model-info-btn');
  }

  async openSettings() {
    await this.settingsBtn.click();
    await expect(this.settingsModal).toBeVisible();
    await expect(this.modalHeader).toContainText('Settings');
  }

  async waitForModelsToLoad(timeout = 1000) {
    await this.page.waitForTimeout(timeout);
  }

  async getModelOptions(): Promise<ModelOption[]> {
    return [
      { value: 'tiny', textPattern: /^[⬇✓]\s*Tiny.*39M params.*1GB.*10x speed/, displayName: 'Tiny' },
      { value: 'tiny.en', textPattern: /^[⬇✓]\s*Tiny English-only.*39M params.*1GB.*10x speed/, displayName: 'Tiny English-only' },
      { value: 'base', textPattern: /^[⬇✓]\s*Base.*74M params.*1GB.*7x speed/, displayName: 'Base' },
      { value: 'base.en', textPattern: /^[⬇✓]\s*Base English-only.*74M params.*1GB.*7x speed/, displayName: 'Base English-only' },
      { value: 'small', textPattern: /^[⬇✓]\s*Small.*244M params.*2GB.*4x speed/, displayName: 'Small' },
      { value: 'small.en', textPattern: /^[⬇✓]\s*Small English-only.*244M params.*2GB.*4x speed/, displayName: 'Small English-only' },
      { value: 'medium', textPattern: /^[⬇✓]\s*Medium.*769M params.*5GB.*2x speed/, displayName: 'Medium' },
      { value: 'medium.en', textPattern: /^[⬇✓]\s*Medium English-only.*769M params.*5GB.*2x speed/, displayName: 'Medium English-only' },
      { value: 'large', textPattern: /^[⬇✓]\s*Large.*1550M params.*10GB.*1x speed/, displayName: 'Large' },
      { value: 'turbo', textPattern: /^[⬇✓]\s*Turbo.*809M params.*6GB.*8x speed/, displayName: 'Turbo' }
    ];
  }

  async verifyModelOptions() {
    await expect(this.modelSelect).toBeVisible();
    await this.waitForModelsToLoad();
    
    const expectedModels = await this.getModelOptions();
    
    // Verify each expected model option exists with correct pattern
    for (const model of expectedModels) {
      const option = this.modelSelect.locator(`option[value="${model.value}"]`);
      await expect(option).toBeAttached();
      const optionText = await option.textContent();
      if (optionText) {
        expect(optionText).toMatch(model.textPattern);
      }
    }
    
    // Verify total number of options matches expected
    const allOptions = this.modelSelect.locator('option');
    await expect(allOptions).toHaveCount(expectedModels.length);
  }

  async selectModel(modelValue: string) {
    await this.modelSelect.selectOption(modelValue);
    await expect(this.modelSelect).toHaveValue(modelValue);
  }

  async selectAvailableModel(): Promise<string | null> {
    const options = await this.modelSelect.locator('option:not([disabled])').all();
    if (options.length > 0) {
      const value = await options[0].getAttribute('value');
      if (value) {
        await this.selectModel(value);
        return value;
      }
    }
    return null;
  }

  async verifyModelDescription(modelValue: string) {
    await expect(this.modelDescription).toBeVisible();
    const descriptionText = await this.modelDescription.textContent();
    expect(descriptionText).not.toBe('Select a model to see detailed information.');
    expect(descriptionText).toBeTruthy();
  }

  async getModelSelection(): Promise<string> {
    return await this.modelSelect.inputValue();
  }

  async saveSettings() {
    await this.saveSettingsBtn.click();
    // Note: Modal might stay open during download operations
    await this.page.waitForTimeout(2000);
  }

  async closeModal() {
    // Close modal if it's still open (for cleanup)
    if (await this.isModalVisible()) {
      await this.cancelSettings();
    }
  }

  async cancelSettings() {
    await this.cancelSettingsBtn.click();
    await expect(this.settingsModal).toBeHidden();
  }

  async isModalVisible(): Promise<boolean> {
    return await this.settingsModal.isVisible();
  }

  async configureSettings(config: {
    language?: string;
    threads?: string;
    translate?: boolean;
  }) {
    if (config.language) {
      await this.languageSelect.selectOption(config.language);
    }
    if (config.threads) {
      await this.threadsSelect.selectOption(config.threads);
    }
    if (config.translate !== undefined) {
      if (config.translate) {
        await this.translateCheckbox.check();
      } else {
        await this.translateCheckbox.uncheck();
      }
    }
  }

  async verifySettings(config: {
    model?: string;
    language?: string;
    threads?: string;
    translate?: boolean;
  }) {
    if (config.model) {
      await expect(this.modelSelect).toHaveValue(config.model);
    }
    if (config.language) {
      await expect(this.languageSelect).toHaveValue(config.language);
    }
    if (config.threads) {
      await expect(this.threadsSelect).toHaveValue(config.threads);
    }
    if (config.translate !== undefined) {
      if (config.translate) {
        await expect(this.translateCheckbox).toBeChecked();
      } else {
        await expect(this.translateCheckbox).not.toBeChecked();
      }
    }
  }
}