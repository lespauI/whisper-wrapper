/**
 * Tests for FileService
 */

const FileService = require('../../../src/services/fileService');
const fs = require('fs');
const path = require('path');

describe('FileService', () => {
    let fileService;

    beforeEach(() => {
        fileService = new FileService();
    });

    afterEach(() => {
        // Clean up any test files
        fileService.cleanupAll();
    });

    describe('validateFile', () => {
        test('should validate supported audio file', async () => {
            // Create a mock file for testing
            const testFile = path.join(__dirname, '../../fixtures/test.mp3');
            
            // Create test directory if it doesn't exist
            const testDir = path.dirname(testFile);
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            // Create a small test file
            fs.writeFileSync(testFile, 'test audio data');
            
            try {
                const result = await fileService.validateFile(testFile);
                expect(result).toBe(true);
            } finally {
                // Clean up
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
            }
        });

        test('should reject unsupported file format', async () => {
            const testFile = path.join(__dirname, '../../fixtures/test.txt');
            
            // Create test directory if it doesn't exist
            const testDir = path.dirname(testFile);
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            // Create a test file with unsupported format
            fs.writeFileSync(testFile, 'test text data');
            
            try {
                await expect(fileService.validateFile(testFile)).rejects.toThrow('Unsupported file format');
            } finally {
                // Clean up
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
            }
        });
    });

    describe('getFileInfo', () => {
        test('should return file information', () => {
            const testFile = path.join(__dirname, '../../fixtures/test.mp3');
            
            // Create test directory if it doesn't exist
            const testDir = path.dirname(testFile);
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            // Create a test file
            fs.writeFileSync(testFile, 'test audio data');
            
            try {
                const info = fileService.getFileInfo(testFile);
                
                expect(info).toHaveProperty('name');
                expect(info).toHaveProperty('size');
                expect(info).toHaveProperty('extension');
                expect(info.name).toBe('test.mp3');
                expect(info.extension).toBe('.mp3');
                expect(info.size).toBeGreaterThan(0);
            } finally {
                // Clean up
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
            }
        });
    });
});