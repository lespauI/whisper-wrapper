import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TranscriptionPage extends BasePage {
  readonly emptyState: Locator;
  readonly loadingState: Locator;
  readonly toolbar: Locator;
  readonly header: Locator;
  readonly toggleViewBtn: Locator;
  readonly clearDraftBtn: Locator;
  readonly status: Locator;
  readonly undoBtn: Locator;
  readonly redoBtn: Locator;
  readonly copyBtn: Locator;
  readonly exportDropdownBtn: Locator;
  readonly exportDropdown: Locator;
  readonly exportTxtBtn: Locator;
  readonly exportMdBtn: Locator;
  readonly exportJsonBtn: Locator;
  readonly transcriptionArea: Locator;
  readonly transcriptionResult: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emptyState = page.locator('#transcription-empty');
    this.loadingState = page.locator('#transcription-loading');
    this.toolbar = page.locator('.transcription-toolbar');
    this.header = page.locator('.transcription-header');
    this.toggleViewBtn = page.locator('#toggle-view-btn');
    this.clearDraftBtn = page.locator('#clear-draft-btn');
    this.status = page.locator('#transcription-status');
    this.undoBtn = page.locator('#undo-btn');
    this.redoBtn = page.locator('#redo-btn');
    this.copyBtn = page.locator('#copy-btn');
    this.exportDropdownBtn = page.locator('#export-dropdown-btn');
    this.exportDropdown = page.locator('#export-dropdown');
    this.exportTxtBtn = page.locator('#export-txt-btn');
    this.exportMdBtn = page.locator('#export-md-btn');
    this.exportJsonBtn = page.locator('#export-json-btn');
    this.transcriptionArea = page.locator('#transcription-result, .transcription-content, .transcription-area');
    this.transcriptionResult = page.locator('#transcription-result');
    this.exportButton = page.locator('#export-btn, .export-button, button:has-text("Export")');
  }

  async ensureTranscriptionTabActive() {
    await this.switchTab('transcription');
    await this.verifyTabIsActive('transcription');
  }

  async verifyEmptyState() {
    await expect(this.emptyState).toBeVisible();
    await expect(this.page.locator('.empty-icon')).toBeVisible();
    await expect(this.emptyState.locator('h4')).toContainText('No transcription yet');
    await expect(this.emptyState.locator('p')).toContainText('Upload a file or record audio to get started');
    
    // Verify features list
    await expect(this.page.locator('.empty-features h5')).toContainText('Features available:');
    await expect(this.page.locator('.empty-features ul')).toBeVisible();
  }

  async verifyLoadingStateHidden() {
    await expect(this.loadingState).toHaveClass(/hidden/);
    await expect(this.page.locator('.spinner')).toBeAttached();
    await expect(this.loadingState.locator('p')).toContainText('Transcribing audio...');
  }

  async verifyToolbar() {
    await expect(this.toolbar).toBeVisible();
    
    // Check toggle view button - text changes based on content availability
    await expect(this.toggleViewBtn).toBeVisible();
    const toggleText = await this.toggleViewBtn.textContent();
    expect(toggleText).toMatch(/Plain Text Only|Timestamped View/);
    
    await expect(this.clearDraftBtn).toBeVisible();
    await expect(this.clearDraftBtn).toContainText('🗑️ Clear');
    
    await expect(this.status).toBeVisible();
    await expect(this.status).toContainText('Ready to transcribe');
  }

  async verifyActionButtons() {
    await expect(this.header).toBeVisible();
    
    await expect(this.undoBtn).toBeVisible();
    await expect(this.undoBtn).toContainText('↶ Undo');
    await expect(this.undoBtn).toBeDisabled(); // Initially disabled
    
    await expect(this.redoBtn).toBeVisible();
    await expect(this.redoBtn).toContainText('↷ Redo');
    await expect(this.redoBtn).toBeDisabled(); // Initially disabled
    
    await expect(this.copyBtn).toBeVisible();
    await expect(this.copyBtn).toContainText('📋 Copy');
    
    await expect(this.exportDropdownBtn).toBeVisible();
    await expect(this.exportDropdownBtn).toContainText('💾 Export ▼');
  }

  async verifyExportDropdown() {
    // Initially hidden
    await expect(this.exportDropdown).toHaveClass(/hidden/);
    
    // Click to open dropdown
    await this.exportDropdownBtn.click();
    
    // Verify dropdown items exist
    await expect(this.exportTxtBtn).toContainText('📄 Export as TXT');
    await expect(this.exportMdBtn).toContainText('📝 Export as Markdown');
    await expect(this.exportJsonBtn).toContainText('🔧 Export as JSON');
  }

  /**
   * Verify transcription-specific UI elements are visible
   */
  async verifyTranscriptionUIElements(): Promise<void> {
    await this.ensureTranscriptionTabActive();
    
    // Should have some transcription UI element (even if empty)
    await expect(this.transcriptionArea.first()).toBeVisible();
    
    // Check for export button if it exists
    if (await this.exportButton.count() > 0) {
      await expect(this.exportButton.first()).toBeVisible();
    }
  }

  /**
   * Check if transcription area exists
   */
  async hasTranscriptionArea(): Promise<boolean> {
    return (await this.transcriptionArea.count()) > 0;
  }

  /**
   * Check if export button exists
   */
  async hasExportButton(): Promise<boolean> {
    return (await this.exportButton.count()) > 0;
  }
}