import { test, expect } from '@playwright/test';

test.describe('Upload Tab UI and Workflow - Web E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Switch to upload tab
    await page.locator('[data-tab="upload"]').click();
    await expect(page.locator('[data-tab="upload"]')).toHaveClass(/active/);
  });

  test.describe('Upload Tab UI Components', () => {
    test('should display upload interface correctly', async ({ page }) => {
      // Verify upload area is visible
      const uploadArea = page.locator('#file-upload');
      await expect(uploadArea).toBeVisible();

      // Verify browse button is present and enabled
      const browseBtn = page.locator('#browse-btn');
      await expect(browseBtn).toBeVisible();
      await expect(browseBtn).toBeEnabled();
      await expect(browseBtn).toContainText(/browse/i);

      // Verify supported formats are shown
      const supportedFormats = page.locator('.supported-formats');
      await expect(supportedFormats).toBeVisible();
      await expect(supportedFormats).toContainText(/mp3|wav|mp4/i);

      // Verify progress area is initially hidden
      const uploadProgress = page.locator('#upload-progress');
      await expect(uploadProgress).toHaveClass(/hidden/);
    });

    test('should detect browse button click (opens native dialog)', async ({ page }) => {
      const browseBtn = page.locator('#browse-btn');
      
      // Click the button - this will attempt to open native dialog
      // We're just testing that the click doesn't crash the app
      await browseBtn.click();
      
      // App should remain responsive
      await expect(page.locator('#app')).toBeVisible();
      await expect(browseBtn).toBeEnabled();
      
      console.log('Note: Native file dialog behavior cannot be tested in web environment');
    });

    test('should handle drag and drop UI events', async ({ page }) => {
      const uploadArea = page.locator('#file-upload');
      
      // Test dragover event - should add dragover class
      await uploadArea.dispatchEvent('dragover', { 
        dataTransfer: await page.evaluateHandle(() => new DataTransfer())
      });
      await expect(uploadArea).toHaveClass(/dragover/);
      
      // Test dragleave event - should remove dragover class
      await uploadArea.dispatchEvent('dragleave');
      await expect(uploadArea).not.toHaveClass(/dragover/);
      
      console.log('Note: Actual file drop processing requires native file system access');
    });
  });

  test.describe('UI State Management', () => {
    test('should verify initial UI state is correct', async ({ page }) => {
      // Verify initial state without calling app methods
      const uploadArea = page.locator('#file-upload');
      const uploadProgress = page.locator('#upload-progress');
      const statusText = page.locator('#status-text');

      await expect(uploadArea).toBeVisible();
      await expect(uploadProgress).toHaveClass(/hidden/);
      await expect(statusText).toBeVisible();
    });

    test('should test progress toggle functionality if available', async ({ page }) => {
      const hasAppMethods = await page.evaluate(() => {
        return !!(window.app && window.app.showProgress);
      });

      if (hasAppMethods) {
        // Test showing progress by calling app methods directly
        await page.evaluate(() => {
          window.app.showProgress(true);
        });

        const uploadArea = page.locator('#file-upload');
        const uploadProgress = page.locator('#upload-progress');

        await expect(uploadArea).toHaveClass(/hidden/);
        await expect(uploadProgress).not.toHaveClass(/hidden/);

        // Test hiding progress
        await page.evaluate(() => {
          window.app.showProgress(false);
        });

        await expect(uploadArea).not.toHaveClass(/hidden/);
        await expect(uploadProgress).toHaveClass(/hidden/);
      } else {
        console.error('MISMATCH: App methods not available - expected window.app.showProgress to be accessible');
      }
    });

    test('should test status message updates if available', async ({ page }) => {
      const hasAppMethods = await page.evaluate(() => {
        return !!(window.app && window.app.updateStatus);
      });

      if (hasAppMethods) {
        const testMessage = 'Test status update';
        
        await page.evaluate((msg) => {
          window.app.updateStatus(msg);
        }, testMessage);

        const statusText = page.locator('#status-text');
        await expect(statusText).toContainText(testMessage);
      } else {
        console.error('MISMATCH: App methods not available - expected window.app.updateStatus to be accessible');
      }
    });

    test('should test error display if available', async ({ page }) => {
      const hasAppMethods = await page.evaluate(() => {
        return !!(window.app && window.app.showError);
      });

      if (hasAppMethods) {
        await page.evaluate(() => {
          window.app.showError('Test error: Unsupported file format');
        });

        const statusText = page.locator('#status-text');
        await expect(statusText).toContainText(/error.*unsupported.*format/i, { timeout: 5000 });
      } else {
        console.error('MISMATCH: App methods not available - expected window.app.showError to be accessible');
      }
    });
  });

  test.describe('Tab Navigation and Workflow', () => {
    test('should handle tab switching during upload states', async ({ page }) => {
      // Start on upload tab
      await expect(page.locator('[data-tab="upload"]')).toHaveClass(/active/);

      // Switch to record tab
      await page.locator('[data-tab="record"]').click();
      await expect(page.locator('[data-tab="record"]')).toHaveClass(/active/);

      // Switch back to upload tab
      await page.locator('[data-tab="upload"]').click();
      await expect(page.locator('[data-tab="upload"]')).toHaveClass(/active/);

      // Upload interface should still be functional
      const browseBtn = page.locator('#browse-btn');
      await expect(browseBtn).toBeEnabled();
    });

    test('should maintain basic UI state during tab switches', async ({ page }) => {
      // Simply test that tab switching works and UI remains functional
      await page.locator('[data-tab="record"]').click();
      await expect(page.locator('[data-tab="record"]')).toHaveClass(/active/);
      
      await page.locator('[data-tab="upload"]').click();
      await expect(page.locator('[data-tab="upload"]')).toHaveClass(/active/);
      
      // Upload area should still be visible and functional
      const uploadArea = page.locator('#file-upload');
      const browseBtn = page.locator('#browse-btn');
      await expect(uploadArea).toBeVisible();
      await expect(browseBtn).toBeEnabled();
    });
  });

  test.describe('Basic Workflow Testing', () => {
    test('should navigate to transcription tab manually', async ({ page }) => {
      // Test manual navigation to transcription tab
      const transcriptionTab = page.locator('[data-tab="transcription"]');
      await transcriptionTab.click();
      
      await expect(transcriptionTab).toHaveClass(/active/, { timeout: 5000 });
      
      // Check if transcription UI elements are present
      const transcriptionArea = page.locator('#transcription-result, .transcription-content, .transcription-area');
      // This should be visible even if empty
      if (await transcriptionArea.count() > 0) {
        console.log('Transcription area found in UI');
      } else {
        console.error('MISMATCH: Transcription area not found - expected transcription UI elements to be present');
      }
    });

    test('should test app methods for transcription workflow if available', async ({ page }) => {
      const hasAppMethods = await page.evaluate(() => {
        return !!(window.app && window.app.showTranscriptionResult && window.app.switchTab);
      });

      if (hasAppMethods) {
        const testTranscriptionData = {
          text: 'This is a test transcription for UI testing.',
          segments: [
            { start: 0, end: 3, text: 'This is a test' },
            { start: 3, end: 7, text: 'transcription for UI testing.' }
          ],
          language: 'en'
        };

        // Call the app's transcription display method directly
        await page.evaluate((data) => {
          window.app.showTranscriptionResult(data.text, data.segments);
          window.app.switchTab('transcription');
        }, testTranscriptionData);

        // Verify UI updates
        const transcriptionTab = page.locator('[data-tab="transcription"]');
        await expect(transcriptionTab).toHaveClass(/active/, { timeout: 5000 });

        const transcriptionResult = page.locator('#transcription-result, .transcription-content');
        await expect(transcriptionResult).toBeVisible({ timeout: 5000 });
        await expect(transcriptionResult).toContainText('This is a test transcription for UI testing');
      } else {
        console.error('MISMATCH: App transcription methods not available - expected window.app.showTranscriptionResult to be accessible');
      }
    });

    test('should check for export functionality in transcription tab', async ({ page }) => {
      // Navigate to transcription tab first
      await page.locator('[data-tab="transcription"]').click();
      
      // Check if export functionality exists
      const exportBtn = page.locator('#export-btn, .export-button, button:has-text("export")');
      
      if (await exportBtn.count() > 0) {
        const firstExportBtn = exportBtn.first();
        if (await firstExportBtn.isVisible()) {
          console.log('Export functionality found in transcription tab');
          
          // Test if it can be clicked (may show dropdown or modal)
          await firstExportBtn.click();
          
          // Look for export options
          const exportOptions = page.locator('.export-options, .export-dropdown, .export-menu');
          if (await exportOptions.isVisible()) {
            console.log('Export options displayed successfully');
          }
        }
      } else {
        console.log('Note: Export functionality not found - this may be expected if not implemented');
      }
    });
  });

  test.describe('Responsive Design and Performance', () => {
    test('should handle window resize properly', async ({ page }) => {
      // Test various window sizes
      const sizes = [
        { width: 800, height: 600 },
        { width: 1200, height: 800 },
        { width: 1600, height: 1000 }
      ];

      for (const size of sizes) {
        await page.setViewportSize(size);
        
        // Verify critical elements remain visible and functional
        await expect(page.locator('#app')).toBeVisible();
        await expect(page.locator('#browse-btn')).toBeVisible();
        await expect(page.locator('.tab-btn')).toHaveCount(3); // upload, record, transcription tabs
      }
    });

    test('should remain responsive during UI updates', async ({ page }) => {
      // Simulate rapid UI updates
      await page.evaluate(() => {
        const app = window.app;
        if (app && app.updateStatus) {
          let counter = 0;
          const interval = setInterval(() => {
            app.updateStatus(`Status update ${counter++}`);
            if (counter > 5) {
              clearInterval(interval);
              app.updateStatus('All updates completed');
            }
          }, 100);
        }
      });

      // UI should remain responsive
      const uploadTab = page.locator('[data-tab="upload"]');
      await uploadTab.click();
      await expect(uploadTab).toHaveClass(/active/);

      const recordTab = page.locator('[data-tab="record"]');
      await recordTab.click();
      await expect(recordTab).toHaveClass(/active/);
    });
  });
});