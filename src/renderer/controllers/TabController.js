/**
 * Tab Controller
 * Manages tab navigation and state
 */

import { TABS, SELECTORS, CSS_CLASSES } from '../utils/Constants.js';
import { EventHandler } from '../utils/EventHandler.js';
import { UIHelpers } from '../utils/UIHelpers.js';

export class TabController {
    constructor(appState) {
        this.appState = appState;
        this.currentTab = TABS.UPLOAD;
        this.init();
    }

    init() {
        this.setupTabNavigation();
        this.setupEventListeners();
    }

    setupTabNavigation() {
        // Set initial tab state
        this.switchTab(this.currentTab);
    }

    setupEventListeners() {
        // Tab navigation clicks
        EventHandler.addListenerAll(SELECTORS.TAB_BUTTONS, 'click', (e) => {
            const tabName = e.target.dataset.tab;
            if (tabName) {
                this.switchTab(tabName);
            }
        });

        // Listen to app state changes
        this.appState.subscribe('tab', (data) => {
            if (data.tab !== this.currentTab) {
                this.currentTab = data.tab;
                this.updateTabUI(data.tab);
            }
        });
    }

    /**
     * Switch to a specific tab
     * @param {string} tabName - Name of the tab to switch to
     */
    async switchTab(tabName) {
        if (!Object.values(TABS).includes(tabName)) {
            console.warn(`Invalid tab name: ${tabName}`);
            return;
        }

        // Update UI immediately
        this.updateTabUI(tabName);
        
        // Update app state
        this.appState.setCurrentTab(tabName);
        this.currentTab = tabName;

        // Handle special tab-specific logic
        await this.handleTabSpecificLogic(tabName);
    }

    /**
     * Update tab UI elements
     * @param {string} tabName - Active tab name
     */
    updateTabUI(tabName) {
        // Update tab buttons
        UIHelpers.querySelectorAll('.tab-btn').forEach(btn => {
            UIHelpers.removeClass(btn, CSS_CLASSES.ACTIVE);
        });
        
        const activeButton = UIHelpers.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            UIHelpers.addClass(activeButton, CSS_CLASSES.ACTIVE);
        }

        // Update tab content
        UIHelpers.querySelectorAll('.tab-pane').forEach(pane => {
            UIHelpers.removeClass(pane, CSS_CLASSES.ACTIVE);
        });
        
        const activePane = UIHelpers.getElementById(`${tabName}-tab`);
        if (activePane) {
            UIHelpers.addClass(activePane, CSS_CLASSES.ACTIVE);
        }
    }

    /**
     * Handle tab-specific logic when switching tabs
     * @param {string} tabName - Tab name
     */
    async handleTabSpecificLogic(tabName) {
        switch (tabName) {
            case TABS.TRANSCRIPTION:
                await this.handleTranscriptionTabSwitch();
                break;
            case TABS.RECORD:
                this.handleRecordTabSwitch();
                break;
            case TABS.UPLOAD:
                this.handleUploadTabSwitch();
                break;
        }
    }

    /**
     * Handle logic when switching to transcription tab
     */
    async handleTranscriptionTabSwitch() {
        try {
            // Check if refinement controller is available
            if (window.app && window.app.refinementController) {
                const refinementController = window.app.refinementController;
                
                // Reload templates in case they were added in settings
                if (typeof window.app.loadTemplates === 'function') {
                    await window.app.loadTemplates();
                }
                
                // Initialize template selector if needed
                if (refinementController && 
                    typeof refinementController.updateTemplateSelector === 'function') {
                    
                    // Initialize if not already done
                    if (!refinementController.constructor.hasInitializedTemplateSelector) {
                        setTimeout(() => {
                            refinementController.updateTemplateSelector(false);
                        }, 500);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling transcription tab switch:', error);
        }
    }

    /**
     * Handle logic when switching to record tab
     */
    handleRecordTabSwitch() {
        // Update recording UI if needed
        const recordingState = this.appState.getRecordingState();
        if (recordingState.isRecording || recordingState.isPaused) {
            // Ensure recording controls are properly displayed
            this.updateRecordingStateUI();
        }
    }

    /**
     * Handle logic when switching to upload tab
     */
    handleUploadTabSwitch() {
        // Reset any upload-related UI state if needed
        const fileUploadState = this.appState.getFileUploadState();
        if (fileUploadState.isProcessing) {
            // Ensure upload progress is displayed
            this.updateUploadProgressUI();
        }
    }

    /**
     * Update recording state UI
     */
    updateRecordingStateUI() {
        // This could be moved to RecordingController later
        const recordingState = this.appState.getRecordingState();
        
        if (recordingState.isRecording) {
            UIHelpers.addClass('#record-tab', 'recording-active');
        } else {
            UIHelpers.removeClass('#record-tab', 'recording-active');
        }
    }

    /**
     * Update upload progress UI
     */
    updateUploadProgressUI() {
        // This could be moved to FileUploadController later
        const uploadState = this.appState.getFileUploadState();
        
        if (uploadState.isProcessing) {
            UIHelpers.addClass('#upload-tab', 'processing-active');
        } else {
            UIHelpers.removeClass('#upload-tab', 'processing-active');
        }
    }

    /**
     * Get current active tab
     * @returns {string} Current tab name
     */
    getCurrentTab() {
        return this.currentTab;
    }

    /**
     * Check if a specific tab is active
     * @param {string} tabName - Tab name to check
     * @returns {boolean} True if tab is active
     */
    isTabActive(tabName) {
        return this.currentTab === tabName;
    }

    /**
     * Get all available tabs
     * @returns {Object} Available tabs object
     */
    getAvailableTabs() {
        return TABS;
    }

    /**
     * Destroy the controller and clean up event listeners
     */
    destroy() {
        // Event listeners will be cleaned up automatically since we're using 
        // the centralized EventHandler which doesn't store references
        console.log('TabController destroyed');
    }
}