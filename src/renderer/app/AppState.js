/**
 * Application State Management
 * Centralized state management for the Whisper Wrapper application
 */

import { TABS, RECORDING_SETTINGS, AI_REFINEMENT, TRANSCRIPTION_VIEW_MODES } from '../utils/Constants.js';

export class AppState {
    constructor() {
        this.initialize();
    }

    initialize() {
        // Current active tab
        this.currentTab = TABS.UPLOAD;

        // Recording state
        this.recording = {
            isRecording: false,
            isPaused: false,
            startTime: null,
            timer: null,
            mediaRecorder: null,
            audioChunks: [],
            audioContext: null,
            analyser: null,
            microphone: null,
            dataArray: null,
            animationId: null,
            blob: null,
            settings: {
                quality: RECORDING_SETTINGS.DEFAULT_QUALITY,
                format: RECORDING_SETTINGS.DEFAULT_FORMAT,
                autoTranscribe: RECORDING_SETTINGS.DEFAULT_AUTO_TRANSCRIBE,
                autoSaveInterval: RECORDING_SETTINGS.AUTO_SAVE_INTERVAL,
                enableAutoSave: RECORDING_SETTINGS.DEFAULT_ENABLE_AUTO_SAVE
            }
        };

        // Auto-save recording state
        this.recordingAutoSave = {
            sessionId: null,
            chunkIndex: 0,
            savedChunks: [],
            autoSaveTimer: null,
            tempDirectory: null
        };

        // Transcription editing state
        this.transcription = {
            originalText: '',
            currentText: '',
            isDirty: false,
            lastSaved: null,
            autoSaveTimer: null,
            history: [],
            historyIndex: -1,
            segments: [], // Store original segments with timestamps
            viewMode: TRANSCRIPTION_VIEW_MODES.TIMESTAMPED
        };

        // AI Refinement state
        this.aiRefinement = {
            enabled: AI_REFINEMENT.DEFAULT_ENABLED,
            connected: false,
            ollamaEndpoint: AI_REFINEMENT.DEFAULT_ENDPOINT,
            ollamaModel: '',
            availableModels: [],
            timeout: AI_REFINEMENT.DEFAULT_TIMEOUT,
            templates: [],
            currentTemplateId: null,
            templateBeingEdited: null,
            isTemplateModalOpen: false
        };

        // File upload state
        this.fileUpload = {
            currentFile: null,
            isProcessing: false,
            progress: 0
        };

        // Settings state
        this.settings = {
            isOpen: false,
            model: 'medium',
            language: '',
            translate: false,
            threads: 4,
            useInitialPrompt: true,
            initialPrompt: '',
            apiKey: ''
        };

        // Status state
        this.status = {
            message: 'Ready',
            isLoading: false,
            error: null
        };

        // UI state
        this.ui = {
            activeModals: new Set(),
            dragOver: false
        };

        // Event listeners registry
        this.eventListeners = new Map();
    }

    // Tab management
    getCurrentTab() {
        return this.currentTab;
    }

    setCurrentTab(tab) {
        if (Object.values(TABS).includes(tab)) {
            this.currentTab = tab;
            this.notifyStateChange('tab', { tab });
        }
    }

    // Recording state management
    getRecordingState() {
        return { ...this.recording };
    }

    setRecordingState(updates) {
        this.recording = { ...this.recording, ...updates };
        this.notifyStateChange('recording', updates);
    }

    updateRecordingSettings(settings) {
        this.recording.settings = { ...this.recording.settings, ...settings };
        this.notifyStateChange('recordingSettings', settings);
    }

    // Transcription state management
    getTranscriptionState() {
        return { ...this.transcription };
    }

    setTranscriptionState(updates) {
        this.transcription = { ...this.transcription, ...updates };
        this.notifyStateChange('transcription', updates);
    }

    updateTranscriptionText(text) {
        this.transcription.currentText = text;
        this.transcription.isDirty = text !== this.transcription.originalText;
        this.notifyStateChange('transcriptionText', { text, isDirty: this.transcription.isDirty });
    }

