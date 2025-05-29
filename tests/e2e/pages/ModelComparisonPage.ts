import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ModelComparisonPage extends BasePage {
  readonly modal: Locator;
  readonly modalHeader: Locator;
  readonly closeBtn: Locator;
  readonly comparisonTable: Locator;
  readonly tableHeaders: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = page.locator('#model-comparison-modal');
    this.modalHeader = page.locator('#model-comparison-modal .modal-header h3');
    this.closeBtn = page.locator('#model-comparison-modal .modal-close');
    this.comparisonTable = page.locator('.comparison-table');
    this.tableHeaders = this.comparisonTable.locator('thead tr th');
    this.tableRows = this.comparisonTable.locator('tbody tr');
  }

  async verifyModalOpen() {
    await expect(this.modal).toBeVisible();
    await expect(this.modalHeader).toContainText('Whisper Model Comparison');
  }

  async verifyTable() {
    await expect(this.comparisonTable).toBeVisible();
    
    // Verify table headers
    await expect(this.tableHeaders).toHaveCount(6);
    
    const expectedHeaders = ['Model', 'Parameters', 'VRAM Required', 'Relative Speed', 'Best For', 'Languages'];
    for (let i = 0; i < expectedHeaders.length; i++) {
      await expect(this.tableHeaders.nth(i)).toContainText(expectedHeaders[i]);
    }
    
    // Verify table has 10 model rows
    await expect(this.tableRows).toHaveCount(10);
  }

  async close() {
    await this.closeBtn.click();
    await expect(this.modal).toBeHidden();
  }

  async isVisible(): Promise<boolean> {
    return await this.modal.isVisible();
  }
}