/**
 * Configuration manager for Whisper Wrapper
 */

const defaultConfig = require('./default');
const Store = require('electron-store');

class ConfigManager {
    constructor() {
        this.store = new Store({
            name: 'whisper-wrapper-config',
            defaults: defaultConfig
        });
    }

    /**
     * Get configuration value
     * @param {string} key - Configuration key (supports dot notation)
     * @param {*} defaultValue - Default value if key not found
     * @returns {*} - Configuration value
     */
    get(key, defaultValue = null) {
        return this.store.get(key, defaultValue);
    }

    /**
     * Set configuration value
     * @param {string} key - Configuration key (supports dot notation)
     * @param {*} value - Value to set
     */
    set(key, value) {
        this.store.set(key, value);
    }

    /**
     * Get all configuration
     * @returns {Object} - Complete configuration object
     */
    getAll() {
        return this.store.store;
    }

    /**
     * Get simplified configuration for renderer
     * @returns {Object} - Simplified configuration
     */
    getSimplified() {
        return {
            model: this.get('transcription.model', 'base'),
            language: this.get('transcription.language', 'auto'),
            threads: this.get('transcription.threads', 4),
            translate: this.get('transcription.translate', false),
            useInitialPrompt: this.get('transcription.useInitialPrompt', true),
            initialPrompt: this.get('transcription.initialPrompt', '')
        };
    }

    /**
     * Set simplified configuration from renderer
     * @param {Object} config - Simplified configuration
     */
    setSimplified(config) {
        if (config.model !== undefined) {
            this.set('transcription.model', config.model);
        }
        if (config.language !== undefined) {
            this.set('transcription.language', config.language);
        }
        if (config.threads !== undefined) {
            this.set('transcription.threads', config.threads);
        }
        if (config.translate !== undefined) {
            this.set('transcription.translate', config.translate);
        }
        if (config.useInitialPrompt !== undefined) {
            this.set('transcription.useInitialPrompt', config.useInitialPrompt);
        }
        if (config.initialPrompt !== undefined) {
            this.set('transcription.initialPrompt', config.initialPrompt);
        }
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.store.clear();
    }

    /**
     * Check if configuration key exists
     * @param {string} key - Configuration key
     * @returns {boolean} - Existence status
     */
    has(key) {
        return this.store.has(key);
    }

    /**
     * Delete configuration key
     * @param {string} key - Configuration key
     */
    delete(key) {
        this.store.delete(key);
    }

    /**
     * Get OpenAI API configuration
     * @returns {Object} - OpenAI configuration
     */
    getOpenAIConfig() {
        return {
            apiKey: this.get('openai.apiKey'),
            model: this.get('openai.model'),
            baseURL: this.get('openai.baseURL'),
            timeout: this.get('openai.timeout'),
            maxRetries: this.get('openai.maxRetries')
        };
    }

    /**
     * Set OpenAI API key
     * @param {string} apiKey - API key
     */
    setOpenAIApiKey(apiKey) {
        this.set('openai.apiKey', apiKey);
    }

    /**
     * Get recording configuration
     * @returns {Object} - Recording configuration
     */
    getRecordingConfig() {
        return {
            sampleRate: this.get('recording.sampleRate'),
            channels: this.get('recording.channels'),
            bitDepth: this.get('recording.bitDepth'),
            format: this.get('recording.format'),
            maxDuration: this.get('recording.maxDuration'),
            autoSave: this.get('recording.autoSave')
        };
    }

    /**
     * Get transcription configuration
     * @returns {Object} - Transcription configuration
     */
    getTranscriptionConfig() {
        return {
            language: this.get('transcription.language'),
            prompt: this.get('transcription.prompt'),
            temperature: this.get('transcription.temperature'),
            responseFormat: this.get('transcription.responseFormat')
        };
    }

    /**
     * Get export configuration
     * @returns {Object} - Export configuration
     */
    getExportConfig() {
        return {
            defaultFormat: this.get('export.defaultFormat'),
            includeMetadata: this.get('export.includeMetadata'),
            timestampFormat: this.get('export.timestampFormat'),
            filenameTemplate: this.get('export.filenameTemplate')
        };
    }

    /**
     * Get window configuration
     * @returns {Object} - Window configuration
     */
    getWindowConfig() {
        return {
            width: this.get('window.width'),
            height: this.get('window.height'),
            minWidth: this.get('window.minWidth'),
            minHeight: this.get('window.minHeight'),
            resizable: this.get('window.resizable'),
            center: this.get('window.center')
        };
    }

    /**
     * Update window bounds
     * @param {Object} bounds - Window bounds
     */
    updateWindowBounds(bounds) {
        this.set('window.x', bounds.x);
        this.set('window.y', bounds.y);
        this.set('window.width', bounds.width);
        this.set('window.height', bounds.height);
    }

    /**
     * Get file handling configuration
     * @returns {Object} - File configuration
     */
    getFileConfig() {
        return {
            maxSize: this.get('files.maxSize'),
            supportedAudioFormats: this.get('files.supportedAudioFormats'),
            supportedVideoFormats: this.get('files.supportedVideoFormats'),
            tempDirectory: this.get('files.tempDirectory'),
            cleanupOnExit: this.get('files.cleanupOnExit')
        };
    }

    /**
     * Validate configuration
     * @returns {Object} - Validation result
     */
    validate() {
        const errors = [];
        const warnings = [];

        // Check required settings
        if (!this.get('openai.apiKey')) {
            warnings.push('OpenAI API key not configured');
        }

        // Validate window settings
        const windowConfig = this.getWindowConfig();
        if (windowConfig.width < windowConfig.minWidth) {
            errors.push('Window width cannot be less than minimum width');
        }
        if (windowConfig.height < windowConfig.minHeight) {
            errors.push('Window height cannot be less than minimum height');
        }

        // Validate recording settings
        const recordingConfig = this.getRecordingConfig();
        if (recordingConfig.sampleRate < 8000 || recordingConfig.sampleRate > 48000) {
            warnings.push('Sample rate should be between 8000 and 48000 Hz');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}

module.exports = new ConfigManager();