/**
 * Transcription Formatter Service - Converts raw transcription data into formatted markdown
 * This service handles timestamp formatting, section organization, and markdown generation
 */

class TranscriptionFormatter {
    constructor() {
        this.sectionThreshold = 30000; // 30 seconds gap to create new section
        this.shortPauseThreshold = 3000; // 3 seconds for paragraph breaks
    }

    /**
     * Format transcription result into markdown with timestamps and sections
     * @param {Object} transcriptionResult - Raw transcription result from whisper
     * @returns {Object} - Formatted transcription with markdown
     */
    formatTranscription(transcriptionResult) {
        if (!transcriptionResult || !transcriptionResult.segments) {
            return {
                markdown: '# Transcription\n\n*No transcription data available*',
                plainText: '',
                metadata: {
                    totalDuration: 0,
                    segmentCount: 0,
                    sectionCount: 0
                }
            };
        }

        const segments = transcriptionResult.segments;
        const sections = this.createSections(segments);
        const markdown = this.generateMarkdown(sections, transcriptionResult);
        const plainText = this.extractPlainText(segments);

        return {
            markdown,
            plainText,
            metadata: {
                totalDuration: this.getTotalDuration(segments),
                segmentCount: segments.length,
                sectionCount: sections.length,
                language: transcriptionResult.language || 'auto',
                model: transcriptionResult.model || 'unknown'
            }
        };
    }

    /**
     * Create sections from segments based on timing gaps
     * @param {Array} segments - Array of transcription segments
     * @returns {Array} - Array of sections with grouped segments
     */
    createSections(segments) {
        if (!segments || segments.length === 0) return [];

        const sections = [];
        const firstSegment = this.normalizeSegment(segments[0]);
        let currentSection = {
            startTime: firstSegment.start,
            endTime: firstSegment.end,
            segments: [firstSegment]
        };

        for (let i = 1; i < segments.length; i++) {
            const currentSegment = this.normalizeSegment(segments[i]);
            const previousSegment = this.normalizeSegment(segments[i - 1]);
            
            // Calculate gap between segments (in milliseconds)
            const gap = (currentSegment.start - previousSegment.end) * 1000;

            // If gap is larger than threshold, start new section
            if (gap > this.sectionThreshold) {
                sections.push(currentSection);
                currentSection = {
                    startTime: currentSegment.start,
                    endTime: currentSegment.end,
                    segments: [currentSegment]
                };
            } else {
                // Add to current section
                currentSection.segments.push(currentSegment);
                currentSection.endTime = currentSegment.end;
            }
        }

        // Add the last section
        if (currentSection.segments.length > 0) {
            sections.push(currentSection);
        }

        return sections;
    }

    /**
     * Generate markdown from sections
     * @param {Array} sections - Array of sections
     * @param {Object} transcriptionResult - Original transcription result
     * @returns {string} - Formatted markdown
     */
    generateMarkdown(sections, transcriptionResult) {
        let markdown = '';

        // Header
        markdown += '# 📝 Transcription\n\n';
        
        // Metadata
        markdown += '## 📊 Information\n\n';
        markdown += `- **Language**: ${transcriptionResult.language || 'auto'}\n`;
        markdown += `- **Model**: ${transcriptionResult.model || 'unknown'}\n`;
        markdown += `- **Duration**: ${this.formatDuration(this.getTotalDuration(transcriptionResult.segments))}\n`;
        markdown += `- **Segments**: ${transcriptionResult.segments.length}\n`;
        markdown += `- **Sections**: ${sections.length}\n\n`;

        // Table of Contents
        if (sections.length > 1) {
            markdown += '## 📑 Table of Contents\n\n';
            sections.forEach((section, index) => {
                const startTime = this.formatTimestamp(section.startTime);
                const endTime = this.formatTimestamp(section.endTime);
                const duration = this.formatDuration((section.endTime - section.startTime) * 1000);
                markdown += `${index + 1}. [Section ${index + 1}](#section-${index + 1}) (${startTime} - ${endTime}, ${duration})\n`;
            });
            markdown += '\n';
        }

        // Sections
        markdown += '## 📖 Content\n\n';
        
        sections.forEach((section, sectionIndex) => {
            // Section header
            const sectionNumber = sectionIndex + 1;
            const startTime = this.formatTimestamp(section.startTime);
            const endTime = this.formatTimestamp(section.endTime);
            const duration = this.formatDuration((section.endTime - section.startTime) * 1000);
            
            markdown += `### Section ${sectionNumber}\n`;
            markdown += `**⏱️ Time**: ${startTime} - ${endTime} (${duration})\n\n`;

            // Group segments into paragraphs based on pauses
            const paragraphs = this.createParagraphs(section.segments);
            
            paragraphs.forEach((paragraph, paragraphIndex) => {
                // Paragraph with timestamps
                const paragraphStart = this.formatTimestamp(paragraph[0].start);
                const paragraphEnd = this.formatTimestamp(paragraph[paragraph.length - 1].end);
                
                markdown += `**[${paragraphStart} → ${paragraphEnd}]**\n\n`;
                
                // Combine text from all segments in paragraph
                const paragraphText = paragraph
                    .map(segment => segment.text.trim())
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                markdown += `${paragraphText}\n\n`;
            });

            // Detailed timestamps for this section
            markdown += '<details>\n';
            markdown += '<summary>🕐 Detailed Timestamps</summary>\n\n';
            markdown += '| Time | Text |\n';
            markdown += '|------|------|\n';
            
            section.segments.forEach(segment => {
                const timestamp = this.formatTimestamp(segment.start);
                const text = segment.text.trim().replace(/\|/g, '\\|'); // Escape pipes for markdown table
                markdown += `| ${timestamp} | ${text} |\n`;
            });
            
            markdown += '\n</details>\n\n';
        });

        // Footer
        markdown += '---\n\n';
        markdown += `*Transcription generated on ${new Date().toLocaleString()}*\n`;

        return markdown;
    }

