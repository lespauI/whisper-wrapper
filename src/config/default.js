/**
 * Default configuration for Whisper Wrapper
 */

module.exports = {
    // Application settings
    app: {
        name: 'Whisper Wrapper',
        version: '0.1.0',
        description: 'A user-friendly interface for local Whisper speech-to-text processing'
    },

    // Window settings
    window: {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        center: true
    },

    // Local Whisper settings
    whisper: {
        model: 'base',
        language: 'auto',
        threads: 4,
        translate: false,
        modelsPath: './models',
        binaryPath: './whisper.cpp/main'
    },

    // File handling settings
    files: {
        maxSize: 25 * 1024 * 1024, // 25MB
        supportedAudioFormats: ['.mp3', '.wav', '.m4a', '.flac', '.ogg'],
        supportedVideoFormats: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
        tempDirectory: 'temp',
        cleanupOnExit: true
    },

    // Recording settings
    recording: {
        sampleRate: 44100,
        channels: 1,
        bitDepth: 16,
        format: 'wav',
        maxDuration: 3600, // 1 hour in seconds
        autoSave: true
    },

    // Transcription settings
    transcription: {
        language: 'auto', // Auto-detect
        model: 'base',
        threads: 4,
        translate: false
    },

    // Export settings
    export: {
        defaultFormat: 'txt',
        includeMetadata: true,
        timestampFormat: 'ISO',
        filenameTemplate: 'transcription-{timestamp}'
    },

    // UI settings
    ui: {
        theme: 'light',
        fontSize: 'medium',
        autoSwitchToTranscription: true,
        showProgressDetails: true
    },

    // Development settings
    development: {
        enableDevTools: false,
        enableLogging: true,
        logLevel: 'info'
    },

    // Security settings
    security: {
        enableCSP: true,
        allowExternalResources: false,
        enableLocalProcessing: true
    }
};