import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OngoingTranslationPage extends BasePage {
  readonly page: Page;

  constructor(page: Page) {
    super(page);
    this.page = page;
  }

  // Translation Settings Selectors
  get translationEnabledCheckbox(): Locator {
    return this.page.locator('#ongoing-translation-enabled-checkbox');
  }

  get sourceLanguageSelect(): Locator {
    return this.page.locator('#translation-source-language');
  }

  get targetLanguageSelect(): Locator {
    return this.page.locator('#translation-target-language');
  }

  get translationModelSelect(): Locator {
    return this.page.locator('#translation-model-select');
  }

  get qualityPresetSelect(): Locator {
    return this.page.locator('#translation-quality-preset');
  }

  get chunkSizeInput(): Locator {
    return this.page.locator('#translation-chunk-size');
  }

  get overlapSizeInput(): Locator {
    return this.page.locator('#translation-overlap-size');
  }

  // Recording Tab Controls
  get recordingTab(): Locator {
    return this.page.locator('#record-tab');
  }

  get startRecordingBtn(): Locator {
    return this.page.locator('#start-recording-btn');
  }

  get stopRecordingBtn(): Locator {
    return this.page.locator('#stop-recording-btn');
  }

  get pauseRecordingBtn(): Locator {
    return this.page.locator('#pause-recording-btn');
  }

  // Live Translation Display
  get liveTranslationDisplay(): Locator {
    return this.page.locator('#live-translation-display');
  }

  get originalTextDisplay(): Locator {
    return this.page.locator('#original-text-display');
  }

  get translatedTextDisplay(): Locator {
    return this.page.locator('#translated-text-display');
  }

  get sourceLanguageDisplay(): Locator {
    return this.page.locator('#source-language-display');
  }

  get targetLanguageDisplay(): Locator {
    return this.page.locator('#target-language-display');
  }

  // Translation Controls
  get clearTranslationBtn(): Locator {
    return this.page.locator('#clear-translation-btn');
  }

  get copyOriginalBtn(): Locator {
    return this.page.locator('#copy-original-btn');
  }

  get copyTranslatedBtn(): Locator {
    return this.page.locator('#copy-translated-btn');
  }

  get exportSessionBtn(): Locator {
    return this.page.locator('#export-session-btn');
  }

  get saveSessionBtn(): Locator {
    return this.page.locator('#save-session-btn');
  }

  // Export Modal
  get exportModal(): Locator {
    return this.page.locator('#translation-export-modal');
  }

  get exportSRTRadio(): Locator {
    return this.page.locator('#export-srt');
  }

  get exportTXTRadio(): Locator {
    return this.page.locator('#export-txt');
  }

  get exportJSONRadio(): Locator {
    return this.page.locator('#export-json');
  }

  get exportCSVRadio(): Locator {
    return this.page.locator('#export-csv');
  }

  get confirmExportBtn(): Locator {
    return this.page.locator('#confirm-export-btn');
  }

  get cancelExportBtn(): Locator {
    return this.page.locator('#cancel-export-btn');
  }

  // Save Session Modal
  get saveSessionModal(): Locator {
    return this.page.locator('#session-save-modal');
  }

  get sessionNameInput(): Locator {
    return this.page.locator('#session-name-input');
  }

  get sessionDescriptionInput(): Locator {
    return this.page.locator('#session-description-input');
  }

  get confirmSaveBtn(): Locator {
    return this.page.locator('#confirm-save-btn');
  }

  get cancelSaveBtn(): Locator {
    return this.page.locator('#cancel-save-btn');
  }

  // Settings Button and Modal
  get settingsBtn(): Locator {
    return this.page.locator('#settings-btn');
  }

  get settingsModal(): Locator {
    return this.page.locator('#settings-modal');
  }

  get saveSettingsBtn(): Locator {
    return this.page.locator('#save-settings-btn');
  }

  // Status and Error Indicators
  get translationStatus(): Locator {
    return this.page.locator('#translation-service-status');
  }

  get errorNotifications(): Locator {
    return this.page.locator('.translation-error-notification');
  }

  get sentenceSegments(): Locator {
    return this.page.locator('.sentence-segment');
  }

  // Helper Methods

  /**
   * Navigate to record tab and ensure it's active
   */
  async ensureRecordingTabActive(): Promise<void> {
    await this.switchTab('record');
    await this.verifyTabIsActive('record');
  }

  /**
   * Open settings and navigate to translation settings
   */
  async openTranslationSettings(): Promise<void> {
    await this.settingsBtn.click();
    await expect(this.settingsModal).toBeVisible();
    
    // Wait for translation settings to be visible
    await expect(this.translationEnabledCheckbox).toBeVisible();
  }

  /**
   * Enable ongoing translation with specified settings
   */
  async enableOngoingTranslation(settings: {
    sourceLanguage?: string;
    targetLanguage?: string;
    model?: string;
    qualityPreset?: string;
  } = {}): Promise<void> {
    await this.openTranslationSettings();
    
    // Enable translation
    await this.translationEnabledCheckbox.check();
    
    // Configure settings if provided
    if (settings.sourceLanguage) {
      await this.sourceLanguageSelect.selectOption(settings.sourceLanguage);
    }
    
    if (settings.targetLanguage) {
      await this.targetLanguageSelect.selectOption(settings.targetLanguage);
    }
    
    if (settings.model) {
      await this.translationModelSelect.selectOption(settings.model);
    }
    
    if (settings.qualityPreset) {
      await this.qualityPresetSelect.selectOption(settings.qualityPreset);
    }
    
    // Save settings
    await this.saveSettingsBtn.click();
    
    // Wait for settings modal to close
    await expect(this.settingsModal).toBeHidden();
  }

  /**
   * Disable ongoing translation
   */
  async disableOngoingTranslation(): Promise<void> {
    await this.openTranslationSettings();
    await this.translationEnabledCheckbox.uncheck();
    await this.saveSettingsBtn.click();
    await expect(this.settingsModal).toBeHidden();
  }

  /**
   * Start recording with translation enabled
   */
  async startRecordingWithTranslation(): Promise<void> {
    await this.ensureRecordingTabActive();
    await expect(this.startRecordingBtn).toBeVisible();
    await this.startRecordingBtn.click();
    
    // Wait for recording to start
    await expect(this.stopRecordingBtn).toBeVisible();
    await expect(this.liveTranslationDisplay).toBeVisible();
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    await expect(this.stopRecordingBtn).toBeVisible();
    await this.stopRecordingBtn.click();
    
    // Wait for recording to stop
    await expect(this.startRecordingBtn).toBeVisible();
  }

  /**
   * Wait for sentence segments to appear
   */
  async waitForSentenceSegments(minCount: number = 1, timeout: number = 30000): Promise<void> {
    await expect(this.sentenceSegments).toHaveCount(minCount, { timeout });
  }

  /**
   * Get text content from original display
   */
  async getOriginalText(): Promise<string> {
    const segments = await this.originalTextDisplay.locator('.sentence-text').all();
    const texts = await Promise.all(segments.map(segment => segment.textContent()));
    return texts.filter(text => text).join(' ');
  }

  /**
   * Get text content from translated display
   */
  async getTranslatedText(): Promise<string> {
    const segments = await this.translatedTextDisplay.locator('.sentence-text').all();
    const texts = await Promise.all(segments.map(segment => segment.textContent()));
    return texts.filter(text => text).join(' ');
  }

  /**
   * Verify translation display is showing content
   */
  async verifyTranslationDisplayActive(): Promise<void> {
    await expect(this.liveTranslationDisplay).toBeVisible();
    await expect(this.originalTextDisplay).toBeVisible();
    await expect(this.translatedTextDisplay).toBeVisible();
  }

  /**
   * Clear translation display
   */
  async clearTranslationDisplay(): Promise<void> {
    await this.clearTranslationBtn.click();
    
    // Verify displays are cleared
    await expect(this.originalTextDisplay).toBeEmpty();
    await expect(this.translatedTextDisplay).toBeEmpty();
  }

  /**
   * Export session with specified format
   */
  async exportSession(format: 'srt' | 'txt' | 'json' | 'csv' = 'srt'): Promise<void> {
    await this.exportSessionBtn.click();
    await expect(this.exportModal).toBeVisible();
    
    // Select format
    const formatRadio = format === 'srt' ? this.exportSRTRadio :
                      format === 'txt' ? this.exportTXTRadio :
                      format === 'json' ? this.exportJSONRadio :
                      this.exportCSVRadio;
    
    await formatRadio.check();
    await this.confirmExportBtn.click();
    
    // Wait for modal to close
    await expect(this.exportModal).toBeHidden();
  }

  /**
   * Save session with name and description
   */
  async saveSession(name: string, description?: string): Promise<void> {
    await this.saveSessionBtn.click();
    await expect(this.saveSessionModal).toBeVisible();
    
    // Fill in session details
    await this.sessionNameInput.fill(name);
    if (description) {
      await this.sessionDescriptionInput.fill(description);
    }
    
    await this.confirmSaveBtn.click();
    
    // Wait for modal to close
    await expect(this.saveSessionModal).toBeHidden();
  }

  /**
   * Wait for translation to complete for a sentence
   */
  async waitForTranslationComplete(sentenceIndex: number = 0, timeout: number = 15000): Promise<void> {
    const translatedSegment = this.translatedTextDisplay.locator('.sentence-segment').nth(sentenceIndex);
    await expect(translatedSegment).toHaveClass(/translated/, { timeout });
  }

  /**
   * Verify error handling by checking error notifications
   */
  async verifyErrorNotification(expectedErrorType?: string): Promise<void> {
    await expect(this.errorNotifications).toBeVisible();
    
    if (expectedErrorType) {
      await expect(this.errorNotifications).toContainText(expectedErrorType);
    }
  }

  /**
   * Verify translation service status
   */
  async verifyTranslationServiceStatus(expectedStatus: 'active' | 'error' | 'warning'): Promise<void> {
    await expect(this.translationStatus).toHaveClass(new RegExp(`service-status-${expectedStatus}`));
  }

  /**
   * Simulate microphone input (for testing purposes)
   */
  async simulateMicrophoneInput(): Promise<void> {
    // This would require mocking microphone input in a real test environment
    // For now, we'll just trigger the recording events programmatically
    await this.page.evaluate(() => {
      // Simulate audio data events that would trigger transcription
      window.dispatchEvent(new CustomEvent('audio-data-available', {
        detail: { audioData: new ArrayBuffer(1024), timestamp: Date.now() }
      }));
    });
  }

  /**
   * Wait for live translation to process audio
   */
  async waitForLiveTranslationProcessing(timeout: number = 10000): Promise<void> {
    // Wait for transcription to appear
    await this.waitForSentenceSegments(1, timeout);
    
    // Wait for translation to complete
    await this.waitForTranslationComplete(0, timeout);
  }
}