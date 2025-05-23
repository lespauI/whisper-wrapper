/**
 * Text formatting utilities
 */

/**
 * Format text as Markdown
 * @param {string} text - Plain text
 * @returns {string} - Markdown formatted text
 */
function formatAsMarkdown(text) {
    if (!text) return '';
    
    // Split into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    
    return paragraphs
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length > 0)
        .join('\n\n');
}

/**
 * Format timestamp
 * @param {Date|string|number} timestamp - Timestamp to format
 * @param {string} format - Format type ('ISO', 'locale', 'short')
 * @returns {string} - Formatted timestamp
 */
function formatTimestamp(timestamp, format = 'locale') {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    
    switch (format) {
    case 'ISO':
        return date.toISOString();
    case 'short':
        return date.toLocaleDateString();
    case 'time':
        return date.toLocaleTimeString();
    case 'locale':
    default:
        return date.toLocaleString();
    }
}

/**
 * Format duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Clean and normalize text
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
function cleanText(text) {
    if (!text) return '';
    
    return text
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove leading/trailing whitespace
        .trim()
        // Normalize line breaks
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Convert text to title case
 * @param {string} text - Text to convert
 * @returns {string} - Title case text
 */
function toTitleCase(text) {
    if (!text) return '';
    
    return text.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}

/**
 * Generate safe filename from text
 * @param {string} text - Text to convert
 * @param {number} maxLength - Maximum filename length
 * @returns {string} - Safe filename
 */
function toSafeFilename(text, maxLength = 50) {
    if (!text) return 'untitled';
    
    return text
        // Remove or replace unsafe characters
        .replace(/[<>:"/\\|?*]/g, '-')
        // Replace spaces with underscores
        .replace(/\s+/g, '_')
        // Remove multiple consecutive dashes/underscores
        .replace(/[-_]+/g, '_')
        // Remove leading/trailing dashes/underscores
        .replace(/^[-_]+|[-_]+$/g, '')
        // Truncate to max length
        .substring(0, maxLength)
        // Ensure it's not empty
        || 'untitled';
}

/**
 * Extract sentences from text
 * @param {string} text - Text to process
 * @returns {Array<string>} - Array of sentences
 */
function extractSentences(text) {
    if (!text) return [];
    
    // Simple sentence splitting (can be improved with more sophisticated NLP)
    return text
        .split(/[.!?]+/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0);
}

/**
 * Count words in text
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function countWords(text) {
    if (!text) return 0;
    
    return text
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .length;
}

/**
 * Estimate reading time
 * @param {string} text - Text to analyze
 * @param {number} wordsPerMinute - Reading speed (default: 200 WPM)
 * @returns {string} - Estimated reading time
 */
function estimateReadingTime(text, wordsPerMinute = 200) {
    const wordCount = countWords(text);
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
}

module.exports = {
    formatAsMarkdown,
    formatTimestamp,
    formatDuration,
    formatFileSize,
    cleanText,
    truncateText,
    toTitleCase,
    toSafeFilename,
    extractSentences,
    countWords,
    estimateReadingTime
};