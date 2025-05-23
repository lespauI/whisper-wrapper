/**
 * Export Service - Handles transcription export functionality
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

class ExportService {
    constructor() {
        this.supportedFormats = ['txt', 'md', 'json'];
    }

    /**
     * Export transcription to file
     * @param {string} text - Transcription text
     * @param {string} format - Export format (txt, md, json)
     * @param {string} outputPath - Output file path
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<string>} - Output file path
     */
    async exportToFile(text, format, outputPath, metadata = {}) {
        try {
            if (!this.supportedFormats.includes(format)) {
                throw new Error(`Unsupported format: ${format}`);
            }

            let content;
            let extension;

            switch (format) {
            case 'txt':
                content = this.formatAsText(text, metadata);
                extension = '.txt';
                break;
            case 'md':
                content = this.formatAsMarkdown(text, metadata);
                extension = '.md';
                break;
            case 'json':
                content = this.formatAsJSON(text, metadata);
                extension = '.json';
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
            }

            // Ensure output path has correct extension
            if (!outputPath.endsWith(extension)) {
                outputPath = outputPath.replace(/\.[^/.]+$/, '') + extension;
            }

            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(outputPath, content, 'utf8');

            return outputPath;
        } catch (error) {
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    /**
     * Format transcription as plain text
     * @param {string} text - Transcription text
     * @param {Object} metadata - Metadata
     * @returns {string} - Formatted text
     */
    formatAsText(text, metadata) {
        let content = '';

        if (metadata.title) {
            content += `${metadata.title}\n`;
            content += '='.repeat(metadata.title.length) + '\n\n';
        }

        if (metadata.timestamp) {
            content += `Generated: ${new Date(metadata.timestamp).toLocaleString()}\n\n`;
        }

        if (metadata.duration) {
            content += `Duration: ${this.formatDuration(metadata.duration)}\n\n`;
        }

        if (metadata.language) {
            content += `Language: ${metadata.language}\n\n`;
        }

        content += text;

        return content;
    }

    /**
     * Format transcription as Markdown
     * @param {string} text - Transcription text
     * @param {Object} metadata - Metadata
     * @returns {string} - Formatted Markdown
     */
    formatAsMarkdown(text, metadata) {
        let content = '';

        if (metadata.title) {
            content += `# ${metadata.title}\n\n`;
        }

        // Add metadata section
        if (Object.keys(metadata).length > 1) {
            content += '## Information\n\n';
            
            if (metadata.timestamp) {
                content += `**Generated:** ${new Date(metadata.timestamp).toLocaleString()}\n\n`;
            }
            
            if (metadata.duration) {
                content += `**Duration:** ${this.formatDuration(metadata.duration)}\n\n`;
            }
            
            if (metadata.language) {
                content += `**Language:** ${metadata.language}\n\n`;
            }
            
            if (metadata.filename) {
                content += `**Source File:** ${metadata.filename}\n\n`;
            }
        }

        content += '## Transcription\n\n';
        content += text;

        return content;
    }

    /**
     * Format transcription as JSON
     * @param {string} text - Transcription text
     * @param {Object} metadata - Metadata
     * @returns {string} - Formatted JSON
     */
    formatAsJSON(text, metadata) {
        const data = {
            transcription: {
                text: text,
                metadata: {
                    timestamp: metadata.timestamp || new Date().toISOString(),
                    duration: metadata.duration || null,
                    language: metadata.language || null,
                    filename: metadata.filename || null,
                    title: metadata.title || null,
                    model: metadata.model || 'whisper-1',
                    version: '1.0'
                }
            }
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Generate filename with timestamp
     * @param {string} prefix - Filename prefix
     * @param {string} format - File format
     * @returns {string} - Generated filename
     */
    generateFilename(prefix = 'transcription', format = 'txt') {
        const timestamp = new Date().toISOString()
            .replace(/:/g, '-')
            .replace(/\..+/, '');
        
        return `${prefix}-${timestamp}.${format}`;
    }

    /**
     * Format duration in human-readable format
     * @param {number} seconds - Duration in seconds
     * @returns {string} - Formatted duration
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 0) return 'Unknown';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Convert Markdown to HTML
     * @param {string} markdown - Markdown text
     * @returns {string} - HTML content
     */
    markdownToHTML(markdown) {
        return marked(markdown);
    }

    /**
     * Get supported export formats
     * @returns {Array} - Supported formats
     */
    getSupportedFormats() {
        return [...this.supportedFormats];
    }

    /**
     * Validate export format
     * @param {string} format - Format to validate
     * @returns {boolean} - Validation result
     */
    isValidFormat(format) {
        return this.supportedFormats.includes(format.toLowerCase());
    }
}

module.exports = ExportService;