    /**
     * Create paragraphs from segments based on pauses
     * @param {Array} segments - Array of segments
     * @returns {Array} - Array of paragraph arrays
     */
    createParagraphs(segments) {
        if (!segments || segments.length === 0) return [];

        const paragraphs = [];
        let currentParagraph = [segments[0]];

        for (let i = 1; i < segments.length; i++) {
            const currentSegment = segments[i];
            const previousSegment = segments[i - 1];
            
            // Calculate gap between segments (in milliseconds)
            const gap = (currentSegment.start - previousSegment.end) * 1000;

            // If gap is larger than short pause threshold, start new paragraph
            if (gap > this.shortPauseThreshold) {
                paragraphs.push(currentParagraph);
                currentParagraph = [currentSegment];
            } else {
                currentParagraph.push(currentSegment);
            }
        }

        // Add the last paragraph
        if (currentParagraph.length > 0) {
            paragraphs.push(currentParagraph);
        }

        return paragraphs;
    }

    /**
     * Format timestamp from seconds to HH:MM:SS.mmm
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted timestamp
     */
    formatTimestamp(seconds) {
        const totalMs = Math.round(seconds * 1000);
        const hours = Math.floor(totalMs / (1000 * 60 * 60));
        const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((totalMs % (1000 * 60)) / 1000);
        const ms = totalMs % 1000;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        }
    }

    /**
     * Format duration from milliseconds to human readable format
     * @param {number} milliseconds - Duration in milliseconds
     * @returns {string} - Formatted duration
     */
    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get total duration from segments
     * @param {Array} segments - Array of segments
     * @returns {number} - Total duration in milliseconds
     */
    getTotalDuration(segments) {
        if (!segments || segments.length === 0) return 0;
        
        const lastSegment = segments[segments.length - 1];
        return lastSegment.end * 1000; // Convert to milliseconds
    }

    /**
     * Extract plain text from segments
     * @param {Array} segments - Array of segments
     * @returns {string} - Plain text
     */
    extractPlainText(segments) {
        if (!segments || segments.length === 0) return '';
        
        return segments
            .map(segment => segment.text.trim())
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Generate SRT subtitle format
     * @param {Array} segments - Array of segments
     * @returns {string} - SRT formatted subtitles
     */
    generateSRT(segments) {
        if (!segments || segments.length === 0) return '';

        let srt = '';
        segments.forEach((segment, index) => {
            const startTime = this.formatSRTTimestamp(segment.start);
            const endTime = this.formatSRTTimestamp(segment.end);
            const text = segment.text.trim();

            srt += `${index + 1}\n`;
            srt += `${startTime} --> ${endTime}\n`;
            srt += `${text}\n\n`;
        });

        return srt;
    }

    /**
     * Format timestamp for SRT format (HH:MM:SS,mmm)
     * @param {number} seconds - Time in seconds
     * @returns {string} - SRT formatted timestamp
     */
    formatSRTTimestamp(seconds) {
        const totalMs = Math.round(seconds * 1000);
        const hours = Math.floor(totalMs / (1000 * 60 * 60));
        const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((totalMs % (1000 * 60)) / 1000);
        const ms = totalMs % 1000;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    /**
     * Generate VTT subtitle format
     * @param {Array} segments - Array of segments
     * @returns {string} - VTT formatted subtitles
     */
    generateVTT(segments) {
        if (!segments || segments.length === 0) return 'WEBVTT\n\n';

        let vtt = 'WEBVTT\n\n';
        segments.forEach((segment, index) => {
            const startTime = this.formatVTTTimestamp(segment.start);
            const endTime = this.formatVTTTimestamp(segment.end);
            const text = segment.text.trim();

            vtt += `${index + 1}\n`;
            vtt += `${startTime} --> ${endTime}\n`;
            vtt += `${text}\n\n`;
        });

        return vtt;
    }

    /**
     * Format timestamp for VTT format (HH:MM:SS.mmm)
     * @param {number} seconds - Time in seconds
     * @returns {string} - VTT formatted timestamp
     */
    formatVTTTimestamp(seconds) {
        return this.formatTimestamp(seconds);
    }

    /**
     * Update formatting settings
     * @param {Object} settings - New settings
     */
    updateSettings(settings) {
        if (settings.sectionThreshold !== undefined) {
            this.sectionThreshold = settings.sectionThreshold;
        }
        if (settings.shortPauseThreshold !== undefined) {
            this.shortPauseThreshold = settings.shortPauseThreshold;
        }
    }

    /**
     * Get current settings
     * @returns {Object} - Current settings
     */
    getSettings() {
        return {
            sectionThreshold: this.sectionThreshold,
            shortPauseThreshold: this.shortPauseThreshold
        };
    }

    /**
     * Normalize segment data to ensure consistent format
     * @param {Object} segment - Raw segment from whisper
     * @returns {Object} - Normalized segment
     */
    normalizeSegment(segment) {
        if (!segment) {
            return {
                start: 0,
                end: 0,
                text: ''
            };
        }

        return {
            start: typeof segment.start === 'number' ? segment.start : 0,
            end: typeof segment.end === 'number' ? segment.end : 0,
            text: typeof segment.text === 'string' ? segment.text : ''
        };
    }
}

module.exports = TranscriptionFormatter;