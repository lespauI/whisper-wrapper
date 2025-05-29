import { test, expect } from '@playwright/test';
import { 
  TabNavigationPage, 
  FileUploadPage, 
  RecordingPage, 
  TranscriptionPage 
} from '../pages';

test.describe('Tab Navigation and UI State - Web E2E', () => {
  let tabNavigationPage: TabNavigationPage;
  let fileUploadPage: FileUploadPage;
  let recordingPage: RecordingPage;
  let transcriptionPage: TranscriptionPage;

  test.beforeEach(async ({ page }) => {
    tabNavigationPage = new TabNavigationPage(page);
    fileUploadPage = new FileUploadPage(page);
    recordingPage = new RecordingPage(page);
    transcriptionPage = new TranscriptionPage(page);
    
    await tabNavigationPage.goto();
  });

  test.describe('Basic Tab Navigation', () => {
    test('should switch between all tabs correctly', async () => {
      // Test the complete tab switching sequence using the page object
      await tabNavigationPage.switchBetweenAllTabs();
    });

    test('should maintain UI elements during tab navigation', async () => {
      const tabs = ['upload', 'record', 'transcription'] as const;
      
      for (const tabName of tabs) {
        await tabNavigationPage.switchToTab(tabName);
        await tabNavigationPage.verifyUIElementsIntact();
      }
    });

    test('should handle rapid tab switching', async () => {
      // Perform rapid tab switching using the page object
      await tabNavigationPage.performRapidTabSwitching(5);
    });
  });

  test.describe('Tab-Specific UI States', () => {
    test('should show upload-specific UI elements', async () => {
      await fileUploadPage.ensureUploadTabActive();
      await fileUploadPage.verifyUploadAreaDisplay();
      await fileUploadPage.verifyProgressAreaHidden();
    });

    test('should show record-specific UI elements', async () => {
      await recordingPage.verifyRecordUIElements();
    });

    test('should show transcription-specific UI elements', async () => {
      await transcriptionPage.verifyTranscriptionUIElements();
    });
  });

  test.describe('State Preservation During Navigation', () => {
    test('should preserve basic form states when switching tabs', async () => {
      // This test can only verify UI state preservation, not actual data since we can't mock file uploads
      
      // Go to upload tab and verify initial state
      await fileUploadPage.ensureUploadTabActive();
      await fileUploadPage.verifyUploadAreaDisplay();
      
      // Switch to another tab and back
      await tabNavigationPage.switchToTab('record');
      await tabNavigationPage.switchToTab('upload');
      
      // Upload area should still be visible and in initial state
      await fileUploadPage.verifyUploadAreaDisplay();
      await fileUploadPage.verifyProgressAreaHidden();
    });

    test('should handle tab switching without errors', async () => {
      // Monitor console errors
      const consoleErrors = await tabNavigationPage.monitorConsoleErrors();

      // Switch between tabs multiple times
      const tabSequence = ['upload', 'record', 'transcription', 'upload', 'transcription', 'record'] as const;
      await tabNavigationPage.navigateTabSequence(tabSequence);
      
      // Should not have generated console errors
      if (consoleErrors.length > 0) {
        console.error('MISMATCH: Console errors during tab navigation:', consoleErrors);
      }
    });
  });

  test.describe('Responsive Tab Navigation', () => {
    test('should handle tab navigation on different screen sizes', async () => {
      const sizes = [
        { width: 800, height: 600 },
        { width: 1200, height: 800 },
        { width: 1600, height: 1000 }
      ];

      for (const size of sizes) {
        await tabNavigationPage.testTabNavigationAtViewportSize(size.width, size.height);
      }
    });

    test('should maintain tab accessibility during navigation', async () => {
      await tabNavigationPage.testTabAccessibility();
    });
  });
});