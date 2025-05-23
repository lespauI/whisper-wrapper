const LocalWhisperService = require('../../src/services/localWhisperService');
const TranscriptionService = require('../../src/services/transcriptionService');
const fs = require('fs');
const path = require('path');

describe('Local Whisper Integration Tests', () => {
    let localWhisperService;
    let transcriptionService;

    beforeAll(() => {
        // These tests require actual whisper.cpp installation
        // Skip if not available in CI environment
        if (process.env.CI && !process.env.WHISPER_INTEGRATION_TESTS) {
            console.log('Skipping integration tests in CI environment');
            return;
        }
    });

    beforeEach(() => {
        localWhisperService = new LocalWhisperService();
        transcriptionService = new TranscriptionService();
    });

    describe('Whisper Binary Detection', () => {
        it('should detect whisper binary if installed', () => {
            const isAvailable = localWhisperService.isAvailable();
            
            if (isAvailable) {
                expect(localWhisperService.whisperPath).toBeTruthy();
                expect(fs.existsSync(localWhisperService.whisperPath)).toBe(true);
            } else {
                console.log('Whisper binary not found - run setup script first');
            }
        });

        it('should find available models', () => {
            const models = localWhisperService.getAvailableModels();
            
            if (localWhisperService.isAvailable()) {
                expect(Array.isArray(models)).toBe(true);
                
                if (models.length > 0) {
                    expect(models[0]).toHaveProperty('name');
                    expect(models[0]).toHaveProperty('path');
                    expect(models[0]).toHaveProperty('size');
                }
            }
        });
    });

    describe('Configuration Integration', () => {
        it('should set and validate model configuration', () => {
            const availableModels = localWhisperService.getAvailableModels();
            
            if (availableModels.length > 0) {
                const modelName = availableModels[0].name;
                
                expect(() => {
                    localWhisperService.setModel(modelName);
                }).not.toThrow();
                
                expect(localWhisperService.model).toBe(modelName);
            }
        });

        it('should validate thread configuration', () => {
            expect(() => {
                localWhisperService.setThreads(4);
            }).not.toThrow();
            
            expect(localWhisperService.threads).toBe(4);
            
            expect(() => {
                localWhisperService.setThreads(0);
            }).toThrow();
            
            expect(() => {
                localWhisperService.setThreads(17);
            }).toThrow();
        });

        it('should validate language configuration', () => {
            expect(() => {
                localWhisperService.setLanguage('auto');
            }).not.toThrow();
            
            expect(() => {
                localWhisperService.setLanguage('en');
            }).not.toThrow();
            
            expect(localWhisperService.language).toBe('en');
        });
    });

    describe('Service Integration', () => {
        it('should integrate with TranscriptionService', () => {
            expect(transcriptionService.localWhisper).toBeInstanceOf(LocalWhisperService);
            expect(transcriptionService.isAvailable()).toBe(localWhisperService.isAvailable());
        });

        it('should propagate configuration changes', () => {
            transcriptionService.setModel('base');
            transcriptionService.setLanguage('en');
            transcriptionService.setThreads(8);
            
            expect(transcriptionService.localWhisper.model).toBe('base');
            expect(transcriptionService.localWhisper.language).toBe('en');
            expect(transcriptionService.localWhisper.threads).toBe(8);
        });
    });

    describe('Installation Test', () => {
        it('should test installation if whisper is available', async () => {
            if (!localWhisperService.isAvailable()) {
                console.log('Skipping installation test - whisper not available');
                return;
            }

            const testResult = await localWhisperService.testInstallation();
            
            expect(testResult).toHaveProperty('success');
            
            if (testResult.success) {
                expect(testResult).toHaveProperty('whisperPath');
                expect(testResult).toHaveProperty('modelsPath');
                expect(fs.existsSync(testResult.whisperPath)).toBe(true);
            } else {
                console.log('Installation test failed:', testResult.error);
            }
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle missing binary gracefully', () => {
            const serviceWithoutBinary = new LocalWhisperService();
            serviceWithoutBinary.whisperPath = '/nonexistent/path';
            
            expect(serviceWithoutBinary.isAvailable()).toBe(false);
        });

        it('should handle invalid model names', () => {
            expect(() => {
                localWhisperService.setModel('nonexistent-model');
            }).toThrow('Invalid model');
        });

        it('should handle transcription service errors', async () => {
            if (!transcriptionService.isAvailable()) {
                await expect(transcriptionService.transcribeFile('/nonexistent/file.wav'))
                    .rejects.toThrow();
            }
        });
    });

    describe('File System Integration', () => {
        it('should handle model directory correctly', () => {
            const modelsPath = path.join(process.cwd(), 'models');
            
            if (fs.existsSync(modelsPath)) {
                const models = localWhisperService.getAvailableModels();
                const files = fs.readdirSync(modelsPath)
                    .filter(file => file.startsWith('ggml-') && file.endsWith('.bin'));
                
                expect(models.length).toBe(files.length);
            }
        });

        it('should handle whisper binary path correctly', () => {
            if (localWhisperService.isAvailable()) {
                expect(path.isAbsolute(localWhisperService.whisperPath)).toBe(true);
                expect(fs.existsSync(localWhisperService.whisperPath)).toBe(true);
            }
        });
    });

    describe('Performance and Resource Management', () => {
        it('should not leak resources during initialization', () => {
            const initialMemory = process.memoryUsage();
            
            // Create multiple service instances
            for (let i = 0; i < 10; i++) {
                new LocalWhisperService();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory increase should be reasonable (less than 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });

        it('should handle concurrent model queries efficiently', () => {
            const startTime = Date.now();
            
            // Query models multiple times concurrently
            const promises = Array(10).fill().map(() => 
                Promise.resolve(localWhisperService.getAvailableModels())
            );
            
            return Promise.all(promises).then(() => {
                const duration = Date.now() - startTime;
                // Should complete quickly (less than 1 second)
                expect(duration).toBeLessThan(1000);
            });
        });
    });
});