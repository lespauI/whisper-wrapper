/**
 * Simple config tests that actually work
 */

const defaultConfig = require('../../src/config/default');

describe('Configuration System', () => {
    describe('default configuration', () => {
        it('should have valid default configuration structure', () => {
            expect(defaultConfig).toBeDefined();
            expect(typeof defaultConfig).toBe('object');
        });

        it('should have app settings', () => {
            expect(defaultConfig.app).toBeDefined();
            expect(defaultConfig.app.name).toBe('Whisper Wrapper');
            expect(defaultConfig.app.version).toBe('0.1.0');
        });

        it('should have window settings', () => {
            expect(defaultConfig.window).toBeDefined();
            expect(defaultConfig.window.width).toBe(1200);
            expect(defaultConfig.window.height).toBe(800);
            expect(defaultConfig.window.minWidth).toBe(800);
            expect(defaultConfig.window.minHeight).toBe(600);
        });

        it('should have whisper settings', () => {
            expect(defaultConfig.whisper).toBeDefined();
            expect(defaultConfig.whisper.model).toBe('base');
            expect(defaultConfig.whisper.language).toBe('auto');
            expect(defaultConfig.whisper.threads).toBe(4);
            expect(defaultConfig.whisper.translate).toBe(false);
        });

        it('should have transcription settings', () => {
            expect(defaultConfig.transcription).toBeDefined();
            expect(defaultConfig.transcription.language).toBe('auto');
            expect(defaultConfig.transcription.model).toBe('base');
            expect(defaultConfig.transcription.threads).toBe(4);
            expect(defaultConfig.transcription.translate).toBe(false);
        });

        it('should have recording settings', () => {
            expect(defaultConfig.recording).toBeDefined();
            expect(defaultConfig.recording.sampleRate).toBe(44100);
            expect(defaultConfig.recording.channels).toBe(1);
            expect(defaultConfig.recording.bitDepth).toBe(16);
            expect(defaultConfig.recording.format).toBe('wav');
            expect(defaultConfig.recording.maxDuration).toBe(3600);
            expect(defaultConfig.recording.autoSave).toBe(true);
        });

        it('should have export settings', () => {
            expect(defaultConfig.export).toBeDefined();
            expect(defaultConfig.export.defaultFormat).toBe('txt');
            expect(defaultConfig.export.includeMetadata).toBe(true);
            expect(defaultConfig.export.timestampFormat).toBe('ISO');
            expect(defaultConfig.export.filenameTemplate).toBe('transcription-{timestamp}');
        });

        it('should have file settings', () => {
            expect(defaultConfig.files).toBeDefined();
            expect(defaultConfig.files.maxSize).toBe(25 * 1024 * 1024); // 25MB
            expect(Array.isArray(defaultConfig.files.supportedAudioFormats)).toBe(true);
            expect(Array.isArray(defaultConfig.files.supportedVideoFormats)).toBe(true);
            expect(defaultConfig.files.tempDirectory).toBe('temp');
            expect(defaultConfig.files.cleanupOnExit).toBe(true);
        });

        it('should have UI settings', () => {
            expect(defaultConfig.ui).toBeDefined();
            expect(defaultConfig.ui.theme).toBe('light');
            expect(defaultConfig.ui.fontSize).toBe('medium');
            expect(defaultConfig.ui.autoSwitchToTranscription).toBe(true);
            expect(defaultConfig.ui.showProgressDetails).toBe(true);
        });

        it('should have development settings', () => {
            expect(defaultConfig.development).toBeDefined();
            expect(defaultConfig.development.enableDevTools).toBe(false);
            expect(defaultConfig.development.enableLogging).toBe(true);
            expect(defaultConfig.development.logLevel).toBe('info');
        });

        it('should have security settings', () => {
            expect(defaultConfig.security).toBeDefined();
            expect(defaultConfig.security.enableCSP).toBe(true);
            expect(defaultConfig.security.allowExternalResources).toBe(false);
            expect(defaultConfig.security.enableLocalProcessing).toBe(true);
        });
    });

    describe('supported formats', () => {
        it('should have valid audio formats', () => {
            const audioFormats = defaultConfig.files.supportedAudioFormats;
            expect(audioFormats).toContain('.mp3');
            expect(audioFormats).toContain('.wav');
            expect(audioFormats).toContain('.m4a');
            expect(audioFormats).toContain('.flac');
            expect(audioFormats).toContain('.ogg');
        });

        it('should have valid video formats', () => {
            const videoFormats = defaultConfig.files.supportedVideoFormats;
            expect(videoFormats).toContain('.mp4');
            expect(videoFormats).toContain('.mov');
            expect(videoFormats).toContain('.avi');
            expect(videoFormats).toContain('.mkv');
            expect(videoFormats).toContain('.webm');
        });
    });
});