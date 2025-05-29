/**
 * E2E Test for Real Video Transcription
 * Tests the complete transcription pipeline using actual video files
 */

const path = require('path');
const fs = require('fs');
const TranscriptionService = require('../../src/services/transcriptionService');
const FileService = require('../../src/services/fileService');

describe('Real Video Transcription E2E', () => {
    let transcriptionService;
    let fileService;
    const testVideoPath = path.join(process.cwd(), 'tests/data', 'Thank you for contac.wav');

    beforeAll(() => {
        console.log('🧪 E2E Test: Setting up real video transcription test...');
        transcriptionService = new TranscriptionService();
        fileService = new FileService();
        
        // Check if test video exists
        if (!fs.existsSync(testVideoPath)) {
            throw new Error(`Test video not found: ${testVideoPath}`);
        }
        
        console.log(`📹 E2E Test: Using test video: ${testVideoPath}`);
        const stats = fs.statSync(testVideoPath);
        console.log(`📊 E2E Test: Video file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    });

    afterAll(() => {
        console.log('🧹 E2E Test: Cleaning up...');
        if (transcriptionService) {
            transcriptionService.cleanup();
        }
    });

    describe('Environment Setup', () => {
        test('should have whisper.cpp available', () => {
            console.log('🔍 E2E Test: Checking whisper.cpp availability...');
            const isAvailable = transcriptionService.isAvailable();
            console.log(`🤖 E2E Test: Whisper available: ${isAvailable}`);
            expect(isAvailable).toBe(true);
        });


        test('should have models available', () => {
            console.log('🔍 E2E Test: Checking available models...');
            const models = transcriptionService.getAvailableModels();
            console.log(`🤖 E2E Test: Available models:`, models.map(m => m.name));
            expect(models.length).toBeGreaterThan(0);
            
            // Check if tiny model is available (our default)
            const hastinyModel = models.some(m => m.name === 'tiny');
            expect(hastinyModel).toBe(true);
        });

        test('should be able to test whisper connection', async () => {
            console.log('🔍 E2E Test: Testing whisper connection...');
            const testResult = await transcriptionService.testConnection();
            console.log(`🤖 E2E Test: Connection test result:`, testResult);
            expect(testResult.success).toBe(true);
        }, 30000);
    });

    describe('File Processing', () => {
        test('should validate the test video file', async () => {
            console.log('🔍 E2E Test: Validating test video file...');
            
            expect(() => {
                fileService.validateFile(testVideoPath);
            }).not.toThrow();
            
            const fileInfo = fileService.getFileInfo(testVideoPath);
            console.log(`📹 E2E Test: File info:`, fileInfo);
            
            expect(fileInfo).toBeDefined();
            expect(fileInfo.name).toBe('Thank you for contac.wav');
            expect(fileInfo.extension).toBe('.wav');
            expect(fileInfo.size).toBeGreaterThan(0);
        });

        test('should copy file to temp directory', async () => {
            console.log('🔍 E2E Test: Testing file copy to temp...');
            
            const tempFilePath = await fileService.copyToTemp(testVideoPath);
            console.log(`📂 E2E Test: Temp file created: ${tempFilePath}`);
            
            expect(fs.existsSync(tempFilePath)).toBe(true);
            
            // Verify file size matches
            const originalStats = fs.statSync(testVideoPath);
            const tempStats = fs.statSync(tempFilePath);
            expect(tempStats.size).toBe(originalStats.size);
            
            // Clean up
            await fileService.cleanup(tempFilePath);
            expect(fs.existsSync(tempFilePath)).toBe(false);
        });
    });

    describe('Transcription Pipeline', () => {
        test('should transcribe the real video file with tiny model', async () => {
            console.log('🎤 E2E Test: Starting real video transcription with tiny model...');
            
            // Set up transcription service
            transcriptionService.setModel('tiny');
            transcriptionService.setLanguage('auto');
            
            const startTime = Date.now();
            
            // Copy to temp for processing
            const tempFilePath = await fileService.copyToTemp(testVideoPath);
            console.log(`📂 E2E Test: Processing temp file: ${tempFilePath}`);
            
            try {
                // Transcribe the file
                const result = await transcriptionService.transcribeFile(tempFilePath, {
                    threads: 4,
                    translate: false
                });
                
                const duration = Date.now() - startTime;
                console.log(`⏱️ E2E Test: Transcription completed in ${duration}ms`);
                console.log(`📝 E2E Test: Result:`, {
                    success: result.success,
                    textLength: result.text?.length || 0,
                    language: result.language,
                    model: result.model,
                    segmentsCount: result.segments?.length || 0
                });
                
                // Verify result structure
                expect(result).toBeDefined();
                expect(result.success).toBe(true);
                expect(result.text).toBeDefined();
                expect(typeof result.text).toBe('string');
                expect(result.text.length).toBeGreaterThan(0);
                expect(result.language).toBeDefined();
                expect(result.model).toBe('tiny');
                
                // Log first 200 characters of transcription
                const preview = result.text.substring(0, 200);
                console.log(`📝 E2E Test: Transcription preview: "${preview}..."`);
                
                // Verify we got actual content (not just empty or error text)
                expect(result.text.trim()).not.toBe('');
                expect(result.text.toLowerCase()).not.toContain('error');
                expect(result.text.toLowerCase()).not.toContain('failed');
                
            } finally {
                // Clean up temp file
                await fileService.cleanup(tempFilePath);
            }
        }, 120000); // 2 minute timeout for transcription

        test('should transcribe with small model if available', async () => {
            console.log('🎤 E2E Test: Testing transcription with small model...');
            
            const models = transcriptionService.getAvailableModels();
            const hasSmallModel = models.some(m => m.name === 'small');
            
            if (!hasSmallModel) {
                console.log('⚠️ E2E Test: Small model not available, skipping test');
                return;
            }
            
            // Set up transcription service
            transcriptionService.setModel('small');
            transcriptionService.setLanguage('auto');
            
            const startTime = Date.now();
            
            // Copy to temp for processing
            const tempFilePath = await fileService.copyToTemp(testVideoPath);
            
            try {
                // Transcribe the file
                const result = await transcriptionService.transcribeFile(tempFilePath, {
                    threads: 4,
                    translate: false
                });
                
                const duration = Date.now() - startTime;
                console.log(`⏱️ E2E Test: Small model transcription completed in ${duration}ms`);
                console.log(`📝 E2E Test: Small model result:`, {
                    success: result.success,
                    textLength: result.text?.length || 0,
                    language: result.language,
                    model: result.model
                });
                
                // Verify result
                expect(result.success).toBe(true);
                expect(result.text).toBeDefined();
                expect(result.text.length).toBeGreaterThan(0);
                expect(result.model).toBe('small');
                
            } finally {
                // Clean up temp file
                await fileService.cleanup(tempFilePath);
            }
        }, 180000); // 3 minute timeout for larger model

        test('should handle transcription with translation', async () => {
            console.log('🎤 E2E Test: Testing transcription with translation...');
            
            // Set up transcription service
            transcriptionService.setModel('tiny');
            transcriptionService.setLanguage('auto');
            
            const startTime = Date.now();
            
            // Copy to temp for processing
            const tempFilePath = await fileService.copyToTemp(testVideoPath);
            
            try {
                // Transcribe with translation enabled
                const result = await transcriptionService.transcribeFile(tempFilePath, {
                    threads: 4,
                    translate: true // Enable translation to English
                });
                
                const duration = Date.now() - startTime;
                console.log(`⏱️ E2E Test: Translation transcription completed in ${duration}ms`);
                console.log(`📝 E2E Test: Translation result:`, {
                    success: result.success,
                    textLength: result.text?.length || 0,
                    language: result.language,
                    model: result.model
                });
                
                // Verify result
                expect(result.success).toBe(true);
                expect(result.text).toBeDefined();
                expect(result.text.length).toBeGreaterThan(0);
                
                // Log translation result
                const preview = result.text.substring(0, 200);
                console.log(`🌍 E2E Test: Translation preview: "${preview}..."`);
                
            } finally {
                // Clean up temp file
                await fileService.cleanup(tempFilePath);
            }
        }, 120000);
    });

    describe('Error Handling', () => {
        test('should handle non-existent file gracefully', async () => {
            console.log('🔍 E2E Test: Testing error handling for non-existent file...');
            
            const nonExistentPath = '/path/to/nonexistent/file.mp4';
            
            await expect(
                transcriptionService.transcribeFile(nonExistentPath)
            ).rejects.toThrow();
        });

        test('should handle invalid model gracefully', async () => {
            console.log('🔍 E2E Test: Testing error handling for invalid model...');
            
            // Test that setting an invalid model throws an error
            let errorThrown = false;
            try {
                transcriptionService.setModel('invalid-model');
            } catch (error) {
                errorThrown = true;
                console.log('✅ E2E Test: Invalid model correctly rejected:', error.message);
                expect(error.message).toContain('invalid-model');
            }
            
            expect(errorThrown).toBe(true);
            
            // Reset to a valid model for subsequent tests
            transcriptionService.setModel('tiny');
            console.log('🔄 E2E Test: Reset to valid model for subsequent tests');
        });

        test('should handle transcription with invalid model gracefully', async () => {
            console.log('🔍 E2E Test: Testing transcription with invalid model...');
            
            const tempFilePath = await fileService.copyToTemp(testVideoPath);
            
            try {
                // Test transcription with invalid model options
                let errorCaught = false;
                try {
                    await transcriptionService.transcribeFile(tempFilePath, {
                        model: 'invalid-model',
                        threads: 4,
                        translate: false
                    });
                } catch (error) {
                    errorCaught = true;
                    console.log('✅ E2E Test: Transcription with invalid model correctly failed:', error.message);
                    expect(error.message).toContain('invalid-model');
                }
                
                expect(errorCaught).toBe(true);
                console.log('✅ E2E Test: Invalid model transcription error handling verified');
                
            } finally {
                await fileService.cleanup(tempFilePath);
            }
        });
    });

    describe('Performance Metrics', () => {
        test('should complete transcription within reasonable time', async () => {
            console.log('🔍 E2E Test: Testing transcription performance...');
            
            // Ensure we're using a valid model for performance testing
            transcriptionService.setModel('tiny');
            console.log('🔧 E2E Test: Using tiny model for performance test');
            
            const tempFilePath = await fileService.copyToTemp(testVideoPath);
            const startTime = Date.now();
            
            try {
                const result = await transcriptionService.transcribeFile(tempFilePath, {
                    threads: 4,
                    translate: false
                });
                
                const duration = Date.now() - startTime;
                const fileStats = fs.statSync(testVideoPath);
                const fileSizeMB = fileStats.size / 1024 / 1024;
                const processingRate = fileSizeMB / (duration / 1000); // MB per second
                
                console.log(`📊 E2E Test: Performance metrics:`);
                console.log(`   - File size: ${fileSizeMB.toFixed(2)} MB`);
                console.log(`   - Processing time: ${duration}ms`);
                console.log(`   - Processing rate: ${processingRate.toFixed(2)} MB/s`);
                console.log(`   - Text length: ${result.text.length} characters`);
                
                // Verify reasonable performance (should process faster than real-time)
                expect(duration).toBeLessThan(300000); // Should complete within 5 minutes
                expect(result.text.length).toBeGreaterThan(10); // Should produce meaningful output
                
            } finally {
                await fileService.cleanup(tempFilePath);
            }
        }, 300000); // 5 minute timeout
    });
});