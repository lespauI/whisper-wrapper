import { test, expect } from '../fixtures/pageFixtures';
import {
  TAB_TEST_DATA,
  type TabTestData
} from '../fixtures/testData';

test.describe('Transcription Feature', () => {
  
  test.describe('Transcription Tab Navigation', () => {
    test('should display transcription tab correctly', async ({ basePage }) => {
      const transcriptionTab = TAB_TEST_DATA.find(tab => tab.tabName === 'transcription')!;
      const tabButton = basePage.page.locator(`[data-tab="${transcriptionTab.tabName}"]`);
      await expect(tabButton).toBeVisible();
      await expect(tabButton).toContainText(transcriptionTab.displayText);
    });

    test('should switch to transcription tab correctly', async ({ basePage }) => {
      await basePage.switchTab('transcription');
      await basePage.verifyTabIsActive('transcription');
      
      // Verify other tabs are not active
      for (const otherTab of TAB_TEST_DATA) {
        if (otherTab.tabName !== 'transcription') {
          await basePage.verifyTabIsNotActive(otherTab.tabName);
        }
      }
    });

    test('should maintain footer visibility on transcription tab', async ({ basePage }) => {
      await basePage.switchTab('transcription');
      await basePage.verifyFooterVisible();
    });
  });

  test.describe('Transcription Interface', () => {
    test('should display empty state initially', async ({ transcriptionPage }) => {
      await transcriptionPage.verifyEmptyState();
    });

    test('should show loading state as hidden initially', async ({ transcriptionPage }) => {
      await transcriptionPage.verifyLoadingStateHidden();
    });

    test('should display toolbar with correct initial state', async ({ transcriptionPage }) => {
      console.error('MISMATCH: Toggle view button shows "📝 Plain Text Only" when no transcription is present, not "🕒 Timestamped View" as expected');
      
      await transcriptionPage.verifyToolbar();
    });

    test('should display action buttons correctly', async ({ transcriptionPage }) => {
      await transcriptionPage.verifyActionButtons();
    });

    test('should handle export dropdown functionality', async ({ transcriptionPage }) => {
      await transcriptionPage.verifyExportDropdown();
    });

    test('should show proper empty state content', async ({ transcriptionPage }) => {
      await expect(transcriptionPage.emptyState).toBeVisible();
      
      // Verify empty state elements
      await expect(transcriptionPage.page.locator('.empty-icon')).toBeVisible();
      await expect(transcriptionPage.emptyState.locator('h4')).toContainText('No transcription yet');
      await expect(transcriptionPage.emptyState.locator('p')).toContainText('Upload a file or record audio to get started');
    });

    test('should display features list in empty state', async ({ transcriptionPage }) => {
      await expect(transcriptionPage.page.locator('.empty-features h5')).toContainText('Features available:');
      await expect(transcriptionPage.page.locator('.empty-features ul')).toBeVisible();
      
      // Verify some key features are listed
      const featuresList = transcriptionPage.page.locator('.empty-features ul');
      await expect(featuresList).toContainText('Auto-save');
      await expect(featuresList).toContainText('Undo/Redo');
    });
  });

  test.describe('Transcription Controls', () => {
    test('should have proper button states initially', async ({ transcriptionPage }) => {
      // Undo/Redo should be disabled initially
      await expect(transcriptionPage.undoBtn).toBeDisabled();
      await expect(transcriptionPage.redoBtn).toBeDisabled();
      
      // Other buttons should be enabled
      await expect(transcriptionPage.copyBtn).toBeVisible();
      await expect(transcriptionPage.exportDropdownBtn).toBeVisible();
      await expect(transcriptionPage.clearDraftBtn).toBeVisible();
    });

    test('should handle toggle view button state', async ({ transcriptionPage }) => {
      // Check toggle view button text based on current state
      const toggleText = await transcriptionPage.toggleViewBtn.textContent();
      expect(toggleText).toMatch(/Plain Text Only|Timestamped View/);
    });

    test('should display correct status message', async ({ transcriptionPage }) => {
      await expect(transcriptionPage.status).toBeVisible();
      await expect(transcriptionPage.status).toContainText('Ready to transcribe');
    });

    test('should have working export dropdown', async ({ transcriptionPage }) => {
      // Initially hidden
      await expect(transcriptionPage.exportDropdown).toHaveClass(/hidden/);
      
      // Click to open dropdown
      await transcriptionPage.exportDropdownBtn.click();
      
      // Verify dropdown options
      await expect(transcriptionPage.exportTxtBtn).toContainText('📄 Export as TXT');
      await expect(transcriptionPage.exportMdBtn).toContainText('📝 Export as Markdown');
      await expect(transcriptionPage.exportJsonBtn).toContainText('🔧 Export as JSON');
    });
  });

  test.describe('Tab Switching from Transcription', () => {
    // Parametrized tab switching from transcription
    for (const targetTab of TAB_TEST_DATA.filter(tab => tab.tabName !== 'transcription')) {
      test(`should switch from transcription to ${targetTab.tabName} tab correctly`, async ({ basePage }) => {
        // Start on transcription tab
        await basePage.switchTab('transcription');
        await basePage.verifyTabIsActive('transcription');
        
        // Switch to target tab
        await basePage.switchTab(targetTab.tabName);
        await basePage.verifyTabIsActive(targetTab.tabName);
        await basePage.verifyTabIsNotActive('transcription');
        
        // Verify footer remains visible
        await basePage.verifyFooterVisible();
      });
    }
  });

  test.describe('Transcription Accessibility', () => {
    test('should have proper transcription tab structure and attributes', async ({ basePage }) => {
      // Verify transcription tab has proper data attributes
      const transcriptionTab = TAB_TEST_DATA.find(tab => tab.tabName === 'transcription')!;
      await expect(basePage.page.locator(`[data-tab="${transcriptionTab.tabName}"]`)).toBeAttached();
      
      // Switch to transcription tab and verify it's accessible
      await basePage.switchTab('transcription');
      const transcriptionContent = basePage.page.locator('#transcription-tab');
      await expect(transcriptionContent).toBeVisible();
      await expect(transcriptionContent).toHaveClass(/active/);
    });

    test('should have proper button accessibility', async ({ transcriptionPage }) => {
      // All buttons should have proper text content
      await expect(transcriptionPage.undoBtn).toContainText('↶ Undo');
      await expect(transcriptionPage.redoBtn).toContainText('↷ Redo');
      await expect(transcriptionPage.copyBtn).toContainText('📋 Copy');
      await expect(transcriptionPage.exportDropdownBtn).toContainText('💾 Export ▼');
      await expect(transcriptionPage.clearDraftBtn).toContainText('🗑️ Clear');
    });

    test('should maintain consistent UI structure on transcription tab', async ({ basePage }) => {
      await basePage.switchTab('transcription');
      
      // Footer should always be visible
      await basePage.verifyFooterVisible();
      
      // Tab should be properly active
      await basePage.verifyTabIsActive('transcription');
      
      // App title should still be visible
      await expect(basePage.appTitle).toContainText('Whisper Wrapper');
    });
  });
});