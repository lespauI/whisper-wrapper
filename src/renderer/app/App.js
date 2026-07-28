/**
 * Main Application Class
 * Coordinates all controllers and manages the application lifecycle
 */

import { AppState } from './AppState.js';
import { TabController } from '../controllers/TabController.js';
import { StatusController } from '../controllers/StatusController.js';
import { FileUploadController } from '../controllers/FileUploadController.js';
import { RecordingController } from '../controllers/RecordingController.js';
import { SettingsController } from '../controllers/SettingsController.js';
import { TranscriptionController } from '../controllers/TranscriptionController.js';
import { TemplateController } from '../controllers/TemplateController.js';

export class App {
    constructor() {
        this.state = new AppState();
        this.controllers = {};
        this.init();
    }

    async init() {
        try {
            // Initialize controllers in dependency order
            this.initializeControllers();
            
            // Setup application-level event listeners
            this.setupEventListeners();
            
            // Load initial settings and configuration
            await this.loadInitialConfiguration();
            
            // Check for any orphaned recordings from previous sessions
            await this.checkForOrphanedRecordings();
            
            // Initialize refinement controller if available
            await this.initializeRefinementController();
            
            // Mark app as ready
            this.controllers.status.updateStatus('Ready');
            
            console.log('✅ App initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing app:', error);
            if (this.controllers.status) {
                this.controllers.status.showError('Failed to initialize application');
            }
        }
    }

    initializeControllers() {
        // Initialize core controllers
        this.controllers.status = new StatusController(this.state);
        this.controllers.tab = new TabController(this.state);
        this.controllers.fileUpload = new FileUploadController(
            this.state, 
            this.controllers.status, 
            this.controllers.tab
        );

        try {
            this.controllers.recording = new RecordingController(
                this.state,
                this.controllers.status,
                this.controllers.tab
            );
        } catch (error) {
            console.error('Error initializing RecordingController (recording features will be unavailable):', error);
        }
        this.controllers.settings = new SettingsController(
            this.state, 
            this.controllers.status
        );

        this.controllers.transcription = new TranscriptionController(
            this.state, 
            this.controllers.status, 
            this.controllers.tab
        );
        this.controllers.template = new TemplateController(
            this.state, 
            this.controllers.status
        );

        // Make controllers globally accessible for backward compatibility
        window.app = this;
    }

    setupEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle uncaught errors
        window.addEventListener('error', (e) => {
            console.error('Uncaught error:', e.error);
            if (this.controllers.status) {
                this.controllers.status.showError('An unexpected error occurred');
            }
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            if (this.controllers.status) {
                this.controllers.status.showError('An unexpected error occurred');
            }
            e.preventDefault();
        });
    }

    handleKeyboardShortcuts(e) {
        // Global keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'o':
                    e.preventDefault();
                    if (this.controllers.fileUpload) {
                        this.controllers.fileUpload.selectFile();
                    }
                    break;
                case 's':
                    e.preventDefault();
                    // Trigger save - will be handled by transcription controller
                    if (this.controllers.transcription) {
                        this.controllers.transcription.saveTranscription();
                    }
                    break;
                case 'r':
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Stop recording
                        if (this.controllers.recording) {
                            this.controllers.recording.stopRecording();
                        }
                    } else {
                        // Start recording
                        if (this.controllers.recording) {
                            this.controllers.recording.startRecording();
                        }
                    }
                    break;
                case '1':
                    e.preventDefault();
                    this.controllers.tab.switchTab('upload');
                    break;
                case '2':
                    e.preventDefault();
                    this.controllers.tab.switchTab('record');
                    break;
                case '3':
                    e.preventDefault();
                    this.controllers.tab.switchTab('transcription');
                    break;
            }
        }

        // ESC key to close modals
        if (e.key === 'Escape') {
            // Close any open modals - will be handled by individual controllers
            this.closeAllModals();
        }
    }

    async loadInitialConfiguration() {
        try {
            // Load settings if settings controller is available
            if (this.controllers.settings) {
                await this.controllers.settings.loadSettings();
            }

            // Check Whisper status
            await this.checkWhisperStatus();

            // Load AI refinement settings
            await this.loadAIRefinementSettings();

            // Load templates
            await this.loadTemplates();

        } catch (error) {
            console.error('Error loading initial configuration:', error);
        }
    }

    async checkWhisperStatus() {
        try {
            if (!window.electronAPI || !window.electronAPI.testWhisper) {
                console.warn('Whisper API not available');
                return;
            }

            // This will be moved to a WhisperController later
            const testResult = await window.electronAPI.testWhisper();
            
            if (testResult.success) {
                console.log('✅ Whisper is ready');
            } else {
                console.warn('⚠️ Whisper not available:', testResult.message);
            }

        } catch (error) {
            console.error('Error checking Whisper status:', error);
        }
    }

    async loadAIRefinementSettings() {
        try {
            // This will be moved to AI/RefinementController later
            if (window.electronAPI && window.electronAPI.getAIRefinementSettings) {
                const settings = await window.electronAPI.getAIRefinementSettings();
                this.state.setAIRefinementState(settings);
            }
        } catch (error) {
            console.error('Error loading AI refinement settings:', error);
        }
    }

    async loadTemplates() {
        try {
            // This will be moved to TemplateController later
            if (window.electronAPI && window.electronAPI.getTemplates) {
                const templates = await window.electronAPI.getTemplates();
                this.state.setAIRefinementState({ templates });
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    async checkForOrphanedRecordings() {
        try {
            // This will be moved to RecordingController later
            if (!window.electronAPI || !window.electronAPI.findRecordingChunks) {
                return;
            }

            const allChunks = await window.electronAPI.findRecordingChunks('recording_');
            
            if (allChunks.length > 0) {
                console.log(`Found ${allChunks.length} orphaned recording chunks`);
                // Handle recovery in RecordingController
            }

        } catch (error) {
            console.error('Error checking for orphaned recordings:', error);
        }
    }

    async initializeRefinementController() {
        try {
            // Initialize refinement controller if available (legacy non-module script,
            // exposes itself on window.RefinementController)
            if (typeof window !== 'undefined' && window.RefinementController) {
                this.refinementController = new window.RefinementController(this);
                console.log('✅ Refinement controller initialized');
            } else {
                console.warn('⚠️ RefinementController not available');
            }
        } catch (error) {
            console.error('Error initializing refinement controller:', error);
        }
    }

    closeAllModals() {
        // Close all open modals
        const activeModals = this.state.getUIState().activeModals;
        activeModals.forEach(modalId => {
            this.state.closeModal(modalId);
        });
    }

    // Utility methods for backward compatibility with existing code

    updateStatus(message) {
        this.controllers.status.updateStatus(message);
    }

    showError(message) {
        this.controllers.status.showError(message);
    }

    switchTab(tabName) {
        this.controllers.tab.switchTab(tabName);
    }

    showTranscriptionResult(text, segments) {
        if (this.controllers.transcription) {
            this.controllers.transcription.showTranscriptionResult(text, segments);
        }
    }

    // Legacy bridge methods used by RefinementController (non-module legacy script)

    saveTranscriptionToHistory() {
        if (this.controllers.transcription) {
            this.controllers.transcription.saveTranscriptionToHistory();
        }
    }

    updateTranscriptionText(text) {
        const tc = this.controllers.transcription;
        if (!tc) return;
        tc.transcriptionState.currentText = text;
        tc.transcriptionState.isDirty = false;
        const textarea = document.getElementById('transcription-text');
        if (textarea) textarea.value = text;
        if (typeof tc.updateTranscriptionStatus === 'function') {
            tc.updateTranscriptionStatus();
        }
    }

    updateToggleButton() {
        if (this.controllers.transcription) {
            this.controllers.transcription.updateToggleButton();
        }
    }

    // Getters for controllers (for external access)

    // Shared AppState instance, exposed under the name the test suite and
    // legacy bridge code expect.
    get appState() {
        return this.state;
    }

    // Live, mutable reference (not a copy) — RefinementController both reads
    // and writes properties on this directly (e.g. `aiRefinementState.connected = true`).
    get aiRefinementState() {
        return this.state.aiRefinement;
    }

    // Delegates to TranscriptionController's own live state object rather than
    // AppState's copy, since TranscriptionController owns transcript rendering
    // and RefinementController reads/updates through this reference.
    get transcriptionState() {
        return this.controllers.transcription
            ? this.controllers.transcription.transcriptionState
            : this.state.getTranscriptionState();
    }
    get tabController() {
        return this.controllers.tab;
    }

    get statusController() {
        return this.controllers.status;
    }

    get fileUploadController() {
        return this.controllers.fileUpload;
    }

    get recordingController() {
        return this.controllers.recording;
    }

    get transcriptionController() {
        return this.controllers.transcription;
    }

    get settingsController() {
        return this.controllers.settings;
    }

    get templateController() {
        return this.controllers.template;
    }

    // Get application state
    getState() {
        return this.state;
    }

    // Cleanup method
    cleanup() {
        try {
            // Cleanup all controllers
            Object.values(this.controllers).forEach(controller => {
                if (controller && typeof controller.destroy === 'function') {
                    controller.destroy();
                }
            });

            // Cleanup refinement controller
            if (this.refinementController && typeof this.refinementController.destroy === 'function') {
                this.refinementController.destroy();
            }

            console.log('✅ App cleanup completed');

        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    // Debug method
    debug() {
        return {
            state: this.state.getFullState(),
            controllers: Object.keys(this.controllers),
            hasRefinementController: !!this.refinementController
        };
    }
}