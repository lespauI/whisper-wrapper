/**
 * Main Entry Point for Whisper Wrapper Renderer Process
 * Initializes the application with modular architecture
 */

// Import CSS
import './styles/main.css';

// Import the main application class
import { WhisperWrapperApp } from './app/App.js';

// Import existing refinement controller for backward compatibility
// Note: This should be loaded before app initialization
// The script is currently loaded via HTML script tag

// Global app instance
let app = null;

/**
 * Initialize the application
 */
function initializeApp() {
    try {
        app = new WhisperWrapperApp();
        
        // Make app globally available for debugging and legacy code
        window.whisperApp = app;
        
        console.log('Whisper Wrapper application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Whisper Wrapper application:', error);
        // Show error to user
        alert('Failed to initialize application. Please refresh the page.');
    }
}

/**
 * Handle application cleanup on page unload
 */
function cleanupApp() {
    if (app && typeof app.destroy === 'function') {
        app.destroy();
        app = null;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded
    initializeApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupApp);

// Global keyboard shortcuts (temporary - will be moved to appropriate controller)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
        case 'o':
            e.preventDefault();
            // Trigger file open
            if (app && app.selectFile) {
                app.selectFile();
            }
            break;
        case 's':
            e.preventDefault();
            // Trigger save
            // TODO: Implement save functionality
            break;
        case 'r':
            e.preventDefault();
            if (e.shiftKey) {
                // Stop recording
                // TODO: Implement stop recording
            } else {
                // Start recording
                // TODO: Implement start recording
            }
            break;
        }
    }
});

// Export for potential external use
export { app, initializeApp, cleanupApp };