    addToTranscriptionHistory(text) {
        // Remove any future history if we're not at the end
        if (this.transcription.historyIndex < this.transcription.history.length - 1) {
            this.transcription.history = this.transcription.history.slice(0, this.transcription.historyIndex + 1);
        }

        // Add new state
        this.transcription.history.push(text);
        this.transcription.historyIndex = this.transcription.history.length - 1;

        // Limit history size to 50
        if (this.transcription.history.length > 50) {
            this.transcription.history.shift();
            this.transcription.historyIndex--;
        }

        this.notifyStateChange('transcriptionHistory', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    canUndo() {
        return this.transcription.historyIndex > 0;
    }

    canRedo() {
        return this.transcription.historyIndex < this.transcription.history.length - 1;
    }

    undo() {
        if (this.canUndo()) {
            this.transcription.historyIndex--;
            const text = this.transcription.history[this.transcription.historyIndex];
            this.transcription.currentText = text;
            this.transcription.isDirty = text !== this.transcription.originalText;
            this.notifyStateChange('transcriptionUndo', { 
                text, 
                isDirty: this.transcription.isDirty,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
            return text;
        }
        return null;
    }

    redo() {
        if (this.canRedo()) {
            this.transcription.historyIndex++;
            const text = this.transcription.history[this.transcription.historyIndex];
            this.transcription.currentText = text;
            this.transcription.isDirty = text !== this.transcription.originalText;
            this.notifyStateChange('transcriptionRedo', { 
                text, 
                isDirty: this.transcription.isDirty,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
            return text;
        }
        return null;
    }

    // AI Refinement state management
    getAIRefinementState() {
        return { ...this.aiRefinement };
    }

    setAIRefinementState(updates) {
        this.aiRefinement = { ...this.aiRefinement, ...updates };
        this.notifyStateChange('aiRefinement', updates);
    }

    // Settings state management
    getSettings() {
        return { ...this.settings };
    }

    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.notifyStateChange('settings', updates);
    }

    // Status management
    getStatus() {
        return { ...this.status };
    }

    setStatus(message, isLoading = false, error = null) {
        this.status = { message, isLoading, error };
        this.notifyStateChange('status', this.status);
    }

    // File upload state management
    getFileUploadState() {
        return { ...this.fileUpload };
    }

    setFileUploadState(updates) {
        this.fileUpload = { ...this.fileUpload, ...updates };
        this.notifyStateChange('fileUpload', updates);
    }

    // UI state management
    getUIState() {
        return { ...this.ui };
    }

    setUIState(updates) {
        this.ui = { ...this.ui, ...updates };
        this.notifyStateChange('ui', updates);
    }

    openModal(modalId) {
        this.ui.activeModals.add(modalId);
        this.notifyStateChange('modal', { modalId, isOpen: true });
    }

    closeModal(modalId) {
        this.ui.activeModals.delete(modalId);
        this.notifyStateChange('modal', { modalId, isOpen: false });
    }

    isModalOpen(modalId) {
        return this.ui.activeModals.has(modalId);
    }

    // Event system for state changes
    subscribe(eventType, callback) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        this.eventListeners.get(eventType).add(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(eventType);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }

    notifyStateChange(eventType, data) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in state change listener for ${eventType}:`, error);
                }
            });
        }
    }

    // Reset methods
    resetRecordingState() {
        this.recording = {
            isRecording: false,
            isPaused: false,
            startTime: null,
            timer: null,
            mediaRecorder: null,
            audioChunks: [],
            audioContext: null,
            analyser: null,
            microphone: null,
            dataArray: null,
            animationId: null,
            blob: null,
            settings: { ...this.recording.settings }
        };
        this.notifyStateChange('recording', this.recording);
    }

    resetTranscriptionState() {
        this.transcription = {
            originalText: '',
            currentText: '',
            isDirty: false,
            lastSaved: null,
            autoSaveTimer: null,
            history: [],
            historyIndex: -1,
            segments: [],
            viewMode: TRANSCRIPTION_VIEW_MODES.TIMESTAMPED
        };
        this.notifyStateChange('transcription', this.transcription);
    }

    // Debug method
    getFullState() {
        return {
            currentTab: this.currentTab,
            recording: { ...this.recording },
            recordingAutoSave: { ...this.recordingAutoSave },
            transcription: { ...this.transcription },
            aiRefinement: { ...this.aiRefinement },
            fileUpload: { ...this.fileUpload },
            settings: { ...this.settings },
            status: { ...this.status },
            ui: { ...this.ui }
        };
    }
}