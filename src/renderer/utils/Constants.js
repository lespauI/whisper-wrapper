/**
 * Application Constants
 * Centralized location for all application constants
 */

// Tab names
export const TABS = {
    UPLOAD: 'upload',
    RECORD: 'record',
    TRANSCRIPTION: 'transcription'
};

// Recording settings
export const RECORDING_SETTINGS = {
    DEFAULT_QUALITY: 'medium',
    DEFAULT_FORMAT: 'wav',
    DEFAULT_AUTO_TRANSCRIBE: true,
    AUTO_SAVE_INTERVAL: 60000, // 1 minute
    DEFAULT_ENABLE_AUTO_SAVE: true
};

// AI Refinement settings
export const AI_REFINEMENT = {
    DEFAULT_ENDPOINT: 'http://localhost:11434',
    DEFAULT_TIMEOUT: 30,
    DEFAULT_ENABLED: false
};

// Transcription view modes
export const TRANSCRIPTION_VIEW_MODES = {
    TIMESTAMPED: 'timestamped',
    PLAIN: 'plain'
};

// Status messages
export const STATUS_MESSAGES = {
    READY: 'Ready',
    PROCESSING: 'Processing...',
    RECORDING: 'Recording...',
    TRANSCRIBING: 'Transcribing...',
    ERROR: 'Error'
};

// Recording states
export const RECORDING_STATES = {
    IDLE: 'idle',
    RECORDING: 'recording',
    PAUSED: 'paused',
    STOPPED: 'stopped'
};

// Supported file formats
export const SUPPORTED_FORMATS = {
    AUDIO: ['.mp3', '.wav', '.m4a', '.flac', '.ogg'],
    VIDEO: ['.mp4', '.mov', '.avi', '.mkv', '.webm']
};

// UI element selectors (commonly used)
export const SELECTORS = {
    // Tabs
    TAB_BUTTONS: '.tab-btn',
    
    // Settings
    SETTINGS_BTN: '#settings-btn',
    SAVE_SETTINGS_BTN: '#save-settings-btn',
    CLOSE_SETTINGS_BTN: '#close-settings-btn',
    CANCEL_SETTINGS_BTN: '#cancel-settings-btn',
    SETTINGS_HEADER: '#settings-header',
    
    // File upload
    FILE_UPLOAD: '#file-upload',
    BROWSE_BTN: '#browse-btn',
    
    // Recording
    START_RECORD_BTN: '#start-record-btn',
    PAUSE_RECORD_BTN: '#pause-record-btn',
    RESUME_RECORD_BTN: '#resume-record-btn',
    STOP_RECORD_BTN: '#stop-record-btn',
    SAVE_RECORD_BTN: '#save-record-btn',
    TRANSCRIBE_RECORD_BTN: '#transcribe-record-btn',
    CLEAR_RECORD_BTN: '#clear-record-btn',
    QUALITY_SELECT: '#quality-select',
    FORMAT_SELECT: '#format-select',
    AUTO_TRANSCRIBE: '#auto-transcribe',
    AUDIO_VISUALIZER: '#audio-visualizer',
    AUDIO_LEVEL_BAR: '#audio-level-bar',
    AUDIO_LEVEL_TEXT: '#audio-level-text',
    RECORD_INDICATOR: '#record-indicator',
    RECORD_STATUS_TEXT: '#record-status-text',
    RECORD_TIME: '#record-time',
    RECORD_SIZE: '#record-size',
    RECORDING_INFO: '#recording-info',
    
    // Status
    STATUS_TEXT: '#status-text',
    
    // AI Refinement
    AI_REFINEMENT_ENABLED_CHECKBOX: '#ai-refinement-enabled-checkbox',
    OLLAMA_ENDPOINT: '#ollama-endpoint',
    OLLAMA_MODEL_SELECT: '#ollama-model-select',
    OLLAMA_TIMEOUT: '#ollama-timeout',
    TEST_OLLAMA_BTN: '#test-ollama-btn',
    REFRESH_MODELS_BTN: '#refresh-models-btn'
};

// CSS classes
export const CSS_CLASSES = {
    ACTIVE: 'active',
    HIDDEN: 'hidden',
    DRAGOVER: 'dragover',
    RECORDING: 'recording',
    PAUSED: 'paused'
};

// Event types
export const EVENTS = {
    CLICK: 'click',
    CHANGE: 'change',
    DRAGOVER: 'dragover',
    DRAGLEAVE: 'dragleave',
    DROP: 'drop',
    KEYDOWN: 'keydown',
    INPUT: 'input'
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
    CTRL_Z: { ctrl: true, key: 'z' },    // Undo
    CTRL_Y: { ctrl: true, key: 'y' },    // Redo
    CTRL_S: { ctrl: true, key: 's' },    // Save
    CTRL_F: { ctrl: true, key: 'f' },    // Find
    ESC: { key: 'Escape' }               // Close modals
};