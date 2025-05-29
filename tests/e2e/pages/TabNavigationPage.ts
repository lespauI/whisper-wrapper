import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type TabName = 'upload' | 'record' | 'transcription';

export class TabNavigationPage extends BasePage {
  readonly uploadTab: Locator;
  readonly recordTab: Locator;
  readonly transcriptionTab: Locator;
  readonly appContainer: Locator;
  readonly tabButtons: Locator;
  readonly footerElement: Locator;

  constructor(page: Page) {
    super(page);
    this.uploadTab = page.locator('[data-tab="upload"]');
    this.recordTab = page.locator('[data-tab="record"]');
    this.transcriptionTab = page.locator('[data-tab="transcription"]');
    this.appContainer = page.locator('#app');
    this.tabButtons = page.locator('.tab-btn');
    this.footerElement = page.locator('.footer, footer, #footer');
  }

  /**
   * Switch to a specific tab
   */
  async switchToTab(tabName: TabName): Promise<void> {
    const tabLocator = this.getTabLocator(tabName);
    await tabLocator.click();
    await this.verifyTabIsActive(tabName);
  }

  /**
   * Verify that a specific tab is active
   */
  async verifyTabIsActive(tabName: TabName): Promise<void> {
    const tabLocator = this.getTabLocator(tabName);
    await expect(tabLocator).toHaveClass(/active/);
  }

  /**
   * Verify that a specific tab is not active
   */
  async verifyTabIsNotActive(tabName: TabName): Promise<void> {
    const tabLocator = this.getTabLocator(tabName);
    await expect(tabLocator).not.toHaveClass(/active/);
  }

  /**
   * Verify that the upload tab is the default active tab
   */
  async verifyUploadTabIsDefault(): Promise<void> {
    await this.verifyTabIsActive('upload');
  }

  /**
   * Switch between all tabs in sequence and verify each becomes active
   */
  async switchBetweenAllTabs(): Promise<void> {
    // Start with upload (should be default)
    await this.verifyTabIsActive('upload');

    // Switch to record tab
    await this.switchToTab('record');
    await this.verifyTabIsNotActive('upload');

    // Switch to transcription tab
    await this.switchToTab('transcription');
    await this.verifyTabIsNotActive('record');

    // Switch back to upload tab
    await this.switchToTab('upload');
    await this.verifyTabIsNotActive('transcription');
  }

  /**
   * Verify that UI elements remain intact during tab navigation
   */
  async verifyUIElementsIntact(): Promise<void> {
    // Verify app container is visible
    await expect(this.appContainer).toBeVisible();
    
    // Verify all tab buttons are present
    await expect(this.tabButtons).toHaveCount(3);
    
    // Verify footer if it exists
    if (await this.footerElement.count() > 0) {
      await expect(this.footerElement.first()).toBeVisible();
    }
  }

  /**
   * Perform rapid tab switching for stress testing
   */
  async performRapidTabSwitching(iterations: number = 5): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      await this.uploadTab.click();
      await this.recordTab.click();
      await this.transcriptionTab.click();
    }
    
    // Verify final state
    await this.verifyTabIsActive('transcription');
    await this.verifyUIElementsIntact();
  }

  /**
   * Navigate through tabs in a specific sequence
   */
  async navigateTabSequence(sequence: TabName[]): Promise<void> {
    for (const tabName of sequence) {
      await this.switchToTab(tabName);
      await this.verifyUIElementsIntact();
      
      // Small delay to allow any async operations
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Test tab navigation at different viewport sizes
   */
  async testTabNavigationAtViewportSize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    
    // Test navigation at this size
    await this.switchToTab('upload');
    await this.switchToTab('record');
    await this.switchToTab('transcription');
    
    // Verify all tabs are still visible
    await expect(this.tabButtons).toHaveCount(3);
  }

  /**
   * Test tab accessibility (keyboard navigation and focus)
   */
  async testTabAccessibility(): Promise<void> {
    // Focus on upload tab
    await this.uploadTab.focus();
    await expect(this.uploadTab).toBeFocused();
    
    const tabs: TabName[] = ['upload', 'record', 'transcription'];
    
    for (const tabName of tabs) {
      const tabButton = this.getTabLocator(tabName);
      await expect(tabButton).toBeVisible();
      await expect(tabButton).toBeEnabled();
      
      // Click and verify it works
      await tabButton.click();
      await this.verifyTabIsActive(tabName);
    }
  }

  /**
   * Monitor console errors during tab navigation
   */
  async monitorConsoleErrors(): Promise<string[]> {
    const consoleErrors: string[] = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    return consoleErrors;
  }

  /**
   * Get the locator for a specific tab
   */
  private getTabLocator(tabName: TabName): Locator {
    return this.page.locator(`[data-tab="${tabName}"]`);
  }
}