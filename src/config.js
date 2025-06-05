/**
 * Configuration settings for the application
 */

const path = require('path');
const os = require('os');

// Default configuration
const config = {
    // Whisper settings
    whisper: {
        defaultModel: 'base',
        defaultLanguage: 'auto',
        defaultThreads: 4,
        modelsDirectory: path.join(process.cwd(), 'models'),
        tempDirectory: path.join(os.tmpdir(), 'whisper-wrapper'),
        useInitialPrompt: true,  // Default to using initial prompt if provided
        initialPrompt: '',       // Default empty initial prompt
    },
    
    // Application settings
    app: {
        dataDirectory: path.join(process.cwd(), 'data'),
        maxRecordingLength: 3600, // 1 hour in seconds
        autoSaveInterval: 5000,   // 5 seconds
    },

    // Get simplified configuration for the UI
    getSimplified() {
        return {
            model: this.whisper.defaultModel,
            language: this.whisper.defaultLanguage,
            threads: this.whisper.defaultThreads,
            translate: false,
            useInitialPrompt: this.whisper.useInitialPrompt !== undefined ? this.whisper.useInitialPrompt : true,
            initialPrompt: this.whisper.initialPrompt || ''
        };
    },

    // Set simplified configuration from the UI
    setSimplified(newConfig) {
        if (newConfig.model) {
            this.whisper.defaultModel = newConfig.model;
        }
        if (newConfig.language) {
            this.whisper.defaultLanguage = newConfig.language;
        }
        if (newConfig.threads) {
            this.whisper.defaultThreads = newConfig.threads;
        }
        if (newConfig.useInitialPrompt !== undefined) {
            this.whisper.useInitialPrompt = newConfig.useInitialPrompt;
            console.log(`🔄 Config: Initial prompt ${newConfig.useInitialPrompt ? 'ENABLED' : 'DISABLED'}`);
        }
        if (newConfig.initialPrompt !== undefined) {
            this.whisper.initialPrompt = newConfig.initialPrompt;
        }
    }
};

module.exports = config;