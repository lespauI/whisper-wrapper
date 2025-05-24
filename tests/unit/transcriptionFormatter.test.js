/**
 * Test for TranscriptionFormatter - Tests markdown formatting and timestamp handling
 */

const TranscriptionFormatter = require('../../src/services/transcriptionFormatter');

describe('TranscriptionFormatter', () => {
    let formatter;

    beforeEach(() => {
        formatter = new TranscriptionFormatter();
    });

    describe('Timestamp Formatting', () => {
        test('should format timestamps correctly', () => {
            expect(formatter.formatTimestamp(0)).toBe('00:00.000');
            expect(formatter.formatTimestamp(65.5)).toBe('01:05.500');
            expect(formatter.formatTimestamp(3661.123)).toBe('01:01:01.123');
        });

        test('should format SRT timestamps correctly', () => {
            expect(formatter.formatSRTTimestamp(0)).toBe('00:00:00,000');
            expect(formatter.formatSRTTimestamp(65.5)).toBe('00:01:05,500');
            expect(formatter.formatSRTTimestamp(3661.123)).toBe('01:01:01,123');
        });
    });

    describe('Duration Formatting', () => {
        test('should format durations correctly', () => {
            expect(formatter.formatDuration(1000)).toBe('1s');
            expect(formatter.formatDuration(65000)).toBe('1m 5s');
            expect(formatter.formatDuration(3661000)).toBe('1h 1m 1s');
        });
    });

    describe('Section Creation', () => {
        test('should create sections based on timing gaps', () => {
            const segments = [
                { start: 0, end: 5, text: 'First segment' },
                { start: 6, end: 10, text: 'Second segment' },
                { start: 45, end: 50, text: 'Third segment after gap' }, // 35 second gap
                { start: 51, end: 55, text: 'Fourth segment' }
            ];

            const sections = formatter.createSections(segments);
            
            expect(sections).toHaveLength(2);
            expect(sections[0].segments).toHaveLength(2);
            expect(sections[1].segments).toHaveLength(2);
        });
    });

    describe('Paragraph Creation', () => {
        test('should create paragraphs based on short pauses', () => {
            const segments = [
                { start: 0, end: 2, text: 'First sentence.' },
                { start: 2.5, end: 4, text: 'Second sentence.' },
                { start: 8, end: 10, text: 'New paragraph.' }, // 4 second gap
                { start: 10.5, end: 12, text: 'Same paragraph.' }
            ];

            const paragraphs = formatter.createParagraphs(segments);
            
            expect(paragraphs).toHaveLength(2);
            expect(paragraphs[0]).toHaveLength(2);
            expect(paragraphs[1]).toHaveLength(2);
        });
    });

    describe('Markdown Generation', () => {
        test('should generate markdown with proper structure', () => {
            const transcriptionResult = {
                segments: [
                    { start: 0, end: 5, text: 'Hello world.' },
                    { start: 6, end: 10, text: 'This is a test.' }
                ],
                language: 'en',
                model: 'base'
            };

            const formatted = formatter.formatTranscription(transcriptionResult);
            
            expect(formatted.markdown).toContain('# 📝 Transcription');
            expect(formatted.markdown).toContain('## 📊 Information');
            expect(formatted.markdown).toContain('**Language**: en');
            expect(formatted.markdown).toContain('**Model**: base');
            expect(formatted.markdown).toContain('Hello world.');
            expect(formatted.markdown).toContain('This is a test.');
        });

        test('should handle empty segments gracefully', () => {
            const transcriptionResult = {
                segments: [],
                language: 'en',
                model: 'base'
            };

            const formatted = formatter.formatTranscription(transcriptionResult);
            
            expect(formatted.markdown).toContain('# 📝 Transcription');
            expect(formatted.plainText).toBe('');
            expect(formatted.metadata.segmentCount).toBe(0);
        });
    });

    describe('SRT Generation', () => {
        test('should generate valid SRT format', () => {
            const segments = [
                { start: 0, end: 5, text: 'Hello world.' },
                { start: 6, end: 10, text: 'This is a test.' }
            ];

            const srt = formatter.generateSRT(segments);
            
            expect(srt).toContain('1\n00:00:00,000 --> 00:00:05,000\nHello world.\n\n');
            expect(srt).toContain('2\n00:00:06,000 --> 00:00:10,000\nThis is a test.\n\n');
        });
    });

    describe('VTT Generation', () => {
        test('should generate valid VTT format', () => {
            const segments = [
                { start: 0, end: 5, text: 'Hello world.' },
                { start: 6, end: 10, text: 'This is a test.' }
            ];

            const vtt = formatter.generateVTT(segments);
            
            expect(vtt).toContain('WEBVTT\n\n');
            expect(vtt).toContain('1\n00:00.000 --> 00:05.000\nHello world.\n\n');
            expect(vtt).toContain('2\n00:06.000 --> 00:10.000\nThis is a test.\n\n');
        });
    });

    describe('Settings Management', () => {
        test('should update and retrieve settings', () => {
            const newSettings = {
                sectionThreshold: 60000,
                shortPauseThreshold: 5000
            };

            formatter.updateSettings(newSettings);
            const settings = formatter.getSettings();

            expect(settings.sectionThreshold).toBe(60000);
            expect(settings.shortPauseThreshold).toBe(5000);
        });
    });

    describe('Plain Text Extraction', () => {
        test('should extract clean plain text', () => {
            const segments = [
                { start: 0, end: 5, text: '  Hello world.  ' },
                { start: 6, end: 10, text: '  This is a test.  ' }
            ];

            const plainText = formatter.extractPlainText(segments);
            
            expect(plainText).toBe('Hello world. This is a test.');
        });
    });
});