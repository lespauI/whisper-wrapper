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
            translate: false
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
    }
};

module.exports = config;