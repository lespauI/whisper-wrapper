/**
 * Tests for formatters utilities
 */

const {
    formatDuration,
    formatFileSize,
    cleanText,
    truncateText,
    toSafeFilename,
    countWords
} = require('../../../src/utils/formatters');

describe('Formatters', () => {
    describe('formatDuration', () => {
        test('should format duration in milliseconds', () => {
            expect(formatDuration(0)).toBe('00:00');
            expect(formatDuration(30000)).toBe('0:30');
            expect(formatDuration(90000)).toBe('1:30');
            expect(formatDuration(3661000)).toBe('1:01:01');
        });

        test('should handle invalid input', () => {
            expect(formatDuration(null)).toBe('00:00');
            expect(formatDuration(-1000)).toBe('00:00');
        });
    });

    describe('formatFileSize', () => {
        test('should format file size in bytes', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(1024)).toBe('1.0 KB');
            expect(formatFileSize(1048576)).toBe('1.0 MB');
            expect(formatFileSize(1073741824)).toBe('1.0 GB');
        });
    });

    describe('cleanText', () => {
        test('should clean and normalize text', () => {
            expect(cleanText('  hello   world  ')).toBe('hello world');
            expect(cleanText('hello\r\nworld')).toBe('hello world');
            expect(cleanText('')).toBe('');
            expect(cleanText(null)).toBe('');
        });
    });

    describe('truncateText', () => {
        test('should truncate text to specified length', () => {
            expect(truncateText('hello world', 5)).toBe('he...');
            expect(truncateText('hello', 10)).toBe('hello');
            expect(truncateText('', 5)).toBe('');
        });
    });

    describe('toSafeFilename', () => {
        test('should create safe filename', () => {
            expect(toSafeFilename('hello world')).toBe('hello_world');
            expect(toSafeFilename('file<>:"/\\|?*name')).toBe('file_name');
            expect(toSafeFilename('')).toBe('untitled');
        });
    });

    describe('countWords', () => {
        test('should count words in text', () => {
            expect(countWords('hello world')).toBe(2);
            expect(countWords('  hello   world  ')).toBe(2);
            expect(countWords('')).toBe(0);
            expect(countWords('one')).toBe(1);
        });
    });
});