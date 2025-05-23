/**
 * File Service - Handles file operations and validation
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FileService {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Validate file type and size
     * @param {string} filePath - Path to the file
     * @returns {Promise<boolean>} - Validation result
     */
    async validateFile(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            const maxSize = 25 * 1024 * 1024; // 25MB limit for Whisper API

            if (fileSize > maxSize) {
                throw new Error('File size exceeds 25MB limit');
            }

            const ext = path.extname(filePath).toLowerCase();
            const supportedFormats = [
                '.mp3', '.wav', '.m4a', '.flac', '.ogg',
                '.mp4', '.mov', '.avi', '.mkv', '.webm'
            ];

            if (!supportedFormats.includes(ext)) {
                throw new Error(`Unsupported file format: ${ext}`);
            }

            return true;
        } catch (error) {
            throw new Error(`File validation failed: ${error.message}`);
        }
    }

    /**
     * Copy file to temporary directory
     * @param {string} sourcePath - Source file path
     * @returns {Promise<string>} - Temporary file path
     */
    async copyToTemp(sourcePath) {
        try {
            const fileName = `${uuidv4()}${path.extname(sourcePath)}`;
            const tempPath = path.join(this.tempDir, fileName);
            
            fs.copyFileSync(sourcePath, tempPath);
            return tempPath;
        } catch (error) {
            throw new Error(`Failed to copy file to temp: ${error.message}`);
        }
    }

    /**
     * Clean up temporary files
     * @param {string} filePath - File path to clean up
     */
    async cleanup(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    /**
     * Clean up all temporary files
     */
    async cleanupAll() {
        try {
            const files = fs.readdirSync(this.tempDir);
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('Cleanup all error:', error);
        }
    }

    /**
     * Get file information
     * @param {string} filePath - File path
     * @returns {Object} - File information
     */
    getFileInfo(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                name: path.basename(filePath),
                size: stats.size,
                extension: path.extname(filePath),
                created: stats.birthtime,
                modified: stats.mtime
            };
        } catch (error) {
            throw new Error(`Failed to get file info: ${error.message}`);
        }
    }
}

module.exports = FileService;