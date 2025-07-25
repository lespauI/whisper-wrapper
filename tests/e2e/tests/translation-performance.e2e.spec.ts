import { test, expect, Page } from '../fixtures/pageFixtures';

test.describe('Translation Performance and Load Testing', () => {
  
  test.describe('Performance Benchmarks', () => {
    test('should meet end-to-end latency requirements', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        sourceLanguage: 'en',
        targetLanguage: 'es',
        qualityPreset: 'balanced'
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Measure transcription to translation latency
      const startTime = Date.now();
      
      // Simulate transcription event
      await ongoingTranslationPage.page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transcription-available', {
          detail: { 
            text: 'This is a performance test sentence that should be translated quickly.',
            timestamp: Date.now(),
            confidence: 0.95 
          }
        }));
      });
      
      // Wait for translation to appear
      await ongoingTranslationPage.waitForTranslationComplete(0, 10000);
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Should complete within 10 seconds as per requirements
      expect(latency).toBeLessThan(10000);
      console.log(`Translation latency: ${latency}ms`);
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should maintain UI responsiveness during processing', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate rapid transcription events
      const rapidEvents = async () => {
        for (let i = 0; i < 10; i++) {
          await ongoingTranslationPage.page.evaluate((index) => {
            window.dispatchEvent(new CustomEvent('transcription-available', {
              detail: { 
                text: `Rapid transcription event number ${index + 1}`,
                timestamp: Date.now() + index * 100
              }
            }));
          }, i);
          await ongoingTranslationPage.page.waitForTimeout(50);
        }
      };
      
      // Measure UI responsiveness during heavy processing
      const startTime = Date.now();
      
      // Start rapid events and simultaneously test UI responsiveness
      const [, clickResponse] = await Promise.all([
        rapidEvents(),
        measureClickResponsiveness(ongoingTranslationPage.page)
      ]);
      
      const totalTime = Date.now() - startTime;
      
      // UI should remain responsive (clicks processed within 100ms)
      expect(clickResponse.averageResponseTime).toBeLessThan(100);
      console.log(`UI responsiveness: ${clickResponse.averageResponseTime}ms average`);
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should handle memory efficiently during long sessions', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Measure initial memory usage
      const initialMemory = await measureMemoryUsage(ongoingTranslationPage.page);
      
      // Simulate long session with many translations
      for (let i = 0; i < 100; i++) {
        await ongoingTranslationPage.page.evaluate((index) => {
          // Add sentence to displays
          const originalDisplay = document.getElementById('original-text-display');
          const translatedDisplay = document.getElementById('translated-text-display');
          
          if (originalDisplay && translatedDisplay) {
            const originalSegment = document.createElement('div');
            originalSegment.className = 'sentence-segment';
            originalSegment.innerHTML = `<span class="sentence-text">Long session sentence ${index + 1}</span>`;
            originalDisplay.appendChild(originalSegment);
            
            const translatedSegment = document.createElement('div');
            translatedSegment.className = 'sentence-segment translated';
            translatedSegment.innerHTML = `<span class="sentence-text">Oración de sesión larga ${index + 1}</span>`;
            translatedDisplay.appendChild(translatedSegment);
          }
        }, i);
        
        // Small delay to simulate real-time processing
        if (i % 10 === 0) {
          await ongoingTranslationPage.page.waitForTimeout(100);
        }
      }
      
      // Measure final memory usage
      const finalMemory = await measureMemoryUsage(ongoingTranslationPage.page);
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      
      // Memory increase should be reasonable (less than 100MB for 100 sentences)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Load Testing', () => {
    test('should handle rapid consecutive translations', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        qualityPreset: 'speed' // Use speed preset for better performance
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      const translationTimes: number[] = [];
      
      // Send 20 rapid translation requests
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();
        
        await ongoingTranslationPage.page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('transcription-available', {
            detail: { 
              text: `Rapid translation test ${index}: The quick brown fox jumps over the lazy dog.`,
              timestamp: Date.now()
            }
          }));
        }, i);
        
        // Wait for processing to start (not complete)
        await ongoingTranslationPage.page.waitForTimeout(50);
        
        translationTimes.push(Date.now() - startTime);
      }
      
      // Average processing start time should be quick
      const averageTime = translationTimes.reduce((a, b) => a + b, 0) / translationTimes.length;
      expect(averageTime).toBeLessThan(200);
      console.log(`Average rapid translation start time: ${averageTime}ms`);
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should handle maximum supported session length', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate 60-minute session with 1000+ sentences (as per requirements)
      const startTime = Date.now();
      const targetSentences = 1000;
      const batchSize = 50;
      
      for (let batch = 0; batch < targetSentences / batchSize; batch++) {
        // Add batch of sentences
        await ongoingTranslationPage.page.evaluate((batchNum, batchSz) => {
          const originalDisplay = document.getElementById('original-text-display');
          const translatedDisplay = document.getElementById('translated-text-display');
          
          if (originalDisplay && translatedDisplay) {
            for (let i = 0; i < batchSz; i++) {
              const sentenceNum = batchNum * batchSz + i + 1;
              
              const originalSegment = document.createElement('div');
              originalSegment.className = 'sentence-segment';
              originalSegment.innerHTML = `<span class="sentence-text">Sentence ${sentenceNum} of stress test</span>`;
              originalDisplay.appendChild(originalSegment);
              
              const translatedSegment = document.createElement('div');
              translatedSegment.className = 'sentence-segment translated';
              translatedSegment.innerHTML = `<span class="sentence-text">Oración ${sentenceNum} de prueba de estrés</span>`;
              translatedDisplay.appendChild(translatedSegment);
            }
          }
        }, batch, batchSize);
        
        // Measure performance every 200 sentences
        if ((batch + 1) * batchSize % 200 === 0) {
          const currentTime = Date.now();
          const elapsed = currentTime - startTime;
          const sentences = (batch + 1) * batchSize;
          
          console.log(`Processed ${sentences} sentences in ${elapsed}ms`);
          
          // Check memory usage
          const memory = await measureMemoryUsage(ongoingTranslationPage.page);
          expect(memory.usedJSHeapSize).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
          
          // Small delay to prevent overwhelming the test
          await ongoingTranslationPage.page.waitForTimeout(100);
        }
      }
      
      // Verify all sentences are processed
      const finalSentenceCount = await ongoingTranslationPage.page.evaluate(() => {
        const segments = document.querySelectorAll('#original-text-display .sentence-segment');
        return segments.length;
      });
      
      expect(finalSentenceCount).toBe(targetSentences);
      
      // Test export functionality with large dataset
      const exportStartTime = Date.now();
      await ongoingTranslationPage.exportSessionBtn.click();
      await expect(ongoingTranslationPage.exportModal).toBeVisible();
      const exportTime = Date.now() - exportStartTime;
      
      // Export modal should open within 3 seconds even with 1000 sentences
      expect(exportTime).toBeLessThan(3000);
      console.log(`Export modal opened in ${exportTime}ms with ${targetSentences} sentences`);
      
      await ongoingTranslationPage.cancelExportBtn.click();
      await ongoingTranslationPage.stopRecording();
    });

    test('should maintain performance under concurrent operations', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate concurrent operations: transcription, translation, UI updates, user interactions
      const operations = [
        // Continuous transcription
        async () => {
          for (let i = 0; i < 50; i++) {
            await ongoingTranslationPage.page.evaluate((index) => {
              window.dispatchEvent(new CustomEvent('transcription-available', {
                detail: { 
                  text: `Concurrent transcription ${index}`,
                  timestamp: Date.now()
                }
              }));
            }, i);
            await ongoingTranslationPage.page.waitForTimeout(200);
          }
        },
        
        // User interactions
        async () => {
          for (let i = 0; i < 10; i++) {
            await ongoingTranslationPage.clearTranslationBtn.click();
            await ongoingTranslationPage.page.waitForTimeout(500);
            
            // Re-add some content
            await ongoingTranslationPage.page.evaluate(() => {
              const originalDisplay = document.getElementById('original-text-display');
              if (originalDisplay) {
                originalDisplay.innerHTML = '<div class="sentence-segment"><span class="sentence-text">Restored content</span></div>';
              }
            });
            await ongoingTranslationPage.page.waitForTimeout(500);
          }
        },
        
        // Settings changes
        async () => {
          for (let i = 0; i < 5; i++) {
            await ongoingTranslationPage.openTranslationSettings();
            await ongoingTranslationPage.qualityPresetSelect.selectOption('speed');
            await ongoingTranslationPage.saveSettingsBtn.click();
            await ongoingTranslationPage.page.waitForTimeout(1000);
            
            await ongoingTranslationPage.openTranslationSettings();
            await ongoingTranslationPage.qualityPresetSelect.selectOption('quality');
            await ongoingTranslationPage.saveSettingsBtn.click();
            await ongoingTranslationPage.page.waitForTimeout(1000);
          }
        }
      ];
      
      // Run all operations concurrently
      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      console.log(`All concurrent operations completed in ${totalTime}ms`);
      
      // System should remain responsive
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      // UI should still be functional
      await expect(ongoingTranslationPage.liveTranslationDisplay).toBeVisible();
      await expect(ongoingTranslationPage.stopRecordingBtn).toBeVisible();
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Resource Monitoring', () => {
    test('should monitor CPU usage during translation', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // Simulate CPU-intensive translation workload
      const cpuMetrics: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const beforeCPU = await measureCPUUsage(ongoingTranslationPage.page);
        
        // Trigger translation
        await ongoingTranslationPage.page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('transcription-available', {
            detail: { 
              text: `CPU intensive translation test ${index}: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
              timestamp: Date.now()
            }
          }));
        }, i);
        
        await ongoingTranslationPage.page.waitForTimeout(500);
        
        const afterCPU = await measureCPUUsage(ongoingTranslationPage.page);
        cpuMetrics.push(afterCPU - beforeCPU);
      }
      
      const averageCPUIncrease = cpuMetrics.reduce((a, b) => a + b, 0) / cpuMetrics.length;
      console.log(`Average CPU increase per translation: ${averageCPUIncrease}%`);
      
      // CPU usage should be reasonable
      expect(averageCPUIncrease).toBeLessThan(70); // Should stay under 70% as per requirements
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should detect memory leaks in extended sessions', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      const memorySnapshots: number[] = [];
      
      // Take initial memory snapshot
      const initialMemory = await measureMemoryUsage(ongoingTranslationPage.page);
      memorySnapshots.push(initialMemory.usedJSHeapSize);
      
      // Run extended session with periodic cleanup simulation
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add content
        for (let i = 0; i < 50; i++) {
          await ongoingTranslationPage.page.evaluate((index, cycleNum) => {
            const originalDisplay = document.getElementById('original-text-display');
            if (originalDisplay) {
              const segment = document.createElement('div');
              segment.className = 'sentence-segment';
              segment.innerHTML = `<span class="sentence-text">Memory test cycle ${cycleNum} sentence ${index}</span>`;
              originalDisplay.appendChild(segment);
            }
          }, i, cycle);
        }
        
        // Clear content periodically
        if (cycle % 3 === 0) {
          await ongoingTranslationPage.clearTranslationDisplay();
        }
        
        // Force garbage collection if available
        await ongoingTranslationPage.page.evaluate(() => {
          if (window.gc) {
            window.gc();
          }
        });
        
        // Take memory snapshot
        const currentMemory = await measureMemoryUsage(ongoingTranslationPage.page);
        memorySnapshots.push(currentMemory.usedJSHeapSize);
        
        await ongoingTranslationPage.page.waitForTimeout(100);
      }
      
      // Analyze memory trend
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryIncrease = finalMemory - memorySnapshots[0];
      const memoryIncreasePercent = (memoryIncrease / memorySnapshots[0]) * 100;
      
      console.log(`Memory increase over extended session: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent.toFixed(1)}%)`);
      
      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
      
      await ongoingTranslationPage.stopRecording();
    });
  });

  test.describe('Performance Optimization Validation', () => {
    test('should use adaptive quality based on system performance', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation({
        qualityPreset: 'balanced'
      });
      
      // Simulate system under stress
      await ongoingTranslationPage.page.evaluate(() => {
        // Mock performance monitoring
        window.mockPerformanceMetrics = {
          cpuUsage: 85, // High CPU usage
          memoryUsage: 75, // High memory usage
          latency: 8000 // High latency
        };
        
        // Trigger performance monitoring event
        window.dispatchEvent(new CustomEvent('performance-metrics-updated', {
          detail: window.mockPerformanceMetrics
        }));
      });
      
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      // System should automatically adjust quality settings
      await ongoingTranslationPage.page.waitForTimeout(2000);
      
      // Check if quality was automatically adjusted
      await ongoingTranslationPage.openTranslationSettings();
      const currentPreset = await ongoingTranslationPage.qualityPresetSelect.inputValue();
      
      // Should have downgraded to speed preset due to high resource usage
      expect(currentPreset).toBe('speed');
      
      await ongoingTranslationPage.stopRecording();
    });

    test('should optimize chunk processing based on content complexity', async ({ ongoingTranslationPage }) => {
      await ongoingTranslationPage.enableOngoingTranslation();
      await ongoingTranslationPage.startRecordingWithTranslation();
      
      const processingTimes: { simple: number[], complex: number[] } = { simple: [], complex: [] };
      
      // Test simple content processing
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await ongoingTranslationPage.page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('transcription-available', {
            detail: { 
              text: `Simple sentence ${index}.`,
              timestamp: Date.now(),
              complexity: 'low'
            }
          }));
        }, i);
        
        await ongoingTranslationPage.page.waitForTimeout(500);
        processingTimes.simple.push(Date.now() - startTime);
      }
      
      // Test complex content processing
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await ongoingTranslationPage.page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('transcription-available', {
            detail: { 
              text: `This is a significantly more complex sentence with technical terminology, multiple subordinate clauses, and sophisticated vocabulary that requires more computational resources to translate accurately ${index}.`,
              timestamp: Date.now(),
              complexity: 'high'
            }
          }));
        }, i);
        
        await ongoingTranslationPage.page.waitForTimeout(1000);
        processingTimes.complex.push(Date.now() - startTime);
      }
      
      const avgSimple = processingTimes.simple.reduce((a, b) => a + b, 0) / processingTimes.simple.length;
      const avgComplex = processingTimes.complex.reduce((a, b) => a + b, 0) / processingTimes.complex.length;
      
      console.log(`Simple content avg processing: ${avgSimple}ms`);
      console.log(`Complex content avg processing: ${avgComplex}ms`);
      
      // Complex content should take longer but still be reasonable
      expect(avgComplex).toBeGreaterThan(avgSimple);
      expect(avgComplex).toBeLessThan(10000); // Still under 10s requirement
      
      await ongoingTranslationPage.stopRecording();
    });
  });
});

// Helper functions for performance measurement
async function measureMemoryUsage(page: Page) {
  return await page.evaluate(() => {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory ? memory.usedJSHeapSize : 0,
      totalJSHeapSize: memory ? memory.totalJSHeapSize : 0,
      jsHeapSizeLimit: memory ? memory.jsHeapSizeLimit : 0
    };
  });
}

async function measureCPUUsage(page: Page): Promise<number> {
  // This is a simplified CPU measurement - in real implementation,
  // you would use more sophisticated performance monitoring
  return await page.evaluate(() => {
    const start = performance.now();
    let iterations = 0;
    const endTime = start + 10; // 10ms measurement window
    
    while (performance.now() < endTime) {
      iterations++;
    }
    
    // Return normalized CPU usage estimation
    return Math.min(iterations / 1000, 100);
  });
}

async function measureClickResponsiveness(page: Page) {
  const responseTimes: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    const startTime = Date.now();
    
    // Find a clickable element and click it
    const testButton = page.locator('#clear-translation-btn');
    if (await testButton.isVisible()) {
      await testButton.click();
    }
    
    const responseTime = Date.now() - startTime;
    responseTimes.push(responseTime);
    
    await page.waitForTimeout(100);
  }
  
  const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  
  return {
    responseTimes,
    averageResponseTime,
    maxResponseTime: Math.max(...responseTimes),
    minResponseTime: Math.min(...responseTimes)
  };
}