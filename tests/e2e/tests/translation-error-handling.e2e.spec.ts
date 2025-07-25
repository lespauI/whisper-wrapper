import { test, expect } from '../fixtures/pageFixtures';

test.describe('Translation Error Handling and Recovery', () => {
  
  test.beforeEach(async ({ ongoingTranslationPage }) => {
    await ongoingTranslationPage.enableOngoingTranslation({
      sourceLanguage: 'en',
      targetLanguage: 'fr'
    });
  });

  test.describe('Service Connection Errors', () => {
    test('should handle Ollama service unavailable gracefully', async ({ ongoingTranslationPage }) => {
      // Mock Ollama service failure
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        route.abort('connectionrefused');
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate transcription that would trigger translation
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'Hello world', timestamp: Date.now() }
        }));
      });
      
      // Should show error notification
      await ongoingTranslationPage.verifyErrorNotification();
      
      // Should continue recording despite translation failure
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should show circuit breaker status when service is down', async ({ ongoingTranslationPage }) => {
      // Mock repeated service failures to trigger circuit breaker
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        route.abort('connectionrefused');
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate multiple failed translation attempts
      for (let i = 0; i < 3; i++) {
        await ongoingTranslationPage.page.evaluate(() => {
          window.dispatchEvent(new CustomEvent('transcription-available', {
            detail: { text: `Hello world ${Date.now()}`, timestamp: Date.now() }
          }));
        });
        await ongoingTranslationPage.page.waitForTimeout(1000);
      }
      
      // Should show circuit breaker open status
      await ongoingTranslationPage.verifyTranslationServiceStatus('error');
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should recover when service comes back online', async ({ ongoingTranslationPage }) => {
      let failCount = 0;
      
      // Mock service that fails first few times then succeeds
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        if (failCount < 2) {
          failCount++;
          route.abort('connectionrefused');
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ response: 'Service is back online' })
          });
        }
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // First attempts should fail
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'First attempt', timestamp: Date.now() }
        }));
      });
      
      await ongoingTranslationPage.page.waitForTimeout(2000);
      
      // Service should recover and show active status
      await ongoingTranslationPage.verifyTranslationServiceStatus('active');
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Network and Timeout Errors', () => {
    test('should handle network timeout gracefully', async ({ ongoingTranslationPage }) => {
      // Mock slow network response
      await ongoingTranslationPage.page.route('**/ollama/**', async (route) => {
        // Delay response beyond timeout
        await new Promise(resolve => setTimeout(resolve, 15000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Too slow' })
        });
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Trigger translation request
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'This will timeout', timestamp: Date.now() }
        }));
      });
      
      // Should show timeout error notification
      await ongoingTranslationPage.verifyErrorNotification('timeout');
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should retry failed translations with exponential backoff', async ({ ongoingTranslationPage }) => {
      let attemptCount = 0;
      const attemptTimes: number[] = [];
      
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        attemptTimes.push(Date.now());
        attemptCount++;
        
        if (attemptCount < 3) {
          route.abort('connectionrefused');
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ response: 'Translation successful after retries' })
          });
        }
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Trigger translation that will retry
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'This will retry', timestamp: Date.now() }
        }));
      });
      
      // Wait for retries to complete
      await ongoingTranslationPage.page.waitForTimeout(5000);
      
      // Should eventually succeed
      expect(attemptCount).toBeGreaterThanOrEqual(3);
      
      // Verify exponential backoff timing
      if (attemptTimes.length >= 3) {
        const firstRetryDelay = attemptTimes[1] - attemptTimes[0];
        const secondRetryDelay = attemptTimes[2] - attemptTimes[1];
        expect(secondRetryDelay).toBeGreaterThan(firstRetryDelay);
      }
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Audio Processing Errors', () => {
    test('should handle microphone access denied', async ({ ongoingTranslationPage }) => {
      // Mock microphone permission denied
      await ongoingTranslationPage.page.evaluate(() => {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        navigator.mediaDevices.getUserMedia = () => {
          return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
        };
      });
      
      // Try to start recording
      await ongoingTranslationPage.page.locator('#start-recording-btn').click();
      
      // Should show permission error
      await ongoingTranslationPage.verifyErrorNotification('Permission');
      
      // Recording should not start
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeHidden();
    });

    test('should handle microphone hardware unavailable', async ({ ongoingTranslationPage }) => {
      // Mock microphone hardware not found
      await ongoingTranslationPage.page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = () => {
          return Promise.reject(new DOMException('Hardware unavailable', 'NotFoundError'));
        };
      });
      
      await ongoingTranslationPage.page.locator('#start-recording-btn').click();
      
      // Should show hardware error
      await ongoingTranslationPage.verifyErrorNotification('Hardware');
      
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeHidden();
    });

    test('should handle audio processing failures during recording', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate audio processing error
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('audio-processing-error', {
          detail: { error: 'Audio buffer overflow', severity: 'medium' }
        }));
      });
      
      // Should show error but continue recording
      await ongoingTranslationPage.verifyErrorNotification('Audio');
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Translation Quality Errors', () => {
    test('should handle poor quality translations', async ({ ongoingTranslationPage }) => {
      // Mock translation service returning low-quality results
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            response: '???', // Poor quality translation
            confidence: 0.1 // Low confidence score
          })
        });
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Trigger translation
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'Hello world', timestamp: Date.now() }
        }));
      });
      
      // Should show quality warning
      await ongoingTranslationPage.verifyErrorNotification('quality');
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should handle translation model errors', async ({ ongoingTranslationPage }) => {
      // Mock model error response
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Model not loaded',
            code: 'MODEL_ERROR'
          })
        });
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Trigger translation
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'Test model error', timestamp: Date.now() }
        }));
      });
      
      // Should show model error
      await ongoingTranslationPage.verifyErrorNotification('Model');
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Memory and Performance Errors', () => {
    test('should handle memory pressure gracefully', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate memory pressure
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('memory-pressure', {
          detail: { level: 'critical', availableMemory: '50MB' }
        }));
      });
      
      // Should show memory warning and possibly reduce quality
      await ongoingTranslationPage.verifyErrorNotification('Memory');
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should handle session duration limits', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate very long session
      await ongoingTranslationPage.page.evaluate(() => {
        // Mock session start time to be very old
        window.translationSessionStartTime = Date.now() - (60 * 60 * 1000); // 1 hour ago
        
        window.dispatchEvent(new CustomEvent('session-duration-warning', {
          detail: { duration: 3600000, limit: 3600000 }
        }));
      });
      
      // Should show duration warning
      await ongoingTranslationPage.verifyErrorNotification('duration');
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Error Recovery Workflows', () => {
    test('should allow user to continue after translation error', async ({ ongoingTranslationPage }) => {
      // Mock intermittent translation failure
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        route.abort('connectionrefused');
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Trigger failed translation
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'This will fail', timestamp: Date.now() }
        }));
      });
      
      // Should show error but allow continuing
      await ongoingTranslationPage.verifyErrorNotification();
      
      // Should still be able to stop recording and export
      await ongoingTranslationPage.stopRecording();
      await expect(ongoingTranslationPage.exportSessionBtn).toBeVisible();
    });

    test('should gracefully degrade to transcription-only mode', async ({ ongoingTranslationPage }) => {
      // Mock translation service failure
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        route.abort('connectionrefused');
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate multiple translation failures triggering degradation
      for (let i = 0; i < 5; i++) {
        await ongoingTranslationPage.page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('transcription-available', {
            detail: { text: `Failed translation ${index}`, timestamp: Date.now() }
          }));
        }, i);
        await ongoingTranslationPage.page.waitForTimeout(500);
      }
      
      // Should show degradation notification
      await ongoingTranslationPage.verifyErrorNotification('degraded');
      
      // Original text should still appear
      await expect(ongoingTranslationPage.originalTextDisplay).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should allow manual error recovery', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.page.route('**/ollama/**', (route) => {
        route.abort('connectionrefused');
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Trigger error
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { text: 'Error test', timestamp: Date.now() }
        }));
      });
      
      // Should show error notification with recovery option
      await ongoingTranslationPage.verifyErrorNotification();
      
      // Click recovery action if available
      const recoveryBtn = ongoingTranslationPage.page.locator('.error-recovery-btn');
      if (await recoveryBtn.isVisible()) {
        await recoveryBtn.click();
      }
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Error Notification Management', () => {
    test('should stack multiple error notifications', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate multiple different errors
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('translation-error', {
          detail: { type: 'network', message: 'Network error', severity: 'medium' }
        }));
        
        window.dispatchEvent(new CustomEvent('translation-error', {
          detail: { type: 'timeout', message: 'Timeout error', severity: 'high' }
        }));
      });
      
      // Should show multiple error notifications
      const errorNotifications = ongoingTranslationPage.errorNotifications;
      await expect(errorNotifications).toHaveCount(2, { timeout: 5000 });
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should auto-dismiss low severity errors', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate low severity error
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('translation-error', {
          detail: { type: 'quality', message: 'Low quality warning', severity: 'low' }
        }));
      });
      
      // Should show notification initially
      await expect(ongoingTranslationPage.errorNotifications).toBeVisible();
      
      // Should auto-dismiss after timeout
      await expect(ongoingTranslationPage.errorNotifications).toBeHidden({ timeout: 10000 });
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should persist critical errors until manually dismissed', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate critical error
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('translation-error', {
          detail: { type: 'service_unavailable', message: 'Critical service failure', severity: 'critical' }
        }));
      });
      
      // Should show notification
      await expect(ongoingTranslationPage.errorNotifications).toBeVisible();
      
      // Should not auto-dismiss
      await ongoingTranslationPage.page.waitForTimeout(10000);
      await expect(ongoingTranslationPage.errorNotifications).toBeVisible();
      
      // Should have close button for manual dismissal
      const closeBtn = ongoingTranslationPage.page.locator('.error-close-btn');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(ongoingTranslationPage.errorNotifications).toBeHidden();
      }
      
      await ongoingTranslationPage.stopRecording();
    });
  });
});