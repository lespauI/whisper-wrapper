import { test, expect } from '../fixtures/pageFixtures';

test.describe('Ongoing Translation - Core Functionality', () => {
  
  test.describe('Translation Settings Management', () => {
    test('should display translation settings in settings modal', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.openTranslationSettings();
      
      // Verify all translation settings are visible
      await expect(ongoingTranslationPage.translationEnabledCheckbox).toBeVisible();
      await expect(ongoingTranslationPage.sourceLanguageSelect).toBeVisible();
      await expect(ongoingTranslationPage.targetLanguageSelect).toBeVisible();
      await expect(ongoingTranslationPage.translationModelSelect).toBeVisible();
      await expect(ongoingTranslationPage.qualityPresetSelect).toBeVisible();
      await expect(ongoingTranslationPage.chunkSizeInput).toBeVisible();
      await expect(ongoingTranslationPage.overlapSizeInput).toBeVisible();
    });

    test('should enable translation with default settings', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      
      // Verify translation is enabled in settings
      await ongoingTranslationPage.openTranslationSettings();
      await expect(ongoingTranslationPage.translationEnabledCheckbox).toBeChecked();
    });

    test('should configure custom translation settings', async ({ ongoingTranslationPage }) => {
      const customSettings = {
        sourceLanguage: 'es',
        targetLanguage: 'en',
        model: 'gemma2:7b',
        qualityPreset: 'quality'
      };

      await ongoingTranslationPage.enableOngoingTranslation(customSettings);
      
      // Verify settings are saved
      await ongoingTranslationPage.openTranslationSettings();
      await expect(ongoingTranslationPage.sourceLanguageSelect).toHaveValue(customSettings.sourceLanguage);
      await expect(ongoingTranslationPage.targetLanguageSelect).toHaveValue(customSettings.targetLanguage);
      await expect(ongoingTranslationPage.translationModelSelect).toHaveValue(customSettings.model);
      await expect(ongoingTranslationPage.qualityPresetSelect).toHaveValue(customSettings.qualityPreset);
    });

    test('should disable dependent settings when translation is disabled', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.disableOngoingTranslation();
      
      // Verify dependent settings are disabled
      await ongoingTranslationPage.openTranslationSettings();
      await expect(ongoingTranslationPage.sourceLanguageSelect).toBeDisabled();
      await expect(ongoingTranslationPage.targetLanguageSelect).toBeDisabled();
      await expect(ongoingTranslationPage.translationModelSelect).toBeDisabled();
    });

    test('should validate chunk size and overlap settings', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.openTranslationSettings();
      
      // Set invalid overlap size (larger than chunk size)
      await ongoingTranslationPage.chunkSizeInput.fill('2000');
      await ongoingTranslationPage.overlapSizeInput.fill('3000');
      
      // Trigger validation
      await ongoingTranslationPage.chunkSizeInput.blur();
      await ongoingTranslationPage.overlapSizeInput.blur();
      
      // Verify overlap size is adjusted
      await expect(ongoingTranslationPage.overlapSizeInput).not.toHaveValue('3000');
    });
  });

  test.describe('Live Translation Display', () => {
    test.beforeEach(async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        sourceLanguage: 'en',
        targetLanguage: 'es'
      });
    });

    test('should show translation display when recording starts', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Verify translation display is visible
      await ongoingTranslationPage.verifyTranslationDisplayActive();
      
      // Verify language labels are correct
      await expect(ongoingTranslationPage.sourceLanguageDisplay).toContainText('English');
      await expect(ongoingTranslationPage.targetLanguageDisplay).toContainText('Spanish');
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should display translation controls', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Verify all translation controls are visible
      await expect(ongoingTranslationPage.clearTranslationBtn).toBeVisible();
      await expect(ongoingTranslationPage.copyOriginalBtn).toBeVisible();
      await expect(ongoingTranslationPage.copyTranslatedBtn).toBeVisible();
      await expect(ongoingTranslationPage.exportSessionBtn).toBeVisible();
      await expect(ongoingTranslationPage.saveSessionBtn).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should clear translation display when clear button is clicked', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate some content (in real test, this would come from audio processing)
      await ongoingTranslationPage.page.evaluate(() => {
        const originalDisplay = document.getElementById('original-text-display');
        if (originalDisplay) {
          originalDisplay.innerHTML = '<div class="sentence-segment"><span class="sentence-text">Test content</span></div>';
        }
      });
      
      // Clear display
      await ongoingTranslationPage.clearTranslationDisplay();
      
      // Verify displays are empty
      await expect(ongoingTranslationPage.originalTextDisplay).toBeEmpty();
      await expect(ongoingTranslationPage.translatedTextDisplay).toBeEmpty();
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Recording Integration', () => {
    test.beforeEach(async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
    });

    test('should start recording with translation enabled', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Verify recording is active
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeVisible();
      await expect(ongoingTranslationPage.startRecordingBtn).toBeHidden();
      
      // Verify translation display is shown
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should stop recording and maintain translation display', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Add some test content
      await ongoingTranslationPage.page.evaluate(() => {
        const originalDisplay = document.getElementById('original-text-display');
        if (originalDisplay) {
          originalDisplay.innerHTML = '<div class="sentence-segment"><span class="sentence-text">Test recording content</span></div>';
        }
      });
      
      await ongoingTranslationPage.stopRecording();
      
      // Verify recording is stopped
      await expect(ongoingTranslationPage.startRecordingBtn).toBeVisible();
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeHidden();
      
      // Verify translation display remains visible with content
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeVisible();
      const originalText = await ongoingTranslationPage.getOriginalText();
      expect(originalText).toContain('Test recording content');
    });

    test('should handle recording without translation enabled', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.disableOngoingTranslation();
      await ongoingTranslationPage.ensureRecordingTabActive();
      
      // Start recording without translation
      await ongoingTranslationPage.startRecordingBtn.click();
      
      // Verify translation display is not shown
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeHidden();
      
      // Stop recording
      await ongoingTranslationPage.stopRecordingBtn.click();
    });
  });

  test.describe('Audio Processing Simulation', () => {
    test.beforeEach(async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      });
    });

    test('should process simulated audio data', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate microphone input
      await ongoingTranslationPage.simulateMicrophoneInput();
      
      // In a real test, we would verify that audio processing starts
      // For now, we'll just verify the UI remains responsive
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should handle rapid audio chunks', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate multiple rapid audio chunks
      for (let i = 0; i < 5; i++) {
        await ongoingTranslationPage.simulateMicrophoneInput();
        await ongoingTranslationPage.page.waitForTimeout(100);
      }
      
      // Verify UI remains responsive
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeVisible();
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Quality Preset Management', () => {
    test('should apply quality preset settings', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        qualityPreset: 'quality'
      });
      
      // Verify quality preset affects chunk settings
      await ongoingTranslationPage.openTranslationSettings();
      await expect(ongoingTranslationPage.chunkSizeInput).toHaveValue('5000');
      await expect(ongoingTranslationPage.overlapSizeInput).toHaveValue('1000');
    });

    test('should apply balanced preset settings', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        qualityPreset: 'balanced'
      });
      
      await ongoingTranslationPage.openTranslationSettings();
      await expect(ongoingTranslationPage.chunkSizeInput).toHaveValue('3000');
      await expect(ongoingTranslationPage.overlapSizeInput).toHaveValue('500');
    });

    test('should apply speed preset settings', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        qualityPreset: 'speed'
      });
      
      await ongoingTranslationPage.openTranslationSettings();
      await expect(ongoingTranslationPage.chunkSizeInput).toHaveValue('2000');
      await expect(ongoingTranslationPage.overlapSizeInput).toHaveValue('250');
    });
  });

  test.describe('Cross-Tab Functionality', () => {
    test('should maintain translation settings across tab switches', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        sourceLanguage: 'de',
        targetLanguage: 'en'
      });
      
      // Switch to transcription tab and back
      await ongoingTranslationPage.switchTab('transcription');
      await ongoingTranslationPage.switchTab('record');
      
      // Verify settings are maintained
      await ongoingTranslationPage.openTranslationSettings();
      await expect(ongoingTranslationPage.translationEnabledCheckbox).toBeChecked();
      await expect(ongoingTranslationPage.sourceLanguageSelect).toHaveValue('de');
      await expect(ongoingTranslationPage.targetLanguageSelect).toHaveValue('en');
    });

    test('should maintain translation display when switching tabs during recording', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Add some content
      await ongoingTranslationPage.page.evaluate(() => {
        const originalDisplay = document.getElementById('original-text-display');
        if (originalDisplay) {
          originalDisplay.innerHTML = '<div class="sentence-segment"><span class="sentence-text">Persistent content</span></div>';
        }
      });
      
      // Switch tabs and return
      await ongoingTranslationPage.switchTab('transcription');
      await ongoingTranslationPage.switchTab('record');
      
      // Verify content is maintained
      const originalText = await ongoingTranslationPage.getOriginalText();
      expect(originalText).toContain('Persistent content');
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display translation controls responsively on mobile viewport', async ({ ongoingTranslationPage }) => {
      // Set mobile viewport
      await ongoingTranslationPage.page.setViewportSize({ width: 375, height: 667 });
      
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Verify translation display adapts to mobile
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeVisible();
      await expect(ongoingTranslationPage.exportSessionBtn).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should display translation controls responsively on tablet viewport', async ({ ongoingTranslationPage }) => {
      // Set tablet viewport
      await ongoingTranslationPage.page.setViewportSize({ width: 768, height: 1024 });
      
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Verify translation display works on tablet
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeVisible();
      await expect(ongoingTranslationPage.originalTextDisplay).toBeVisible();
      await expect(ongoingTranslationPage.translatedTextDisplay).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });
  });
});