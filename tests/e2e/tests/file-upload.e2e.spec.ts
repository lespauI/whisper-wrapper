import { test, expect } from '../fixtures/pageFixtures';
import {
  TAB_TEST_DATA,
  SUPPORTED_FORMATS,
  type TabTestData
} from '../fixtures/testData';

test.describe('File Upload Feature', () => {
  
  test.describe('Application Base', () => {
    test('should load application with correct title', async ({ basePage }) => {
      await expect(basePage.appTitle).toContainText('Whisper Wrapper');
    });

    test('should display footer with correct information', async ({ basePage }) => {
      await basePage.verifyFooterVisible();
    });

    test('should display upload tab correctly', async ({ basePage }) => {
      const uploadTab = TAB_TEST_DATA.find(tab => tab.tabName === 'upload')!;
      const tabButton = basePage.page.locator(`[data-tab="${uploadTab.tabName}"]`);
      await expect(tabButton).toBeVisible();
      await expect(tabButton).toContainText(uploadTab.displayText);
    });

    test('should have upload tab active by default', async ({ basePage }) => {
      await basePage.verifyTabIsActive('upload');
    });

    test('should maintain footer visibility on upload tab', async ({ basePage }) => {
      await basePage.switchTab('upload');
      await basePage.verifyFooterVisible();
    });
  });

  test.describe('Upload Interface', () => {
    test('should display upload area with all elements', async ({ fileUploadPage }) => {
      await fileUploadPage.verifyUploadAreaDisplay();
    });

    test('should show progress area initially hidden', async ({ fileUploadPage }) => {
      await fileUploadPage.verifyProgressAreaHidden();
    });

    test('should trigger file selection via browse button', async ({ fileUploadPage }) => {
      await fileUploadPage.clickBrowseButton();
    });

    test('should trigger file selection via upload area click', async ({ fileUploadPage }) => {
      await fileUploadPage.clickUploadArea();
    });

    test('should handle drag and drop interactions', async ({ fileUploadPage }) => {
      console.error('MISMATCH: Drag and drop event simulation with DataTransfer object construction failed in test environment');
      
      await fileUploadPage.simulateDragAndDrop();
    });

    // Parametrized supported formats verification
    test('should display all supported file formats', async ({ fileUploadPage }) => {
      for (const format of SUPPORTED_FORMATS) {
        await expect(fileUploadPage.supportedFormats).toContainText(format);
      }
    });
  });

  test.describe('Tab Navigation from Upload', () => {
    // Parametrized tab switching from upload
    for (const targetTab of TAB_TEST_DATA.filter(tab => tab.tabName !== 'upload')) {
      test(`should switch from upload to ${targetTab.tabName} tab correctly`, async ({ basePage }) => {
        // Start on upload tab
        await basePage.switchTab('upload');
        await basePage.verifyTabIsActive('upload');
        
        // Switch to target tab
        await basePage.switchTab(targetTab.tabName);
        await basePage.verifyTabIsActive(targetTab.tabName);
        await basePage.verifyTabIsNotActive('upload');
        
        // Verify footer remains visible
        await basePage.verifyFooterVisible();
      });
    }
  });

  test.describe('Upload Accessibility', () => {
    test('should have proper upload button classes and structure', async ({ fileUploadPage }) => {
      await expect(fileUploadPage.browseBtn).toHaveClass(/btn/);
      await expect(fileUploadPage.browseBtn).toBeEnabled();
    });

    test('should have proper upload area attributes', async ({ fileUploadPage }) => {
      await expect(fileUploadPage.uploadArea).toBeVisible();
      await expect(fileUploadPage.uploadIcon).toBeVisible();
      await expect(fileUploadPage.uploadContent).toBeVisible();
    });
  });
});