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
        binaryPath: './whisper.cpp/main',
        availableModels: [
            { name: 'tiny', size: '39M params', vram: '~1GB', speed: '~10x', type: 'multilingual' },
            { name: 'tiny.en', size: '39M params', vram: '~1GB', speed: '~10x', type: 'english-only' },
            { name: 'base', size: '74M params', vram: '~1GB', speed: '~7x', type: 'multilingual' },
            { name: 'base.en', size: '74M params', vram: '~1GB', speed: '~7x', type: 'english-only' },
            { name: 'small', size: '244M params', vram: '~2GB', speed: '~4x', type: 'multilingual' },
            { name: 'small.en', size: '244M params', vram: '~2GB', speed: '~4x', type: 'english-only' },
            { name: 'medium', size: '769M params', vram: '~5GB', speed: '~2x', type: 'multilingual' },
            { name: 'medium.en', size: '769M params', vram: '~5GB', speed: '~2x', type: 'english-only' },
            { name: 'large', size: '1550M params', vram: '~10GB', speed: '1x', type: 'multilingual' },
            { name: 'turbo', size: '809M params', vram: '~6GB', speed: '~8x', type: 'multilingual' }
        ]
    },

    // File handling settings
    files: {
        maxSize: 10 * 1024 * 1024 * 1024, // 10GB (increased from 25MB for local processing)
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
        translate: false,
        useInitialPrompt: true, // Whether to use initial prompt
        initialPrompt: '' // Initial prompt to guide transcription
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