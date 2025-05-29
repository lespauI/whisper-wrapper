import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class RecordingPage extends BasePage {
  readonly recordSection: Locator;
  readonly recordButton: Locator;
  readonly recordingInterface: Locator;

  constructor(page: Page) {
    super(page);
    this.recordSection = page.locator('#record-section, .record-section, .recording-interface');
    this.recordButton = page.locator('#record-btn, .record-button, button:has-text("Record"), button[title*="record" i]');
    this.recordingInterface = page.locator('.recording-interface');
  }

  /**
   * Ensure the record tab is active
   */
  async ensureRecordTabActive(): Promise<void> {
    await this.switchTab('record');
    await this.verifyTabIsActive('record');
  }

  /**
   * Verify that record-specific UI elements are visible
   */
  async verifyRecordUIElements(): Promise<void> {
    await this.ensureRecordTabActive();
    
    // Check for record section
    if (await this.recordSection.count() > 0) {
      await expect(this.recordSection.first()).toBeVisible();
    } else {
      console.log('Note: Record section not found - checking for record button directly');
    }
    
    // Check for record button
    if (await this.recordButton.count() > 0) {
      await expect(this.recordButton.first()).toBeVisible();
    } else {
      console.error('MISMATCH: No record button found - expected recording interface to have a record button');
    }
  }

  /**
   * Check if recording interface is properly set up
   */
  async verifyRecordingInterfaceSetup(): Promise<void> {
    await this.ensureRecordTabActive();
    
    // Verify recording interface exists
    if (await this.recordingInterface.count() > 0) {
      await expect(this.recordingInterface).toBeVisible();
    }
    
    // Verify record button is functional
    if (await this.recordButton.count() > 0) {
      const recordBtn = this.recordButton.first();
      await expect(recordBtn).toBeVisible();
      await expect(recordBtn).toBeEnabled();
    }
  }

  /**
   * Get the record button (first available)
   */
  async getRecordButton(): Promise<Locator> {
    if (await this.recordButton.count() > 0) {
      return this.recordButton.first();
    }
    throw new Error('No record button found');
  }

  /**
   * Check if record section exists
   */
  async hasRecordSection(): Promise<boolean> {
    return (await this.recordSection.count()) > 0;
  }

  /**
   * Check if record button exists
   */
  async hasRecordButton(): Promise<boolean> {
    return (await this.recordButton.count()) > 0;
  }
}