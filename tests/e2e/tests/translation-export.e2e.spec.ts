import { test, expect } from '../fixtures/pageFixtures';

test.describe('Translation Export and Session Management', () => {
  
  test.beforeEach(async ({ ongoingTranslationPage }) => {
    await ongoingTranslationPage.enableOngoingTranslation({
      sourceLanguage: 'en',
      targetLanguage: 'es'
    });
    
    // Start recording with translation and add some test content
    await ongoingTranslationPage.startRecordingWithTranslation();
    
    // Simulate translation session content
    await ongoingTranslationPage.page.evaluate(() => {
      const originalDisplay = document.getElementById('original-text-display');
      const translatedDisplay = document.getElementById('translated-text-display');
      
      if (originalDisplay && translatedDisplay) {
        originalDisplay.innerHTML = `
          <div class="sentence-segment" data-segment-id="1">
            <span class="sentence-text">Hello, this is a test recording.</span>
            <span class="timestamp">00:00:01</span>
          </div>
          <div class="sentence-segment" data-segment-id="2">
            <span class="sentence-text">We are testing the translation feature.</span>
            <span class="timestamp">00:00:05</span>
          </div>
        `;
        
        translatedDisplay.innerHTML = `
          <div class="sentence-segment translated" data-segment-id="1">
            <span class="sentence-text">Hola, esta es una grabación de prueba.</span>
          </div>
          <div class="sentence-segment translated" data-segment-id="2">
            <span class="sentence-text">Estamos probando la función de traducción.</span>
          </div>
        `;
      }
    });
    
    await ongoingTranslationPage.stopRecording();
  });

  test.describe('Export Modal Functionality', () => {
    test('should open export modal with session information', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Verify export modal is visible
      await expect(ongoingTranslationPage.exportModal).toBeVisible();
      
      // Verify session information is displayed
      await expect(ongoingTranslationPage.page.locator('#export-session-languages')).toContainText('→');
      await expect(ongoingTranslationPage.page.locator('#export-session-sentences')).toContainText('sentences');
      await expect(ongoingTranslationPage.page.locator('#export-session-duration')).toContainText(':');
    });

    test('should display all export format options', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Verify all format options are available
      await expect(ongoingTranslationPage.exportSRTRadio).toBeVisible();
      await expect(ongoingTranslationPage.exportTXTRadio).toBeVisible();
      await expect(ongoingTranslationPage.exportJSONRadio).toBeVisible();
      await expect(ongoingTranslationPage.exportCSVRadio).toBeVisible();
      
      // Verify SRT is selected by default
      await expect(ongoingTranslationPage.exportSRTRadio).toBeChecked();
    });

    test('should update export options based on format selection', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Test SRT format (timestamps should be forced on)
      await ongoingTranslationPage.exportSRTRadio.check();
      await expect(ongoingTranslationPage.page.locator('#export-include-timestamps')).toBeChecked();
      await expect(ongoingTranslationPage.page.locator('#export-include-timestamps')).toBeDisabled();
      
      // Test JSON format (all options should be forced on)
      await ongoingTranslationPage.exportJSONRadio.check();
      await expect(ongoingTranslationPage.page.locator('#export-include-timestamps')).toBeChecked();
      await expect(ongoingTranslationPage.page.locator('#export-bilingual')).toBeChecked();
      
      // Test TXT format (options should be configurable)
      await ongoingTranslationPage.exportTXTRadio.check();
      await expect(ongoingTranslationPage.page.locator('#export-include-timestamps')).not.toBeDisabled();
      await expect(ongoingTranslationPage.page.locator('#export-bilingual')).not.toBeDisabled();
    });

    test('should close export modal on cancel', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.exportSessionBtn.click();
      await ongoingTranslationPage.cancelExportBtn.click();
      
      // Verify modal is closed
      await expect(ongoingTranslationPage.exportModal).toBeHidden();
    });
  });

  test.describe('Export Format Testing', () => {
    test('should export session in SRT format', async ({ ongoingTranslationPage }) => {
      // Setup download promise before triggering export
      const downloadPromise = ongoingTranslationPage.page.waitForEvent('download');
      
      await ongoingTranslationPage.exportSession('srt');
      
      // Verify download was triggered
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.srt$/);
    });

    test('should export session in TXT format', async ({ ongoingTranslationPage }) => {
      const downloadPromise = ongoingTranslationPage.page.waitForEvent('download');
      
      await ongoingTranslationPage.exportSession('txt');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.txt$/);
    });

    test('should export session in JSON format', async ({ ongoingTranslationPage }) => {
      const downloadPromise = ongoingTranslationPage.page.waitForEvent('download');
      
      await ongoingTranslationPage.exportSession('json');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.json$/);
    });

    test('should export session in CSV format', async ({ ongoingTranslationPage }) => {
      const downloadPromise = ongoingTranslationPage.page.waitForEvent('download');
      
      await ongoingTranslationPage.exportSession('csv');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    });
  });

  test.describe('Session Save Functionality', () => {
    test('should open save session modal with session preview', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.saveSessionBtn.click();
      
      // Verify save modal is visible
      await expect(ongoingTranslationPage.saveSessionModal).toBeVisible();
      
      // Verify session preview information
      await expect(ongoingTranslationPage.page.locator('#save-session-languages')).toContainText('→');
      await expect(ongoingTranslationPage.page.locator('#save-session-sentences')).toContainText('sentences');
      await expect(ongoingTranslationPage.page.locator('#save-session-duration')).toContainText(':');
    });

    test('should save session with custom name and description', async ({ ongoingTranslationPage }) => {
      const sessionName = 'Test Translation Session';
      const sessionDescription = 'This is a test session for e2e testing';
      
      await ongoingTranslationPage.saveSession(sessionName, sessionDescription);
      
      // Verify success (modal should be closed)
      await expect(ongoingTranslationPage.saveSessionModal).toBeHidden();
      
      // Verify success notification (if implemented)
      // This would depend on your notification system
    });

    test('should generate default session name', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.saveSessionBtn.click();
      
      // Verify default name is generated
      const nameInput = ongoingTranslationPage.sessionNameInput;
      const defaultName = await nameInput.inputValue();
      expect(defaultName).toMatch(/Translation Session \d+\/\d+\/\d+ \d+:\d+/);
    });

    test('should save session with minimum required information', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.saveSessionBtn.click();
      
      // Just confirm save without changing default name
      await ongoingTranslationPage.confirmSaveBtn.click();
      
      // Verify modal closes (indicating successful save)
      await expect(ongoingTranslationPage.saveSessionModal).toBeHidden();
    });

    test('should cancel session save', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.saveSessionBtn.click();
      await ongoingTranslationPage.cancelSaveBtn.click();
      
      // Verify modal is closed
      await expect(ongoingTranslationPage.saveSessionModal).toBeHidden();
    });
  });

  test.describe('Copy Functionality', () => {
    test('should copy original text to clipboard', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.copyOriginalBtn.click();
      
      // Verify clipboard content (if browser supports clipboard API)
      const clipboardText = await ongoingTranslationPage.page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return 'clipboard-not-accessible';
        }
      });
      
      if (clipboardText !== 'clipboard-not-accessible') {
        expect(clipboardText).toContain('Hello, this is a test recording');
      }
    });

    test('should copy translated text to clipboard', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.copyTranslatedBtn.click();
      
      const clipboardText = await ongoingTranslationPage.page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return 'clipboard-not-accessible';
        }
      });
      
      if (clipboardText !== 'clipboard-not-accessible') {
        expect(clipboardText).toContain('Hola, esta es una grabación');
      }
    });
  });

  test.describe('Data Integrity', () => {
    test('should maintain session data consistency during export', async ({ ongoingTranslationPage }) => {
      // Get current session data
      const originalText = await ongoingTranslationPage.getOriginalText();
      const translatedText = await ongoingTranslationPage.getTranslatedText();
      
      // Open export modal and verify data consistency
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Verify sentence count is accurate
      const sentenceCountText = await ongoingTranslationPage.page.locator('#export-session-sentences').textContent();
      expect(sentenceCountText).toContain('2 sentences'); // Based on our test content
      
      await ongoingTranslationPage.cancelExportBtn.click();
      
      // Verify original content is unchanged
      const currentOriginalText = await ongoingTranslationPage.getOriginalText();
      const currentTranslatedText = await ongoingTranslationPage.getTranslatedText();
      
      expect(currentOriginalText).toBe(originalText);
      expect(currentTranslatedText).toBe(translatedText);
    });

    test('should handle empty session export gracefully', async ({ ongoingTranslationPage }) => {
      // Clear translation display
      await ongoingTranslationPage.clearTranslationDisplay();
      
      // Try to export empty session
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Verify export modal still opens but shows 0 sentences
      await expect(ongoingTranslationPage.exportModal).toBeVisible();
      await expect(ongoingTranslationPage.page.locator('#export-session-sentences')).toContainText('0 sentences');
      
      await ongoingTranslationPage.cancelExportBtn.click();
    });

    test('should handle large session data efficiently', async ({ ongoingTranslationPage }) => {
      // Add many sentence segments to test performance
      await ongoingTranslationPage.page.evaluate(() => {
        const originalDisplay = document.getElementById('original-text-display');
        const translatedDisplay = document.getElementById('translated-text-display');
        
        if (originalDisplay && translatedDisplay) {
          let originalHTML = '';
          let translatedHTML = '';
          
          for (let i = 1; i <= 100; i++) {
            originalHTML += `
              <div class="sentence-segment" data-segment-id="${i}">
                <span class="sentence-text">This is sentence number ${i} in English.</span>
                <span class="timestamp">00:00:${String(i).padStart(2, '0')}</span>
              </div>
            `;
            
            translatedHTML += `
              <div class="sentence-segment translated" data-segment-id="${i}">
                <span class="sentence-text">Esta es la oración número ${i} en español.</span>
              </div>
            `;
          }
          
          originalDisplay.innerHTML = originalHTML;
          translatedDisplay.innerHTML = translatedHTML;
        }
      });
      
      // Test export performance with large dataset
      const startTime = Date.now();
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Verify modal opens quickly even with large dataset
      await expect(ongoingTranslationPage.exportModal).toBeVisible();
      const endTime = Date.now();
      
      // Should open within 2 seconds even with 100 sentences
      expect(endTime - startTime).toBeLessThan(2000);
      
      // Verify sentence count is correct
      await expect(ongoingTranslationPage.page.locator('#export-session-sentences')).toContainText('100 sentences');
      
      await ongoingTranslationPage.cancelExportBtn.click();
    });
  });

  test.describe('Modal Accessibility', () => {
    test('should support keyboard navigation in export modal', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Test tab navigation through modal elements
      await ongoingTranslationPage.page.keyboard.press('Tab');
      await ongoingTranslationPage.page.keyboard.press('Tab');
      
      // Test escape key to close modal
      await ongoingTranslationPage.page.keyboard.press('Escape');
      await expect(ongoingTranslationPage.exportModal).toBeHidden();
    });

    test('should support keyboard navigation in save modal', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.saveSessionBtn.click();
      
      // Test tab navigation
      await ongoingTranslationPage.page.keyboard.press('Tab');
      await ongoingTranslationPage.page.keyboard.press('Tab');
      
      // Test escape key
      await ongoingTranslationPage.page.keyboard.press('Escape');
      await expect(ongoingTranslationPage.saveSessionModal).toBeHidden();
    });

    test('should have proper ARIA labels and roles', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.exportSessionBtn.click();
      
      // Verify modal has proper accessibility attributes
      await expect(ongoingTranslationPage.exportModal).toHaveAttribute('role', 'dialog');
      
      // Verify form controls have proper labels
      await expect(ongoingTranslationPage.exportSRTRadio).toHaveAttribute('type', 'radio');
      await expect(ongoingTranslationPage.page.locator('label[for="export-srt"]')).toBeVisible();
      
      await ongoingTranslationPage.cancelExportBtn.click();
    });
  });
});